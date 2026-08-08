// Folios — all guest folios, both active and historical
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { hotelApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Search } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  reserved:    'bg-blue-100 text-blue-700',
  checked_in:  'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
  no_show:     'bg-yellow-100 text-yellow-700',
}

export function FoliosPage() {
  const navigate  = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['hotel-bookings-all', search, page],
    queryFn: () => hotelApi.listBookings({ search: search || undefined, page, limit: 30 }),
  })

  const bookings   = data?.data  ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 30)

  return (
    <div>
      <PageHeader title="Folios" subtitle={`${total} total`} />

      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by guest, folio, phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No folios found</div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left">Folio</th>
                  <th className="px-4 py-2.5 text-left">Guest</th>
                  <th className="px-4 py-2.5 text-left">Room</th>
                  <th className="px-4 py-2.5 text-left">Check-in</th>
                  <th className="px-4 py-2.5 text-left">Check-out</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((bk: any) => (
                  <tr
                    key={bk.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/hotel/bookings/${bk.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{bk.folioNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{bk.guestName}</div>
                      {bk.guestPhone && <div className="text-xs text-gray-400">{bk.guestPhone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{bk.roomNo}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(bk.checkIn).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(bk.checkOut).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ₹{Number(bk.totalAmount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[bk.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {bk.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-ghost text-sm">← Prev</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="btn-ghost text-sm">Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
