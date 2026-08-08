"""
generate_payment_reminders.py
------------------------------
Generates ~400 training examples for the WhatsApp payment reminder task.
Output: training/data/payment_reminder_examples.jsonl

Covers all 5 languages × 3 tones × multiple business types.
Teaches the model to write culturally warm Indian payment reminders.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python generate_payment_reminders.py
"""

import json
import time
from pathlib import Path
from itertools import product as iterproduct
from tqdm import tqdm
from _client import generate
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "payment_reminder_examples.jsonl"

LANGUAGES   = ["hi", "gu", "en", "mr", "ta"]
TONES       = ["friendly", "firm", "urgent"]
BUSINESSES  = [
    "Sharma Kirana Store",
    "Patel General Store",
    "Mehta Medical & General",
    "Gupta Grocery",
    "Raju Provision Store",
    "New Bombay Traders",
]
CUSTOMERS   = [
    ("Ramesh", 850),
    ("Suresh Patel", 2200),
    ("Mohan Kumar", 5500),
    ("Geeta Devi", 430),
    ("Rajesh Bhai", 12000),
    ("Kantaben", 3750),
    ("Vikram Singh", 900),
    ("Sunita Sharma", 1600),
]
DAYS_BY_TONE = {"friendly": 10, "firm": 22, "urgent": 45}

SYSTEM = """You write polite, culturally appropriate WhatsApp payment reminder
messages for Indian small businesses to send to customers with outstanding
credit (udhaar). Keep the relationship warm — these are often regular, valued
customers, not strangers. Never be rude or threatening.

Return ONLY JSON:
{ "message": "the WhatsApp message text", "tone": "friendly|firm|urgent", "language": "hi|gu|en|mr|ta" }

Guidelines by tone:
- friendly: light reminder, assume they simply forgot, warm and brief (2-3 lines)
- firm: clear ask for payment by a specific timeframe, still respectful (3-4 lines)
- urgent: direct but never threatening, may mention impact on continued credit (3-4 lines)

Use the customer's name. Include the amount in Indian Rupee format (Rs X or ₹X).
Sign off with the business name. Write in the specified language naturally."""

def generate_example(business: str, customer: str, amount: int, days: int, tone: str, lang: str) -> dict | None:
    prompt = f"""Business: {business}
Customer: {customer}
Amount due: Rs {amount}
Days overdue: {days}
Suggested tone: {tone}
Language: {lang}"""
    try:
        raw = generate(SYSTEM, prompt, max_tokens=300)
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw.strip())
        return {
            "instruction": SYSTEM,
            "input": prompt,
            "output": json.dumps(parsed, ensure_ascii=False),
        }
    except Exception as e:
        print(f"  ERROR {business}/{customer}/{lang}/{tone}: {e}")
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

    combos = [
        (biz, cust, amt, DAYS_BY_TONE[tone], tone, lang)
        for biz in BUSINESSES
        for (cust, amt) in CUSTOMERS
        for tone in TONES
        for lang in LANGUAGES
    ]

    print(f"Generating payment reminder examples ({len(combos)} combos)…")
    with open(OUTPUT_FILE, "a", encoding="utf-8") as out:
        for biz, cust, amt, days, tone, lang in tqdm(combos):
            prompt_key = f"Business: {biz}\nCustomer: {cust}\nAmount due: Rs {amt}\nDays overdue: {days}\nSuggested tone: {tone}\nLanguage: {lang}"
            if prompt_key in existing:
                continue
            example = generate_example(biz, cust, amt, days, tone, lang)
            if example:
                out.write(json.dumps(example, ensure_ascii=False) + "\n")
                out.flush()
            time.sleep(4)

    total = sum(1 for _ in open(OUTPUT_FILE))
    print(f"Done. {OUTPUT_FILE} now has {total} examples.")


if __name__ == "__main__":
    main()
