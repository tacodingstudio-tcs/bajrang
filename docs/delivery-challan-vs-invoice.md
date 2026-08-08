# Delivery Challan vs Invoice

## One-line distinction

> A challan moves goods. An invoice moves money.

---

## What each document is

### Invoice
A **demand for payment**. It says: "You received these goods, you owe me this money."

- GST is calculated and charged
- Creates a legal liability on the buyer
- Recorded in GST returns (GSTR-1)
- Buyer claims Input Tax Credit (ITC) based on this
- Payment terms run from invoice date

### Delivery Challan
A **proof of goods movement**. It says: "These goods left my premises and went to your location."

- No GST charged — it is not a sale document
- Not recorded in GST returns
- Creates no payment obligation
- Just acknowledges physical transfer of goods

---

## When they are different documents

### Situation 1 — Goods sent on approval / trial
```
Seller → [Delivery Challan] → Buyer tries goods
Buyer approves → Seller issues Invoice → Buyer pays
```
Goods have moved but the sale has not happened yet. Challan covers the movement. Invoice is raised only after acceptance.

### Situation 2 — Job work (fabric sent to tailor / parts sent for processing)
```
Factory → [Delivery Challan] → Job Worker (goods leave factory)
Job Worker does work → Returns goods with Delivery Challan
Factory issues Invoice for finished product to end customer
```
Under GST, goods sent for job work must travel under a challan (Rule 45). No invoice is raised between principal and job worker for the raw material movement.

### Situation 3 — Branch transfer (same company, different location)
```
Warehouse A → [Delivery Challan] → Warehouse B
```
No invoice — no sale happened. Same legal entity, just internal movement. Still requires a challan and possibly an E-Way Bill if value exceeds ₹50,000.

### Situation 4 — Wholesale with deferred billing
```
Distributor → [Delivery Challan] → Retailer   (goods delivered today)
End of month → Distributor issues Invoice for all deliveries that month
```
Common in FMCG distribution. Multiple challan deliveries are consolidated into one monthly invoice. The `delivery_challan_id` on the invoice is the link.

---

## Legal standing in India

| | Delivery Challan | Invoice |
|---|---|---|
| GST Act reference | Rule 55 of CGST Rules | Section 31 of CGST Act |
| Required fields | Challan No., date, consignor, consignee, goods description, quantity | GSTIN, HSN, GST rate, taxable value, tax amount |
| E-Way Bill | Can be generated against challan | Can also be generated against invoice |
| Appears in GSTR-1 | No | Yes |
| Buyer can claim ITC | No | Yes |
| Creates payment obligation | No | Yes |
| Mandatory when | Job work, approval basis, branch transfer | Every supply of goods/services |

---

## You can have a challan without an invoice
- Goods on approval (buyer hasn't accepted yet)
- Branch stock transfer (no sale)
- Job work dispatch

## You cannot have a valid invoice without goods movement having happened
- Issuing an invoice before delivering goods is considered a bogus invoice under GST law
- Can attract penalties and ITC reversal for the buyer

---

## How it sits in the codebase

`delivery_challan_id` appears in `invoiceDataSchema` for:

| Domain | Why |
|---|---|
| `wholesale` | Challan raised at dispatch, invoice follows on acceptance or month-end |
| `enterprise` | Same — large B2B orders often dispatched on challan first |
| `hardware` | Contractor receives material on challan, invoice raised after site confirmation |

The flow in wholesale/enterprise:

```
1. Goods dispatched → Delivery Challan created
                       (no GST, no payment, E-Way Bill generated against challan)
2. Goods received and accepted by buyer
3. Invoice raised → GST triggered → payment clock starts
   invoice.data.delivery_challan_id = challan.id   ← the link
```

---

## Common confusion: E-Way Bill

An E-Way Bill is required for movement of goods worth more than ₹50,000. It can be generated against **either** a challan or an invoice. This is why people confuse the three:

```
E-Way Bill  =  permission to move goods on the road
Challan     =  document that describes what goods moved and where
Invoice     =  document that says what money is owed
```

All three can exist together for the same transaction. In most wholesale deliveries:
- E-Way Bill is generated first (before truck leaves)
- Challan accompanies the goods in the truck
- Invoice is raised after delivery confirmation
