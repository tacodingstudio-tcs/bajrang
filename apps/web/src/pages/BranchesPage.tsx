// src/pages/BranchesPage.tsx
import { useState } from 'react'
import {
  useBranches, useCreateBranch, useUpdateBranch, useDeactivateBranch, useActivateBranch,
  useUsers, useCreateUser, useResetUserPin, useDeactivateUser, useActivateUser,
} from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Plus, Building2, MapPin, Phone, FileText, CheckCircle, XCircle, AlertTriangle,
  Users, ChevronRight, KeyRound, UserX, UserCheck, ArrowLeft,
} from 'lucide-react'

const DOMAIN_LABELS: Record<string, string> = {
  retail:         'Retail / Kirana / General',
  restaurant:     'Restaurant',
  pharmacy:       'Pharmacy',
  electronics:    'Electronics',
  salon:          'Salon / Spa',
  jewellery:      'Jewellery',
  automobile:     'Automobile Workshop',
  hotel:          'Hotel',
  petrol_pump:    'Petrol Pump',
  coaching:       'Coaching Centre',
  sweet:          'Sweet Shop',
  catering:       'Catering',
  tiffin:         'Tiffin Service',
  gym:            'Gym / Fitness',
  diagnostic_lab: 'Diagnostic Lab',
  repair:         'Repair Shop',
  wholesale:      'Wholesale',
  clinic:         'Clinic',
  textile:        'Textile',
  hardware:       'Hardware Store',
  optical:        'Optical Store',
  pest_control:   'Pest Control',
  photography:    'Photography Studio',
  laundry:        'Laundry',
  printing:       'Printing',
  agri:           'Agriculture',
  enterprise:     'Enterprise',
}

const DOMAIN_KEYS = Object.keys(DOMAIN_LABELS)

// Domain-aware role names — underlying value stays 'manager'/'cashier'/'viewer'
// so permissions don't change, only the display label matches the business type.
const DOMAIN_ROLE_NAMES: Record<string, { manager: string; cashier: string; viewer: string }> = {
  // Retail / product
  retail:         { manager: 'Store Manager',        cashier: 'Cashier / Counter Staff', viewer: 'Helper'            },
  wholesale:      { manager: 'Sales Manager',        cashier: 'Sales Executive',         viewer: 'Helper'            },
  electronics:    { manager: 'Store Manager',        cashier: 'Sales Executive / Billing', viewer: 'Helper'          },
  hardware:       { manager: 'Store Manager',        cashier: 'Counter Staff / Billing', viewer: 'Helper'            },
  textile:        { manager: 'Store Manager',        cashier: 'Sales Staff / Billing',   viewer: 'Helper'            },
  optical:        { manager: 'Store Manager',        cashier: 'Optician / Billing',      viewer: 'Helper'            },
  jewellery:      { manager: 'Showroom Manager',     cashier: 'Salesperson / Billing',   viewer: 'Helper'            },
  sweet:          { manager: 'Shop Manager',         cashier: 'Counter Staff',           viewer: 'Helper'            },
  agri:           { manager: 'Centre Manager',       cashier: 'Sales / Billing Staff',   viewer: 'Helper'            },
  enterprise:     { manager: 'Branch Manager',       cashier: 'Accounts Executive',      viewer: 'Staff'             },
  // Food & hospitality
  restaurant:     { manager: 'Restaurant Manager',   cashier: 'Waiter / Counter Staff',  viewer: 'Kitchen Display'   },
  hotel:          { manager: 'Hotel Manager',        cashier: 'Front Desk / Receptionist', viewer: 'Housekeeping'    },
  catering:       { manager: 'Catering Manager',     cashier: 'Billing / Order Taker',   viewer: 'Kitchen Staff'     },
  tiffin:         { manager: 'Tiffin Manager',       cashier: 'Billing / Delivery',      viewer: 'Kitchen Staff'     },
  // Health & wellness
  pharmacy:       { manager: 'Pharmacy Manager',     cashier: 'Pharmacist / Counter',    viewer: 'Delivery Staff'    },
  clinic:         { manager: 'Clinic Manager',       cashier: 'Receptionist / Billing',  viewer: 'Staff'             },
  diagnostic_lab: { manager: 'Lab Manager',          cashier: 'Lab Technician',          viewer: 'Report Viewer'     },
  // Beauty & fitness
  salon:          { manager: 'Salon Manager',        cashier: 'Stylist / Beautician',    viewer: 'Assistant'         },
  gym:            { manager: 'Gym Manager',          cashier: 'Trainer / Front Desk',    viewer: 'Helper'            },
  // Automotive & repairs
  automobile:     { manager: 'Workshop Manager',     cashier: 'Mechanic / Billing',      viewer: 'Helper'            },
  repair:         { manager: 'Service Manager',      cashier: 'Technician / Billing',    viewer: 'Helper'            },
  // Education & services
  coaching:       { manager: 'Centre Manager',       cashier: 'Teacher / Billing',       viewer: 'Admin Staff'       },
  petrol_pump:    { manager: 'Pump Manager',         cashier: 'Attendant / Cashier',     viewer: 'Staff'             },
  pest_control:   { manager: 'Operations Manager',   cashier: 'Technician / Billing',    viewer: 'Field Staff'       },
  photography:    { manager: 'Studio Manager',       cashier: 'Photographer / Billing',  viewer: 'Assistant'         },
  laundry:        { manager: 'Store Manager',        cashier: 'Counter Staff',           viewer: 'Helper'            },
  printing:       { manager: 'Press Manager',        cashier: 'Operator / Billing',      viewer: 'Helper'            },
}

const DEFAULT_ROLE_NAMES = { manager: 'Manager', cashier: 'Cashier / Staff', viewer: 'Viewer' }

function getRoleNames(domainType?: string) {
  return DOMAIN_ROLE_NAMES[domainType ?? ''] ?? DEFAULT_ROLE_NAMES
}

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  cashier: 'bg-green-100 text-green-700',
  viewer:  'bg-gray-100 text-gray-600',
}

// ── Branch create/edit modal ──────────────────────────────────────────────────

function BranchModal({ branch, onClose }: { branch?: any; onClose: () => void }) {
  const createBranch = useCreateBranch()
  const updateBranch = useUpdateBranch()
  const isEdit = !!branch

  const [form, setForm] = useState({
    name:       branch?.name       ?? '',
    domainType: branch?.domainType ?? 'retail',
    gstin:      branch?.gstin      ?? '',
    city:       branch?.city       ?? '',
    phone:      branch?.phone      ?? '',
    address:    branch?.address?.line1 ?? '',
  })

  async function handleSubmit() {
    if (!form.name.trim()) return
    const payload = {
      name:       form.name.trim(),
      domainType: form.domainType,
      gstin:      form.gstin || undefined,
      city:       form.city  || undefined,
      address:    form.address ? { line1: form.address } : undefined,
    }
    if (isEdit) {
      await updateBranch.mutateAsync({ id: branch.id, ...payload })
    } else {
      await createBranch.mutateAsync(payload)
    }
    onClose()
  }

  const busy = createBranch.isPending || updateBranch.isPending

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-base font-semibold text-gray-900 mb-5">
          {isEdit ? 'Edit branch' : 'Add new branch'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="label">Branch name *</label>
            <input className="input" placeholder="e.g. Rajkot Main Branch"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div>
            <label className="label">Business type *</label>
            <select className="input" value={form.domainType}
              onChange={(e) => setForm({ ...form, domainType: e.target.value })}
              disabled={isEdit} aria-label="Business type">
              {DOMAIN_KEYS.map((k) => (
                <option key={k} value={k}>{DOMAIN_LABELS[k]}</option>
              ))}
            </select>
            {isEdit && (
              <p className="text-xs text-gray-400 mt-1">Business type cannot be changed after creation</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="Rajkot" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="98765 43210" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">GSTIN</label>
            <input className="input" placeholder="24AAAAA0000A1Z5" value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              maxLength={15} />
          </div>

          <div>
            <label className="label">Address</label>
            <input className="input" placeholder="Shop no., Street, Area" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={busy || !form.name.trim()} className="btn-primary">
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create branch'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Branch toggle confirm ─────────────────────────────────────────────────────

function ToggleConfirmDialog({ branch, onClose }: { branch: any; onClose: () => void }) {
  const deactivate = useDeactivateBranch()
  const activate   = useActivateBranch()
  const isActive   = branch.isActive
  const busy       = deactivate.isPending || activate.isPending

  async function handleConfirm() {
    if (isActive) { await deactivate.mutateAsync(branch.id) }
    else          { await activate.mutateAsync(branch.id) }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-red-50' : 'bg-green-50'}`}>
            <AlertTriangle className={`w-4 h-4 ${isActive ? 'text-red-500' : 'text-green-600'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {isActive ? 'Deactivate branch?' : 'Activate branch?'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {isActive
                ? `Staff assigned to "${branch.name}" will lose access immediately.`
                : `"${branch.name}" will become accessible to assigned staff again.`}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={busy}
            className={isActive ? 'btn-danger' : 'btn-primary'}>
            {busy ? 'Please wait…' : isActive ? 'Yes, deactivate' : 'Yes, activate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add user modal ────────────────────────────────────────────────────────────

function AddUserModal({ branches, domainType, onClose }: { branches: any[]; domainType?: string; onClose: () => void }) {
  const rn = getRoleNames(domainType)
  const createUser = useCreateUser()
  const [form, setForm] = useState({
    name:      '',
    phone:     '',
    pin:       '',
    role:      'cashier',
    branchIds: [] as string[],
    lang:      'hi',
  })

  function toggleBranch(id: string) {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter((b) => b !== id)
        : [...f.branchIds, id],
    }))
  }

  async function handleSubmit() {
    if (!form.name.trim() || form.phone.length < 10 || form.pin.length !== 4) return
    await createUser.mutateAsync({
      name:      form.name.trim(),
      phone:     form.phone.trim(),
      pin:       form.pin,
      role:      form.role,
      branchIds: form.branchIds,
      lang:      form.lang,
    })
    onClose()
  }

  const canSubmit = form.name.trim() && form.phone.length >= 10 && form.pin.length === 4 && !createUser.isPending

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Add New User</h3>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="u-name">Full name *</label>
            <input id="u-name" className="input" placeholder="Ramesh Patel"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div>
            <label className="label" htmlFor="u-phone">Phone number *</label>
            <input id="u-phone" type="tel" className="input" placeholder="9876543210"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Used to log in to the app</p>
          </div>

          <div>
            <label className="label" htmlFor="u-pin">4-digit PIN *</label>
            <input id="u-pin" type="password" className="input" placeholder="••••"
              maxLength={4} value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
          </div>

          <div>
            <label className="label" htmlFor="u-role">Role *</label>
            <select id="u-role" className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cashier">{rn.cashier} — create invoices, record payments</option>
              <option value="manager">{rn.manager} — full access except owner settings</option>
              <option value="viewer">{rn.viewer} — read-only access</option>
            </select>
          </div>

          <div>
            <label className="label">Branch access</label>
            <p className="text-xs text-gray-400 mb-2">Leave all unchecked to grant access to all branches</p>
            <div className="space-y-1.5">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">{b.name}</span>
                  {!b.isActive && <span className="text-xs text-gray-400">(inactive)</span>}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="u-lang">Language</label>
            <select id="u-lang" className="input" value={form.lang}
              onChange={(e) => setForm({ ...form, lang: e.target.value })}>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
              <option value="gu">Gujarati</option>
              <option value="mr">Marathi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="kn">Kannada</option>
              <option value="bn">Bengali</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="btn-primary">
            {createUser.isPending ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reset PIN modal ───────────────────────────────────────────────────────────

function ResetPinModal({ user, onClose }: { user: any; onClose: () => void }) {
  const resetPin = useResetUserPin()
  const [pin, setPin] = useState('')

  async function handleSubmit() {
    if (pin.length !== 4) return
    await resetPin.mutateAsync({ id: user.id, pin })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Reset PIN</h3>
        <p className="text-sm text-gray-500 mb-4">Set a new 4-digit PIN for <strong>{user.name}</strong></p>

        <label className="label" htmlFor="new-pin">New PIN</label>
        <input id="new-pin" type="password" className="input mb-4" placeholder="••••"
          maxLength={4} value={pin} autoFocus
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="button" onClick={handleSubmit}
            disabled={pin.length !== 4 || resetPin.isPending} className="btn-primary">
            {resetPin.isPending ? 'Saving…' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Users panel ───────────────────────────────────────────────────────────────

function UsersPanel({ branches, domainType, onBack }: { branches: any[]; domainType?: string; onBack: () => void }) {
  const role = useAuthStore((s) => s.user?.role)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const { data, isLoading } = useUsers()
  const deactivate = useDeactivateUser()
  const activate   = useActivateUser()
  const rn = getRoleNames(domainType)

  const [showAdd,     setShowAdd]     = useState(false)
  const [resetUser,   setResetUser]   = useState<any | null>(null)

  const users: any[] = data?.users ?? []

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Branches
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Users & Staff</h2>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        {role === 'owner' && (
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add User
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">No users yet. Add your first staff member.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf  = u.id === currentUserId
            const allBranches = !u.branchIds || u.branchIds.length === 0
            const branchNames = allBranches
              ? 'All branches'
              : u.branchIds.map((id: string) => branches.find((b) => b.id === id)?.name ?? id).join(', ')

            return (
              <div key={u.id} className={`card p-4 flex items-center gap-4 ${!u.isActive ? 'opacity-60' : ''}`}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-semibold text-primary-700 flex-shrink-0">
                  {u.name?.[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{u.name}</span>
                    {isSelf && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">You</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.role === 'owner' ? 'Owner' : u.role === 'manager' ? rn.manager : u.role === 'viewer' ? rn.viewer : rn.cashier}
                    </span>
                    {!u.isActive && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{u.phone}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{branchNames}</div>
                </div>

                {/* Actions — owner only, not on self */}
                {role === 'owner' && !isSelf && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button type="button"
                      onClick={() => setResetUser(u)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600"
                      title="Reset PIN">
                      <KeyRound className="w-3.5 h-3.5" />
                      Reset PIN
                    </button>
                    {u.isActive ? (
                      <button type="button"
                        onClick={() => deactivate.mutate(u.id)}
                        disabled={deactivate.isPending}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                        title="Deactivate user">
                        <UserX className="w-3.5 h-3.5" />
                        Deactivate
                      </button>
                    ) : (
                      <button type="button"
                        onClick={() => activate.mutate(u.id)}
                        disabled={activate.isPending}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                        title="Activate user">
                        <UserCheck className="w-3.5 h-3.5" />
                        Activate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd   && <AddUserModal branches={branches} domainType={domainType} onClose={() => setShowAdd(false)} />}
      {resetUser && <ResetPinModal user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BranchesPage() {
  const { data: branches, isLoading } = useBranches()
  const currentBranch = useAuthStore((s) => s.branch)
  const role          = useAuthStore((s) => s.user?.role)
  const domainType    = currentBranch?.domainType as string | undefined

  const [showModal,    setShowModal]    = useState(false)
  const [editBranch,   setEditBranch]   = useState<any | null>(null)
  const [toggleBranch, setToggleBranch] = useState<any | null>(null)
  const [view,         setView]         = useState<'branches' | 'users'>('branches')

  const list: any[] = branches ?? []

  if (view === 'users') {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Manage branches and users" />
        <div className="p-8">
          <UsersPanel branches={list} domainType={domainType} onBack={() => setView('branches')} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle={`${list.length} branch${list.length !== 1 ? 'es' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setView('users')}
              className="btn-ghost">
              <Users className="w-4 h-4" /> Manage Users
            </button>
            {role === 'owner' && (
              <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Branch
              </button>
            )}
          </div>
        }
      />

      <div className="p-8">
        {isLoading && <div className="text-gray-400 text-center py-12">Loading…</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((b) => {
            const isCurrent = b.id === currentBranch?.id
            return (
              <div key={b.id}
                className={`card p-5 relative ${isCurrent ? 'ring-2 ring-primary-500' : ''}`}>
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-xs bg-primary-100 text-primary-700 font-medium px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{b.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {DOMAIN_LABELS[b.domainType] ?? b.domainType}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500">
                  {b.city && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {b.city}
                    </div>
                  )}
                  {b.gstin && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> {b.gstin}
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> {b.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {b.isActive
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    {b.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>

                {role === 'owner' && (
                  <div className="flex items-center gap-3 mt-4">
                    <button type="button" onClick={() => setEditBranch(b)}
                      className="text-xs text-primary-600 hover:underline">
                      Edit
                    </button>
                    {!isCurrent && (
                      <button type="button" onClick={() => setToggleBranch(b)}
                        className={`text-xs hover:underline ${b.isActive ? 'text-red-500' : 'text-green-600'}`}>
                        {b.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    <button type="button" onClick={() => setView('users')}
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-auto">
                      Users <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showModal   && <BranchModal onClose={() => setShowModal(false)} />}
      {editBranch  && <BranchModal branch={editBranch} onClose={() => setEditBranch(null)} />}
      {toggleBranch && <ToggleConfirmDialog branch={toggleBranch} onClose={() => setToggleBranch(null)} />}
    </div>
  )
}
