"""
generate_all.py
---------------
Runs all 4 data generation scripts in sequence.
Produces ~1500 total training examples across all tasks.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python generate_all.py

Expected cost: $0 with Gemini Flash free tier
Expected time: 15-30 minutes
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS = [
    "generate_hsn.py",
    "generate_invoice_extraction.py",
    "generate_payment_reminders.py",
    "generate_dashboard_insights.py",
]

HERE = Path(__file__).parent


def main():
    for script in SCRIPTS:
        print(f"\n{'='*60}")
        print(f"Running {script}…")
        print('='*60)
        result = subprocess.run(
            [sys.executable, str(HERE / script)],
            check=False,
        )
        if result.returncode != 0:
            print(f"WARNING: {script} exited with code {result.returncode}")

    # Print summary
    data_dir = HERE.parent / "data"
    print(f"\n{'='*60}")
    print("SUMMARY")
    print('='*60)
    total = 0
    for f in sorted(data_dir.glob("*.jsonl")):
        count = sum(1 for _ in open(f))
        total += count
        print(f"  {f.name}: {count} examples")
    print(f"  TOTAL: {total} examples")
    print(f"\nNext step: run the training script")
    print(f"  cd training && python finetune_llama3.py")


if __name__ == "__main__":
    main()
