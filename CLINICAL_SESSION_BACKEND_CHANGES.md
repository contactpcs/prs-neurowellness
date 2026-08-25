# Backend Changes Needed — Clinical Session Workflow

Companion doc to the doctor-side clinical session work (Initial Consultation → Follow-up → Protocol Follow-up → Protocol Device Session). Everything shipped so far was **explicitly scoped to frontend-only** — no schema or endpoint changes — per direction during that work. This document lists what was worked around on the frontend because the backend doesn't support it yet, so those workarounds can be replaced with the real thing.

Frontend files referenced below all live under `prs-neurowellness/src/`. Backend files referenced below all live under `db-backend-architecture-anava/backend/app/` and `db-backend-architecture-anava/SQL/`.

---

## 1. Anamnesis — no way to link a version to a session, no way to fetch a past version

### Current state
- `core.anamnesis_assessments` (`SQL/v1/05_tables_core.sql`) is already **versioned correctly** — every submission is a new, immutable row (`anamnesis_id = ANA-{patient8}-{version}`), never an UPDATE. `anamnesis/repository.py` confirms insert-only behavior.
- But the row is keyed only by `patient_id` + `assessment_stage` ("general_registration" | "main_clinical"). There is **no `appointment_id` / `session_id` column**.
- The only read endpoint, `GET /patients/{id}/anamnesis` (`patients/router.py`, wrapped by `ENDPOINTS.ANAMNESIS.FOR_PATIENT` in `lib/api/endpoints.ts`), returns **only the latest version**. There is no history/list endpoint and no "get by id/version" endpoint exposed to the frontend.

### Why this matters
The doctor workspace has a session tab bar (Consultation / Follow-up 1 / Follow-up 2 / Protocol Follow-up 1 / …, built in `lib/hooks/usePatientClinicalSessions.ts` + `components/doctor/SessionTabsBar.tsx`). Each tab is supposed to show its own frozen anamnesis. Because the API can only ever return "the latest," recording a new anamnesis from Follow-up 1 makes that version show up **everywhere**, including under Consultation — it looks like historical data changed, when really the UI just has no way to ask for "the one that belonged to Consultation."

### Workaround shipped
`components/assessment/AnamnesisForm.tsx` now takes a `lockedForSession` prop: the doctor can only record a new anamnesis from the patient's **current/latest** session tab (computed by `usePatientClinicalSessions`). Every earlier tab shows the anamnesis read-only with no edit/record action. This stops new *corrupting* writes, but every locked tab still displays the same "latest" anamnesis rather than its own true historical version — that data still exists in the DB (nothing was lost) but is not retrievable through the current API.

### What's needed
- Add `appointment_id UUID REFERENCES appointments(appointment_id)` (nullable, for legacy rows) to `core.anamnesis_assessments`, set at `POST /patients/{id}/anamnesis/start` time. The caller (frontend) would pass the appointment_id of the session being conducted.
- One of:
  - `GET /patients/{id}/anamnesis/history` → all versions for that patient/stage, each with `appointment_id`, `version`, `completed_at`.
  - or `GET /anamnesis/{anamnesis_id}` → fetch one specific version by id.
  - or a `?appointment_id=` filter on the existing `GET /patients/{id}/anamnesis`.
- Frontend impact once available: fetch the anamnesis whose `appointment_id` matches the selected session tab instead of always "latest" — removes the `lockedForSession` read-only workaround entirely, since each tab would show its own real data instead of just being blocked from writing.

---

## 2. Doctor Notes — the session-scoped table exists but has no working API

### Current state
- The real backend table, `core.doctor_session_notes` (`SQL/v1/05_tables_core.sql`), is already shaped correctly for this: required `session_id`, `cycle_id`, `session_number`, `session_phase` — i.e. one row per session by design, insert-only.
- There is **no live router** exposing it. `grep` across `clinical/router.py` and the rest of the backend finds no `doctor-session-notes` route.
- The frontend (`lib/api/services/doctorNotes.service.ts`, `lib/hooks/useDoctorNotes.ts`) is a **stub** built against a different, non-existent per-patient-upsert model. It does not call the real table at all.
- What's actually live today: a single per-patient "notepad" (`usePatientNote` in the patient workspace) — one row, overwritten on every save. This directly **violates** the "never overwrite previous clinical data" rule the rest of this workflow enforces (Anamnesis, PRS, EEG, Protocol are all properly versioned; Doctor Notes is the one exception).

### Workaround shipped
None — this was intentionally left as-is rather than building a UI that fakes session-scoping on top of a table that doesn't support it. `components/doctor/TreatmentPlanPanel.tsx` reads the same single overwritable note (`doctorNoteText` prop) as a stand-in, clearly not session-accurate.

### What's needed
- Wire real endpoints for `core.doctor_session_notes`:
  - `POST /doctor-session-notes` — `{ appointment_id, note_text }` (resolve `session_id`/`cycle_id`/`session_number`/`session_phase` server-side from the appointment, the way `session_id` is already resolved elsewhere).
  - `GET /doctor-session-notes?patient_id=&appointment_id=` — list, filterable by patient and/or a specific session.
  - `GET /doctor-session-notes/{note_id}` — single note.
- Frontend impact: replace the single-note "notepad" with a per-session note list, exactly matching the pattern already built for Anamnesis (previous notes read-only, "Add Note" only from the current session).

---

## 3. Session/appointment linkage is inferred on the frontend, not authoritative

### Current state
`usePatientClinicalSessions.ts` builds the whole Consultation/Follow-up/Protocol Follow-up tab list, numbering, and "which one is currently editable" purely by:
- filtering the patient's appointments to `initial | follow_up | protocol_followup` (excluding `device_session`),
- requiring `status` to have reached `checked_in` before a Follow-up/Protocol Follow-up tab appears at all,
- sorting by date/time,
- treating the **last** one in that order as the only editable/"current" session — everything before it is frozen.

This is a reasonable approximation and works today, but it's inference, not a backend-enforced fact. PRS (`prs_assessment_instances.session_id`) and EEG (`patient_eeg_files.session_id`) already link to a real `sessions` table; Anamnesis and Doctor Notes (see #1, #2) don't yet.

### What's needed (lower priority than #1/#2)
- Once Anamnesis and Doctor Notes carry `appointment_id`, consider whether "which session is currently open/editable" should become an explicit backend concept (e.g. an `is_locked` / `closed_at` flag on the appointment, set when the next session starts) rather than the frontend inferring it from booking order. Not required for correctness today — flagging so a future edge case (e.g. two follow-ups booked for the same day, a cancelled-then-rebooked follow-up) doesn't silently produce a wrong "latest" session.

---

## 4. "Generate Final Report" has no backend at all

### Current state
- `components/doctor/SessionFinalReportModal.tsx` compiles whatever's already visible (anamnesis chief complaint, latest PRS score, protocol snapshot, doctor note) into an HTML document and calls `window.print()` — the browser's "Save as PDF" is the only persistence. Nothing is sent to or stored by the backend.
- Whether a Final Report has been generated for a given session is tracked in **`localStorage`** (`lib/utils/finalReportLock.ts`, `final_report_generated_${appointmentId}`), the same pattern already used for the EEG-analysis-job-in-progress flag. This flag is what locks the Treatment Plan (`treatmentPlanLocked` in the patient workspace page) once a report has been generated for the current-but-not-yet-superseded stage.
- Consequences of this being client-only: it doesn't sync across devices or browsers, doesn't survive the doctor clearing browser storage, isn't visible to reception/admin, and isn't auditable — a "final report was generated" fact should be a durable clinical record, not a browser flag.

### What's needed
- A real endpoint, e.g. `POST /patients/{id}/sessions/{appointment_id}/final-report`, that generates and stores a report artifact (PDF and/or structured JSON snapshot of anamnesis/PRS/protocol/notes as of that session) server-side.
- `GET /patients/{id}/sessions/{appointment_id}/final-report` to check existence / retrieve it.
- A persisted flag (on the appointment, or a new `session_reports` table) replacing `finalReportLock.ts` as the source of truth for whether a stage is locked-by-report.
- **This is the one item worth prioritizing highest** if any of these are picked up — right now "Generate Final Report" doesn't actually generate a stored report at all, and the lock it drives isn't durable.

---

## 5. PRS / Brain Mapping "as of a session" — exact linkage vs. best-effort snapshot (nice-to-have)

### Current state
PRS and EEG are already properly versioned and already carry `session_id` server-side (see #3) — this item is about **read ergonomics**, not data integrity. `lib/utils/clinicalSnapshot.ts` (`asOfSnapshot`) approximates "the PRS score / protocol version as of this session" by taking the latest `completed_at`/`created_at` on or before the session's date. Used by `CompareSessionsModal.tsx` ("View Changes") and `TreatmentPlanPanel.tsx` ("Progress Since …"). This is a reasonable trend indicator but not a guaranteed exact match to what was live at that specific appointment.

### What's needed (optional polish)
- Expose `appointment_id` (resolved from `session_id`) directly on the PRS instance and EEG report read models, or accept an `?appointment_id=` filter, so "PRS as of Follow-up 1" can be resolved exactly instead of by date proximity.

---

## Suggested priority

1. **Doctor Notes CRUD** (#2) — currently the only completely non-functional piece; the table already exists.
2. **Anamnesis appointment linkage + a way to fetch a specific version** (#1) — directly fixes the "data appears to change across sessions" bug that prompted this doc.
3. **Final Report persistence** (#4) — replaces a `localStorage` hack with a real, durable, auditable record; also the least defensible workaround of the three.
4. **Session/appointment linkage as an explicit backend concept** (#3) and **exact PRS/EEG-as-of-session linkage** (#5) — both nice-to-have hardening, not blocking anything today.

## Reference — files touched by the frontend-only implementation

**Frontend**
- `lib/hooks/usePatientClinicalSessions.ts` — session tab derivation
- `components/doctor/SessionTabsBar.tsx`, `SessionFinalReportModal.tsx`, `CompareSessionsModal.tsx`, `TreatmentPlanPanel.tsx`
- `components/assessment/AnamnesisForm.tsx`, `AnamnesisReadOnlyView.tsx`
- `lib/utils/finalReportLock.ts`, `lib/utils/clinicalSnapshot.ts`
- `lib/api/services/anamnesis.service.ts`, `doctorNotes.service.ts` (stub)
- `app/(roles)/doctor/patients/[id]/page.tsx`, `app/(roles)/doctor/appointments/[id]/page.tsx`

**Backend (reviewed, not modified)**
- `SQL/v1/05_tables_core.sql` — `anamnesis_assessments`, `doctor_session_notes`, `prs_assessment_instances`, `patient_eeg_files`
- `app/modules/anamnesis/repository.py`, `app/modules/patients/router.py`
- `app/modules/clinical/router.py` (no `doctor-session-notes` route present)
