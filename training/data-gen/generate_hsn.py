"""
generate_hsn.py
---------------
Generates ~500 training examples for the HSN suggestion task.
Output: training/data/hsn_examples.jsonl

Each example teaches the model:
  Input:  Product name (English / Hinglish)
  Output: JSON array of HSN suggestions with gst_rate and confidence

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python generate_hsn.py
"""

import json
import time
from pathlib import Path
from tqdm import tqdm
from _client import generate

OUTPUT_FILE = Path(__file__).parent.parent / "data" / "hsn_examples.jsonl"

# ── Seed product names covering all GST slabs ─────────────────────────────────
SEED_PRODUCTS = [
    # 0% GST — essential food
    "Tata Salt 1kg", "India Gate Basmati Rice 5kg", "Aashirvaad Atta 10kg",
    "Toor Dal 1kg", "Moong Dal 500g", "Chana Dal 2kg", "Urad Dal 1kg",
    "Fresh Milk 1 litre", "Curd 500g", "Paneer 200g", "Eggs dozen",
    "Fresh Onion 1kg", "Potato 5kg", "Tomato 1kg", "Fresh Spinach bunch",
    "Wheat Flour 5kg", "Maida 1kg", "Besan 500g", "Suji Rawa 1kg",
    "Jaggery 1kg", "Groundnut 500g", "Mustard Seeds 200g",

    # 5% GST — packaged food / essential
    "Aashirvaad Atta 5kg (packed)", "Maggi Noodles 70g", "Sunfeast Marie biscuit 200g",
    "Fortune Sunflower Oil 1 litre", "Saffola Gold Oil 1 litre",
    "Amul Butter 500g", "Amul Cheese slice 200g", "Britannia Cheese 400g",
    "Kissan Mixed Fruit Jam 500g", "Heinz Ketchup 950g",
    "Horlicks 500g", "Bournvita 500g", "Complan 200g",
    "Eno Fruit Salt 100g", "ORS sachets", "Glucon-D 500g",

    # 12% GST
    "Ghee 1kg tin", "Amul Pure Ghee 500ml", "Frozen peas 500g",
    "Pickle mango 500g", "Papad packet 200g",
    "Ayurvedic toothpaste 100g", "Dabur Honey 500g",
    "Cashews 250g", "Almonds 500g", "Raisins 200g",

    # 18% GST — FMCG / toiletries
    "Surf Excel 1kg", "Ariel Matic 2kg", "Harpic toilet cleaner 500ml",
    "Lizol floor cleaner 500ml", "Vim dishwash bar 200g",
    "Clinic Plus shampoo 340ml", "Head & Shoulders 200ml",
    "Dove soap 100g", "Lux soap 150g", "Dettol soap 75g",
    "Colgate Total toothpaste 200g", "Oral-B toothbrush",
    "Gillette shaving gel 200ml", "Ponds face cream 150g",
    "Lakme face wash 100ml", "Fair & Lovely cream 50g",
    "Vaseline petroleum jelly 250ml", "Johnson baby powder 200g",
    "Whisper sanitary pads 15pcs", "Pampers diaper L 32pcs",
    "Reynolds Ball Pen", "Classmate notebook 200 pages",
    "Fevicol 200g", "Pidilite M-seal 90g",

    # 28% GST — luxury / tobacco / beverages
    "Coca Cola 2 litre", "Pepsi 750ml bottle", "Sprite 600ml",
    "Red Bull energy drink 250ml", "Kingfisher beer 650ml",
    "Marlboro cigarette 10s", "Wills Navy Cut 20s",
    "Pan Parag gutka 10g", "Manikchand Pan Masala",
    "LG 32 inch LED TV", "Samsung washing machine 7kg",
    "Prestige pressure cooker 5 litre", "Philips mixer grinder 750W",
    "Godrej refrigerator 265 litre",

    # Electronics / hardware
    "TP-Link WiFi router", "Boat Bassheads earphone",
    "Syska LED bulb 9W", "Havells ceiling fan",
    "Anchor electric switch 6A", "Polycab wire 1.5sqmm",
    "Asian Paints Tractor Emulsion 20 litre",
    "Fevikwik super glue 1g", "Stanley screwdriver set",
    "Bosch drill machine 500W",

    # Pharma
    "Paracetamol 500mg tablet strip", "Crocin advance 10 tablets",
    "Azithromycin 500mg", "Amoxicillin 250mg capsule",
    "Betadine antiseptic 500ml", "Savlon liquid 500ml",
    "Disprin aspirin 350mg", "Digene antacid syrup 200ml",
    "Vicks VapoRub 50g", "Zandu Balm 50ml",
    "Dolo 650 tablet", "Combiflam tablet",

    # Stationery / school
    "Camlin colour pencil box 12", "Apsara pencil HB",
    "Natraj eraser", "Stapler machine", "A4 paper ream 500 sheets",
    "Fevistick glue stick", "Cello ball pen blue",
]

GENERATION_PROMPT = """You are an Indian GST expert.
For the given product name, return ONLY a JSON array with 1-3 HSN code suggestions.
Format:
[
  {{
    "hsn_code": "8-digit HSN code as string",
    "description": "official HSN description max 80 chars",
    "gst_rate": one of [0, 5, 12, 18, 28],
    "confidence": float 0.0-1.0
  }}
]
Rules:
- Sort by confidence descending
- Use correct 8-digit HSN codes from the Indian GST schedule
- Only return the JSON array, no other text
Product: "{product}" """


HSN_SYSTEM = "You are an Indian GST expert. Return only valid JSON arrays as instructed."

def _extract_json(raw: str):
    """Extract first valid JSON array or object from raw text."""
    import re
    # Try direct parse first
    try:
        return json.loads(raw)
    except Exception:
        pass
    # Find first [...] or {...} block
    for pattern in (r'\[.*\]', r'\{.*\}'):
        m = re.search(pattern, raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


def generate_example(product: str) -> dict | None:
    try:
        raw = generate(HSN_SYSTEM, GENERATION_PROMPT.format(product=product))
        parsed = _extract_json(raw)
        if not isinstance(parsed, list) or not parsed:
            return None
        return {
            "instruction": "You are an Indian GST expert. For the given product name, suggest the correct HSN code and GST rate. Return ONLY a JSON array with up to 3 suggestions.",
            "input": f'Product name: "{product}"',
            "output": json.dumps(parsed, ensure_ascii=False),
        }
    except Exception as e:
        print(f"  ERROR for {product!r}: {e}")
        return None


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing = set()
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            for line in f:
                try:
                    existing.add(json.loads(line)["input"])
                except Exception:
                    pass
    print(f"Generating HSN examples ({len(SEED_PRODUCTS)} products, {len(existing)} already done)…")

    with open(OUTPUT_FILE, "a", encoding="utf-8") as out:
        for product in tqdm(SEED_PRODUCTS):
            key = f'Product name: "{product}"'
            if key in existing:
                continue
            example = generate_example(product)
            if example:
                out.write(json.dumps(example, ensure_ascii=False) + "\n")
                out.flush()
            time.sleep(4)  # stay under rate limit

    total = sum(1 for _ in open(OUTPUT_FILE))
    print(f"Done. {OUTPUT_FILE} now has {total} examples.")


if __name__ == "__main__":
    main()
