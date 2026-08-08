// Night Audit — post room charges for all checked-in guests
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { hotelApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Moon, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export function NightAuditPage() {
  const [result, setResult] = useState<any>(null)

  const { data: dashboard } = useQuery({
    queryKey: ['hotel-dashboard'],
    queryFn:  hotelApi.dashboard,
  })

  const audit = useMutation({
    mutationFn: hotelApi.nightAudit,
    onSuccess: (data) => {
      setResult(data)
      toast.success(`Night audit complete — ${data.charged} folios charged`)
    },
    onError: () => toast.error('Night audit failed'),
  })

  const inHouseCount = dashboard?.inHouse?.length ?? 0

  return (
    <div>
      <PageHeader title="Night Audit" subtitle="Post nightly room charges for all in-house guests" />

      <div className="p-6 max-w-xl mx-auto space-y-6">
        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-blue-800 font-semibold">
            <Moon className="w-5 h-5" />
            Night Audit
          </div>
          <p className="text-sm text-blue-700">
            Running night audit will post one night's room charge to every checked-in guest folio.
            It also schedules housekeeping for tomorrow morning. If a folio already has a charge for
            today, it will be skipped to prevent double-posting.
          </p>
          <div className="text-sm text-blue-800 font-medium">
            Currently in-house: {inHouseCount} guest{inHouseCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Run button */}
        <button
          type="button"
          onClick={() => audit.mutate()}
          disabled={audit.isPending || inHouseCount === 0}
          className="btn-primary w-full justify-center py-3"
        >
          <Moon className="w-5 h-5 mr-2" />
          {audit.isPending ? 'Running Night Audit…' : 'Run Night Audit'}
        </button>

        {inHouseCount === 0 && (
          <p className="text-center text-sm text-gray-400">No guests currently checked in.</p>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Audit Complete — {result.date}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{result.charged}</div>
                <div className="text-xs text-green-600">Folios Charged</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700">{result.skipped}</div>
                <div className="text-xs text-yellow-600">Already Posted</div>
              </div>
            </div>
            {result.chargedFolios?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Charged:</p>
                <div className="flex flex-wrap gap-1">
                  {result.chargedFolios.map((f: string) => (
                    <span key={f} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-mono">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {result.skippedFolios?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium mb-2">
                  <AlertCircle className="w-3 h-3" /> Already posted today:
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.skippedFolios.map((f: string) => (
                    <span key={f} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
