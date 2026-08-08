import { useState } from 'react'
import { Images, Plus } from 'lucide-react'
import { useGallery } from '@/hooks/useApi'
import { galleryApi } from '@/lib/api'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { GalleryUpload } from '@/components/gallery/GalleryUpload'
import { format } from 'date-fns'

const PAGE_SIZE = 24

export default function GalleryPage() {
  const [showUpload, setShowUpload] = useState(false)
  const [offset, setOffset]         = useState(0)
  const [tagFilter, setTagFilter]   = useState('')

  const { data, isLoading } = useGallery({
    limit: PAGE_SIZE,
    offset,
    ...(tagFilter && { tags: tagFilter }),
  })
  const items = (data as any)?.data ?? []
  const total = (data as any)?.meta?.total ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  async function loadFull(id: string) {
    const item = await galleryApi.get(id)
    return item.imageData as string
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Gallery</h1>
          {total > 0 && <span className="text-gray-400 text-sm">{total} items</span>}
        </div>
        <button type="button" onClick={() => setShowUpload(s => !s)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Add Photo / Video
        </button>
      </div>

      {showUpload && (
        <div className="max-w-md">
          <GalleryUpload onDone={() => setShowUpload(false)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input type="text" value={tagFilter} onChange={e => { setTagFilter(e.target.value); setOffset(0) }}
          placeholder="Filter by tag…"
          className="border rounded px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {tagFilter && (
          <button type="button" onClick={() => { setTagFilter(''); setOffset(0) }}
            className="text-sm text-gray-500 hover:text-gray-700">
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading gallery…</div>
      ) : (
        <GalleryGrid items={items} onLoadFull={loadFull} showPartyName />
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button type="button" disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {currentPage} of {pages}</span>
          <button type="button" disabled={currentPage >= pages}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
