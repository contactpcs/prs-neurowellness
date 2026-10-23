"use client";

import { Fragment, forwardRef } from "react";
// Report template assets (src/assets/report, from the Anava patient report
// template package). Imported, not served from /public, so the bundler
// fingerprints them and the print window loads the same cached files.
import logoStacked from "@/assets/report/anava-logo-stacked.svg";
import logoHorizontal from "@/assets/report/anava-logo-horizontal.svg";
import { reportSans, reportSerif } from "./reportFonts";
import "./final-report.css";
import type {
  FinalReportNote,
  FinalReportPrsDeviceGroup,
  FinalReportPrsDisease,
  FinalReportPrsScale,
  FinalReportScope,
  FinalReportSections,
  FinalReportSignature,
  FinalReportTreatmentPlan,
} from "@/types/finalReport.types";

/** "Patient Medical Report and Treatment Plan" — the one template for every
 * patient report. Structure and class names mirror the reference template
 * (templates/patient_report.html.j2); the look lives in final-report.css. */
export const REPORT_TITLE = "Patient Medical Report and Treatment Plan";

/** Letterhead and footer. Single source of truth for the company's name and
 * contact details on the report. (The CIN / Udyam line of the reference
 * template is left out by the owner's decision, 2026-10-13.) */
export const REPORT_COMPANY = {
  legalName: "Anava Clinics Private Limited",
  shortName: "Anava Clinics Pvt Ltd",
  email: "contact@anavaclinics.com",
  phone: "+91 724-9310743",
  website: "www.anavaclinics.com",
};

/** URL of the horizontal logo the printed running header draws (pages 2+). */
export const REPORT_RUNNING_LOGO_URL: string = logoHorizontal.src;

// The clinics are in India: every date on the report reads in IST, whatever
// the timezone of the machine that opens or prints it.
const TIME_ZONE = "Asia/Kolkata";

const SCOPE_LABEL: Record<FinalReportScope, string> = {
  overall: "Overall — start of treatment to date",
  last_consultation: "Last consultation",
};

export const ORIGIN_LABEL: Record<string, string> = {
  device_session: "Device session",
  initial: "Consultation",
  follow_up: "Follow-up",
  protocol_followup: "Protocol follow-up",
  main: "Assessment",
  main_clinical: "Clinical assessment",
  followup: "Follow-up assessment",
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

const SEVERITY_TONE: Record<string, string> = {
  normal: "good",
  minimal: "good",
  none: "good",
  mild: "mild",
  borderline: "mild",
  "borderline clinical depression": "mild",
  moderate: "moderate",
  "moderately severe": "moderate",
  severe: "severe",
  "extremely severe": "severe",
  extreme: "severe",
};

// Order the session counts are listed in ("2 completed · 14 missed · ...").
const SESSION_STATUS_LABEL: [string, string][] = [
  ["completed", "completed"],
  ["in_progress", "in progress"],
  ["planned", "planned"],
  ["scheduled", "scheduled"],
  ["confirmed", "confirmed"],
  ["paid", "paid"],
  ["missed", "missed"],
  ["no_show", "no-show"],
  ["cancelled", "cancelled"],
];

export function formatReportDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE });
}

function fmtDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: TIME_ZONE });
}

function fmtSignedAt(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });
  return `${formatReportDate(iso)}, ${time} IST`;
}

/** Change of a weekly score from the last week that had one. Scores are
 * direction-corrected (higher = worse), so a minus is an improvement. */
function weeklyChanges(scores: (number | null)[]): (number | null)[] {
  let previous: number | null = null;
  return scores.map((score) => {
    const change = score != null && previous != null ? Math.round(score) - Math.round(previous) : null;
    if (score != null) previous = score;
    return change;
  });
}

function words(value: string): string {
  return value.replace(/_/g, " ");
}

function statusKey(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** A value, or the template's grey dash when there is none. */
function Val({ children }: { children: React.ReactNode }) {
  const empty = children === null || children === undefined || (typeof children === "string" && !children.trim());
  return empty ? <span className="nil">—</span> : <>{children}</>;
}

function Sep() {
  return <span className="sep">·</span>;
}

function Section({ num, title, className, children }: { num: string; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`section${className ? ` ${className}` : ""}`}>
      <h2 className="section__title">
        <span className="num">{num}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The scale-wise breakdown of one PRS row. */
function ScaleLines({ scales }: { scales: FinalReportPrsScale[] }) {
  if (scales.length === 0) return <span className="nil">—</span>;
  return (
    <>
      {scales.map((s) => (
        <div key={s.scale_code} className="scale">
          <span className="scale__name">{s.scale_name}</span>:{" "}
          <span className="scale__val">
            {s.value ?? "—"}
            {s.max != null && `/${s.max}`}
          </span>
          {s.severity_label && <span className="scale__int"> ({s.severity_label})</span>}
          {s.carried && s.taken_at && <span className="scale__carried"> · from {formatReportDate(s.taken_at)}</span>}
        </div>
      ))}
    </>
  );
}

/** One weekly progress strip: the score out of 100 and the change from the
 * last week that had one (lower is better, so a minus is the good one). */
function WeeklyStrip({ weeks, scores, note }: { weeks: string[]; scores: (number | null)[]; note: string }) {
  const changes = weeklyChanges(scores);
  return (
    <table className="weekly">
      <tbody>
        <tr>
          <th className="lbl">Last {weeks.length} weeks</th>
          {weeks.map((week) => (
            <th key={week}>{fmtDayMonth(week)}</th>
          ))}
        </tr>
        <tr>
          <td className="lbl">
            Weekly progress
            <small>{note}</small>
          </td>
          {scores.map((score, i) => (
            <td key={i}>
              {score != null ? (
                <>
                  {score.toFixed(0)}
                  <span className="of">/100</span>
                  {changes[i] != null && (
                    <span className={`delta delta--${changes[i]! < 0 ? "better" : changes[i]! > 0 ? "worse" : "same"}`}>
                      {changes[i]! > 0 ? "+" : changes[i]! < 0 ? "−" : "±"}
                      {Math.abs(changes[i]!)}
                    </span>
                  )}
                </>
              ) : (
                <span className="nil">—</span>
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** PRS taken at the device sessions of one protocol instance: labelled
 * "Device session PRS · Instance n", never by a condition — the protocol
 * prescribes individual scales, and the condition a session scale is filed
 * under in the database is arbitrary. The overall score is the plain average
 * of the scales. */
function DevicePrsGroup({ group }: { group: FinalReportPrsDeviceGroup }) {
  const protocol = [group.device_name?.trim(), group.conditions.join(", ")].filter(Boolean).join(" · ");
  const { weeks, scores } = group.weekly_progress;
  return (
    <div className="prs-group">
      <div className="condition-label">
        Device session PRS{group.instance_number != null && ` · Instance ${group.instance_number}`}
      </div>
      {protocol && <span className="condition-meta">{protocol}</span>}
      {group.entries.length === 0 ? (
        <p className="empty">No PRS recorded at this device&apos;s sessions yet.</p>
      ) : (
        <>
          <table className="data">
            <colgroup>
              <col style={{ width: "17%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "15%" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Taken at</th>
                <th>Overall</th>
                <th>Scale-wise scores</th>
              </tr>
            </thead>
            <tbody>
              {group.entries.map((entry) => (
                <tr key={entry.instance_id ?? entry.appointment_id}>
                  <td>{formatReportDate(entry.completed_at)}</td>
                  <td>
                    Device session{entry.session_number != null && ` #${entry.session_number}`}
                    {entry.status === "in_progress" && <small>In progress</small>}
                  </td>
                  <td>
                    {entry.score != null ? (
                      <div className="score">
                        {entry.score.toFixed(0)}
                        <span className="of">/100</span>
                      </div>
                    ) : (
                      <span className="nil">—</span>
                    )}
                    {entry.severity_label && (
                      <span className={`pill pill-below tone-${SEVERITY_TONE[entry.severity_label.trim().toLowerCase()] ?? "neutral"}`}>
                        {entry.severity_label}
                      </span>
                    )}
                  </td>
                  <td>
                    <ScaleLines scales={entry.scales} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WeeklyStrip weeks={weeks} scores={scores} note="average of the scales · lower is better" />
        </>
      )}
    </div>
  );
}

function PrsGroup({ disease }: { disease: FinalReportPrsDisease }) {
  return (
    <div className="prs-group">
      <div className="condition-label">{disease.disease_name}</div>
      <table className="data">
        <colgroup>
          <col style={{ width: "17%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "15%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>Taken at</th>
            <th>Overall</th>
            <th>Scale-wise breakdown</th>
          </tr>
        </thead>
        <tbody>
          {disease.entries.map((entry) => {
            const detail = [entry.device_name, entry.conditions.join(", ")].filter(Boolean).join(" - ");
            return (
              <tr key={entry.instance_id}>
                <td>{formatReportDate(entry.completed_at)}</td>
                <td>
                  {ORIGIN_LABEL[entry.origin] ?? capitalise(words(entry.origin))}
                  {entry.session_number != null && ` #${entry.session_number}`}
                  {detail && <small>{detail}</small>}
                  {entry.status === "in_progress" && <small>In progress</small>}
                </td>
                <td>
                  {entry.score != null ? (
                    <div className="score">
                      {entry.score.toFixed(0)}
                      <span className="of">/100</span>
                    </div>
                  ) : (
                    <span className="nil">—</span>
                  )}
                  {entry.severity_label && (
                    <span className={`pill pill-below tone-${SEVERITY_TONE[entry.severity_label.trim().toLowerCase()] ?? "neutral"}`}>
                      {entry.severity_label}
                    </span>
                  )}
                </td>
                <td>
                  <ScaleLines scales={entry.scales} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <WeeklyStrip weeks={disease.weekly_progress.weeks} scores={disease.weekly_progress.scores} note="lower is better" />
    </div>
  );
}

function Plan({ plan }: { plan: FinalReportTreatmentPlan }) {
  const dosage = Object.entries(plan.dosage)
    .map(([key, value]) => {
      const [label, unit] = DOSAGE_LABEL[key] ?? [capitalise(words(key)), ""];
      return `${label} ${value}${unit ? ` ${unit}` : ""}`;
    })
    .join(", ");
  const schedule = [
    plan.session_count != null ? `${plan.session_count} sessions` : null,
    plan.sessions_per_week != null ? `${plan.sessions_per_week}/week` : null,
    plan.sessions_per_day != null && plan.sessions_per_day > 1 ? `${plan.sessions_per_day}/day` : null,
    plan.follow_up_every_n != null ? `follow-up every ${plan.follow_up_every_n}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const keys = plan.schedule.map((s) => statusKey(s.status));
  const known = new Set(SESSION_STATUS_LABEL.map(([key]) => key));
  const counts = [
    ...SESSION_STATUS_LABEL,
    // A status the template has no colour for is still counted, by its own name.
    ...Array.from(new Set(keys.filter((k) => !known.has(k)))).map((k): [string, string] => [k, words(k)]),
  ]
    .map(([key, label]) => [keys.filter((k) => k === key).length, label] as const)
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`);

  return (
    <div className="plan">
      <div className="plan__head">
        <div className="plan__device">
          {plan.device_name ?? plan.modality ?? "Protocol"}
          <span className="ver">
            {plan.instance_number != null && `Instance ${plan.instance_number} · `}v{plan.version}
          </span>
        </div>
        <span className={`pill tone-${plan.status === "active" ? "good" : "neutral"}`}>{words(plan.status)}</span>
      </div>
      <table className="plan__params">
        <tbody>
          <tr>
            <td>
              <span className="k">Condition</span>
              <span className="v">
                <Val>{plan.conditions.join(", ")}</Val>
              </span>
            </td>
            <td>
              <span className="k">Placement</span>
              <span className="v">
                <Val>{plan.placement?.replace(/->/g, "→")}</Val>
              </span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="k">Dosage</span>
              <span className="v">
                <Val>{dosage}</Val>
              </span>
            </td>
            <td>
              <span className="k">Schedule</span>
              <span className="v">
                <Val>{schedule}</Val>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      {plan.schedule.length > 0 && (
        <>
          <div className="plan__sched-head">
            Session schedule
            <span className="counts">
              {plan.schedule.length} sessions
              {counts.length > 0 && (
                <>
                  <Sep />
                  {counts.join(" · ")}
                </>
              )}
            </span>
          </div>
          <div className="chips">
            {plan.schedule.map((s, i) => (
              <div key={i} className={`chip st-${statusKey(s.status)}`}>
                <span className="chip__n">#{s.session_number ?? "?"}</span>
                <span className="chip__date">{formatReportDate(s.date)}</span>
                <span className="chip__status">{words(s.status)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface FinalReportDocumentProps {
  sections: FinalReportSections;
  diagnosis: string;
  /** Preview passes the notes the doctor has ticked so far; a signed report
   * already carries them in sections.doctor_notes. */
  notes?: FinalReportNote[];
  /** null while the report is still a preview (prints the DRAFT watermark). */
  signature: FinalReportSignature | null;
  /** final_reports.report_id — the ID the report is stored under. It exists
   * only once the report is signed; a preview has none. Shown in the footer
   * only, in small type: the foot of the sheet on screen, the foot of every
   * page in print (printFinalReport.ts). */
  reportId?: string;
}

/** The Final Report as it is printed and as the patient reads it. Renders
 * only what it is given — for a signed report that is the frozen snapshot,
 * never live data. */
export const FinalReportDocument = forwardRef<HTMLDivElement, FinalReportDocumentProps>(function FinalReportDocument(
  { sections, diagnosis, notes, signature, reportId },
  ref,
) {
  const doctorNotes = notes ?? sections.doctor_notes;
  const { patient, doctor, clinic, window: scopeWindow } = sections;
  const number = reportId ?? "";
  const deviceSessionPrs = sections.prs.device_sessions ?? [];
  const doctorName = signature?.typed_name ?? doctor?.name;
  const registrationNo = signature?.license_number ?? doctor?.license_number;
  const scope =
    sections.scope === "last_consultation" && scopeWindow.consultation
      ? `${SCOPE_LABEL.last_consultation} — ${formatReportDate(scopeWindow.consultation.appointment_date)}`
      : SCOPE_LABEL[sections.scope];
  // The city is appended only when the clinic's address does not already end with it.
  const clinicAddress = [clinic?.address, clinic?.city && !clinic.address?.includes(clinic.city) ? clinic.city : null].filter(Boolean).join(", ");

  return (
    <div ref={ref} className={`anava-report ${reportSans.variable} ${reportSerif.variable}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: must also render in the bare print window */}
      <img className="preload" src={REPORT_RUNNING_LOGO_URL} alt="" aria-hidden="true" />

      {/* Watermark: the Anava logo in the centre of the page. On screen it
          stays centred in view while the report scrolls; in print it is
          fixed, which the browser repeats on every page. */}
      <div className="watermark" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoStacked.src} alt="" />
      </div>

      {!signature && (
        <div className="draft-mark" aria-hidden="true">
          <span>DRAFT</span>
        </div>
      )}

      {/* ---------- Letterhead (page 1 only) ---------- */}
      <header className="letterhead">
        <div className="brand-bar">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="letterhead__row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="letterhead__logo" src={logoStacked.src} alt="Anava" />
          <div className="letterhead__org">
            <div className="org-name">{REPORT_COMPANY.legalName.toUpperCase()}</div>
            <div className="org-contact">
              {REPORT_COMPANY.email}
              <Sep />
              {REPORT_COMPANY.phone}
              <Sep />
              {REPORT_COMPANY.website}
            </div>
          </div>
        </div>
        <div className="letterhead__rule" />
      </header>

      {/* ---------- Title + patient panel ---------- */}
      <div className="title-block">
        <div className="eyebrow">Final report</div>
        <h1 className="doc-title">{REPORT_TITLE}</h1>
        <div className="doc-sub">{scope}</div>
      </div>

      <div className="patient-panel">
        {/* A grid, not the reference's table: four across on paper and wide
            screens, two across on a phone. */}
        <div className="kv">
          {(
            [
              ["Patient", patient?.name, false],
              ["MRN", patient?.mrn, true],
              ["Date of birth", formatReportDate(patient?.dob), false],
              ["Treating doctor", doctor?.name, false],
              ["Report date", formatReportDate(signature?.signed_at ?? sections.generated_at), false],
              ["Sex", patient?.gender ? capitalise(words(patient.gender)) : null, false],
              ["Clinic", clinic?.clinic_name, false],
            ] as [string, string | null | undefined, boolean][]
          ).map(([label, value, mono]) => (
            <div key={label} className="kv__item">
              <span className="k">{label}</span>
              <span className={`v${mono ? " mono" : ""}`}>
                <Val>{value}</Val>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- 01 Anamnesis ---------- */}
      <Section num="01" title="Anamnesis">
        {sections.anamnesis.length === 0 ? (
          <p className="empty">Not available.</p>
        ) : (
          sections.anamnesis.map((record) => (
            <Fragment key={record.anamnesis_id}>
              <div className="subhead">
                Consultation anamnesis
                {record.recorded_at && <span className="meta">{formatReportDate(record.recorded_at)}</span>}
              </div>
              <table className="data qa">
                <colgroup>
                  <col className="c-n" />
                  <col className="c-q" />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "right" }}>#</th>
                    <th>Question</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {record.sections.map((group, groupIndex) => {
                    // Questions are numbered continuously across groups.
                    const offset = record.sections.slice(0, groupIndex).reduce((count, g) => count + g.items.length, 0);
                    return (
                      <Fragment key={group.title}>
                        <tr className="group">
                          <td colSpan={3}>{group.title}</td>
                        </tr>
                        {group.items.map((item, i) => (
                          <tr key={i}>
                            <td className="n">{offset + i + 1}</td>
                            <td className="q">{item.question}</td>
                            <td className="a">
                              <Val>{item.answer}</Val>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Fragment>
          ))
        )}
      </Section>

      {/* ---------- 02 Diagnosis ---------- */}
      <Section num="02" title="Diagnosis">
        {!diagnosis.trim() && sections.diagnosis_codes.length === 0 ? (
          <p className="empty">Not available.</p>
        ) : (
          <div className="dx">
            {diagnosis.trim() ? <div className="dx__name">{diagnosis.trim()}</div> : <p className="empty">Diagnosis not entered yet.</p>}
            {sections.diagnosis_codes.length > 0 && (
              <>
                <div className="dx__label">ICD-10</div>
                <table className="dx__codes">
                  <tbody>
                    {sections.diagnosis_codes.map((code) => (
                      <tr key={code.icd10_code}>
                        <td className="code">
                          <span className="code-chip">{code.icd10_code}</span>
                        </td>
                        <td>{code.icd10_description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </Section>

      {/* ---------- 03 Brain mapping (not built yet: the slot is always printed) ---------- */}
      <Section num="03" title="Brain mapping">
        <p className="empty">Not available.</p>
      </Section>

      {/* ---------- 04 Patient-reported scores ---------- */}
      <Section num="04" title="Patient-reported scores (PRS)">
        {sections.prs.diseases.length === 0 && deviceSessionPrs.length === 0 ? (
          <p className="empty">No assessments recorded.</p>
        ) : (
          <>
            {sections.prs.diseases.map((disease) => (
              <PrsGroup key={disease.disease_id ?? disease.disease_name} disease={disease} />
            ))}
            {deviceSessionPrs.map((group, i) => (
              <DevicePrsGroup key={i} group={group} />
            ))}
          </>
        )}
      </Section>

      {/* ---------- 05 Doctor's notes ---------- */}
      <Section num="05" title="Doctor's notes">
        {doctorNotes.length === 0 ? (
          <p className="empty">No notes recorded.</p>
        ) : (
          doctorNotes.map((note) => (
            <div key={note.note_id} className="note">
              <div className="note__meta">
                {note.category}{" "}
                <span className="rest">
                  <Sep />
                  {formatReportDate(note.created_at)}
                  {note.doctor_name && (
                    <>
                      <Sep />
                      {note.doctor_name}
                    </>
                  )}
                </span>
              </div>
              <p className="note__text">{note.note_text}</p>
            </div>
          ))
        )}
      </Section>

      {/* ---------- 06 Prescribed medication ---------- */}
      <Section num="06" title="Prescribed medication">
        {sections.medications.length === 0 ? (
          <p className="empty">No medication prescribed.</p>
        ) : (
          <table className="data">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "14%" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dose</th>
                <th>Timing</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sections.medications.map((m, i) => (
                <tr key={i}>
                  <td className="a">
                    {m.medicine_name}
                    {m.note && <small>{m.note}</small>}
                  </td>
                  <td>
                    <Val>{m.dose}</Val>
                  </td>
                  <td>
                    <Val>{[m.timing, m.meal_instruction].filter(Boolean).join(", ")}</Val>
                  </td>
                  <td>
                    <Val>{m.duration}</Val>
                  </td>
                  <td>
                    <span className={`pill tone-${m.status === "active" ? "good" : "severe"}`}>{m.status}</span>
                    {m.status === "active"
                      ? m.started_at && <small>since {formatReportDate(m.started_at)}</small>
                      : m.stopped_at && <small>stopped {formatReportDate(m.stopped_at)}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ---------- 07 Treatment protocol ---------- */}
      <Section num="07" title="Treatment protocol">
        {sections.treatment_plans.length === 0 ? (
          <p className="empty">No active treatment protocol.</p>
        ) : (
          sections.treatment_plans.map((plan) => <Plan key={plan.protocol_id} plan={plan} />)
        )}
      </Section>

      {/* ---------- 08 Device session details ---------- */}
      <Section num="08" title="Device session details">
        {sections.sessions.length === 0 ? (
          <p className="empty">No device sessions recorded.</p>
        ) : (
          <table className="data">
            <colgroup>
              <col style={{ width: "7mm" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: "right" }}>#</th>
                <th>Date</th>
                <th>Device</th>
                <th>Intensity</th>
                <th>Duration</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {sections.sessions.map((s, i) => {
                const stopped = s.status === "stopped_early";
                return (
                  <tr key={i}>
                    <td className="n">{s.session_number ?? "—"}</td>
                    <td>{formatReportDate(s.date)}</td>
                    <td>
                      <Val>{s.device_name}</Val>
                    </td>
                    <td>
                      <b>
                        <Val>{s.actual_intensity_ma != null ? `${s.actual_intensity_ma} mA` : null}</Val>
                      </b>
                      <small>prescribed {s.prescribed_current_ma != null ? `${s.prescribed_current_ma} mA` : "—"}</small>
                    </td>
                    <td>
                      <b>
                        <Val>{s.actual_duration_min != null ? `${s.actual_duration_min} min` : null}</Val>
                      </b>
                      <small>prescribed {s.prescribed_duration_min != null ? `${s.prescribed_duration_min} min` : "—"}</small>
                    </td>
                    <td>
                      <span className={`outcome tone-${stopped ? "warn" : "ok"}`}>
                        {stopped ? `Stopped early${s.stop_reason ? ` (${words(s.stop_reason)})` : ""}` : "Completed"}
                      </span>
                      {s.deviations.length > 0 && (
                        <>
                          <br />
                          {s.deviations.map((d) => (
                            <span key={d} className="flag">
                              Deviated: {d}
                            </span>
                          ))}
                        </>
                      )}
                      <small>
                        {plural(s.symptom_count, "symptom")}
                        <Sep />
                        {plural(s.adverse_event_count, "adverse event")}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* ---------- 09 Signature + treating clinic ---------- */}
      <Section num="09" title="Doctor's signature" className="signoff">
        <div className={`sign${signature ? "" : " sign--pending"}`}>
          <div className="sign__seal">
            <span className="t">{signature ? "Electronically signed" : "Awaiting signature"}</span>
            <span className="n">{signature ? doctorName : "Draft — not valid"}</span>
          </div>
          <div className="sign__line" />
          <div className="sign__name">
            <Val>{doctorName}</Val>
          </div>
          <div className="sign__reg">
            Reg. no. <Val>{registrationNo}</Val>
          </div>
          <p className="sign__statement">
            {signature
              ? `Electronically signed on ${fmtSignedAt(signature.signed_at)}. This report is locked and cannot be edited.`
              : "This report has not been signed and is not valid as a medical record."}
          </p>
        </div>

        {clinic && (
          <div className="clinic-card">
            <div className="eyebrow">Treating clinic</div>
            <div className="clinic-card__name">{clinic.clinic_name}</div>
            {clinicAddress && <div className="clinic-card__addr">{clinicAddress}</div>}
            {clinic.phone && <div className="clinic-card__contact">{clinic.phone}</div>}
          </div>
        )}
        <p className="end-mark">End of report</p>
      </Section>

      {/* On screen only: in print the page footer carries the ID on every page. */}
      {number && <div className="screen-footer">Report ID {number}</div>}
    </div>
  );
});
