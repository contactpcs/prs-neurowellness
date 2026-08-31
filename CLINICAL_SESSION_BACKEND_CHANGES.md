# Backend Changes Needed — Clinical Session Workflow

Companion doc to the doctor-side clinical session work (Initial Consultation → Follow-up → Protocol Follow-up → Protocol Device Session). Everything shipped so far was **explicitly scoped to frontend-only** — no schema or endpoint changes — per direction during that work. This document lists what was worked around on the frontend because the backend doesn't support it yet, so those workarounds can be replaced with the real thing.

Frontend files referenced below all live under `prs-neurowellness/src/`. Backend files referenced below all live under `db-backend-architecture-anava/backend/app/` and `db-backend-architecture-anava/SQL/`.

> **Update:** Item 1 below (anamnesis-to-session linkage) has since been **resolved** by a real `GET /patients/{id}/visits/{appointment_id}/summary` endpoint — see the note at the end of that section. Items 2, 4, and 6 are still open.

---

## 1. Anamnesis — RESOLVED: visit-scoped summary endpoint now exists

### Original problem
- `core.anamnesis_assessments` (`SQL/v1/05_tables_core.sql`) is already **versioned correctly** — every submission is a new, immutable row (`anamnesis_id = ANA-{patient8}-{version}`), never an UPDATE. `anamnesis/repository.py` confirms insert-only behavior.
- But the row was keyed only by `patient_id` + `assessment_stage`, with no `appointment_id` / `session_id` column, and `GET /patients/{id}/anamnesis` only ever returned the latest version — no way to fetch what was on record for a specific past session.
- Symptom: recording a new anamnesis from Follow-up 1 made that version show up everywhere, including under Consultation.

### Resolution (already shipped, both sides)
- Backend now exposes `GET /patients/{id}/visits/{appointment_id}/summary` (`ENDPOINTS.DOCTORS.VISIT_SUMMARY` in `lib/api/endpoints.ts`, called via `doctorsService.getVisitSummary`) — a bundle of `{ anamnesis, prs_instances, protocols, registration }` **scoped to that specific appointment**, with an `inherited` flag on each item distinguishing "recorded at this visit" from "carried over from an earlier one" (the initial visit always resolves anamnesis to version 1).
- Frontend: `lib/hooks/usePatientVisitSummary.ts` wraps it, and `app/(roles)/doctor/patients/[id]/page.tsx` now feeds the Anamnesis section (`initialRecord={visitSummary?.anamnesis}`) from this per-visit summary instead of the old always-latest fetch. `AnamnesisForm.tsx` also now takes `assessmentStage` and `appointmentId` props so a new submission is explicitly tagged to the visit it belongs to. The `lockedForSession` prop (blocks recording a new anamnesis from a non-current session) is still in place and still correct to keep — it stops the doctor from writing into the wrong visit's slot even though reads are now accurate.
- Remaining polish (not blocking): `components/doctor/CompareSessionsModal.tsx` and `lib/utils/clinicalSnapshot.ts` (`asOfSnapshot`) still reconstruct "PRS/protocol as of a date" via a **date-proximity heuristic** rather than calling `getVisitSummary` per session for the exact `prs_instances`/`protocols` bundle. `TreatmentPlanFull.tsx` *does* already call `getVisitSummary` per clinical session for its PRS-by-visit grid. Worth aligning `CompareSessionsModal` to the real per-visit data too — purely a frontend follow-up, no further backend work needed for this item.

---

## 2. Doctor Notes — the session-scoped table exists but has no working API

### Current state
- The real backend table, `core.doctor_session_notes` (`SQL/v1/05_tables_core.sql`), is already shaped correctly for this: required `session_id`, `cycle_id`, `session_number`, `session_phase` — i.e. one row per session by design, insert-only.
- There is **no live router** exposing it. `grep` across `clinical/router.py` and the rest of the backend finds no `doctor-session-notes` route.
- The frontend (`lib/api/services/doctorNotes.service.ts`, `lib/hooks/useDoctorNotes.ts`) is a **stub** built against a different, non-existent per-patient-upsert model. It does not call the real table at all.
- What's actually live today: a single per-patient "notepad" (`usePatientNote` in the patient workspace) — one row, overwritten on every save. This directly **violates** the "never overwrite previous clinical data" rule the rest of this workflow enforces (Anamnesis, PRS, EEG, Protocol are all properly versioned; Doctor Notes is the one exception).

### Workaround shipped
None — this was intentionally left as-is rather than building a UI that fakes session-scoping on top of a table that doesn't support it. `components/doctor/TreatmentPlanFull.tsx` reads the same single overwritable note (`doctorNoteText` prop) as a stand-in, clearly not session-accurate.

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

This is a reasonable approximation and works today. Anamnesis and PRS now both resolve to a specific appointment via `getVisitSummary` (see #1), which removes most of the practical risk here; Doctor Notes (#2) still has no linkage at all.

### What's needed (lower priority)
- Consider whether "which session is currently open/editable" should become an explicit backend concept (e.g. an `is_locked` / `closed_at` flag on the appointment, set when the next session starts) rather than the frontend inferring it from booking order. Not required for correctness today — flagging so a future edge case (e.g. two follow-ups booked for the same day, a cancelled-then-rebooked follow-up) doesn't silently produce a wrong "latest" session.

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

---

## 5. PRS / Brain Mapping "as of a session" — mostly resolved, one frontend follow-up left

### Current state
PRS and EEG are already properly versioned and already carry `session_id` server-side (see #3). Since the `GET /patients/{id}/visits/{appointment_id}/summary` endpoint from #1 already returns exact `prs_instances` for a given appointment, this is **no longer a backend gap** — `TreatmentPlanFull.tsx` already uses it for the per-visit PRS grid. `lib/utils/clinicalSnapshot.ts` (`asOfSnapshot`, a date-proximity heuristic predating that endpoint) is still used by `CompareSessionsModal.tsx`, and should be swapped for real `getVisitSummary` calls too — see the note at the end of #1.

### What's needed
Nothing on the backend. Frontend-only: replace the remaining `asOfSnapshot` call site in `CompareSessionsModal.tsx` with `doctorsService.getVisitSummary`.

---

## 6. Treatment Plan — no persistence at all; editable state lives only in the browser

### Current state
- `components/doctor/TreatmentPlanFull.tsx` implements the full doctor Treatment Plan screen (goal, session/frequency targets, medication plan, CA instructions, notes, a Draft → Set → Reopen lifecycle, and an append-only "Plan log" of every finalised version) — but there is no backend table backing any of it.
- `types/treatmentProtocol.types.ts` already declares a `TreatmentPlanRead` interface (`plan_id`, `patient_id`, `doctor_id`, `cycle_id`, `device_type`, `sessions_prescribed`, `standard_sessions`, `extended_sessions`, `status`, `parent_plan_id`) — strong evidence this was designed for once, but nothing in `endpoints.ts` or any service calls it, and a comment elsewhere in that file notes `plan_id` was actually **dropped** from `protocol_plan` in migration 48. So the concept exists in name only.
- `lib/utils/treatmentPlanStore.ts` persists the whole plan object (including the finalise log) to **`localStorage`**, keyed by the active protocol's id — same pattern as `finalReportLock.ts`, but carrying much more data (free-text goal/instructions/notes, and a clinical audit log of every "finalised" plan version). This is the least defensible of all the localStorage workarounds in this doc: an append-only clinical log that only exists in one browser is not really an audit log.
- The "Medication plan" field is free text only — there is no medication/prescription tracking module anywhere in this codebase (checked: no service, no type, no table reference). The Treatment Plan screen says so explicitly rather than fabricating a medication list.

### What's needed
- A real `treatment_plans` table (or resurrect/repurpose the existing `TreatmentPlanRead` shape) with fields for: goal, total sessions, sessions/week, review cadence, next review, medication plan text, CA instructions, notes, status (`draft`/`set`), `set_by`/`set_at`.
- An append-only `treatment_plan_versions` (or similar) table for the "Plan log" — one row per finalise action, never updated, mirroring how `treatment_protocols` versions itself.
- Endpoints: `GET /patients/{id}/treatment-plan` (current + log), `PUT /patients/{id}/treatment-plan` (save draft), `POST /patients/{id}/treatment-plan/finalize` (appends a new log entry, supersedes the previous one).
- If medication tracking is ever wanted as structured data (not just a free-text plan field), that's a separate, larger module with no existing groundwork — flagging it here since the mockup this screen was built from assumed one exists.

---

## Suggested priority

1. **Doctor Notes CRUD** (#2) — currently the only completely non-functional piece; the table already exists.
2. **Final Report persistence** (#4) — replaces a `localStorage` hack with a real, durable, auditable record.
3. **Treatment Plan persistence** (#6) — same class of problem as #4, and the biggest single chunk of clinical data currently living only in `localStorage`.
4. **Frontend follow-up to wire the remaining `asOfSnapshot` call site to `getVisitSummary`** (#5) — no backend work, just consistency cleanup.
5. **Session/appointment linkage as an explicit backend concept** (#3) — nice-to-have hardening, not blocking anything today.

Item 1 (anamnesis-to-session linkage) is done — see the update at the top of this document.

## Reference — files touched by the frontend-only implementation

**Frontend**
- `lib/hooks/usePatientClinicalSessions.ts` — session tab derivation
- `lib/hooks/usePatientVisitSummary.ts` — per-visit anamnesis/PRS/protocol bundle (backed by the real `getVisitSummary` endpoint)
- `components/doctor/SessionTabsBar.tsx`, `SessionFinalReportModal.tsx`, `CompareSessionsModal.tsx`, `TreatmentPlanFull.tsx`
- `components/assessment/AnamnesisForm.tsx`, `AnamnesisReadOnlyView.tsx`
- `lib/utils/finalReportLock.ts`, `lib/utils/clinicalSnapshot.ts`, `lib/utils/treatmentPlanStore.ts`
- `lib/api/services/anamnesis.service.ts`, `doctorNotes.service.ts` (stub)
- `app/(roles)/doctor/patients/[id]/page.tsx`, `app/(roles)/doctor/appointments/[id]/page.tsx`

**Backend (reviewed, not modified)**
- `SQL/v1/05_tables_core.sql` — `anamnesis_assessments`, `doctor_session_notes`, `prs_assessment_instances`, `patient_eeg_files`
- `app/modules/anamnesis/repository.py`, `app/modules/patients/router.py`
- `app/modules/clinical/router.py` (no `doctor-session-notes` route present)
