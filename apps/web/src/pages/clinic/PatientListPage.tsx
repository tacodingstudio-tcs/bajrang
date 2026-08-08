// apps/web/src/pages/clinic/PatientListPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ClipboardList } from 'lucide-react'
import { useParties } from '@/hooks/useApi'
import { PageHeader } from '@/components/layout/PageHeader'

export function PatientListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useParties({ type: 'customer', search: search || undefined, limit: 100 })
  const patients: any[] = Array.isArray(data) ? data : (data?.data ?? [])

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Patient History"
        subtitle="View visit history, vitals and documents per patient"
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9 w-full"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading patients...</div>
      ) : patients.length === 0 ? (
        <div className="text-sm text-gray-500">
          {search ? 'No patients found.' : 'No patients yet. Add patients from Parties.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {patients.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/clinic/patients/${p.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-primary-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                  {p.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate group-hover:text-primary-700">{p.name}</div>
                  {p.phone && <div className="text-xs text-gray-500">{p.phone}</div>}
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                    {p.meta?.age   && <span>{p.meta.age}y</span>}
                    {p.meta?.gender && <span>{p.meta.gender}</span>}
                    {p.meta?.blood_group && <span className="text-red-500">{p.meta.blood_group}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                <ClipboardList className="w-3 h-3" /> View History
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
