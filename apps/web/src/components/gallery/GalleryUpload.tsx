import { useRef, useState } from 'react'
import { Upload, X, Tag, Video, Link } from 'lucide-react'
import { useUploadGalleryItem } from '@/hooks/useApi'
import { prepareGalleryImage, formatBytes, base64SizeBytes } from '@/lib/imageUtils'
import { useAuthStore } from '@/store/auth.store'

interface Props {
  partyId?: string
  invoiceId?: string
  onDone?: () => void
}

function isValidVideoUrl(url: string): boolean {
  try { new URL(url); return true } catch { return false }
}

export function GalleryUpload({ partyId, invoiceId, onDone }: Props) {
  const [mode, setMode]           = useState<'photo' | 'video'>('photo')
  const [preview, setPreview]     = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [thumbData, setThumbData] = useState<string | null>(null)
  const [videoUrl, setVideoUrl]   = useState('')
  const [caption, setCaption]     = useState('')
  const [tagInput, setTagInput]   = useState('')
  const [tags, setTags]           = useState<string[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload     = useUploadGalleryItem()
  const branch     = useAuthStore(s => s.branch)
  const domainType = (branch as any)?.domainType ?? 'general'

  async function onFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return }
    setLoading(true)
    try {
      const { imageData: img, thumbData: thumb } = await prepareGalleryImage(file)
      const sizeBytes = base64SizeBytes(img)
      if (sizeBytes > 520_000) {
        setError(`Image too large (${formatBytes(sizeBytes)}). Max 500 KB.`)
        setLoading(false)
        return
      }
      setImageData(img)
      setThumbData(thumb)
      setPreview(img)
    } catch { setError('Failed to process image') }
    setLoading(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  async function submitPhoto() {
    if (!imageData) return
    await upload.mutateAsync({
      imageData, thumbData: thumbData ?? undefined,
      caption: caption || undefined, tags,
      partyId, invoiceId, domainType,
    })
    setPreview(null); setImageData(null); setThumbData(null)
    setCaption(''); setTags([])
    onDone?.()
  }

  async function submitVideo() {
    setError(null)
    const url = videoUrl.trim()
    if (!url || !isValidVideoUrl(url)) {
      setError('Please enter a valid video URL')
      return
    }
    const encoded = `video:${url}`
    await upload.mutateAsync({
      imageData: encoded,
      thumbData: encoded,
      caption: caption || undefined, tags,
      partyId, invoiceId, domainType,
    })
    setVideoUrl(''); setCaption(''); setTags([])
    onDone?.()
  }

  const tagRow = (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="gallery-tag-input" className="sr-only">Add tag</label>
        <input id="gallery-tag-input" type="text" value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
          placeholder="Add tag, press Enter"
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" title="Add tag" onClick={addTag}
          className="px-3 py-2 bg-gray-100 rounded text-sm hover:bg-gray-200">
          <Tag className="w-4 h-4" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {t}
              <button type="button" title={`Remove tag ${t}`} onClick={() => setTags(prev => prev.filter(x => x !== t))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
        <button type="button" onClick={() => { setMode('photo'); setError(null) }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${mode === 'photo' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Upload className="w-3.5 h-3.5" /> Photo
        </button>
        <button type="button" onClick={() => { setMode('video'); setError(null) }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${mode === 'video' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Video className="w-3.5 h-3.5" /> Video (Drive)
        </button>
      </div>

      {mode === 'photo' ? (
        <>
          {preview ? (
            <div className="relative w-full aspect-video bg-gray-100 rounded overflow-hidden">
              <img src={preview} alt="preview" className="w-full h-full object-contain" />
              <button type="button" title="Remove photo"
                onClick={() => { setPreview(null); setImageData(null) }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <label htmlFor="gallery-file-input"
                className="flex flex-col items-center justify-center p-6 cursor-pointer w-full">
                <input id="gallery-file-input" ref={inputRef} type="file" accept="image/*" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">{loading ? 'Processing…' : 'Click or drag photo here'}</p>
                <p className="text-xs text-gray-400 mt-1">JPEG/PNG · max 500 KB after resize</p>
              </label>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)" maxLength={200}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {tagRow}
          <button type="button" onClick={submitPhoto} disabled={!imageData || upload.isPending}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {upload.isPending ? 'Uploading…' : 'Add Photo'}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Link className="w-3.5 h-3.5" /> Video Link
            </label>
            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="YouTube, Google Drive, Vimeo, or any video URL"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400">
              YouTube · Google Drive · Vimeo · Instagram · any sharable link
            </p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)" maxLength={200}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {tagRow}
          <button type="button" onClick={submitVideo} disabled={!videoUrl.trim() || upload.isPending}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {upload.isPending ? 'Saving…' : 'Add Video'}
          </button>
        </>
      )}
    </div>
  )
}
