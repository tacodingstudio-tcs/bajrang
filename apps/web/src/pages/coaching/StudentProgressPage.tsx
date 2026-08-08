// apps/web/src/pages/coaching/StudentProgressPage.tsx
// Lists all students for the coaching domain with search, links to per-student progress detail.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingUp, FileText, BookOpen } from 'lucide-react'
import { useParties } from '@/hooks/useApi'
import { PageHeader } from '@/components/layout/PageHeader'

export function StudentProgressPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useParties({ type: 'customer', search: search || undefined, limit: 100 })
  const students: any[] = Array.isArray(data) ? data : (data?.data ?? [])

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Student Progress"
        subtitle="Track daily notes, weekly reviews and exam performance per student"
        action={
          <button
            type="button"
            onClick={() => navigate('/coaching/exams')}
            className="btn-primary"
          >
            <FileText className="w-4 h-4" /> Manage Exams
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9 w-full"
        />
      </div>

      {/* Student Grid */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="text-sm text-gray-500">
          {search ? 'No students found.' : 'No students yet. Add students from Parties.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {students.map((s: any) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/coaching/progress/${s.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-primary-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm shrink-0">
                  {s.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate group-hover:text-primary-700">{s.name}</div>
                  {s.phone && <div className="text-xs text-gray-500">{s.phone}</div>}
                  {s.meta?.standard && (
                    <div className="text-xs text-gray-500">{s.meta.standard}{s.meta.batch_name ? ` · ${s.meta.batch_name}` : ''}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Notes</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Progress</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
