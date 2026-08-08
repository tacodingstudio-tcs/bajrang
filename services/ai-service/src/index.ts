/**
 * HisabKitab AI Service
 * ---------------------
 * Express server that implements the custom_http AI provider contract
 * expected by apps/api/src/lib/ai-provider.ts
 *
 * Contract:
 *   POST /ai/chat    { system, prompt, max_tokens, quality } → { text }
 *   POST /ai/vision  { system, prompt, image_base64, media_type, max_tokens } → { text }
 *   GET  /health     → { status: "ok", backend, model }
 *
 * Set MODEL_BACKEND=ollama|vllm|openai_compat in .env
 */

import express from 'express'
import { z } from 'zod'
import { requireApiKey } from './middleware/auth.js'
import { ollamaChat, ollamaVision } from './providers/ollama.js'
import { vllmChat, vllmVision } from './providers/vllm.js'

const app  = express()
const PORT = parseInt(process.env.PORT ?? '8080', 10)
const BACKEND = process.env.MODEL_BACKEND ?? 'ollama'

app.use(express.json({ limit: '20mb' }))  // large limit for base64 images

// ── Request schemas ───────────────────────────────────────────────────────────
const ChatSchema = z.object({
  system:     z.string(),
  prompt:     z.string(),
  max_tokens: z.number().int().min(1).max(8192).default(1024),
  quality:    z.enum(['fast', 'best']).default('fast'),
})

const VisionSchema = z.object({
  system:       z.string(),
  prompt:       z.string(),
  image_base64: z.string().min(10),
  media_type:   z.string().default('image/jpeg'),
  max_tokens:   z.number().int().min(1).max(8192).default(2048),
})

// ── Route helpers ─────────────────────────────────────────────────────────────
async function runChat(system: string, prompt: string, maxTokens: number, quality: 'fast' | 'best'): Promise<string> {
  if (BACKEND === 'ollama') {
    return ollamaChat({ system, prompt, maxTokens, quality })
  }
  // vllm and openai_compat both use the same OpenAI-compatible API
  return vllmChat({ system, prompt, maxTokens })
}

async function runVision(system: string, prompt: string, imageBase64: string, mediaType: string, maxTokens: number): Promise<string> {
  if (BACKEND === 'ollama') {
    return ollamaVision({ system, prompt, imageBase64, mediaType, maxTokens })
  }
  return vllmVision({ system, prompt, imageBase64, mediaType, maxTokens })
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    backend: BACKEND,
    model:   process.env.OLLAMA_CHAT_MODEL ?? process.env.VLLM_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? 'unknown',
    time:    new Date().toISOString(),
  })
})

// Chat endpoint
app.post('/ai/chat', requireApiKey, async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', issues: parsed.error.flatten() })
    return
  }

  const { system, prompt, max_tokens, quality } = parsed.data

  try {
    const text = await runChat(system, prompt, max_tokens, quality)
    res.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/ai/chat] error:', message)
    res.status(502).json({ error: 'Model error', detail: message })
  }
})

// Vision endpoint (bill OCR)
app.post('/ai/vision', requireApiKey, async (req, res) => {
  const parsed = VisionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', issues: parsed.error.flatten() })
    return
  }

  const { system, prompt, image_base64, media_type, max_tokens } = parsed.data

  try {
    const text = await runVision(system, prompt, image_base64, media_type, max_tokens)
    res.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/ai/vision] error:', message)
    res.status(502).json({ error: 'Vision model error', detail: message })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`HisabKitab AI Service running on :${PORT}`)
  console.log(`  Backend : ${BACKEND}`)
  console.log(`  Health  : http://localhost:${PORT}/health`)
  console.log(`  Chat    : POST http://localhost:${PORT}/ai/chat`)
  console.log(`  Vision  : POST http://localhost:${PORT}/ai/vision`)
})
