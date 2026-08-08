# HisabKitab — Fine-Tuning Your Own AI Model

This directory contains everything needed to build and deploy your own
fine-tuned billing AI model, replacing any external provider (Claude, GPT-4, etc.)

---

## Architecture

```
HisabKitab API  ──►  services/ai-service  ──►  Your fine-tuned model (Ollama / vLLM)
  (apps/api)          (Express wrapper)          (Llama 3.1 8B + your data)
```

---

## Step-by-Step Guide

### Step 1 — Generate Training Data

You need ~1500 examples across 4 tasks. We generate them using Claude Haiku
(cheap — expect ~$1-2 total for all data).

```bash
cd training/data-gen
pip install -r requirements.txt

export GEMINI_API_KEY=AIza...   # free at aistudio.google.com — only needed for data generation

# Run all 4 generators at once:
python generate_all.py

# Or individually:
python generate_hsn.py                 # ~100 HSN suggestion examples
python generate_invoice_extraction.py  # ~60 voice invoice examples
python generate_payment_reminders.py   # ~1440 reminder examples (all lang×tone combos)
python generate_dashboard_insights.py  # ~300 dashboard insight examples
```

Output files in `training/data/`:
- `hsn_examples.jsonl`
- `invoice_extraction_examples.jsonl`
- `payment_reminder_examples.jsonl`
- `dashboard_insight_examples.jsonl`

**After generation, review 20-30 examples from each file manually.**
Delete any that look wrong before training.

---

### Step 2 — Rent a GPU (if you don't have one)

Recommended: **Vast.ai** (cheapest) or **RunPod**

1. Go to [vast.ai](https://vast.ai) → Create account
2. Search for: `RTX 3090`, `24GB VRAM`, `~$0.30/hr`
3. Choose a machine with PyTorch pre-installed
4. Upload your `training/` folder to the machine
5. SSH in and continue

Alternatively: **Google Colab Pro** ($10/month, has A100 40GB)

---

### Step 3 — Train the Model

On the GPU machine:

```bash
# Install dependencies
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
pip install trl transformers datasets peft bitsandbytes accelerate

# Run training
cd training
python finetune_llama3.py
```

Training takes **2-4 hours** on RTX 3090, **45 min** on A100.

The script:
- Loads Llama 3.1 8B (4-bit quantized, fits in 10GB VRAM)
- Applies QLoRA (only trains 0.5% of parameters — fast)
- Trains for 3 epochs on your ~1500 examples
- Saves merged model to `./hisabkitab-model/merged/`

To also export as GGUF (for Ollama):
```bash
EXPORT_GGUF=1 python finetune_llama3.py
```

---

### Step 4 — Load Into Ollama

After training, copy the model to your server and load it:

**Option A: GGUF (if you exported it)**
```bash
# Create an Ollama Modelfile
cat > Modelfile << 'EOF'
FROM ./hisabkitab-model/gguf/model.gguf
SYSTEM "You are HisabKitab AI, a billing assistant for Indian small businesses."
EOF

ollama create hisabkitab -f Modelfile
ollama run hisabkitab "Test: suggest HSN for Tata Salt 1kg"
```

**Option B: Load merged weights directly (slower)**
```bash
# Use llama.cpp to convert and quantize
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp && make
python convert_hf_to_gguf.py ../hisabkitab-model/merged --outtype q4_k_m
```

---

### Step 5 — Start the AI Service

```bash
cd services/ai-service
cp .env.example .env

# Edit .env:
#   SERVICE_API_KEY=your-random-secret
#   MODEL_BACKEND=ollama
#   OLLAMA_CHAT_MODEL=hisabkitab

npm install
npm run dev    # development
npm start      # production (after npm run build)
```

Test it:
```bash
curl -X POST http://localhost:8080/ai/chat \
  -H "Authorization: Bearer your-random-secret" \
  -H "Content-Type: application/json" \
  -d '{"system":"You are a GST expert.","prompt":"HSN code for Tata Salt?","max_tokens":200,"quality":"fast"}'
```

---

### Step 6 — Wire Into HisabKitab

Edit `apps/api/.env`:
```env
AI_PROVIDER=custom_http
CUSTOM_AI_BASE_URL=http://localhost:8080
CUSTOM_AI_API_KEY=your-random-secret   # must match SERVICE_API_KEY above
```

Restart the API — all AI calls now go through your model.

---

## Production Deployment

### Docker (recommended)
```bash
cd services/ai-service
docker build -t hisabkitab-ai .
docker run -d \
  -p 8080:8080 \
  -e SERVICE_API_KEY=your-secret \
  -e MODEL_BACKEND=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_CHAT_MODEL=hisabkitab \
  hisabkitab-ai
```

### vLLM (for high traffic)
```bash
# Install vLLM on GPU server
pip install vllm

# Serve merged model
python -m vllm.entrypoints.openai.api_server \
  --model ./hisabkitab-model/merged \
  --port 8000 \
  --max-model-len 4096

# Update services/ai-service/.env:
#   MODEL_BACKEND=vllm
#   VLLM_BASE_URL=http://localhost:8000
#   VLLM_MODEL=hisabkitab-model/merged
```

---

## Re-training (Improving the Model)

As your platform grows:
1. Export real conversations from HisabKitab (anonymized)
2. Add them to the `.jsonl` files in `training/data/`
3. Re-run `finetune_llama3.py` — it continues from the existing examples
4. Each re-training cycle improves domain accuracy

---

## Cost Summary

| Step | Tool | Cost |
|------|------|------|
| Data generation | Claude Haiku | ~$1-2 |
| GPU training (3h) | Vast.ai RTX 3090 | ~$1-3 |
| Serving (Ollama) | Your own server | $0 |
| Serving (vLLM) | VPS with GPU | ~$50-200/mo |
| **Total to get started** | | **~$5** |

---

## File Structure

```
training/
  data-gen/
    generate_all.py                  ← run this to generate all data
    generate_hsn.py                  ← HSN code suggestion examples
    generate_invoice_extraction.py   ← voice invoice parsing examples
    generate_payment_reminders.py    ← WhatsApp reminder examples
    generate_dashboard_insights.py   ← daily summary examples
    requirements.txt
  data/
    *.jsonl                          ← generated training data (git-ignored)
  finetune_llama3.py                 ← QLoRA training script

services/
  ai-service/
    src/
      index.ts                       ← Express server
      middleware/auth.ts             ← Bearer token check
      providers/ollama.ts            ← Ollama backend
      providers/vllm.ts              ← vLLM / OpenAI-compat backend
    .env.example
    Dockerfile
    package.json
```
