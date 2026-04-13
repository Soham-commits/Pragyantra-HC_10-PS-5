# MediQ — Copilot Briefing Document
## Referral Module Implementation

---

## Step 0 — Read Everything First

Before writing a single line of code, read and fully understand the following:

**MediQ (existing codebase):**
- All backend routers, services, models
- MongoDB schema — especially scan and report records
- JWT auth implementation and role structure
- Doctor dashboard components and patient profile structure
- The existing doctor review workflow (how follow_up_flag works)

**AutoReferral (reference codebase — do NOT port everything blindly):**
- `agents/` — understand the orchestration logic
- `tools/` — specialist_search, availability, booking logic
- `services/` — referral workflow and state management
- `models/` — referral data schemas
- The reroute logic and audit trail structure

Take these two pieces specifically from AutoReferral:
1. The **reroute logic** — it is well structured, adapt it
2. The **audit trail pattern** — the array of state change events on each record

Do not port anything else wholesale. Everything new gets built natively inside MediQ.

---

## What We Are Building

MediQ is being extended with a **Referral Module.** AutoReferral ceases to exist as a standalone project. Its useful logic is absorbed into MediQ as a module.

The goal is a single end-to-end system:
> Scan → AI Detection → Report → Doctor Review → Referral → (Appointments — future phase)

---

## The 4 Roles in the Merged System

| Role | Region | Responsibility |
|---|---|---|
| Patient | USA | Uploads scans, views reports, receives referral status |
| Referring Doctor | USA | Reviews scans, initiates referrals to specialists |
| Specialist | India | Receives referrals, reviews case context, accepts or declines |
| Hospital Admin | India | Oversees all specialists and referrals under their hospital |

Add `specialist` and `hospital_admin` as new roles in the existing JWT auth system. Do not modify how existing `patient` and `doctor` roles work.

---

## What You Are NOT Allowed to Touch

This is critical. MediQ's core is fully built and working.

- ❌ Do not modify the AI inference pipeline
- ❌ Do not modify Grad-CAM generation logic
- ❌ Do not modify the existing report generation system
- ❌ Do not modify the existing scan upload flow
- ❌ Do not modify the existing patient dashboard structure
- ❌ Do not modify existing auth logic — only extend it
- ❌ Do not modify existing MongoDB collections — only add new ones
- ❌ Do not modify existing API endpoints — only add new ones
- ❌ Do not implement appointments — that is a future phase, do not touch it

---

## What You Are Building — Referral Phase Only

### 1. MongoDB — 2 New Collections

**`specialists` collection**
```json
{
  "specialist_id": "string",
  "name": "string",
  "specialty": "string",
  "hospital_name": "string",
  "city": "string",
  "country": "string",
  "contact": "string",
  "is_registered": "bool",
  "hospital_admin_id": "string"
}
```

**`referrals` collection**
```json
{
  "referral_id": "string",
  "patient_id": "string",
  "source_scan_id": "string",
  "referring_doctor_id": "string",
  "specialist_id": "string | null",
  "external_specialist": {
    "name": "string",
    "specialty": "string",
    "contact": "string"
  },
  "clinical_notes": "string",
  "priority": "routine | urgent | emergency",
  "status": "pending | active | pending_registration | rerouted | completed | declined",
  "created_at": "datetime",
  "audit_log": []
}
```

Also add 2 new fields to the existing **scan record**:
- `referral_triggered: bool`
- `referral_id: string | null`

---

### 2. Backend — 4 New Endpoints

All under `/referrals/` router. Do not touch existing routers.

```
GET  /referrals/search?q=         → fuzzy search specialists by name or specialty
POST /referrals/create            → create referral record, fire invite if external
PATCH /referrals/{id}/status      → update status (accept / decline / reroute / complete)
GET  /referrals/patient/{id}      → fetch all referrals for a patient
```

Fuzzy search should match against `name`, `specialty`, and `hospital_name` fields in the specialists collection.

---

### 3. Frontend — 3 New Things Only

**Thing 1 — Referral Panel on Doctor's Patient Profile View**

Rules:
- If patient has zero scans → panel is completely hidden, not rendered
- If patient has at least one scan → panel is visible but collapsed by default
- When expanded, show:
  - Scan selector dropdown (patient may have multiple scans)
  - Specialist search bar with live suggestions dropdown
  - If no match found → show "Add External" form (name, specialty, contact)
  - Priority selector (Routine / Urgent / Emergency)
  - Clinical notes textarea
  - Confirm Referral button
- After referral is confirmed → panel shows referral status badge instead of the form
- Status badge states: Pending · Active · Awaiting Registration · Rerouted · Completed · Declined

**Thing 2 — Specialist Inbox (New Dashboard for Specialist Role)**

- List of incoming referrals
- Each referral card shows: patient name, scan type, prediction, confidence, priority, referring doctor name
- Clicking a card shows full detail: scan image, Grad-CAM, report, referring doctor remarks
- Actions: Accept · Decline
- Declined referral → referring doctor sees "Declined" status and can reroute

**Thing 3 — Referral Status on Patient Dashboard**

- New collapsed section below existing reports section
- Shows: specialist name, status badge, priority, date referred
- Read only — no actions for patient in this phase

---

### 4. Auth Extension

Extend existing JWT to support 2 new roles:
- `specialist`
- `hospital_admin`

Protect new routes accordingly:
- `/referrals/search` → doctor only
- `/referrals/create` → doctor only
- `/referrals/{id}/status` → specialist only
- `/referrals/patient/{id}` → doctor + patient + specialist

Do not change anything about existing role protection.

---

## Execution Order

Follow this exact sequence. Do not jump ahead.

1. Add `specialists` and `referrals` collections and models
2. Add `referral_triggered` and `referral_id` fields to scan model
3. Add new JWT roles (specialist, hospital_admin)
4. Build `/referrals/` router with all 4 endpoints
5. Build the Referral Panel component on doctor's patient profile
6. Build the Specialist Inbox dashboard
7. Add Referral Status section to patient dashboard
8. Seed a small mock dataset of Indian specialists for testing

---

## Strict Rules for Implementation

- One step at a time — do not start the next step until current step is confirmed working
- No changes to existing files unless explicitly adding the 2 new scan fields
- All new code goes into new files / new router / new components
- Do not implement anything related to appointments — that is a separate future phase
- Do not add Google Calendar integration — future phase
- Do not modify the AutoReferral repo — only read it for reference

---

## The Referral Payload (when doctor confirms)

This is what gets saved to the referrals collection:

```json
{
  "patient_id": "...",
  "source_scan_id": "...",
  "scan_type": "chest_xray | skin",
  "prediction": "normal | abnormal",
  "confidence": 0.87,
  "gradcam_url": "...",
  "referring_doctor_id": "...",
  "clinical_notes": "...",
  "priority": "routine | urgent | emergency",
  "specialist_id": "...",
  "external_specialist": null
}
```

If external specialist is entered instead:
```json
{
  "specialist_id": null,
  "external_specialist": {
    "name": "Dr. Example",
    "specialty": "Cardiology",
    "contact": "email or phone"
  },
  "status": "pending_registration"
}
```

---

That is the complete scope for Phase 1 — Referral Module.
Appointments are Phase 2 and will be briefed separately.