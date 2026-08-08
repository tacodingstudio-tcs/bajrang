"""
Shared Gemini client for all data-gen scripts.
Uses the new google-genai SDK (replaces deprecated google-generativeai).
"""
import os
import time
from google import genai
from google.genai import types

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    raise SystemExit(
        "\nERROR: GEMINI_API_KEY not found.\n"
        "Set it in this terminal session:\n"
        "  Windows CMD:        set GEMINI_API_KEY=AIza...\n"
        "  Windows PowerShell: $env:GEMINI_API_KEY='AIza...'\n"
        "Then re-run the script in the SAME terminal window.\n"
    )

client = genai.Client(api_key=API_KEY)
MODEL  = "models/gemini-2.5-flash"


def generate(system: str, prompt: str, max_tokens: int = 1024) -> str:
    """Call Gemini and return the text response. Retries on rate limit or empty response."""
    for attempt in range(5):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=[
                    types.Content(role="user", parts=[types.Part(text=prompt)])
                ],
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                    temperature=0.2,
                ),
            )

            # Extract text safely from candidates
            text = ""
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        text += part.text

            if not text:
                print(f"\n  Empty response on attempt {attempt+1}, retrying…")
                time.sleep(5)
                continue

            # Strip markdown fences if model wrapped output in ```json ... ```
            text = text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                text = "\n".join(lines).strip()

            return text

        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = 60 * (attempt + 1)
                print(f"\n  Rate limited. Waiting {wait}s before retry {attempt+1}/5…")
                time.sleep(wait)
            else:
                raise

    raise RuntimeError("Gemini: all retries exhausted")
