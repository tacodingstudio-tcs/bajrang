/**
 * Ollama provider — calls your locally-running Ollama instance.
 * After fine-tuning: ollama create hisabkitab -f Modelfile
 * Then set OLLAMA_CHAT_MODEL=hisabkitab in .env
 */

const BASE_URL     = process.env.OLLAMA_BASE_URL    ?? 'http://localhost:11434'
const CHAT_MODEL   = process.env.OLLAMA_CHAT_MODEL  ?? 'hisabkitab'
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? 'llava'

export interface ChatRequest {
  system:     string
  prompt:     string
  maxTokens:  number
  quality:    'fast' | 'best'
}

export interface VisionRequest {
  system:      string
  prompt:      string
  imageBase64: string
  mediaType:   string
  maxTokens:   number
}

export async function ollamaChat(req: ChatRequest): Promise<string> {
  const body = {
    model:  CHAT_MODEL,
    prompt: `${req.system}\n\n${req.prompt}`,
    stream: false,
    options: { num_predict: req.maxTokens },
  }

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama chat error ${res.status}: ${text}`)
  }

  const data = await res.json() as { response: string }
  return data.response
}

export async function ollamaVision(req: VisionRequest): Promise<string> {
  const body = {
    model:   VISION_MODEL,
    prompt:  `${req.system}\n\n${req.prompt}`,
    images:  [req.imageBase64],
    stream:  false,
    options: { num_predict: req.maxTokens },
  }

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama vision error ${res.status}: ${text}`)
  }

  const data = await res.json() as { response: string }
  return data.response
}
