import type { Request, Response, NextFunction } from 'express'

const API_KEY = process.env.SERVICE_API_KEY

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    res.status(500).json({ error: 'SERVICE_API_KEY not configured' })
    return
  }
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
