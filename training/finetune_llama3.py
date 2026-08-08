"""
finetune_llama3.py
------------------
Fine-tunes Llama 3.1 8B on HisabKitab billing tasks using QLoRA + unsloth.

Run this on a GPU machine (Vast.ai / RunPod / Colab):
  pip install unsloth trl transformers datasets peft bitsandbytes
  python finetune_llama3.py

What this script does:
  1. Loads Llama 3.1 8B in 4-bit quantization (fits in 10GB VRAM)
  2. Applies LoRA adapters (trains ~0.5% of parameters — fast + cheap)
  3. Loads all *.jsonl files from ../data/
  4. Formats into Alpaca-style instruction tuning format
  5. Trains for 3 epochs
  6. Saves the merged model to ./hisabkitab-model/
  7. Optionally converts to GGUF for Ollama

Requirements:
  - GPU with 10GB+ VRAM (RTX 3090 / A100 / T4 on Colab)
  - Python 3.10+
  - ~30GB disk space for model weights

Estimated cost on Vast.ai RTX 3090: ~$2-5 total
Estimated training time: 2-4 hours for 1500 examples
"""

import json
import os
from pathlib import Path
from datasets import Dataset

# ── 1. Install check ─────────────────────────────────────────────────────────
try:
    from unsloth import FastLanguageModel
    import torch
    from trl import SFTTrainer
    from transformers import TrainingArguments
    print("✓ unsloth + trl ready")
except ImportError:
    print("ERROR: Missing packages. Run:")
    print("  pip install unsloth trl transformers datasets peft bitsandbytes")
    raise SystemExit(1)

# ── 2. Config ─────────────────────────────────────────────────────────────────
MODEL_NAME   = "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit"  # 4-bit quantized
OUTPUT_DIR   = Path("./hisabkitab-model")
DATA_DIR     = Path(__file__).parent / "data"
MAX_SEQ_LEN  = 2048
BATCH_SIZE   = 2       # safe for 10GB VRAM; increase to 4 on A100
GRAD_ACCUM   = 4       # effective batch = BATCH_SIZE * GRAD_ACCUM = 8
EPOCHS       = 3
LEARNING_RATE= 2e-4
LORA_RANK    = 16      # 16 is a good balance for this task size

# ── 3. Load model + tokenizer ─────────────────────────────────────────────────
print(f"\nLoading {MODEL_NAME}…")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name      = MODEL_NAME,
    max_seq_length  = MAX_SEQ_LEN,
    dtype           = None,    # auto-detect float16 / bfloat16
    load_in_4bit    = True,
)

# Apply LoRA — only trains a small fraction of parameters
model = FastLanguageModel.get_peft_model(
    model,
    r                   = LORA_RANK,
    target_modules      = ["q_proj", "k_proj", "v_proj", "o_proj",
                           "gate_proj", "up_proj", "down_proj"],
    lora_alpha          = 16,
    lora_dropout        = 0,
    bias                = "none",
    use_gradient_checkpointing = "unsloth",
    random_state        = 42,
)

print(f"✓ Model loaded. Trainable params: {sum(p.numel() for p in model.parameters() if p.requires_grad):,}")

# ── 4. Load training data ─────────────────────────────────────────────────────
print(f"\nLoading data from {DATA_DIR}…")
all_examples: list[dict] = []
for jsonl_file in sorted(DATA_DIR.glob("*.jsonl")):
    count = 0
    with open(jsonl_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                all_examples.append(json.loads(line))
                count += 1
            except json.JSONDecodeError:
                pass
    print(f"  {jsonl_file.name}: {count} examples")

print(f"  TOTAL: {len(all_examples)} examples")

if len(all_examples) < 50:
    print("ERROR: Not enough training data. Run data-gen scripts first.")
    raise SystemExit(1)

# ── 5. Format into Alpaca prompt ──────────────────────────────────────────────
ALPACA_TEMPLATE = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Input:
{input}

### Response:
{output}"""

def format_example(example: dict) -> dict:
    text = ALPACA_TEMPLATE.format(
        instruction = example.get("instruction", ""),
        input       = example.get("input", ""),
        output      = example.get("output", ""),
    ) + tokenizer.eos_token
    return {"text": text}

dataset = Dataset.from_list([format_example(e) for e in all_examples])
dataset = dataset.shuffle(seed=42)

# 90/10 train/eval split
split    = dataset.train_test_split(test_size=0.1, seed=42)
train_ds = split["train"]
eval_ds  = split["test"]
print(f"\n✓ Train: {len(train_ds)} | Eval: {len(eval_ds)}")

# ── 6. Training ───────────────────────────────────────────────────────────────
print("\nStarting training…")
trainer = SFTTrainer(
    model           = model,
    tokenizer       = tokenizer,
    train_dataset   = train_ds,
    eval_dataset    = eval_ds,
    dataset_text_field = "text",
    max_seq_length  = MAX_SEQ_LEN,
    dataset_num_proc = 2,
    args = TrainingArguments(
        per_device_train_batch_size = BATCH_SIZE,
        gradient_accumulation_steps = GRAD_ACCUM,
        warmup_steps                = 20,
        num_train_epochs            = EPOCHS,
        learning_rate               = LEARNING_RATE,
        fp16                        = not torch.cuda.is_bf16_supported(),
        bf16                        = torch.cuda.is_bf16_supported(),
        logging_steps               = 10,
        evaluation_strategy         = "steps",
        eval_steps                  = 50,
        save_strategy               = "steps",
        save_steps                  = 100,
        optim                       = "adamw_8bit",
        weight_decay                = 0.01,
        lr_scheduler_type           = "cosine",
        seed                        = 42,
        output_dir                  = str(OUTPUT_DIR / "checkpoints"),
        report_to                   = "none",  # set to "wandb" if you have W&B
    ),
)

trainer_stats = trainer.train()
print(f"\n✓ Training complete in {trainer_stats.metrics['train_runtime']:.0f}s")

# ── 7. Save merged model ──────────────────────────────────────────────────────
print(f"\nSaving merged model to {OUTPUT_DIR}…")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
model.save_pretrained_merged(
    str(OUTPUT_DIR / "merged"),
    tokenizer,
    save_method = "merged_16bit",
)
print(f"✓ Saved to {OUTPUT_DIR / 'merged'}")

# ── 8. (Optional) Export to GGUF for Ollama ──────────────────────────────────
EXPORT_GGUF = os.environ.get("EXPORT_GGUF", "0") == "1"
if EXPORT_GGUF:
    print("\nExporting to GGUF (Q4_K_M quantization) for Ollama…")
    model.save_pretrained_gguf(
        str(OUTPUT_DIR / "gguf"),
        tokenizer,
        quantization_method = "q4_k_m",
    )
    print(f"✓ GGUF saved to {OUTPUT_DIR / 'gguf'}")
    print("\nTo load in Ollama:")
    print(f"  ollama create hisabkitab -f {OUTPUT_DIR / 'gguf' / 'Modelfile'}")

print("\n" + "="*60)
print("DONE. Next steps:")
print("  1. Copy the model to your server")
print("  2. Load with Ollama or vLLM")
print("  3. Set AI_PROVIDER=custom_http in HisabKitab .env")
print("="*60)
