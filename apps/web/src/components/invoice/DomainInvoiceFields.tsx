// src/components/invoice/DomainInvoiceFields.tsx
//
// Domain-specific extra fields shown on the Create Invoice page.
// Each domain renders a collapsible card with only the fields that matter.
// Data flows up as a flat patch via onChange so the parent can merge into domainData.
import React from 'react'

interface Props {
  domainType: string
  data: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}

function f(val: unknown): string {
  return val == null ? '' : String(val)
}
function n(val: unknown): string {
  return val == null ? '' : String(val)
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

export function DomainInvoiceFields({ domainType, data, onChange }: Props) {
  const set = (key: string, val: unknown) => onChange({ [key]: val })

  // ── CLINIC ──────────────────────────────────────────────────────────────────
  if (domainType === 'clinic') {
    return (
      <Card title="Patient Details">
        <Field label="Patient Name">
          <input className="input" placeholder="Full name" value={f(data.patient_name)}
            onChange={e => set('patient_name', e.target.value)} />
        </Field>
        <Row>
          <Field label="Age">
            <input className="input" type="number" min={0} max={120} placeholder="Years"
              value={n(data.patient_age)} onChange={e => set('patient_age', e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="Gender">
            <select className="input" title="Gender" value={f(data.patient_gender)}
              onChange={e => set('patient_gender', e.target.value || undefined)}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </Field>
        </Row>
        <Field label="Visit Type">
          <select className="input" title="Visit type" value={f(data.visit_type) || 'opd'}
            onChange={e => set('visit_type', e.target.value)}>
            <option value="opd">OPD</option>
            <option value="follow_up">Follow-up</option>
            <option value="emergency">Emergency</option>
            <option value="ipd">IPD</option>
            <option value="teleconsult">Teleconsult</option>
          </select>
        </Field>
        <Field label="Referral Doctor">
          <input className="input" placeholder="Dr. name (optional)" value={f(data.referral_doctor)}
            onChange={e => set('referral_doctor', e.target.value || undefined)} />
        </Field>
        <Field label="Diagnosis Notes">
          <textarea className="input" rows={2} placeholder="Brief diagnosis..."
            value={f(data.diagnosis_notes)}
            onChange={e => set('diagnosis_notes', e.target.value || undefined)} />
        </Field>
      </Card>
    )
  }

  // ── DIAGNOSTIC LAB ───────────────────────────────────────────────────────────
  if (domainType === 'diagnostic_lab') {
    return (
      <Card title="Patient Details">
        <Field label="Patient Name" required>
          <input className="input" placeholder="Full name" value={f(data.patient_name)}
            onChange={e => set('patient_name', e.target.value)} />
        </Field>
        <Row>
          <Field label="Age">
            <input className="input" type="number" min={0} max={120} placeholder="Years"
              value={n(data.patient_age)} onChange={e => set('patient_age', e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="Gender">
            <select className="input" title="Gender" value={f(data.patient_gender)}
              onChange={e => set('patient_gender', e.target.value || undefined)}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </Field>
        </Row>
        <Field label="Referring Doctor">
          <input className="input" placeholder="Dr. name (optional)" value={f(data.ref_doctor)}
            onChange={e => set('ref_doctor', e.target.value || undefined)} />
        </Field>
        <Row>
          <Field label="Sample Collected At">
            <input className="input" type="datetime-local" value={f(data.sample_collected_at)}
              onChange={e => set('sample_collected_at', e.target.value || undefined)} />
          </Field>
          <Field label="Report Expected">
            <input className="input" type="datetime-local" value={f(data.report_expected_at)}
              onChange={e => set('report_expected_at', e.target.value || undefined)} />
          </Field>
        </Row>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.home_collection}
            onChange={e => set('home_collection', e.target.checked)} />
          Home collection
        </label>
        {!!data.home_collection && (
          <Field label="Collection Address">
            <input className="input" placeholder="Address for sample pickup" value={f(data.collection_address)}
              onChange={e => set('collection_address', e.target.value || undefined)} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-orange-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.urgent}
            onChange={e => set('urgent', e.target.checked)} />
          Urgent / Priority
        </label>
      </Card>
    )
  }

  // ── PHARMACY ─────────────────────────────────────────────────────────────────
  if (domainType === 'pharmacy') {
    return (
      <Card title="Prescription Details">
        <Field label="Patient Name">
          <input className="input" placeholder="Patient name" value={f(data.patient_name)}
            onChange={e => set('patient_name', e.target.value || undefined)} />
        </Field>
        <Field label="Doctor Name">
          <input className="input" placeholder="Prescribing doctor" value={f(data.doctor_name)}
            onChange={e => set('doctor_name', e.target.value || undefined)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.rx_required}
            onChange={e => set('rx_required', e.target.checked)} />
          Prescription received (Rx)
        </label>
      </Card>
    )
  }

  // ── SALON / SPA ──────────────────────────────────────────────────────────────
  if (domainType === 'salon') {
    return (
      <Card title="Service Details">
        <Field label="Stylist / Staff Name">
          <input className="input" placeholder="Who served the customer" value={f(data.staff_name)}
            onChange={e => set('staff_name', e.target.value || undefined)} />
        </Field>
        <Field label="Appointment Ref (optional)">
          <input className="input" placeholder="Booking / appt ID" value={f(data.appointment_ref)}
            onChange={e => set('appointment_ref', e.target.value || undefined)} />
        </Field>
      </Card>
    )
  }

  // ── REPAIR SHOP ───────────────────────────────────────────────────────────────
  if (domainType === 'repair') {
    return (
      <Card title="Device & Job Details">
        <Row>
          <Field label="Device Type">
            <select className="input" title="Device type" value={f(data.device_type)}
              onChange={e => set('device_type', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="mobile">Mobile</option>
              <option value="laptop">Laptop</option>
              <option value="tablet">Tablet</option>
              <option value="smartwatch">Smartwatch</option>
              <option value="tv">TV</option>
              <option value="ac">AC</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Physical Condition">
            <select className="input" title="Condition" value={f(data.physical_condition)}
              onChange={e => set('physical_condition', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="good">Good</option>
              <option value="scratched">Scratched</option>
              <option value="cracked">Cracked</option>
              <option value="water_damage">Water Damage</option>
              <option value="dead">Dead</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Brand">
            <input className="input" placeholder="e.g. Samsung" value={f(data.device_brand)}
              onChange={e => set('device_brand', e.target.value || undefined)} />
          </Field>
          <Field label="Model">
            <input className="input" placeholder="e.g. Galaxy S23" value={f(data.device_model)}
              onChange={e => set('device_model', e.target.value || undefined)} />
          </Field>
        </Row>
        <Field label="Problem Reported">
          <textarea className="input" rows={2} placeholder="Customer's complaint…"
            value={f(data.problem_reported)}
            onChange={e => set('problem_reported', e.target.value || undefined)} />
        </Field>
        <Row>
          <Field label="Technician">
            <input className="input" placeholder="Assigned to" value={f(data.technician_name)}
              onChange={e => set('technician_name', e.target.value || undefined)} />
          </Field>
          <Field label="Advance Collected (₹)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.advance_amount)}
              onChange={e => set('advance_amount', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
      </Card>
    )
  }

  // ── PEST CONTROL ─────────────────────────────────────────────────────────────
  if (domainType === 'pest_control') {
    return (
      <Card title="Service Details">
        <Field label="Service Address" required>
          <input className="input" placeholder="Where service is performed" value={f(data.service_address)}
            onChange={e => set('service_address', e.target.value)} />
        </Field>
        <Row>
          <Field label="Property Type">
            <select className="input" title="Property type" value={f(data.property_type)}
              onChange={e => set('property_type', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="industrial">Industrial</option>
              <option value="restaurant">Restaurant</option>
              <option value="hospital">Hospital</option>
            </select>
          </Field>
          <Field label="Area (sq.ft)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.area_sqft)}
              onChange={e => set('area_sqft', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Technician">
            <input className="input" placeholder="Name" value={f(data.technician_name)}
              onChange={e => set('technician_name', e.target.value || undefined)} />
          </Field>
          <Field label="Next Visit Date">
            <input className="input" type="date" value={f(data.next_visit_date)}
              onChange={e => set('next_visit_date', e.target.value || undefined)} />
          </Field>
        </Row>
        <Field label="Pest Type">
          <input className="input" placeholder="e.g. Cockroach, Termite, Mosquito" value={f(data.pest_type)}
            onChange={e => set('pest_type', e.target.value || undefined)} />
        </Field>
      </Card>
    )
  }

  // ── LAUNDRY ───────────────────────────────────────────────────────────────────
  if (domainType === 'laundry') {
    return (
      <Card title="Order Details">
        <Row>
          <Field label="Pickup Date">
            <input className="input" type="date" value={f(data.pickup_date)}
              onChange={e => set('pickup_date', e.target.value || undefined)} />
          </Field>
          <Field label="Delivery Date">
            <input className="input" type="date" value={f(data.delivery_date)}
              onChange={e => set('delivery_date', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Bag / Tag No.">
            <input className="input" placeholder="e.g. BAG-001" value={f(data.bag_no)}
              onChange={e => set('bag_no', e.target.value || undefined)} />
          </Field>
          <Field label="Total Pieces">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.total_pieces)}
              onChange={e => set('total_pieces', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.is_express}
            onChange={e => set('is_express', e.target.checked)} />
          Express service
        </label>
        <Field label="Special Instructions">
          <input className="input" placeholder="Stain treatment, fabric care…" value={f(data.special_instructions)}
            onChange={e => set('special_instructions', e.target.value || undefined)} />
        </Field>
      </Card>
    )
  }

  // ── COACHING ──────────────────────────────────────────────────────────────────
  if (domainType === 'coaching') {
    return (
      <Card title="Enrollment Details">
        <Field label="Student Name">
          <input className="input" placeholder="Student's full name" value={f(data.student_name)}
            onChange={e => set('student_name', e.target.value || undefined)} />
        </Field>
        <Row>
          <Field label="Batch / Course">
            <input className="input" placeholder="e.g. JEE Physics" value={f(data.batch_name)}
              onChange={e => set('batch_name', e.target.value || undefined)} />
          </Field>
          <Field label="Fee Month">
            <input className="input" type="month" value={f(data.fee_month)}
              onChange={e => set('fee_month', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Installment No.">
            <input className="input" type="number" min={1} placeholder="1" value={n(data.installment_no)}
              onChange={e => set('installment_no', e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="of Total">
            <input className="input" type="number" min={1} placeholder="e.g. 12" value={n(data.total_installments)}
              onChange={e => set('total_installments', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Field label="Discount Reason (optional)">
          <input className="input" placeholder="e.g. Sibling discount, scholarship" value={f(data.discount_reason)}
            onChange={e => set('discount_reason', e.target.value || undefined)} />
        </Field>
      </Card>
    )
  }

  // ── GYM ───────────────────────────────────────────────────────────────────────
  if (domainType === 'gym') {
    return (
      <Card title="Membership Details">
        <Field label="Member ID">
          <input className="input" placeholder="e.g. GYM-0042" value={f(data.member_id)}
            onChange={e => set('member_id', e.target.value || undefined)} />
        </Field>
        <Row>
          <Field label="Membership From">
            <input className="input" type="date" value={f(data.membership_from)}
              onChange={e => set('membership_from', e.target.value || undefined)} />
          </Field>
          <Field label="Membership To">
            <input className="input" type="date" value={f(data.membership_to)}
              onChange={e => set('membership_to', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Locker No. (optional)">
            <input className="input" placeholder="L-12" value={f(data.locker_no)}
              onChange={e => set('locker_no', e.target.value || undefined)} />
          </Field>
          <Field label="Admission Fee (₹)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.admission_fee)}
              onChange={e => set('admission_fee', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
      </Card>
    )
  }

  // ── TIFFIN ────────────────────────────────────────────────────────────────────
  if (domainType === 'tiffin') {
    return (
      <Card title="Subscription Billing">
        <Row>
          <Field label="Period From">
            <input className="input" type="date" value={f(data.billing_period_from)}
              onChange={e => set('billing_period_from', e.target.value || undefined)} />
          </Field>
          <Field label="Period To">
            <input className="input" type="date" value={f(data.billing_period_to)}
              onChange={e => set('billing_period_to', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Delivered Days">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.delivered_days)}
              onChange={e => set('delivered_days', e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="Paused Days">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.paused_days)}
              onChange={e => set('paused_days', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Field label="Delivery Address">
          <input className="input" placeholder="Customer's delivery address" value={f(data.delivery_address)}
            onChange={e => set('delivery_address', e.target.value || undefined)} />
        </Field>
        <Field label="Delivery Person">
          <input className="input" placeholder="Name of delivery boy" value={f(data.delivery_boy_name)}
            onChange={e => set('delivery_boy_name', e.target.value || undefined)} />
        </Field>
      </Card>
    )
  }

  // ── OPTICAL ───────────────────────────────────────────────────────────────────
  if (domainType === 'optical') {
    return (
      <Card title="Eye Prescription">
        <Field label="Patient Name">
          <input className="input" placeholder="Patient name" value={f(data.patient_name)}
            onChange={e => set('patient_name', e.target.value || undefined)} />
        </Field>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Right Eye (OD)</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['right_sph','right_cyl','right_axis','right_add'] as const).map(k => (
            <div key={k}>
              <div className="text-xs text-gray-400 mb-0.5">{k.replace('right_','').toUpperCase()}</div>
              <input className="input text-center text-xs px-1" type="number" step="0.25" placeholder="0"
                value={n(data[k])} onChange={e => set(k, e.target.value ? +e.target.value : undefined)} />
            </div>
          ))}
        </div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Left Eye (OS)</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['left_sph','left_cyl','left_axis','left_add'] as const).map(k => (
            <div key={k}>
              <div className="text-xs text-gray-400 mb-0.5">{k.replace('left_','').toUpperCase()}</div>
              <input className="input text-center text-xs px-1" type="number" step="0.25" placeholder="0"
                value={n(data[k])} onChange={e => set(k, e.target.value ? +e.target.value : undefined)} />
            </div>
          ))}
        </div>
        <Row>
          <Field label="Delivery Date">
            <input className="input" type="date" value={f(data.delivery_date)}
              onChange={e => set('delivery_date', e.target.value || undefined)} />
          </Field>
          <Field label="Advance Paid (₹)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.advance_paid)}
              onChange={e => set('advance_paid', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
      </Card>
    )
  }

  // ── HOTEL ─────────────────────────────────────────────────────────────────────
  if (domainType === 'hotel') {
    return (
      <Card title="Guest & Stay Details">
        <Row>
          <Field label="Guest Name">
            <input className="input" placeholder="Full name" value={f(data.guest_name)}
              onChange={e => set('guest_name', e.target.value || undefined)} />
          </Field>
          <Field label="Room No.">
            <input className="input" placeholder="e.g. 201" value={f(data.room_no)}
              onChange={e => set('room_no', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Check-in">
            <input className="input" type="date" value={f(data.check_in)}
              onChange={e => set('check_in', e.target.value || undefined)} />
          </Field>
          <Field label="Check-out">
            <input className="input" type="date" value={f(data.check_out)}
              onChange={e => set('check_out', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Adults">
            <input className="input" type="number" min={1} placeholder="1" value={n(data.adults)}
              onChange={e => set('adults', e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="Children">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.children)}
              onChange={e => set('children', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="ID Type">
            <select className="input" title="ID type" value={f(data.id_type)}
              onChange={e => set('id_type', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="aadhar">Aadhar</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving Licence</option>
              <option value="voter_id">Voter ID</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="ID Number">
            <input className="input" placeholder="ID number" value={f(data.id_number)}
              onChange={e => set('id_number', e.target.value || undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Booking Source">
            <select className="input" title="Booking source" value={f(data.booking_source)}
              onChange={e => set('booking_source', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="walk_in">Walk-in</option>
              <option value="phone">Phone</option>
              <option value="ota_makemytrip">MakeMyTrip</option>
              <option value="ota_goibibo">Goibibo</option>
              <option value="ota_booking">Booking.com</option>
              <option value="corporate">Corporate</option>
              <option value="direct_web">Direct / Website</option>
            </select>
          </Field>
          <Field label="Advance Paid (₹)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.advance_paid)}
              onChange={e => set('advance_paid', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
      </Card>
    )
  }

  // ── CATERING ──────────────────────────────────────────────────────────────────
  if (domainType === 'catering') {
    return (
      <Card title="Event Details">
        <Row>
          <Field label="Event Type">
            <select className="input" title="Event type" value={f(data.event_type)}
              onChange={e => set('event_type', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="wedding">Wedding</option>
              <option value="birthday">Birthday</option>
              <option value="corporate">Corporate</option>
              <option value="pooja">Pooja / Ceremony</option>
              <option value="social">Social Function</option>
              <option value="conference">Conference</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Pax Count">
            <input className="input" type="number" min={1} placeholder="Guests" value={n(data.pax_count)}
              onChange={e => set('pax_count', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Event Date">
            <input className="input" type="date" value={f(data.event_date)}
              onChange={e => set('event_date', e.target.value || undefined)} />
          </Field>
          <Field label="Advance Paid (₹)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.advance_paid)}
              onChange={e => set('advance_paid', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Field label="Event Venue">
          <input className="input" placeholder="Venue / location" value={f(data.event_venue)}
            onChange={e => set('event_venue', e.target.value || undefined)} />
        </Field>
        <div className="flex gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-gray-300"
              checked={!!data.is_outdoor} onChange={e => set('is_outdoor', e.target.checked)} />
            Outdoor event
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-gray-300"
              checked={!!data.requires_generator} onChange={e => set('requires_generator', e.target.checked)} />
            Generator required
          </label>
        </div>
      </Card>
    )
  }

  // ── PHOTOGRAPHY ───────────────────────────────────────────────────────────────
  if (domainType === 'photography') {
    return (
      <Card title="Shoot Details">
        <Row>
          <Field label="Event Date">
            <input className="input" type="date" value={f(data.event_date)}
              onChange={e => set('event_date', e.target.value || undefined)} />
          </Field>
          <Field label="Delivery Date">
            <input className="input" type="date" value={f(data.delivery_date)}
              onChange={e => set('delivery_date', e.target.value || undefined)} />
          </Field>
        </Row>
        <Field label="Event Venue">
          <input className="input" placeholder="Location / venue" value={f(data.event_venue)}
            onChange={e => set('event_venue', e.target.value || undefined)} />
        </Field>
        <Row>
          <Field label="Photographer">
            <input className="input" placeholder="Lead photographer" value={f(data.photographer_name)}
              onChange={e => set('photographer_name', e.target.value || undefined)} />
          </Field>
          <Field label="Shoot Hours">
            <input className="input" type="number" min={0} step={0.5} placeholder="e.g. 6" value={n(data.shoot_hours)}
              onChange={e => set('shoot_hours', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <Row>
          <Field label="Advance %">
            <input className="input" type="number" min={0} max={100} placeholder="50" value={n(data.advance_pct)}
              onChange={e => set('advance_pct', e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="Travel (km)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.travel_km)}
              onChange={e => set('travel_km', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.client_approval} onChange={e => set('client_approval', e.target.checked)} />
          Client approved brief / moodboard
        </label>
      </Card>
    )
  }

  // ── PRINTING ──────────────────────────────────────────────────────────────────
  if (domainType === 'printing') {
    return (
      <Card title="Print Job Details">
        <Row>
          <Field label="Job Order No.">
            <input className="input" placeholder="e.g. JO-2025-001" value={f(data.job_order_no)}
              onChange={e => set('job_order_no', e.target.value || undefined)} />
          </Field>
          <Field label="Delivery Date">
            <input className="input" type="date" value={f(data.delivery_date)}
              onChange={e => set('delivery_date', e.target.value || undefined)} />
          </Field>
        </Row>
        <Field label="Urgency">
          <select className="input" title="Urgency" value={f(data.urgency) || 'normal'}
            onChange={e => set('urgency', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="super_urgent">Super Urgent</option>
          </select>
        </Field>
        <Row>
          <Field label="Advance Paid (₹)">
            <input className="input" type="number" min={0} placeholder="0" value={n(data.advance_paid)}
              onChange={e => set('advance_paid', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <div className="flex gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-gray-300"
              checked={!!data.artwork_approved} onChange={e => set('artwork_approved', e.target.checked)} />
            Artwork approved
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-gray-300"
              checked={!!data.customer_design} onChange={e => set('customer_design', e.target.checked)} />
            Customer's own design
          </label>
        </div>
      </Card>
    )
  }

  // ── SWEET SHOP ────────────────────────────────────────────────────────────────
  if (domainType === 'sweet') {
    return (
      <Card title="Order Details">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.is_advance_order} onChange={e => set('is_advance_order', e.target.checked)} />
          Advance order (future delivery)
        </label>
        {!!data.is_advance_order && (
          <Row>
            <Field label="Delivery Date">
              <input className="input" type="date" value={f(data.delivery_date)}
                onChange={e => set('delivery_date', e.target.value || undefined)} />
            </Field>
            <Field label="Advance Paid (₹)">
              <input className="input" type="number" min={0} placeholder="0" value={n(data.advance_paid)}
                onChange={e => set('advance_paid', e.target.value ? +e.target.value : undefined)} />
            </Field>
          </Row>
        )}
      </Card>
    )
  }

  // ── AGRI ──────────────────────────────────────────────────────────────────────
  if (domainType === 'agri') {
    return (
      <Card title="Farmer & Crop Details">
        <Row>
          <Field label="Kisan / Farmer ID">
            <input className="input" placeholder="PM Kisan or local ID" value={f(data.kisan_id)}
              onChange={e => set('kisan_id', e.target.value || undefined)} />
          </Field>
          <Field label="Season">
            <select className="input" title="Season" value={f(data.season)}
              onChange={e => set('season', e.target.value || undefined)}>
              <option value="">Select…</option>
              <option value="kharif">Kharif</option>
              <option value="rabi">Rabi</option>
              <option value="zaid">Zaid</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Crop Name">
            <input className="input" placeholder="e.g. Wheat, Cotton" value={f(data.crop_name)}
              onChange={e => set('crop_name', e.target.value || undefined)} />
          </Field>
          <Field label="Land (acres)">
            <input className="input" type="number" min={0} step={0.1} placeholder="0" value={n(data.land_area_acres)}
              onChange={e => set('land_area_acres', e.target.value ? +e.target.value : undefined)} />
          </Field>
        </Row>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded border-gray-300"
            checked={!!data.subsidy_applied} onChange={e => set('subsidy_applied', e.target.checked)} />
          Government subsidy applied
        </label>
      </Card>
    )
  }

  // No domain-specific fields for this domain
  return null
}
