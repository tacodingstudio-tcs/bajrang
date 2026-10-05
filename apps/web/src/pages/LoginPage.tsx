// src/pages/LoginPage.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Store, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_LABELS: Record<string, string> = {
  owner:      'Owner',
  super_user: 'Super User',
  manager:    'Manager',
  cashier:    'Cashier',
  viewer:     'Housekeeping',
}

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [tenantPhone, setTenantPhone] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin]     = useState('')
  const pinRef = useRef<HTMLInputElement>(null)

  // Dev-only — lists every user of the seed tenant live, so newly created
  // test accounts show up here without editing this file. Backend 404s in
  // production, so the query just silently fails and the panel stays hidden.
  const { data: devUsers } = useQuery({
    queryKey: ['dev-users'],
    queryFn: authApi.devUsers,
    retry: false,
    staleTime: 30_000,
    enabled: import.meta.env.DEV,   // endpoint only exists in dev; avoid a 404 in prod
  })

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(tenantPhone, phone, pin),
    onSuccess: (data) => {
      setAuth(
        data.accessToken, data.refreshToken, data.accessTokenExpiresIn,
        data.user, data.tenant, data.branch
      )
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate(
        data.user.role === 'super_user' ? '/website'
        : data.user.role === 'viewer' ? '/hotel/housekeeping'
        : '/'
      )
    },
    onError: () => {
      toast.error('Invalid phone number or PIN')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tenantPhone.length < 10 || phone.length < 10 || pin.length !== 4) return
    loginMutation.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gray-50 px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-600 flex items-center justify-center mb-4 shadow-lg shadow-primary-600/20">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-600 mt-1">Sign in to your hotel dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Business phone number</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value.replace(/\D/g, ''))}
              className="input"
              autoFocus
            />
            <p className="text-xs text-gray-600 mt-1">The phone number your business registered with — same for every staff member.</p>
          </div>

          <div>
            <label className="label">Your phone number</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="input"
            />
          </div>

          <div>
            <label className="label">4-digit PIN</label>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="input text-center text-2xl tracking-[0.5em] font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={tenantPhone.length < 10 || phone.length < 10 || pin.length !== 4 || loginMutation.isPending}
            className="btn-primary w-full justify-center mt-2"
          >
            {loginMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : 'Sign in'}
          </button>
        </form>

        {!!devUsers?.users?.length && (
          <details className="mt-4">
            <summary className="text-center text-xs text-gray-600 cursor-pointer select-none">
              Dev credentials ▾
            </summary>
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
              {devUsers.users.map((u) => (
                <div
                  key={u.phone}
                  className="flex justify-between gap-2 cursor-pointer hover:text-primary-600 py-0.5"
                  onClick={() => {
                    setTenantPhone(devUsers.tenantPhone ?? '')
                    setPhone(u.phone)
                    setPin(u.pin)
                  }}
                >
                  <span className="font-medium w-24 shrink-0 truncate">{ROLE_LABELS[u.role] ?? u.role}</span>
                  <span>{u.phone}</span>
                  <span className="font-mono">{u.pin}</span>
                </div>
              ))}
              <p className="text-gray-600 pt-1">Click any row to auto-fill credentials. All dev PINs are reset to {devUsers.users[0]?.pin} on load.</p>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
