/**
 * vLLM provider — OpenAI-compatible API served by vLLM.
 * Start server: python -m vllm.entrypoints.openai.api_server \
 *   --model ./hisabkitab-model/merged --port 8000
 *
 * Also works with: LM Studio, LocalAI, Together AI, Groq, OpenRouter
 * Just set OPENAI_COMPAT_BASE_URL + OPENAI_COMPAT_API_KEY + OPENAI_COMPAT_MODEL
 */

const BASE_URL = (
  process.env.VLLM_BASE_URL ??
  process.env.OPENAI_COMPAT_BASE_URL ??
  'http://localhost:8000'
).replace(/\/$/, '')

const API_KEY = (
  process.env.VLLM_API_KEY ??
  process.env.OPENAI_COMPAT_API_KEY ??
  'no-key'
)

const MODEL = (
  process.env.VLLM_MODEL ??
  process.env.OPENAI_COMPAT_MODEL ??
  'hisabkitab'
)

interface OpenAIMessage {
  role:    'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

async function callOpenAICompat(messages: OpenAIMessage[], maxTokens: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model:      MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`vLLM error ${res.status}: ${text}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message.content ?? ''
}

export async function vllmChat(req: {
  system: string; prompt: string; maxTokens: number
}): Promise<string> {
  return callOpenAICompat([
    { role: 'system', content: req.system },
    { role: 'user',   content: req.prompt },
  ], req.maxTokens)
}

export async function vllmVision(req: {
  system: string; prompt: string; imageBase64: string; mediaType: string; maxTokens: number
}): Promise<string> {
  return callOpenAICompat([
    { role: 'system', content: req.system },
    {
      role:    'user',
      content: [
        { type: 'text', text: req.prompt },
        {
          type:      'image_url',
          image_url: { url: `data:${req.mediaType};base64,${req.imageBase64}` },
        },
      ],
    },
  ], req.maxTokens)
}
