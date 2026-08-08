import { useState } from 'react'
import { Images, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useGallery } from '@/hooks/useApi'
import { galleryApi } from '@/lib/api'
import { GalleryGrid } from './GalleryGrid'
import { GalleryUpload } from './GalleryUpload'

interface Props {
  partyId: string
}

export function GallerySection({ partyId }: Props) {
  const [showUpload, setShowUpload] = useState(false)
  const [collapsed, setCollapsed]   = useState(false)

  const { data, isLoading } = useGallery({ partyId, limit: 12 })
  const items = (data as any)?.data ?? []
  const total = (data as any)?.meta?.total ?? 0

  async function loadFull(id: string) {
    const item = await galleryApi.get(id)
    return item.imageData as string
  }

  return (
    <div className="border rounded-lg bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button type="button" onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 font-semibold text-sm hover:text-blue-600">
          <Images className="w-4 h-4" />
          Gallery
          {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}
          {collapsed ? <ChevronDown className="w-4 h-4 ml-1" /> : <ChevronUp className="w-4 h-4 ml-1" />}
        </button>
        <button type="button" onClick={() => setShowUpload(s => !s)}
          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-100">
          <Plus className="w-3 h-3" />
          Add Photo
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {showUpload && (
            <GalleryUpload partyId={partyId} onDone={() => setShowUpload(false)} />
          )}
          {isLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">Loading…</div>
          ) : (
            <GalleryGrid items={items} onLoadFull={loadFull} />
          )}
        </div>
      )}
    </div>
  )
}
