// apps/web/src/pages/coaching/NotesLibraryPage.tsx
import { useState, useMemo } from 'react'
import {
  BookOpen, Search, Plus, Trash2, NotebookPen, CheckCircle2,
  ChevronDown, ChevronRight, Sparkles, Clock, FlaskConical,
  Calculator, Globe, BookMarked, X,
} from 'lucide-react'
import { useAllNotes, useDeleteTopicNotes, useTagNotes } from '@/hooks/useApi'
import { TopicNotesModal } from '@/components/coaching/TopicNotesModal'
import { useQueryClient } from '@tanstack/react-query'

// ── Constants ─────────────────────────────────────────────────────────────────

const BOARDS    = ['CBSE', 'GSEB', 'ICSE', 'IGCSE', 'State Board', 'Other']
const STANDARDS = ['5', '6', '7', '8', '9', '10', '11', '12']

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const d    = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function subjectIcon(subject: string) {
  const s = subject.toLowerCase()
  if (/chem|bio|science|physics|phy|vigyan|botanical|zoo/.test(s)) return <FlaskConical className="w-4 h-4 text-green-500" />
  if (/math|maths|algebra|geometry|trig/.test(s))                   return <Calculator   className="w-4 h-4 text-violet-500" />
  if (/geo|history|sst|social|civics|economics/.test(s))            return <Globe        className="w-4 h-4 text-blue-500"   />
  return <BookOpen className="w-4 h-4 text-indigo-500" />
}

function contentTags(content: any): string[] {
  const tags: string[] = []
  if (content?.formulae?.length)       tags.push(`${content.formulae.length} formulae`)
  if (content?.experiment)             tags.push('experiment')
  if (content?.practicalActivity)      tags.push('activity')
  if (content?.solvedExamples?.length) tags.push(`${content.solvedExamples.length} examples`)
  if (content?.boardQuestions?.length) tags.push('board Qs')
  if (content?.tricks?.length)         tags.push('tricks')
  return tags
}

function labelForStandard(s: string) {
  return s === '10' ? '10th' : s === '11' ? '11th' : s === '12' ? '12th' : `Class ${s}`
}

// ── Add Topic Modal ───────────────────────────────────────────────────────────

function AddTopicModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [board,    setBoard]    = useState('')
  const [standard, setStandard] = useState('')
  const [subject,  setSubject]  = useState('')
  const [topic,    setTopic]    = useState('')
  const [step,     setStep]     = useState<'form' | 'notes'>('form')

  if (step === 'notes' && subject && topic) {
    return (
      <TopicNotesModal
        subject={subject}
        topic={topic}
        board={board || undefined}
        standard={standard || undefined}
        onClose={() => {
          qc.invalidateQueries({ queryKey: ['all-notes'] })
          onClose()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-600" /> Add New Topic Notes
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Board <span className="text-gray-400 font-normal">(optional)</span></label>
              <select title="Board" className="input" value={board} onChange={e => setBoard(e.target.value)}>
                <option value="">Select board…</option>
                {BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Standard <span className="text-gray-400 font-normal">(optional)</span></label>
              <select title="Standard / Class" className="input" value={standard} onChange={e => setStandard(e.target.value)}>
                <option value="">Select class…</option>
                {STANDARDS.map(s => <option key={s} value={s}>Class {s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              placeholder="e.g. Chemistry, Mathematics, Physics"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Topic</label>
            <input
              className="input"
              placeholder="e.g. Chemical Reactions, Pythagoras Theorem"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && subject && topic && setStep('notes')}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            type="button"
            disabled={!subject.trim() || !topic.trim()}
            onClick={() => setStep('notes')}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Continue
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Subject group ─────────────────────────────────────────────────────────────

function SubjectGroup({
  subject, notes, searchQ, onOpen, onDelete,
}: {
  subject: string
  notes: any[]
  searchQ: string
  onOpen: (n: any) => void
  onDelete: (n: any) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const filtered = searchQ
    ? notes.filter(n => n.topic.toLowerCase().includes(searchQ.toLowerCase()))
    : notes
  if (filtered.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {subjectIcon(subject)}
          <span className="font-semibold text-gray-800 text-sm">{subject}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {filtered.length} topic{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {filtered.map(note => {
            const tags = contentTags(note.content)
            return (
              <div
                key={note.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-indigo-50/40 transition-colors group"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{note.topic}</span>
                    {tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-300" />
                    <span className="text-[11px] text-gray-400">Updated {timeAgo(note.updatedAt)}</span>
                    <span className="text-[11px] text-gray-300">·</span>
                    <span className={`text-[11px] ${note.generatedBy === 'manual' ? 'text-gray-400' : 'text-green-400'}`}>
                      {note.generatedBy === 'manual' ? 'Manual' : 'AI Generated'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onOpen(note)}
                    className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg font-medium"
                  >
                    <NotebookPen className="w-3.5 h-3.5" /> View
                  </button>
                  <button
                    type="button"
                    title="Delete notes"
                    onClick={() => {
                      if (confirm(`Delete notes for "${note.topic}"?`)) onDelete(note)
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Standard group (board → standard → subjects) ──────────────────────────────

function StandardGroup({
  standard, board, notes, searchQ, onOpen, onDelete,
}: {
  standard: string | null
  board: string | null
  notes: any[]
  searchQ: string
  onOpen: (n: any) => void
  onDelete: (n: any) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [tagging, setTagging]     = useState(false)
  const [tagBoard, setTagBoard]   = useState('')
  const [tagStd,   setTagStd]     = useState('')
  const tagMutation = useTagNotes()

  const bySubject = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const n of notes) {
      if (!map[n.subject]) map[n.subject] = []
      map[n.subject].push(n)
    }
    return map
  }, [notes])

  const subjects = Object.keys(bySubject).sort()
  const totalFiltered = searchQ
    ? notes.filter(n => n.topic.toLowerCase().includes(searchQ.toLowerCase())).length
    : notes.length

  if (totalFiltered === 0) return null

  const isUnclassified = !standard && !board
  const label = standard ? labelForStandard(standard) : 'Unclassified'

  async function handleApplyTag() {
    if (!tagBoard && !tagStd) return
    await tagMutation.mutateAsync({ notes, board: tagBoard, standard: tagStd })
    setTagging(false)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2.5 flex-1 text-left"
        >
          <span className="font-bold text-gray-700 text-sm">{label}</span>
          {board && (
            <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
              {board}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''} · {notes.length} topic{notes.length !== 1 ? 's' : ''}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {isUnclassified && !tagging && (
            <button
              type="button"
              onClick={() => setTagging(true)}
              className="text-xs text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 px-2.5 py-1 rounded-lg font-medium"
            >
              + Tag Class/Board
            </button>
          )}
          <button type="button" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>

      {/* Quick tag panel for unclassified notes */}
      {isUnclassified && tagging && (
        <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-orange-700">Tag all {notes.length} topics as:</span>
          <select title="Board" value={tagBoard} onChange={e => setTagBoard(e.target.value)} className="text-xs border border-orange-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400">
            <option value="">Board (optional)</option>
            {BOARDS.filter(b => b !== 'Other').map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select title="Class" value={tagStd} onChange={e => setTagStd(e.target.value)} className="text-xs border border-orange-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400">
            <option value="">Class (optional)</option>
            {STANDARDS.map(s => <option key={s} value={s}>Class {s}</option>)}
          </select>
          <button
            type="button"
            disabled={(!tagBoard && !tagStd) || tagMutation.isPending}
            onClick={handleApplyTag}
            className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {tagMutation.isPending ? 'Saving…' : 'Apply'}
          </button>
          <button type="button" onClick={() => setTagging(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      )}

      {!collapsed && (
        <div className="p-3 space-y-2">
          {subjects.map(subject => (
            <SubjectGroup
              key={subject}
              subject={subject}
              notes={bySubject[subject] ?? []}
              searchQ={searchQ}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )

}

// ── Filter chip ───────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      {label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function NotesLibraryPage() {
  const [searchQ,        setSearchQ]        = useState('')
  const [activeBoard,    setActiveBoard]    = useState<string | null>(null)
  const [activeStandard, setActiveStandard] = useState<string | null>(null)
  const [activeSubject,  setActiveSubject]  = useState<string | null>(null)
  const [addOpen,        setAddOpen]        = useState(false)
  const [viewNote,       setViewNote]       = useState<any>(null)

  const { data, isLoading } = useAllNotes()
  const deleteMutation = useDeleteTopicNotes()

  const notes: any[] = Array.isArray(data) ? data : []

  // Derive filter options from data
  const boards    = useMemo(() => [...new Set(notes.map(n => n.board).filter(Boolean))].sort() as string[], [notes])
  const standards = useMemo(() => [...new Set(notes.map(n => n.standard).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b)) as string[], [notes])
  const subjects  = useMemo(() => [...new Set(notes.map(n => n.subject))].sort() as string[], [notes])

  // Apply filters
  const filtered = useMemo(() => notes.filter(n => {
    if (activeBoard    && n.board    !== activeBoard)    return false
    if (activeStandard && n.standard !== activeStandard) return false
    if (activeSubject  && n.subject  !== activeSubject)  return false
    if (searchQ && !n.topic.toLowerCase().includes(searchQ.toLowerCase()) && !n.subject.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  }), [notes, activeBoard, activeStandard, activeSubject, searchQ])

  // Group: (board, standard) → notes
  const groups = useMemo(() => {
    const map = new Map<string, { board: string | null; standard: string | null; notes: any[] }>()
    for (const n of filtered) {
      const key = `${n.board ?? ''}||${n.standard ?? ''}`
      if (!map.has(key)) map.set(key, { board: n.board ?? null, standard: n.standard ?? null, notes: [] })
      map.get(key)!.notes.push(n)
    }
    // Sort: classified first (has standard), then by standard numerically, then by board
    return [...map.values()].sort((a, b) => {
      if (!a.standard && b.standard) return 1
      if (a.standard && !b.standard) return -1
      if (a.standard !== b.standard) return parseInt(a.standard ?? '99') - parseInt(b.standard ?? '99')
      return (a.board ?? '').localeCompare(b.board ?? '')
    })
  }, [filtered])

  const hasFilters = activeBoard || activeStandard || activeSubject || searchQ

  function clearFilters() {
    setActiveBoard(null)
    setActiveStandard(null)
    setActiveSubject(null)
    setSearchQ('')
  }

  function handleDelete(note: any) {
    deleteMutation.mutate({ subject: note.subject, topic: note.topic })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <BookMarked className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">Notes Library</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            AI-generated study notes organised by board, class & subject
          </p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Topic Notes
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{notes.length}</div>
          <div className="text-xs text-indigo-500 mt-0.5">Topics</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{standards.length}</div>
          <div className="text-xs text-blue-500 mt-0.5">Standards</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <div className="text-2xl font-bold text-green-700">{subjects.length}</div>
          <div className="text-xs text-green-500 mt-0.5">Subjects</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
          <div className="text-2xl font-bold text-purple-700">
            {notes.filter(n => n.content?.experiment).length}
          </div>
          <div className="text-xs text-purple-500 mt-0.5">With Experiments</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9 py-2 w-full"
          placeholder="Search topics or subjects…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        {searchQ && (
          <button type="button" title="Clear search" onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter chips — always show all options */}
      {notes.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2 mb-5">
          {/* Standard chips — always visible */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide w-14 shrink-0">Class</span>
            <div className="flex gap-1.5 flex-wrap">
              {STANDARDS.map(s => (
                <Chip
                  key={s}
                  label={labelForStandard(s)}
                  active={activeStandard === s}
                  onClick={() => setActiveStandard(v => v === s ? null : s)}
                />
              ))}
            </div>
          </div>

          {/* Board chips — always visible */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide w-14 shrink-0">Board</span>
            <div className="flex gap-1.5 flex-wrap">
              {BOARDS.filter(b => b !== 'Other').map(b => (
                <Chip
                  key={b}
                  label={b}
                  active={activeBoard === b}
                  onClick={() => setActiveBoard(v => v === b ? null : b)}
                />
              ))}
            </div>
          </div>

          {/* Subject chips — only when data exists */}
          {subjects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide w-14 shrink-0">Subject</span>
              <div className="flex gap-1.5 flex-wrap">
                {subjects.map(s => (
                  <Chip
                    key={s}
                    label={s}
                    active={activeSubject === s}
                    onClick={() => setActiveSubject(v => v === s ? null : s)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active filter summary + clear */}
          {hasFilters && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500">
                Showing <span className="font-semibold text-indigo-600">{filtered.length}</span> of {notes.length} topics
                {activeStandard ? ` · ${labelForStandard(activeStandard)}` : ''}
                {activeBoard    ? ` · ${activeBoard}` : ''}
                {activeSubject  ? ` · ${activeSubject}` : ''}
              </span>
              <button
                type="button"
                title="Clear all filters"
                onClick={clearFilters}
                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-0.5"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-20 text-center text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 animate-pulse" />
          <p className="text-sm">Loading notes library…</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notes.length === 0 && (
        <div className="py-20 text-center">
          <BookMarked className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500 font-medium">No notes yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Generate notes for your first topic to build the library</p>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Generate First Topic
          </button>
        </div>
      )}

      {/* No results after filter */}
      {!isLoading && notes.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm mb-2">No topics match your filters</p>
          <button type="button" onClick={clearFilters} className="text-xs text-indigo-600 hover:underline">
            Clear all filters
          </button>
        </div>
      )}

      {/* Groups */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {groups.map(g => (
            <StandardGroup
              key={`${g.board ?? ''}||${g.standard ?? ''}`}
              board={g.board}
              standard={g.standard}
              notes={g.notes}
              searchQ={searchQ}
              onOpen={n => setViewNote(n)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {addOpen && <AddTopicModal onClose={() => setAddOpen(false)} />}
      {viewNote && (
        <TopicNotesModal
          subject={viewNote.subject}
          topic={viewNote.topic}
          board={viewNote.board ?? undefined}
          standard={viewNote.standard ?? undefined}
          onClose={() => setViewNote(null)}
        />
      )}
    </div>
  )
}
