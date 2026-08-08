// src/pages/POSSettingsPage.tsx
// POS hardware & display settings — stored in localStorage (no backend needed)

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

type Setting = {
  key: string
  label: string
  description: string
  type: 'select' | 'toggle'
  options?: { value: string; label: string }[]
  default: string
}

const SETTINGS: Setting[] = [
  {
    key: 'pos_thermal_width',
    label: 'Thermal Printer Width',
    description: 'Paper roll width for your thermal receipt printer. Most modern printers use 80mm; older or compact printers use 58mm.',
    type: 'select',
    options: [
      { value: '80mm', label: '80mm (standard)' },
      { value: '58mm', label: '58mm (compact)' },
    ],
    default: '80mm',
  },
  {
    key: 'pos_customer_display',
    label: 'Customer Display Screen',
    description: 'Show a second window on a customer-facing monitor displaying the current cart and total. Click the 📺 Display button on the billing page to open it.',
    type: 'toggle',
    default: 'false',
  },
  {
    key: 'pos_weighing_scale',
    label: 'Weighing Scale (Web Serial)',
    description: 'Connect a serial/USB weighing scale and auto-fill weight into the qty field for items sold in kg or gm. Requires Chrome or Edge browser.',
    type: 'toggle',
    default: 'false',
  },
  {
    key: 'pos_price_groups',
    label: 'Price Groups (Retail / Wholesale / Special)',
    description: 'Enable per-party price groups. Set a price group on a party and define wholesale/special prices per product — the correct price loads automatically when billing.',
    type: 'toggle',
    default: 'false',
  },
  {
    key: 'pos_barcode_dedicated',
    label: 'Dedicated Barcode Scanner',
    description: 'Enable when using a dedicated USB barcode scanner (not keyboard wedge mode). In keyboard wedge mode scanners emulate keyboard input and work automatically via the Enter key.',
    type: 'toggle',
    default: 'false',
  },
]

function getVal(key: string, def: string) {
  return localStorage.getItem(key) ?? def
}

export function POSSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const s of SETTINGS) init[s.key] = getVal(s.key, s.default)
    return init
  })
  const [saved, setSaved] = useState(false)

  function handleChange(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, value)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader title="POS Settings" subtitle="Hardware and display configuration for your point of sale" />

      <div className="p-8 max-w-2xl space-y-6">
        {SETTINGS.map(setting => (
          <div key={setting.key} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{setting.label}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{setting.description}</p>
              </div>

              <div className="flex-shrink-0 mt-0.5">
                {setting.type === 'select' ? (
                  <select
                    title={setting.label}
                    value={values[setting.key]}
                    onChange={e => handleChange(setting.key, e.target.value)}
                    className="input text-sm w-40"
                  >
                    {setting.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={values[setting.key] === 'true'}
                    onClick={() => handleChange(setting.key, values[setting.key] === 'true' ? 'false' : 'true')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      values[setting.key] === 'true' ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform ${
                        values[setting.key] === 'true' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary px-6 py-2"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">✓ Settings saved</span>
          )}
        </div>

        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-700">
            <strong>Note:</strong> Settings take effect immediately after saving. Changes to price groups and customer display require refreshing the billing page.
          </p>
        </div>
      </div>
    </div>
  )
}
