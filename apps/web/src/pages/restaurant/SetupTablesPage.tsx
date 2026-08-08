// src/pages/restaurant/SetupTablesPage.tsx
// Owner/manager setup: add, edit, archive tables.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { restaurantApi } from '@/lib/api'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const SECTIONS = ['Main', 'Outdoor', 'Terrace', 'Bar', 'VIP', 'Takeaway']

function TableFormModal({
  initial,
  onClose,
}: {
  initial?: any
  onClose: () => void
}) {
  const qc  = useQueryClient()
  const [form, setForm] = useState({
    tableNo:  initial?.tableNo  ?? '',
    capacity: String(initial?.capacity ?? 4),
    section:  initial?.section  ?? '',
    notes:    initial?.notes    ?? '',
  })

  const mut = useMutation({
    mutationFn: () =>
      initial
        ? restaurantApi.updateTable(initial.id, {
            tableNo:  form.tableNo,
            capacity: Number(form.capacity),
            section:  form.section || undefined,
            notes:    form.notes   || undefined,
          })
        : restaurantApi.createTable({
            tableNo:  form.tableNo,
            capacity: Number(form.capacity),
            section:  form.section || undefined,
            notes:    form.notes   || undefined,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      toast.success(initial ? 'Table updated' : 'Table added')
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{initial ? 'Edit Table' : 'Add Table'}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Table No / Name</label>
            <input
              autoFocus
              value={form.tableNo}
              onChange={e => setForm({ ...form, tableNo: e.target.value })}
              className="input"
              placeholder="T1, A3, Bar-1…"
            />
          </div>
          <div>
            <label className="label">Capacity (seats)</label>
            <input
              type="number" min="1" max="50"
              value={form.capacity}
              onChange={e => setForm({ ...form, capacity: e.target.value })}
              className="input w-24"
            />
          </div>
          <div>
            <label className="label">Section</label>
            <select
              value={form.section}
              onChange={e => setForm({ ...form, section: e.target.value })}
              className="input"
            >
              <option value="">— None —</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input"
              placeholder="Near window, wheelchair accessible…"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.tableNo}
            className="btn-primary flex-1 justify-center"
          >
            {mut.isPending ? 'Saving…' : (initial ? 'Update' : 'Add Table')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SetupTablesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | any | null>(null)

  const { data: tables = [], isLoading } = useQuery<any[]>({
    queryKey: ['restaurant-tables'],
    queryFn:  restaurantApi.listTables,
  })

  const archiveMut = useMutation({
    mutationFn: (id: string) => restaurantApi.updateTable(id, { isActive: false }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      toast.success('Table archived')
    },
  })

  const sectionMap = new Map<string, any[]>()
  for (const t of tables) {
    const key = t.section ?? 'Main'
    const arr = sectionMap.get(key) ?? []
    arr.push(t)
    sectionMap.set(key, arr)
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Setup Tables</h1>
          <p className="text-sm text-gray-500">{tables.length} tables configured</p>
        </div>
        <button type="button" onClick={() => setModal('add')} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Table
        </button>
      </div>

      {isLoading && <div className="text-gray-400 py-10 text-center">Loading…</div>}

      {[...sectionMap.entries()].map(([section, sectionTables]) => (
        <div key={section} className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{section}</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Table</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Capacity</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Notes</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sectionTables.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.tableNo}</td>
                    <td className="px-4 py-3 text-gray-500">{t.capacity} seats</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{t.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setModal(t)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Archive table ${t.tableNo}?`)) archiveMut.mutate(t.id)
                          }}
                          disabled={t.status === 'occupied'}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-30"
                          title={t.status === 'occupied' ? 'Cannot archive occupied table' : 'Archive'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {modal && (
        <TableFormModal
          initial={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
