// src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Store, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [phone, setPhone] = useState('')
  const [pin, setPin]     = useState('')

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(phone, pin),
    onSuccess: (data) => {
      setAuth(
        data.accessToken, data.refreshToken, data.accessTokenExpiresIn,
        data.user, data.tenant, data.branch
      )
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate('/')
    },
    onError: () => {
      toast.error('Invalid phone number or PIN')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (phone.length < 10 || pin.length !== 4) return
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
          <p className="text-sm text-gray-500 mt-1">Sign in to your billing dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Phone number</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="label">4-digit PIN</label>
            <input
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
            disabled={phone.length < 10 || pin.length !== 4 || loginMutation.isPending}
            className="btn-primary w-full justify-center mt-2"
          >
            {loginMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          New business?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">
            Create account
          </Link>
        </p>

        <details className="mt-4">
          <summary className="text-center text-xs text-gray-400 cursor-pointer select-none">
            Dev credentials ▾
          </summary>
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            {[
              ['Kirana / Retail',   '9876543210', '1111'],
              ['Restaurant',        '9898765432', '3333'],
              ['Pharmacy',          '9925123456', '4444'],
              ['Electronics',       '9933445566', '7777'],
              ['Salon',             '9844001001', '8001'],
              ['Wholesale',         '9844002002', '8002'],
              ['Sweets',            '9844003003', '8003'],
              ['Clinic',            '9844004004', '8004'],
              ['Optical',           '9844005005', '8005'],
              ['Jewellery',         '9844006006', '8006'],
              ['Automobile',        '9844007007', '8007'],
              ['Textile',           '9844008008', '8008'],
              ['Hotel',             '9844009009', '8009'],
              ['Catering',          '9844010010', '8010'],
              ['Coaching',          '9844011011', '8011'],
              ['Printing',          '9844012012', '8012'],
              ['Laundry',           '9844013013', '8013'],
              ['Hardware',          '9845001001', '9001'],
              ['Petrol Pump',       '9845002002', '9002'],
              ['Agri',              '9845003003', '9003'],
              ['Repair',            '9845004004', '9004'],
              ['Tiffin',            '9845005005', '9005'],
              ['Gym',               '9846001001', '9101'],
              ['Diagnostic Lab',    '9846002002', '9102'],
              ['Pest Control',      '9846003003', '9103'],
              ['Photography',       '9846004004', '9104'],
              ['Enterprise',        '9911223344', '5555'],
              ['Tailoring',         '9847001001', '9201'],
              ['CA Firm',           '9847002002', '9202'],
              ['Gas Agency',        '9847003003', '9203'],
              ['Event Mgmt',        '9847004004', '9204'],
              ['Veterinary',        '9847005005', '9205'],
              ['Milk Dairy',        '9847006006', '9206'],
              ['Banquet Hall',      '9847007007', '9207'],
              ['Real Estate',       '9847008008', '9208'],
              ['Water Supply',      '9848001001', '9301'],
              ['Driving School',    '9848002002', '9302'],
              ['Interior Works',    '9848003003', '9303'],
              ['Packers & Movers',  '9848004004', '9304'],
              ['Security Agency',   '9848005005', '9305'],
              ['Daycare',           '9848006006', '9306'],
              ['Dance & Music',     '9848007007', '9307'],
              ['Footwear',          '9848008008', '9308'],
              ['Tent House',        '9848009009', '9309'],
              ['Iron & Steel',      '9849001001', '9401'],
            ].map(([domain, phone, pin]) => (
              <div
                key={phone}
                className="flex justify-between gap-2 cursor-pointer hover:text-primary-600 py-0.5"
                onClick={() => { setPhone(phone ?? ''); setPin(pin ?? '') }}
              >
                <span className="font-medium w-28 shrink-0">{domain}</span>
                <span>{phone}</span>
                <span className="font-mono">{pin}</span>
              </div>
            ))}
            <p className="text-gray-400 pt-1">Click any row to auto-fill credentials.</p>
          </div>
        </details>
      </div>
    </div>
  )
}
