// Hotel Room Management — grid view + add/edit rooms + status updates
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Plus, Pencil, X, BedDouble, Wifi, Wind, Tv2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ROOM_TYPES = [
  'standard','deluxe','super_deluxe','suite','family','dormitory','studio','cottage','villa',
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: 'Available',   color: 'text-green-700',  bg: 'bg-green-100 border-green-200'  },
  occupied:    { label: 'Occupied',    color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-200'    },
  dirty:       { label: 'Dirty',       color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-200'},
  maintenance: { label: 'Maintenance', color: 'text-red-700',    bg: 'bg-red-100 border-red-200'      },
  blocked:     { label: 'Blocked',     color: 'text-gray-600',   bg: 'bg-gray-200 border-gray-300'    },
}

function RoomForm({
  initial, onSave, onClose, saving,
}: {
  initial?: any
  onSave: (data: any) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    roomNo:       initial?.roomNo       ?? '',
    roomType:     initial?.roomType     ?? 'standard',
    floor:        initial?.floor        ?? '',
    bedType:      initial?.bedType      ?? '',
    maxOccupancy: String(initial?.maxOccupancy ?? 2),
    ratePerNight: String(initial?.ratePerNight ?? ''),
    weekendRate:  String(initial?.weekendRate  ?? ''),
    hasAc:        initial?.hasAc     ?? true,
    hasTv:        initial?.hasTv     ?? true,
    hasGeyser:    initial?.hasGeyser ?? true,
    hasWifi:      initial?.hasWifi   ?? true,
    viewType:     initial?.viewType  ?? '',
    imageUrl:     initial?.imageUrl  ?? '',
    description:  initial?.description ?? '',
    notes:        initial?.notes     ?? '',
  })
  const [images, setImages] = useState<string[]>(initial?.images ?? [])

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value })
  const fb = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.checked })

  function setImage(i: number, url: string) { setImages((s) => s.map((u, idx) => idx === i ? url : u)) }
  function addImage() { setImages((s) => [...s, '']) }
  function removeImage(i: number) { setImages((s) => s.filter((_, idx) => idx !== i)) }

  function handleSubmit() {
    if (!form.roomNo || !form.ratePerNight) { toast.error('Room number and rate are required'); return }
    onSave({
      roomNo:       form.roomNo,
      roomType:     form.roomType,
      floor:        form.floor || undefined,
      bedType:      form.bedType || undefined,
      maxOccupancy: Number(form.maxOccupancy),
      ratePerNight: Number(form.ratePerNight),
      weekendRate:  form.weekendRate ? Number(form.weekendRate) : undefined,
      hasAc:        form.hasAc,
      hasTv:        form.hasTv,
      hasGeyser:    form.hasGeyser,
      hasWifi:      form.hasWifi,
      viewType:     form.viewType || undefined,
      imageUrl:     form.imageUrl || undefined,
      images:       images.map((u) => u.trim()).filter(Boolean),
      description:  form.description || undefined,
      notes:        form.notes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{initial ? 'Edit Room' : 'Add Room'}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Room No. *</label>
              <input className="input" value={form.roomNo} onChange={f('roomNo')} placeholder="101" />
            </div>
            <div>
              <label className="label">Floor</label>
              <input className="input" value={form.floor} onChange={f('floor')} placeholder="1" />
            </div>
            <div>
              <label className="label">Room Type</label>
              <select className="input" value={form.roomType} onChange={f('roomType')}>
                {ROOM_TYPES.map(t => (
                  <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bed Type</label>
              <select className="input" value={form.bedType} onChange={f('bedType')}>
                <option value="">— Select —</option>
                {['single','double','twin','king','queen','bunk','sofa_bed'].map(b => (
                  <option key={b} value={b} className="capitalize">{b.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Max Occupancy</label>
              <input className="input" type="number" min="1" max="20" value={form.maxOccupancy} onChange={f('maxOccupancy')} />
            </div>
            <div>
              <label className="label">View Type</label>
              <select className="input" value={form.viewType} onChange={f('viewType')}>
                <option value="">— None —</option>
                {['garden','pool','sea','city','mountain','courtyard'].map(v => (
                  <option key={v} value={v} className="capitalize">{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Rate/Night (₹) *</label>
              <input className="input" type="number" min="0" value={form.ratePerNight} onChange={f('ratePerNight')} placeholder="2500" />
            </div>
            <div>
              <label className="label">Weekend Rate (₹)</label>
              <input className="input" type="number" min="0" value={form.weekendRate} onChange={f('weekendRate')} placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['hasAc','hasTv','hasGeyser','hasWifi'] as const).map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[k] as boolean} onChange={fb(k)} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">{k === 'hasAc' ? 'Air Conditioning' : k === 'hasTv' ? 'Television' : k === 'hasGeyser' ? 'Geyser' : 'WiFi'}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="label">Cover Image URL</label>
            <input className="input" value={form.imageUrl} onChange={f('imageUrl')} placeholder="https://…" />
            <p className="text-xs text-gray-400 mt-1">The thumbnail shown on the homepage and room list. All rooms of the same type share one — set it on any one of them.</p>
          </div>

          <div>
            <label className="label">Gallery photos (for the room's detail page)</label>
            <div className="space-y-2">
              {images.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input" value={url} onChange={(e) => setImage(i, e.target.value)} placeholder="https://…" />
                  <button type="button" onClick={() => removeImage(i)} className="text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addImage} className="btn-ghost text-xs mt-2"><Plus className="w-3.5 h-3.5" /> Add photo</button>
            <p className="text-xs text-gray-400 mt-1">All photos shown together on the room's detail page. Same sharing rule — set once per room type.</p>
          </div>

          <div>
            <label className="label">Description (for the website)</label>
            <textarea className="input h-20 resize-none" value={form.description} onChange={f('description')}
              placeholder="A brief, honest description of this room — what makes it worth booking." />
            <p className="text-xs text-gray-400 mt-1">Shown on the room's detail page. Same sharing rule as the image — set it on any one room of this type.</p>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input h-16 resize-none" value={form.notes} onChange={f('notes')} placeholder="e.g. adjoining rooms, connecting door…" />
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Room'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function RoomsPage() {
  const queryClient = useQueryClient()
  // viewer (housekeeping) has read-only server-side access to rooms — hide
  // the edit/add/status-change controls rather than let them 403 on click.
  const isViewer = useAuthStore((s) => s.user?.role === 'viewer')
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)
  const [statusFilter, setStatus] = useState<string>('')

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['hotel-rooms', statusFilter],
    queryFn: () => hotelApi.listRooms(statusFilter ? { status: statusFilter } : undefined),
  })

  // Always fetch all rooms to compute per-status counts regardless of active filter
  const { data: allRooms = [] } = useQuery({
    queryKey: ['hotel-rooms', ''],
    queryFn: () => hotelApi.listRooms(undefined),
  })

  const createRoom = useMutation({
    mutationFn: (data: any) => hotelApi.createRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-rooms'] })
      toast.success('Room added')
      setShowAdd(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed'),
  })

  const updateRoom = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => hotelApi.updateRoom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-dashboard'] })
      toast.success('Room updated')
      setEditing(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed'),
  })

  const changeStatus = (room: any, status: string) => {
    updateRoom.mutate({ id: room.id, data: { status } })
  }

  const counts = allRooms.reduce((acc: Record<string, number>, r: any) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle={`${allRooms.length} rooms total`}
        action={
          !isViewer && (
            <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Room
            </button>
          )
        }
      />

      <div className="p-6 space-y-4">
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '',            label: `All (${rooms.length})` },
            ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({
              value: v, label: `${c.label} (${counts[v] ?? 0})`
            })),
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No rooms yet.{!isViewer && <> <button type="button" onClick={() => setShowAdd(true)} className="text-primary-600 hover:underline">Add your first room</button></>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {rooms.map((room: any) => {
              const sc = STATUS_CONFIG[room.status] ?? STATUS_CONFIG['available']!
              return (
                <div
                  key={room.id}
                  className={`relative border rounded-xl p-3 transition-shadow hover:shadow-md ${sc.bg}`}
                >
                  {/* Edit button */}
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setEditing(room)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-white/50"
                      title="Edit room"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className={`text-2xl font-bold ${sc.color} mb-1`}>{room.roomNo}</div>
                  <div className="text-xs text-gray-600 capitalize mb-2">
                    {room.roomType.replace('_', ' ')} · {room.floor ? `Floor ${room.floor}` : ''}
                  </div>

                  {/* Amenity icons */}
                  <div className="flex gap-1 mb-2">
                    {room.hasAc    && <span title="AC"><Wind className="w-3 h-3 text-gray-400" /></span>}
                    {room.hasTv    && <span title="TV"><Tv2  className="w-3 h-3 text-gray-400" /></span>}
                    {room.hasWifi  && <span title="WiFi"><Wifi className="w-3 h-3 text-gray-400" /></span>}
                    {room.hasGeyser && <span title="Geyser" className="text-xs text-gray-400">🚿</span>}
                  </div>

                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    ₹{Number(room.ratePerNight).toLocaleString('en-IN')}/night
                  </div>

                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${sc.color} bg-white/60`}>
                    {sc.label}
                  </span>

                  {/* Quick status change */}
                  {!isViewer && room.status !== 'occupied' && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {room.status !== 'available' && (
                        <button
                          type="button"
                          onClick={() => changeStatus(room, 'available')}
                          className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded hover:bg-green-700"
                        >
                          ✓ Available
                        </button>
                      )}
                      {room.status !== 'maintenance' && (
                        <button
                          type="button"
                          onClick={() => changeStatus(room, 'maintenance')}
                          className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded hover:bg-red-200"
                        >
                          Maintenance
                        </button>
                      )}
                      {room.status !== 'blocked' && (
                        <button
                          type="button"
                          onClick={() => changeStatus(room, 'blocked')}
                          className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-300"
                        >
                          Block
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <RoomForm
          onSave={(data) => createRoom.mutate(data)}
          onClose={() => setShowAdd(false)}
          saving={createRoom.isPending}
        />
      )}
      {editing && (
        <RoomForm
          initial={editing}
          onSave={(data) => updateRoom.mutate({ id: editing.id, data })}
          onClose={() => setEditing(null)}
          saving={updateRoom.isPending}
        />
      )}
    </div>
  )
}
