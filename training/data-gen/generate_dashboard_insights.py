"""
generate_dashboard_insights.py
-------------------------------
Generates ~300 training examples for the daily dashboard insight task.
Output: training/data/dashboard_insight_examples.jsonl

Teaches the model to turn raw sales numbers into a friendly, actionable
4-line summary for an Indian shop owner — in English and Hindi.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python generate_dashboard_insights.py
"""

import json
import time
import random
from pathlib import Path
from tqdm import tqdm
from _client import generate
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "dashboard_insight_examples.jsonl"

SYSTEM = """You are a business intelligence assistant for an Indian small business billing app.
Given today's sales data, write a brief, friendly, actionable summary for the shop owner.
Return ONLY JSON:
{
  "headline": "one short sentence summary (max 15 words)",
  "insights": ["up to 4 bullet observations, each max 15 words"],
  "alert": "one urgent alert if any, else null"
}
Be specific with numbers. Sound like a helpful colleague. Never use jargon."""


def random_scenario() -> dict:
    """Generate a random but realistic sales scenario."""
    revenue      = random.choice([2800, 5500, 8200, 12000, 18500, 3200, 450, 22000, 9800, 6700])
    invoices     = random.randint(8, 85)
    collected    = int(revenue * random.uniform(0.5, 0.95))
    prev_revenue = int(revenue * random.uniform(0.7, 1.4))
    pct_change   = round((revenue - prev_revenue) / prev_revenue * 100)
    top_products = random.sample([
        ("Tata Salt", 320), ("Aashirvaad Atta", 1850), ("Maggi Noodles", 760),
        ("Surf Excel", 420), ("Amul Butter", 530), ("Toor Dal", 890),
        ("Sunflower Oil", 1100), ("Colgate", 280), ("Rice", 2400),
        ("Biscuits", 650), ("Dettol Soap", 340), ("Paracetamol", 180),
    ], k=3)
    overdue = random.randint(0, 25)
    lang    = random.choice(["en", "hi"])

    context = f"""Today: ₹{revenue} revenue, {invoices} invoices, ₹{collected} collected.
vs yesterday: {'+' if pct_change >= 0 else ''}{pct_change}%
Top products (7d): {', '.join(f'{p} ₹{r}' for p, r in top_products)}
Customers with pending balance: {overdue}"""
    return {"context": context, "lang": lang}


def generate_example(scenario: dict) -> dict | None:
    try:
        lang_instruction = "Respond in English." if scenario["lang"] == "en" else "Respond in Hindi."
        raw = generate(SYSTEM + "\n" + lang_instruction, scenario["context"], max_tokens=350)
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw.strip())
        return {
            "instruction": SYSTEM,
            "input": scenario["context"],
            "output": json.dumps(parsed, ensure_ascii=False),
        }
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    TARGET = 300
    existing = 0
    if OUTPUT_FILE.exists():
        existing = sum(1 for _ in open(OUTPUT_FILE))

    remaining = TARGET - existing
    if remaining <= 0:
        print(f"Already have {existing} examples. Nothing to do.")
        return

    print(f"Generating {remaining} dashboard insight examples…")
    with open(OUTPUT_FILE, "a", encoding="utf-8") as out:
        for _ in tqdm(range(remaining)):
            scenario = random_scenario()
            example  = generate_example(scenario)
            if example:
                out.write(json.dumps(example, ensure_ascii=False) + "\n")
                out.flush()
            time.sleep(4)

    total = sum(1 for _ in open(OUTPUT_FILE))
    print(f"Done. {OUTPUT_FILE} now has {total} examples.")


if __name__ == "__main__":
    main()
