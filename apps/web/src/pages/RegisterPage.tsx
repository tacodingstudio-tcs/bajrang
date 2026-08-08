// src/pages/RegisterPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import {
  Store, ChevronRight, ChevronLeft, Loader2, Check,
  ShoppingCart, Utensils, Pill, Package, Scissors, Zap,
  Shirt, Hammer, Gem, Car, Sprout, ChefHat, Printer,
  Hotel, GraduationCap, WashingMachine, Fuel, Wrench, UtensilsCrossed,
  Dumbbell, Microscope, Bug, Camera, Building2, Stethoscope,
  Candy, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

// ── Domain definitions (mirrors DOMAIN_REGISTRY labels) ──────────────────────
const DOMAINS = [
  { key: 'retail',         label: 'Retail / Kirana',      icon: ShoppingCart  },
  { key: 'restaurant',     label: 'Restaurant',            icon: Utensils      },
  { key: 'pharmacy',       label: 'Pharmacy',              icon: Pill          },
  { key: 'wholesale',      label: 'Wholesale',             icon: Package       },
  { key: 'salon',          label: 'Salon / Parlour',       icon: Scissors      },
  { key: 'electronics',    label: 'Electronics',           icon: Zap           },
  { key: 'textile',        label: 'Textile / Clothing',    icon: Shirt         },
  { key: 'hardware',       label: 'Hardware',              icon: Hammer        },
  { key: 'jewellery',      label: 'Jewellery',             icon: Gem           },
  { key: 'automobile',     label: 'Automobile',            icon: Car           },
  { key: 'agri',           label: 'Agriculture',           icon: Sprout        },
  { key: 'catering',       label: 'Catering',              icon: ChefHat       },
  { key: 'printing',       label: 'Printing / Packaging',  icon: Printer       },
  { key: 'hotel',          label: 'Hotel / Lodge',         icon: Hotel         },
  { key: 'coaching',       label: 'Coaching / Classes',    icon: GraduationCap },
  { key: 'laundry',        label: 'Laundry',               icon: WashingMachine },
  { key: 'petrol_pump',    label: 'Petrol Pump',           icon: Fuel          },
  { key: 'repair',         label: 'Repair / Service',      icon: Wrench        },
  { key: 'tiffin',         label: 'Tiffin / Mess',         icon: UtensilsCrossed },
  { key: 'gym',            label: 'Gym / Fitness',         icon: Dumbbell      },
  { key: 'diagnostic_lab', label: 'Diagnostic Lab',        icon: Microscope    },
  { key: 'pest_control',   label: 'Pest Control',          icon: Bug           },
  { key: 'photography',    label: 'Photography / Studio',  icon: Camera        },
  { key: 'enterprise',     label: 'Enterprise / B2B',      icon: Building2     },
  { key: 'clinic',         label: 'Clinic / Doctor',       icon: Stethoscope   },
  { key: 'sweet',          label: 'Sweets / Bakery',       icon: Candy         },
  { key: 'optical',        label: 'Optical',               icon: Eye           },
]

const STEP_LABELS = ['Business type', 'Business details', 'Owner & PIN']

// ── API call (unauthenticated — public endpoint) ──────────────────────────────
async function registerTenant(payload: {
  businessName: string
  ownerName: string
  phone: string
  pin: string
  domainType: string
  gstin?: string
  city?: string
  lang: string
}) {
  const res = await api.post('/tenants/register', payload)
  return res.data
}

async function checkPhone(phone: string): Promise<boolean> {
  const res = await axios.get(`/api/tenants/check-phone/${phone}`)
  return res.data.available
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate  = useNavigate()
  const setAuth   = useAuthStore((s) => s.setAuth)
  const [step, setStep] = useState(0)

  // Step 1 — domain
  const [domainType, setDomainType] = useState('')

  // Step 2 — business
  const [businessName, setBusinessName] = useState('')
  const [city, setCity]                 = useState('')
  const [gstin, setGstin]               = useState('')

  // Step 3 — owner
  const [ownerName, setOwnerName]         = useState('')
  const [phone, setPhone]                 = useState('')
  const [pin, setPin]                     = useState('')
  const [confirmPin, setConfirmPin]       = useState('')
  const [phoneAvailable, setPhoneAvail]   = useState<boolean | null>(null)
  const [checkingPhone, setCheckingPhone] = useState(false)

  // Debounced phone availability check
  useEffect(() => {
    if (phone.length !== 10) { setPhoneAvail(null); return }
    setCheckingPhone(true)
    const t = setTimeout(async () => {
      try {
        const available = await checkPhone(phone)
        setPhoneAvail(available)
      } catch {
        setPhoneAvail(null)
      } finally {
        setCheckingPhone(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [phone])

  const registerMutation = useMutation({
    mutationFn: () => registerTenant({
      businessName: businessName.trim(),
      ownerName:    ownerName.trim(),
      phone,
      pin,
      domainType,
      gstin:        gstin.trim() || undefined,
      city:         city.trim() || undefined,
      lang:         'hi',
    }),
    onSuccess: async (data) => {
      toast.success('Account created! Signing you in…')
      // Auto-login after registration
      try {
        const loginRes = await api.post('/auth/login', { tenantPhone: phone, phone, pin })
        const d = loginRes.data
        setAuth(d.accessToken, d.refreshToken, d.accessTokenExpiresIn, d.user, d.tenant, d.branch)
        navigate('/')
      } catch {
        toast.success('Registration successful! Please log in.')
        navigate('/login')
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Registration failed'
      toast.error(msg)
    },
  })

  // ── Step validation ──────────────────────────────────────────────────────────
  const step1Valid = !!domainType
  const step2Valid = businessName.trim().length >= 2
  const step3Valid =
    ownerName.trim().length >= 2 &&
    phone.length === 10 &&
    phoneAvailable === true &&
    pin.length === 4 &&
    pin === confirmPin

  function next() {
    if (step === 0 && step1Valid) setStep(1)
    else if (step === 1 && step2Valid) setStep(2)
    else if (step === 2 && step3Valid) registerMutation.mutate()
  }

  function back() { if (step > 0) setStep(step - 1) }

  const selectedDomain = DOMAINS.find((d) => d.key === domainType)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gray-50 px-4 py-8">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-600 flex items-center justify-center mb-4 shadow-lg shadow-primary-600/20">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your billing dashboard in under a minute</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                i === step ? 'text-primary-600' : i < step ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                  i < step
                    ? 'bg-green-600 border-green-600 text-white'
                    : i === step
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 h-px transition-colors ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="card p-6">

          {/* ── Step 0: Domain selection ── */}
          {step === 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">What type of business do you run?</p>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {DOMAINS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDomainType(key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                      domainType === key
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${domainType === key ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className="leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Business details ── */}
          {step === 1 && (
            <div className="space-y-4">
              {selectedDomain && (
                <div className="flex items-center gap-2 text-sm text-primary-700 bg-primary-50 rounded-lg px-3 py-2">
                  <selectedDomain.icon className="w-4 h-4" />
                  <span className="font-medium">{selectedDomain.label}</span>
                </div>
              )}
              <div>
                <label className="label">Business name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Krishna General Store"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="input"
                  autoFocus
                  maxLength={200}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  placeholder="e.g. Ahmedabad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="label">GSTIN <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. 24AABCR1234A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="input font-mono tracking-wide"
                  maxLength={15}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Owner details ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="label">Your name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="input"
                  autoFocus
                  maxLength={100}
                />
              </div>
              <div>
                <label className="label">Mobile number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`input pr-8 ${
                      phoneAvailable === false ? 'border-red-400 focus:ring-red-300' :
                      phoneAvailable === true  ? 'border-green-400 focus:ring-green-300' : ''
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingPhone && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    {!checkingPhone && phoneAvailable === true  && <Check className="w-4 h-4 text-green-500" />}
                    {!checkingPhone && phoneAvailable === false && <span className="text-red-400 text-xs">Taken</span>}
                  </div>
                </div>
                {phoneAvailable === false && (
                  <p className="text-xs text-red-500 mt-1">
                    This number is already registered.{' '}
                    <Link to="/login" className="underline">Sign in instead?</Link>
                  </p>
                )}
              </div>
              <div>
                <label className="label">Set a 4-digit PIN <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="input text-center text-2xl tracking-[0.5em] font-semibold"
                />
              </div>
              <div>
                <label className="label">Confirm PIN <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className={`input text-center text-2xl tracking-[0.5em] font-semibold ${
                    confirmPin.length === 4 && confirmPin !== pin ? 'border-red-400 focus:ring-red-300' : ''
                  }`}
                />
                {confirmPin.length === 4 && confirmPin !== pin && (
                  <p className="text-xs text-red-500 mt-1">PINs do not match</p>
                )}
              </div>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="btn-secondary flex-1 justify-center"
                disabled={registerMutation.isPending}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={
                (step === 0 && !step1Valid) ||
                (step === 1 && !step2Valid) ||
                (step === 2 && (!step3Valid || registerMutation.isPending))
              }
              className="btn-primary flex-1 justify-center"
            >
              {registerMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step === 2 ? (
                'Create account'
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
