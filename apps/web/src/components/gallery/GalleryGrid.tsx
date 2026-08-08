import { useState } from 'react'
import { Trash2, Edit2, X, ChevronLeft, ChevronRight, Tag, Play } from 'lucide-react'
import { useDeleteGalleryItem, useUpdateGalleryItem } from '@/hooks/useApi'
import { format } from 'date-fns'

function isVideoItem(data?: string | null) {
  return !!data?.startsWith('video:') || !!data?.startsWith('gdrive:')
}

function extractVideoUrl(data: string): string {
  if (data.startsWith('video:')) return data.slice(6)
  // legacy gdrive: prefix
  const fileId = data.replace('gdrive:', '')
  return `https://drive.google.com/file/d/${fileId}/view`
}

type VideoInfo = { embedUrl: string; thumbUrl: string | null; platform: string }

function resolveVideo(rawUrl: string): VideoInfo {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace('www.', '')

    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = url.searchParams.get('v')
      if (id) return {
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1`,
        thumbUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        platform: 'YouTube',
      }
    }
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1)
      return {
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1`,
        thumbUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        platform: 'YouTube',
      }
    }

    // Google Drive
    if (host === 'drive.google.com') {
      const m = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      const fileId = m?.[1] ?? url.searchParams.get('id') ?? ''
      return {
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        thumbUrl: fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` : null,
        platform: 'Google Drive',
      }
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const id = url.pathname.replace('/', '')
      return {
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
        thumbUrl: null,
        platform: 'Vimeo',
      }
    }

    // Generic fallback — open in new tab (no embed)
    return { embedUrl: rawUrl, thumbUrl: null, platform: 'Video' }
  } catch {
    return { embedUrl: rawUrl, thumbUrl: null, platform: 'Video' }
  }
}

interface GalleryItemThumb {
  id: string
  thumbData?: string | null
  caption?: string | null
  tags: string[]
  createdAt: string
  party?: { id: string; name: string } | null
}

interface Props {
  items: GalleryItemThumb[]
  onLoadFull?: (id: string) => Promise<string>
  showPartyName?: boolean
}

export function GalleryGrid({ items, onLoadFull, showPartyName = false }: Props) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [fullImages, setFullImages]   = useState<Record<string, string>>({})
  const [editing, setEditing]         = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editTags, setEditTags]       = useState<string[]>([])
  const [tagInput, setTagInput]       = useState('')

  const deleteMut = useDeleteGalleryItem()
  const updateMut = useUpdateGalleryItem()

  async function openLightbox(idx: number) {
    const item = items[idx]
    if (!item) return
    // Videos open in a new tab — iframes are blocked by most platforms
    if (isVideoItem(item.thumbData)) {
      window.open(extractVideoUrl(item.thumbData!), '_blank', 'noopener,noreferrer')
      return
    }
    setLightboxIdx(idx)
    if (!fullImages[item.id] && onLoadFull) {
      const full = await onLoadFull(item.id)
      setFullImages(prev => ({ ...prev, [item.id]: full }))
    }
  }

  function closeLightbox() { setLightboxIdx(null) }

  function navigate(dir: 1 | -1) {
    if (lightboxIdx === null) return
    const next = lightboxIdx + dir
    if (next >= 0 && next < items.length) openLightbox(next)
  }

  function startEdit(item: GalleryItemThumb) {
    setEditing(item.id)
    setEditCaption(item.caption ?? '')
    setEditTags(item.tags ?? [])
  }

  async function saveEdit() {
    if (!editing) return
    await updateMut.mutateAsync({ id: editing, caption: editCaption, tags: editTags })
    setEditing(null)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No media yet. Add photos or video links above.
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((item, idx) => (
          <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-gray-100 aspect-square">
            {isVideoItem(item.thumbData) ? (() => {
              const raw = extractVideoUrl(item.thumbData!)
              const { thumbUrl, platform } = resolveVideo(raw)
              return (
                <div className="w-full h-full cursor-pointer relative" onClick={() => openLightbox(idx)}>
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={item.caption ?? 'Video'}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-gray-800 ml-0.5" />
                    </div>
                  </div>
                  <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded font-medium">{platform}</span>
                </div>
              )
            })() : item.thumbData ? (
              <img src={item.thumbData} alt={item.caption ?? 'Gallery photo'}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openLightbox(idx)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs cursor-pointer"
                onClick={() => openLightbox(idx)}>
                No preview
              </div>
            )}

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors pointer-events-none" />
            <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
              <button type="button" title="Edit" onClick={() => startEdit(item)}
                className="bg-white/90 rounded p-1 hover:bg-white shadow">
                <Edit2 className="w-3 h-3 text-gray-700" />
              </button>
              <button type="button" title="Delete" onClick={() => deleteMut.mutate(item.id)}
                className="bg-white/90 rounded p-1 hover:bg-white shadow">
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>

            {(item.caption || showPartyName) && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1.5 truncate">
                {showPartyName && item.party?.name && (
                  <span className="text-blue-200 mr-1">{item.party.name} ·</span>
                )}
                {item.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}>
          <button type="button" title="Close" onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X className="w-7 h-7" />
          </button>

          {lightboxIdx > 0 && (
            <button type="button" title="Previous" onClick={e => { e.stopPropagation(); navigate(-1) }}
              className="absolute left-4 text-white hover:text-gray-300">
              <ChevronLeft className="w-9 h-9" />
            </button>
          )}
          {lightboxIdx < items.length - 1 && (
            <button type="button" title="Next" onClick={e => { e.stopPropagation(); navigate(1) }}
              className="absolute right-4 text-white hover:text-gray-300">
              <ChevronRight className="w-9 h-9" />
            </button>
          )}

          {(() => {
            const lbItem = items[lightboxIdx]
            if (!lbItem) return null
            return (
              <div className="max-w-4xl w-full mx-16" onClick={e => e.stopPropagation()}>
                <img
                  src={fullImages[lbItem.id] ?? lbItem.thumbData ?? ''}
                  alt={lbItem.caption ?? ''}
                  className="max-w-full max-h-[80vh] object-contain rounded mx-auto block" />
                <div className="mt-2 text-center">
                  {lbItem.caption && <p className="text-white text-sm">{lbItem.caption}</p>}
                  <p className="text-gray-400 text-xs mt-1">
                    {format(new Date(lbItem.createdAt), 'dd MMM yyyy')}
                  </p>
                  {lbItem.tags?.length > 0 && (
                    <div className="flex justify-center gap-1 mt-2 flex-wrap">
                      {lbItem.tags.map(t => (
                        <span key={t} className="text-xs bg-white/10 text-white px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow-xl space-y-3">
            <h3 className="font-semibold">Edit Photo</h3>
            <input type="text" value={editCaption} onChange={e => setEditCaption(e.target.value)}
              placeholder="Caption" maxLength={200}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    const t = tagInput.trim().toLowerCase()
                    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t])
                    setTagInput('')
                  }
                }}
                placeholder="Add tag" className="flex-1 border rounded px-3 py-2 text-sm" />
              <button type="button" title="Add tag" className="px-3 bg-gray-100 rounded hover:bg-gray-200">
                <Tag className="w-4 h-4" />
              </button>
            </div>
            {editTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {editTags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                    {t}
                    <button type="button" title={`Remove ${t}`} onClick={() => setEditTags(prev => prev.filter(x => x !== t))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)}
                className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={updateMut.isPending}
                className="flex-1 bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
                {updateMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
