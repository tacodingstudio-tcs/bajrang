"""
generate_invoice_extraction.py
-------------------------------
Generates ~500 training examples for the voice/text invoice extraction task.
Output: training/data/invoice_extraction_examples.jsonl

Covers: Hindi, Gujarati, Marathi, English, and mixed (Hinglish/Hinglish+Gujarati)
billing phrases as spoken by shop owners or customers.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python generate_invoice_extraction.py
"""

import json
import time
from pathlib import Path
from tqdm import tqdm
import random
from _client import generate
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "invoice_extraction_examples.jsonl"

# ── Seed phrases — what real shop owners actually say ─────────────────────────
SEED_PHRASES = [
    # Hindi — single item
    "Ramesh ne 10 kilo chawal liya 60 rupaye kilo",
    "Suresh ko 5 litre tel diya 130 mein",
    "Mohan bhai ne aaj 2 kilo dal liya",
    "Aaj Geeta ne 3 packet namak liya 20 rupaye ek",
    "Raju ko do dozen ande diye 6 rupaye ek",

    # Hindi — multiple items
    "Vikram ne 5 kilo aata 40 mein aur 2 kilo cheeni 45 mein liya",
    "Kailash bhai ne 10 kilo chawal, 5 kilo dal aur 1 tin ghee liya",
    "Ravi ne aaj subah 3 kilo tamatar 20 rupaye kilo aur 2 kilo pyaz 15 rupaye liya",
    "Sunita didi ko 2 shampoo 120 rupaye wala aur 3 soap 40 rupaye wala diya",
    "Pappu ne 1 dozen ande 84 mein, 500g makhan 110 mein aur 1 litre doodh 55 mein liya",

    # Hindi — with date/time hints
    "Kal Mahesh ne 20 kilo aata liya 38 rupaye kilo",
    "Aaj subah Priya ne 1 kg paneer liya 280 mein",
    "Parso Ramu kaka ne 5 litre sarso ka tel liya",
    "Aaj dopahar mein Amit ko 2 packet biscuit diya",

    # Hindi — with discount
    "Ganesh bhai ko 5 kilo dal diya, 10% discount pe",
    "Regular customer hai Raju, 50 kilo aata diya 5% chhoot ke saath",
    "Sharma ji ko ghee diya 500g, 15 rupaye discount de diya",

    # Gujarati
    "Rasiklal e aaj 5 kilo chaval lido 55 rupaya kilo",
    "Maniben ne kale 2 litre tel lidhu",
    "Bhavesh bhai e 10 kilo atta lido 38 rupaya ma",
    "Aaj Jignesh e 3 sabun lido 45 rupaya ek",
    "Kantaben e 500g paneer lidu 260 rupaya ma",
    "Hasmukh bhai ne 20 kilo chaval, 5 kilo dal ane 2 tin ghee lidu",

    # Marathi
    "Ramrao ne aaj 5 kilo tandul ghetle 60 rupaye kilo",
    "Shantabai ne kal 2 litre tel ghetle",
    "Ganpat rao ne 10 kilo pith ghetle 40 rupaye kilo",

    # English
    "Suresh took 5 kg rice at 65 per kg",
    "Today Rajesh purchased 2 bottles of cooking oil at 140 each",
    "Mrs Sharma bought 10 kg wheat flour at 38 per kg and 1 kg sugar at 45",
    "Deepak took 3 soaps at 45 each with 10% discount",
    "Customer Mohan bought 500g butter 110 and 1 dozen eggs at 84",

    # Hinglish — mixed
    "Aaj Ramesh bhai ne 10 kilo rice liya at 60 rupees",
    "Suresh ko do kilo dal aur ek packet namak diya na",
    "Bhai Vikram ne teen ghante pehle 5 litre oil purchase kiya 130 per litre",
    "Ajay customer hai, usne 2 kg paneer liya 280 per kg mein",
    "Regular hai Mohan, 50 kilo atta liya 5 percent discount pe 38 per kg",

    # Ambiguous / low confidence examples (model must handle these)
    "Kuch cheez le gaya 500 mein",
    "Woh aaya tha thoda dal wala",
    "Kal wala jo tha woh le gaya",
    "5 kilo kuch le gaya Ramesh",
    "stock check karo chawal ka",  # not an invoice — should return UNKNOWN

    # Payment-related (different intent)
    "Ramesh ne 500 rupaye de diye aaj",
    "Suresh ka payment aa gaya 1200 rupaye",
    "Mohan bhai ne 50 percent de diya",

    # Party check intent
    "Ramesh ka kitna baaki hai",
    "Suresh ki ledger dikhaao",
    "Ganesh bhai ka hisab kya hai",
]

SYSTEM = """\
You are a billing assistant AI for an Indian small business app.
Extract a structured invoice draft from spoken text that may be in Hindi, Gujarati, Marathi, Tamil, or English, often mixed.

Return ONLY valid JSON matching this shape:
{
  "intent": "CREATE_INVOICE" | "ADD_PAYMENT" | "CHECK_STOCK" | "QUERY_REPORT" | "CREATE_PARTY" | "UNKNOWN",
  "partyHint": "customer name or null",
  "items": [
    { "name": "product name", "qty": number, "unit": "kg|pcs|l|box|etc", "rate": number or null, "discountPct": number default 0 }
  ],
  "dateHint": "aaj | kal | YYYY-MM-DD | null",
  "notes": "anything else or null",
  "confidence": 0.0 to 1.0,
  "ambiguities": ["list any unclear fields"]
}

Rules:
- NEVER guess GST or totals
- If rate not mentioned, set rate to null
- spoken numbers: "do" = 2, "teen" = 3, "paanch" = 5, "das" = 10, "bis" = 20
- "aaj" = today, "kal" = yesterday (usually), "parso" = day before yesterday
- Non-invoice messages: set intent to ADD_PAYMENT, CHECK_STOCK, or UNKNOWN appropriately
- Lower confidence for ambiguous party names or missing quantities"""

def generate_example(phrase: str) -> dict | None:
    try:
        raw = generate(SYSTEM, phrase, max_tokens=600)
        # strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw.strip())
        return {
            "instruction": SYSTEM,
            "input": phrase,
            "output": json.dumps(parsed, ensure_ascii=False),
        }
    except Exception as e:
        print(f"  ERROR for {phrase!r}: {e}")
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

    print(f"Generating invoice extraction examples ({len(SEED_PHRASES)} phrases)…")
    with open(OUTPUT_FILE, "a", encoding="utf-8") as out:
        for phrase in tqdm(SEED_PHRASES):
            if phrase in existing:
                continue
            example = generate_example(phrase)
            if example:
                out.write(json.dumps(example, ensure_ascii=False) + "\n")
                out.flush()
            time.sleep(4)

    total = sum(1 for _ in open(OUTPUT_FILE))
    print(f"Done. {OUTPUT_FILE} now has {total} examples.")


if __name__ == "__main__":
    main()
