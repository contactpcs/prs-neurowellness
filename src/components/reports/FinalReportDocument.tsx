"use client";

import { Fragment, forwardRef } from "react";
// The colour Anava mark + wordmark (frontend/logo.png). Imported, not served
// from /public, so the bundler fingerprints it and the print window can load
// the same cached file.
import anavaLogo from "../../../logo.png";
import type {
  FinalReportNote,
  FinalReportPrsDisease,
  FinalReportScope,
  FinalReportSections,
  FinalReportSignature,
} from "@/types/finalReport.types";

const SCOPE_LABEL: Record<FinalReportScope, string> = {
  overall: "Overall — start of treatment to date",
  last_consultation: "Last consultation",
};

const ORIGIN_LABEL: Record<string, string> = {
  device_session: "Device session",
  initial: "Consultation",
  follow_up: "Follow-up",
  protocol_followup: "Protocol follow-up",
  general_registration: "Registration",
  registration: "Registration",
  main: "Assessment",
  main_clinical: "Clinical assessment",
};

const DOSAGE_LABEL: Record<string, [string, string]> = {
  prescribed_current_ma: ["Current", "mA"],
  prescribed_duration_min: ["Duration", "min"],
  ramp_seconds: ["Ramp", "s"],
  prescribed_tvns_wavelength: ["Wavelength", ""],
  prescribed_tvns_pattern: ["Pattern", ""],
  prescribed_tvns_strength_pct: ["Strength", "%"],
  prescribed_tvns_frequency_hz: ["Frequency", "Hz"],
  prescribed_tvns_pulse_width_us: ["Pulse width", "µs"],
  prescribed_tvns_duration_min: ["Duration", "min"],
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function words(value: string): string {
  return value.replace(/_/g, " ");
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    // A section may run across printed pages (session lists get long); only
    // its heading is kept with the content that follows it.
    <section className="mt-6">
      <h2 className="break-after-avoid text-sm font-bold text-neutral-900 uppercase tracking-wide border-b border-neutral-300 pb-1 mb-2.5">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-neutral-400 italic">{children}</p>;
}

const TH = "text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide px-2 py-1.5 border-b border-neutral-200";
const TD = "text-xs text-neutral-800 px-2 py-1.5 border-b border-neutral-100 align-top";
// Full grid (every cell boxed) — the anamnesis table.
const GRID_TH = "text-left text-[11px] font-semibold text-neutral-600 uppercase tracking-wide px-2 py-1.5 border border-neutral-300";
const GRID_TD = "text-xs text-neutral-800 px-2 py-1.5 border border-neutral-300 align-top";

function PrsDisease({ disease }: { disease: FinalReportPrsDisease }) {
  return (
    <div className="mb-4 break-inside-avoid-page">
      <p className="text-xs font-semibold text-neutral-900 mb-1.5">{disease.disease_name}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Taken at</th>
            <th className={TH}>Overall score</th>
            <th className={TH}>Scale-wise breakdown</th>
          </tr>
        </thead>
        <tbody>
          {disease.entries.map((entry) => (
            <tr key={entry.instance_id}>
              <td className={`${TD} whitespace-nowrap`}>{fmtDate(entry.completed_at)}</td>
              <td className={TD}>
                {ORIGIN_LABEL[entry.origin] ?? words(entry.origin)}
                {entry.session_number != null && ` #${entry.session_number}`}
                {(entry.device_name || entry.conditions.length > 0) && (
                  <span className="block text-[11px] text-neutral-500">
                    {[entry.device_name, entry.conditions.join(", ")].filter(Boolean).join(" · ")}
                  </span>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                {entry.score != null ? (
                  <>
                    <span className="font-semibold">{entry.score.toFixed(0)}</span>
                    <span className="text-neutral-400">/100</span>
                    {entry.severity_label && <span className="block text-[11px] text-neutral-500">{entry.severity_label}</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className={TD}>
                {entry.scales.length === 0
                  ? "—"
                  : entry.scales.map((s) => (
                      <span key={s.scale_code} className="block">
                        {s.scale_name}: <span className="font-medium">{s.value ?? "—"}</span>
                        {s.max != null && <span className="text-neutral-400">/{s.max}</span>}
                        {s.severity_label && <span className="text-neutral-500"> ({s.severity_label})</span>}
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full border-collapse mt-2">
        <thead>
          <tr>
            <th className={TH}>Last {disease.weekly_progress.weeks.length} weeks</th>
            {disease.weekly_progress.weeks.map((week) => (
              <th key={week} className={`${TH} text-center`}>
                {new Date(week).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>Weekly progress</td>
            {disease.weekly_progress.scores.map((score, i) => (
              <td key={i} className={`${TD} text-center font-medium`}>
                {score != null ? score.toFixed(0) : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface FinalReportDocumentProps {
  sections: FinalReportSections;
  diagnosis: string;
  /** Preview passes the notes the doctor has ticked so far; a signed report
   * already carries them in sections.doctor_notes. */
  notes?: FinalReportNote[];
  /** null while the report is still a preview. */
  signature: FinalReportSignature | null;
  contentHash?: string;
}

/** The Final Report as it is printed and as the patient reads it. Renders
 * only what it is given — for a signed report that is the frozen snapshot,
 * never live data. */
export const FinalReportDocument = forwardRef<HTMLDivElement, FinalReportDocumentProps>(function FinalReportDocument(
  { sections, diagnosis, notes, signature, contentHash },
  ref,
) {
  const doctorNotes = notes ?? sections.doctor_notes;
  const { patient, doctor, clinic, window: scopeWindow } = sections;

  return (
    <div ref={ref} className="relative bg-white text-neutral-900 p-6 sm:p-8 max-w-[820px] mx-auto">
      {/* Watermark. On screen it stays centred in view while the report
          scrolls (sticky, zero height so it takes no room); in print it is
          fixed, which the browser repeats on every page. */}
      <div aria-hidden="true" className="pointer-events-none sticky top-[30vh] z-0 h-0 print:fixed print:inset-0 print:h-auto print:flex print:items-center print:justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- must also render in the plain print window */}
        <img src={anavaLogo.src} alt="" className="mx-auto w-[60%] max-w-[460px] opacity-[0.07]" />
      </div>

      <header className="relative border-b-2 border-neutral-800 pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- must also render in the plain print window */}
            <img src={anavaLogo.src} alt="Anava" className="h-14 w-auto" />
            <div>
              <h1 className="text-xl font-bold">Final Report</h1>
              <p className="text-xs text-neutral-500 mt-0.5">{SCOPE_LABEL[sections.scope]}</p>
            </div>
          </div>
          {clinic && (
            <div className="text-right text-xs text-neutral-600">
              <p className="font-semibold text-neutral-900">{clinic.clinic_name}</p>
              {clinic.address && <p>{clinic.address}</p>}
              {clinic.phone && <p>{clinic.phone}</p>}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-3 text-xs">
          <div>
            <dt className="text-neutral-500">Patient</dt>
            <dd className="font-semibold">{patient?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">MRN</dt>
            <dd className="font-semibold">{patient?.mrn ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Date of birth</dt>
            <dd className="font-semibold">{fmtDate(patient?.dob)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Doctor</dt>
            <dd className="font-semibold">{doctor?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Report date</dt>
            <dd className="font-semibold">{fmtDate(signature?.signed_at ?? sections.generated_at)}</dd>
          </div>
          {scopeWindow.consultation && (
            <div className="col-span-2">
              <dt className="text-neutral-500">Period covered</dt>
              <dd className="font-semibold">
                {scopeWindow.from ? fmtDate(scopeWindow.from) : "First visit"} — {fmtDate(scopeWindow.consultation.appointment_date)}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <Section number={1} title="Anamnesis">
        {sections.anamnesis.length === 0 ? (
          <Empty>No anamnesis recorded.</Empty>
        ) : (
          sections.anamnesis.map((record) => (
            <div key={record.anamnesis_id} className="mb-3">
              <p className="text-xs font-semibold text-neutral-900 mb-1">
                Consultation anamnesis · {fmtDate(record.recorded_at)}
              </p>
              {/* One bordered grid per anamnesis: #, question, response, with
                  each catalogue section as a shaded group row. */}
              <table className="w-full border-collapse border border-neutral-300">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className={`${GRID_TH} w-8 text-center`}>#</th>
                    <th className={`${GRID_TH} w-1/2`}>Question</th>
                    <th className={GRID_TH}>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {record.sections.map((group, groupIndex) => {
                    const offset = record.sections.slice(0, groupIndex).reduce((count, g) => count + g.items.length, 0);
                    return (
                      <Fragment key={group.title}>
                        <tr className="bg-neutral-50">
                          <td colSpan={3} className={`${GRID_TD} text-[11px] font-semibold text-neutral-600 uppercase tracking-wide`}>
                            {group.title}
                          </td>
                        </tr>
                        {group.items.map((item, i) => (
                          <tr key={i}>
                            <td className={`${GRID_TD} text-center text-neutral-500`}>{offset + i + 1}</td>
                            <td className={`${GRID_TD} text-neutral-700`}>{item.question}</td>
                            <td className={`${GRID_TD} whitespace-pre-wrap`}>{item.answer ?? "—"}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </Section>

      <Section number={2} title="Diagnosis">
        {diagnosis.trim() ? (
          <p className="text-sm font-semibold whitespace-pre-wrap">{diagnosis}</p>
        ) : (
          <Empty>Diagnosis not entered yet.</Empty>
        )}
        {sections.diagnosis_codes.length > 0 && (
          <p className="text-xs text-neutral-600 mt-1.5">
            ICD-10: {sections.diagnosis_codes.map((d) => `${d.icd10_code}${d.icd10_description ? ` ${d.icd10_description}` : ""}`).join("; ")}
          </p>
        )}
      </Section>

      <Section number={3} title="Brain Mapping">
        <Empty>Not available.</Empty>
      </Section>

      <Section number={4} title="PRS">
        {sections.prs.diseases.length === 0 ? (
          <Empty>No completed PRS in this period.</Empty>
        ) : (
          sections.prs.diseases.map((disease) => <PrsDisease key={disease.disease_id ?? disease.disease_name} disease={disease} />)
        )}
      </Section>

      <Section number={5} title="Doctor's Notes">
        {doctorNotes.length === 0 ? (
          <Empty>No notes included.</Empty>
        ) : (
          doctorNotes.map((note) => (
            <div key={note.note_id} className="mb-2">
              <p className="text-[11px] text-neutral-500">
                {note.category} · {fmtDate(note.created_at)}
                {note.doctor_name && ` · ${note.doctor_name}`}
              </p>
              <p className="text-xs whitespace-pre-wrap">{note.note_text}</p>
            </div>
          ))
        )}
      </Section>

      <Section number={6} title="Prescribed Medication">
        {sections.medications.length === 0 ? (
          <Empty>No medication prescribed.</Empty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Medicine</th>
                <th className={TH}>Dose</th>
                <th className={TH}>Timing</th>
                <th className={TH}>Duration</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sections.medications.map((m, i) => (
                <tr key={i}>
                  <td className={TD}>
                    <span className="font-medium">{m.medicine_name}</span>
                    {m.note && <span className="block text-[11px] text-neutral-500">{m.note}</span>}
                  </td>
                  <td className={TD}>{m.dose ?? "—"}</td>
                  <td className={TD}>{[m.timing, m.meal_instruction].filter(Boolean).join(", ") || "—"}</td>
                  <td className={TD}>{m.duration ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {m.status === "active" ? `Active since ${fmtDate(m.started_at)}` : `Stopped ${fmtDate(m.stopped_at)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section number={7} title="Treatment Plan">
        {sections.treatment_plans.length === 0 ? (
          <Empty>No treatment protocol prescribed.</Empty>
        ) : (
          sections.treatment_plans.map((plan) => (
            <div key={plan.protocol_id} className="mb-3 break-inside-avoid-page">
              <p className="text-xs font-semibold">
                {plan.device_name ?? plan.modality ?? "Protocol"} <span className="font-normal text-neutral-500">· v{plan.version} · {words(plan.status)}</span>
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
                <div>
                  <dt className="text-neutral-500 inline">Condition: </dt>
                  <dd className="inline">{plan.conditions.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500 inline">Placement: </dt>
                  <dd className="inline">{plan.placement ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500 inline">Dosage: </dt>
                  <dd className="inline">
                    {Object.entries(plan.dosage)
                      .map(([key, value]) => {
                        const [label, unit] = DOSAGE_LABEL[key] ?? [words(key), ""];
                        return `${label} ${value}${unit ? ` ${unit}` : ""}`;
                      })
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 inline">Schedule: </dt>
                  <dd className="inline">
                    {plan.session_count ?? "—"} sessions
                    {plan.sessions_per_week != null && `, ${plan.sessions_per_week}/week`}
                    {plan.follow_up_every_n != null && `, follow-up every ${plan.follow_up_every_n}`}
                  </dd>
                </div>
              </dl>
              {plan.schedule.length > 0 && (
                <p className="text-[11px] text-neutral-600 mt-1.5 leading-relaxed">
                  {plan.schedule.map((s) => `#${s.session_number ?? "?"} ${fmtDate(s.date)} (${words(s.status)})`).join(" · ")}
                </p>
              )}
            </div>
          ))
        )}
      </Section>

      <Section number={8} title="Session Details">
        {sections.sessions.length === 0 ? (
          <Empty>No device sessions done in this period.</Empty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>Date</th>
                <th className={TH}>Device</th>
                <th className={TH}>Intensity</th>
                <th className={TH}>Duration</th>
                <th className={TH}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {sections.sessions.map((s, i) => (
                <tr key={i}>
                  <td className={TD}>{s.session_number ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>{fmtDate(s.date)}</td>
                  <td className={TD}>{s.device_name ?? "—"}</td>
                  <td className={TD}>
                    {s.actual_intensity_ma ?? "—"}
                    {s.prescribed_current_ma != null && <span className="text-neutral-400"> / {s.prescribed_current_ma} mA</span>}
                  </td>
                  <td className={TD}>
                    {s.actual_duration_min ?? "—"}
                    {s.prescribed_duration_min != null && <span className="text-neutral-400"> / {s.prescribed_duration_min} min</span>}
                  </td>
                  <td className={TD}>
                    {s.status === "stopped_early" ? `Stopped early${s.stop_reason ? ` (${words(s.stop_reason)})` : ""}` : "Completed"}
                    {s.deviations.length > 0 && <span className="block text-[11px] text-neutral-500">Deviated: {s.deviations.join(", ")}</span>}
                    {(s.symptom_count > 0 || s.adverse_event_count > 0) && (
                      <span className="block text-[11px] text-neutral-500">
                        {s.symptom_count} symptom(s), {s.adverse_event_count} adverse event(s)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section number={9} title="Doctor's Signature">
        {signature ? (
          <div>
            <p className="text-3xl leading-tight" style={{ fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive' }}>
              {signature.typed_name}
            </p>
            <p className="text-xs text-neutral-700 border-t border-neutral-400 inline-block pt-1 mt-1 pr-8">
              {signature.typed_name}
              {signature.license_number && ` · Reg. no. ${signature.license_number}`}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Electronically signed on {fmtDateTime(signature.signed_at)}. This report is locked and cannot be edited.
            </p>
            {contentHash && <p className="text-[10px] text-neutral-400 mt-0.5 break-all">Document ID {contentHash.slice(0, 16)}</p>}
          </div>
        ) : (
          <Empty>Not signed yet — this is a preview.</Empty>
        )}
      </Section>
    </div>
  );
});
