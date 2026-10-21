"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileCheck2, Loader2, Lock, Pencil, Printer, X } from "lucide-react";
import toast from "react-hot-toast";
import { finalReportsService } from "@/lib/api/services";
import { extractErrorMessage } from "@/lib/api/errors";
import { Card, GroupLabel, Pill, Stat, textareaCls } from "@/components/doctor/TreatmentPlanFull";
import { FinalReportDocument, ORIGIN_LABEL, formatReportDate } from "@/components/reports/FinalReportDocument";
import { PatientFinalReports } from "@/components/reports/PatientFinalReports";
import { printFinalReport } from "@/components/reports/printFinalReport";
import type {
  FinalReport,
  FinalReportPreview,
  FinalReportPrsScale,
  FinalReportScope,
  FinalReportSections,
  FinalReportSelection,
  FinalReportSelectionKey,
} from "@/types/finalReport.types";

const SCOPES: { value: FinalReportScope; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "last_consultation", label: "Last consultation" },
];

function words(value: string): string {
  return value.replace(/_/g, " ");
}

function originLabel(origin: string): string {
  return ORIGIN_LABEL[origin] ?? words(origin);
}

// ─── the pencil's picker ────────────────────────────────────────────────────

interface PickItem {
  id: string;
  label: string;
  sub?: string;
  group?: string;
  /** The record itself, shown under its label so the doctor can read it before ticking. */
  details?: React.ReactNode;
}

/** The patient's full history for one section, with a tick per item. Apply
 * returns the ticked ids; the report is rebuilt from them. With an `editor`
 * (the consultation is still open) a second tab runs that section's own
 * form/wizard in place; once it saves, the report reloads and the new record
 * comes back here already ticked. */
function SectionPicker({
  title,
  items,
  selected,
  wide,
  editor,
  onEdited,
  onApply,
  onClose,
}: {
  title: string;
  items: PickItem[];
  selected: string[];
  /** Wider dialog, for items that carry their full details. */
  wide?: boolean;
  editor?: SectionEditor;
  /** A record was added/changed in the editor — reload the report. */
  onEdited: () => void;
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [ticked, setTicked] = useState<Set<string>>(new Set(selected));
  const [tab, setTab] = useState<"choose" | "edit">("choose");
  // Ids already shown; anything new after an edit is ticked and badged.
  const known = useRef<Set<string>>(new Set(items.map((i) => i.id)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const added = items.map((i) => i.id).filter((id) => !known.current.has(id));
    if (added.length === 0) return;
    added.forEach((id) => known.current.add(id));
    setTicked((prev) => new Set([...prev, ...added]));
    setFresh((prev) => new Set([...prev, ...added]));
  }, [items]);
  const groups = useMemo(() => {
    const out: { name: string; items: PickItem[] }[] = [];
    for (const item of items) {
      const name = item.group ?? "";
      const group = out.find((g) => g.name === name) ?? out[out.push({ name, items: [] }) - 1];
      group.items.push(item);
    }
    return out;
  }, [items]);
  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The open editor, if its tab is showing.
  const editing = tab === "edit" ? editor : undefined;
  const size = editing ? (editing.size === "wizard" ? "max-w-6xl h-full" : "max-w-3xl") : wide ? "max-w-3xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${size} max-h-full flex flex-col overflow-hidden`}>
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-neutral-100">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {editing ? editing.hint : "Everything on record for this patient. Tick what goes into the report."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        {editor && (
          <div className="flex gap-1 px-5 pt-2 border-b border-neutral-100 text-xs" role="tablist">
            {(
              [
                ["choose", "Choose for report"],
                ["edit", editor.label],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 -mb-px border-b-2 font-semibold ${tab === key ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {editing ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {editing.render(() => {
              setTab("choose");
              onEdited();
            })}
          </div>
        ) : (
        <>
        <div className="flex items-center gap-3 px-5 py-2 border-b border-neutral-100 text-xs">
          <button onClick={() => setTicked(new Set(items.map((i) => i.id)))} className="font-semibold text-primary-600 hover:text-primary-700">
            Select all
          </button>
          <button onClick={() => setTicked(new Set())} className="font-semibold text-neutral-500 hover:text-neutral-700">
            Clear
          </button>
          <span className="ml-auto text-neutral-400">
            {ticked.size} of {items.length} selected
          </span>
        </div>
        <div className="overflow-y-auto px-5 py-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">Nothing on record yet.</p>
          ) : (
            groups.map((group) => (
              <div key={group.name}>
                {group.name && <GroupLabel>{group.name}</GroupLabel>}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={item.details ? `rounded-lg border ${ticked.has(item.id) ? "border-primary-300 bg-primary-50/30" : "border-neutral-200"}` : ""}
                    >
                      <label className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-50 cursor-pointer">
                        <input type="checkbox" className="mt-0.5" checked={ticked.has(item.id)} onChange={() => toggle(item.id)} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-neutral-800">
                            {item.label}
                            {fresh.has(item.id) && <Pill className="ml-1.5 bg-green-50 text-green-700">New</Pill>}
                          </span>
                          {item.sub && <span className="block text-xs text-neutral-500 line-clamp-2">{item.sub}</span>}
                        </span>
                      </label>
                      {item.details && <div className="px-3 pb-3 pl-8">{item.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onApply(Array.from(ticked))} className="px-4 py-2 text-sm font-medium text-white bg-brand-gradient rounded-lg">
            Apply
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

/** An earlier anamnesis in full, inside the pencil: every question and answer. */
function AnamnesisDetails({ sections }: { sections: { title: string; items: { question: string; answer: string | null }[] }[] }) {
  const answered = sections.flatMap((s) => s.items).filter((i) => i.answer).length;
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  return (
    // Open from the start: the doctor reads the record before ticking it.
    <details open className="text-[12px]">
      <summary className="cursor-pointer text-primary-600 font-semibold select-none">
        Answers <span className="text-neutral-400 font-normal">· {answered} of {total} answered</span>
      </summary>
      <div className="mt-2 space-y-2">
        {sections.map((group) => (
          <div key={group.title}>
            <GroupLabel>{group.title}</GroupLabel>
            {group.items.map((item, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 py-1 border-b border-neutral-100 last:border-0">
                <span className="text-neutral-500">{item.question}</span>
                <span className="font-semibold text-neutral-800 whitespace-pre-wrap">{item.answer ?? "—"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

/** An earlier PRS in full, inside the pencil: overall score and every scale. */
function PrsDetails({ score, severity, scales }: { score: number | null; severity: string | null; scales: FinalReportPrsScale[] }) {
  return (
    <div className="text-[12px] text-neutral-700 space-y-0.5">
      <p>
        Overall: <b className="text-neutral-900">{score != null ? `${score.toFixed(0)}/100` : "—"}</b>
        {severity && <span className="text-neutral-500"> ({severity})</span>}
      </p>
      <ScaleList scales={scales} />
    </div>
  );
}

function PencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-neutral-400 italic">{children}</p>;
}

const TH = "text-left text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide px-2 py-1.5 border-b border-neutral-200";
const TD = "text-[12.5px] text-neutral-800 px-2 py-2 border-b border-neutral-100 align-top";

// ─── section bodies (screen summaries; the print uses FinalReportDocument) ──

function AnamnesisBody({ sections }: { sections: FinalReportSections }) {
  if (sections.anamnesis.length === 0) return <Empty>No anamnesis selected.</Empty>;
  return (
    <div className="space-y-3">
      {sections.anamnesis.map((record) => {
        const items = record.sections.flatMap((s) => s.items);
        const answered = items.filter((i) => i.answer).length;
        return (
          <details key={record.anamnesis_id} className="border border-neutral-200 rounded-lg">
            <summary className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer text-[13px]">
              <span className="font-semibold text-neutral-800">Consultation anamnesis · {formatReportDate(record.recorded_at)}</span>
              <span className="text-xs text-neutral-500">
                {answered} of {items.length} answered
              </span>
            </summary>
            <div className="px-3.5 pb-3 space-y-2.5">
              {record.sections.map((group) => (
                <div key={group.title}>
                  <GroupLabel>{group.title}</GroupLabel>
                  {group.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-2 gap-3 py-1.5 border-b border-neutral-100 last:border-0 text-[12.5px]">
                      <span className="text-neutral-500">{item.question}</span>
                      <span className="font-semibold text-neutral-800 whitespace-pre-wrap">{item.answer ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function ScaleList({ scales }: { scales: FinalReportSections["prs"]["diseases"][number]["entries"][number]["scales"] }) {
  if (scales.length === 0) return <span className="text-neutral-400">—</span>;
  return (
    <>
      {scales.map((s) => (
        <span key={s.scale_code} className="block">
          {s.scale_name}: <b>{s.value ?? "—"}</b>
          {s.max != null && <span className="text-neutral-400">/{s.max}</span>}
          {s.carried && s.taken_at && <span className="text-[11px] text-neutral-400 italic"> · from {formatReportDate(s.taken_at)}</span>}
        </span>
      ))}
    </>
  );
}

const IN_PROGRESS_NOTE = "Not finished by the patient — printed only if you tick it, never counted in the weekly progress.";

function PrsBody({ sections }: { sections: FinalReportSections }) {
  const devices = sections.prs.device_sessions ?? [];
  if (sections.prs.diseases.length === 0 && devices.every((g) => g.entries.length === 0)) {
    return <Empty>No PRS selected.</Empty>;
  }
  const table = (
    rows: { key: string; date: string | null; takenAt: string; status?: string; score: number | null | undefined; scales: Parameters<typeof ScaleList>[0]["scales"] }[],
  ) => (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={`${TH} w-[16%]`}>Date</th>
          <th className={`${TH} w-[22%]`}>Taken at</th>
          <th className={`${TH} w-[12%]`}>Overall</th>
          <th className={TH}>Scales</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className={`${TD} whitespace-nowrap`}>{formatReportDate(r.date)}</td>
            <td className={TD}>
              {r.takenAt}
              {r.status === "in_progress" && <Pill className="ml-1.5 bg-amber-50 text-amber-700">In progress</Pill>}
            </td>
            <td className={`${TD} font-bold`}>{r.score != null ? `${r.score.toFixed(0)}/100` : "—"}</td>
            <td className={TD}>
              <ScaleList scales={r.scales} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="space-y-4">
      {sections.prs.diseases.map((d) => (
        <div key={d.disease_id ?? d.disease_name}>
          <GroupLabel>Main PRS · {d.disease_name}</GroupLabel>
          {table(
            d.entries.map((e) => ({ key: e.instance_id, date: e.completed_at, takenAt: originLabel(e.origin), status: e.status, score: e.score, scales: e.scales })),
          )}
        </div>
      ))}
      {devices.map((g, i) => (
        <div key={i}>
          <GroupLabel>
            Device session PRS{g.instance_number != null && ` · Instance ${g.instance_number}`} · {[g.device_name?.trim(), g.conditions.join(", ")].filter(Boolean).join(" · ")}
          </GroupLabel>
          {g.entries.length === 0 ? (
            <Empty>No PRS selected for this device.</Empty>
          ) : (
            table(
              g.entries.map((e) => ({
                key: e.instance_id ?? e.appointment_id ?? "",
                date: e.completed_at,
                takenAt: `Device session${e.session_number != null ? ` #${e.session_number}` : ""}`,
                status: e.status,
                score: e.score,
                scales: e.scales,
              })),
            )
          )}
        </div>
      ))}
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

type PickerKey = "anamnesis" | "prs" | "notes" | "medicines" | "protocols" | "sessions" | "diagnosis";

/** One section's in-place editor, for the pencil pop-up's "Add or edit" tab. */
export interface SectionEditor {
  label: string;
  hint: string;
  /** "wizard" = a multi-step flow that needs the near-full-screen dialog. */
  size?: "form" | "wizard";
  /** `done` once the record is saved: the report reloads and ticks it. */
  render: (done: () => void) => React.ReactNode;
}

export type FinalReportEditors = Partial<Record<"anamnesis" | "prs" | "notes" | "medicines" | "protocols", SectionEditor>>;

/** The Final Report as a workspace section, laid out like the Treatment Plan:
 * one card per report section, each with a pencil that opens the patient's
 * full history for that section so the doctor picks what goes in. Nothing is
 * saved until the doctor signs; signing freezes the report, shares it with
 * the patient and prints it in the report template. */
export function FinalReportWorkspace({
  patientId,
  patientName,
  defaultScope,
  editors,
  onSigned,
}: {
  patientId: string;
  patientName: string;
  defaultScope: FinalReportScope;
  /** Present only while the consultation is open: lets each pencil edit its
   * section in place, as many times as needed, without leaving the report. */
  editors?: FinalReportEditors;
  onSigned?: (report: FinalReport) => void;
}) {
  const [scope, setScope] = useState<FinalReportScope>(defaultScope);
  // null = the scope's defaults; set by the pencils.
  const [selection, setSelection] = useState<FinalReportSelection | null>(null);
  const [preview, setPreview] = useState<FinalReportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState<FinalReport | null>(null);
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const [previousKey, setPreviousKey] = useState(0);
  // Bumped after an in-place edit so the preview (and its candidates) reload.
  const [reloadKey, setReloadKey] = useState(0);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (signed) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    finalReportsService
      .preview(patientId, scope, selection)
      .then((data) => !cancelled && setPreview(data))
      .catch((err) => !cancelled && setLoadError(extractErrorMessage(err, "Could not build the report.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [patientId, scope, selection, signed, reloadKey]);

  const sections = signed?.snapshot ?? preview?.sections ?? null;
  const candidates = preview?.candidates;
  const current = preview?.selection;
  const locked = !!signed;
  const canSign = !!preview && !loading && diagnosis.trim().length > 0 && confirmed && !signing;

  /** The pencils start from what the report holds now, then replace one key. */
  const applyPick = (keys: Partial<Record<FinalReportSelectionKey, string[]>>) => {
    setSelection({ ...(current ?? {}), ...keys });
    setPicker(null);
  };

  const changeScope = (value: FinalReportScope) => {
    if (value === scope) return;
    setScope(value);
    setSelection(null); // a new scope starts from its own defaults
  };

  const print = (report: FinalReport | null) => {
    if (!docRef.current || !sections) return;
    const meta = report
      ? { sections: report.snapshot, signature: report.signature, reportId: report.report_id }
      : { sections, signature: null };
    if (!printFinalReport(docRef.current, meta)) toast.error("Allow pop-ups for this site to print the report.");
  };

  async function handleSign() {
    if (!canSign || !current) return;
    setSigning(true);
    try {
      const report = await finalReportsService.sign(patientId, {
        scope,
        // Exactly what the doctor sees: the server rebuilds the report from it.
        selection: current,
        diagnosis: diagnosis.trim(),
        confirm_sign: true,
      });
      setSigned(report);
      setPreviousKey((k) => k + 1);
      onSigned?.(report);
      toast.success("Final report signed and shared with the patient.");
      // Let the signed document render before it is copied to the print window.
      setTimeout(() => print(report), 150);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not sign the report."));
    } finally {
      setSigning(false);
    }
  }

  const startNew = () => {
    setSigned(null);
    setConfirmed(false);
    setDiagnosis("");
    setSelection(null);
  };

  // ── picker contents ──
  const pickerConfig = useMemo((): { title: string; items: PickItem[]; selected: string[]; wide?: boolean; apply: (ids: string[]) => void } | null => {
    if (!picker || !candidates || !current) return null;
    switch (picker) {
      case "anamnesis":
        return {
          title: "01 Anamnesis",
          items: candidates.anamnesis.map((a) => ({
            id: a.id,
            label: `Consultation anamnesis · ${formatReportDate(a.recorded_at)}`,
            sub: words(a.status),
            details: <AnamnesisDetails sections={a.sections ?? []} />,
          })),
          selected: current.anamnesis_ids,
          wide: true,
          apply: (ids) => applyPick({ anamnesis_ids: ids }),
        };
      case "prs":
        return {
          title: "04 Patient-reported scores (PRS)",
          items: [
            ...candidates.prs.map((p) => ({
              id: `main:${p.id}`,
              label: `${originLabel(p.origin)} · ${formatReportDate(p.completed_at)}${p.status === "in_progress" ? " · In progress" : ""}`,
              sub: p.status === "in_progress" ? IN_PROGRESS_NOTE : undefined,
              group: `Main PRS · ${p.condition}`,
              details: <PrsDetails score={p.score} severity={p.severity_label} scales={p.scales ?? []} />,
            })),
            ...candidates.session_prs.map((p) => ({
              id: `session:${p.id}`,
              label: `Device session${p.session_number != null ? ` #${p.session_number}` : ""} · ${formatReportDate(p.completed_at)}${p.status === "in_progress" ? " · In progress" : ""}`,
              sub: p.status === "in_progress" ? IN_PROGRESS_NOTE : undefined,
              group: `Device session PRS${p.instance_number != null ? ` · Instance ${p.instance_number}` : ""}${p.device_name ? ` · ${p.device_name.trim()}` : ""}${p.conditions?.length ? ` · ${p.conditions.join(", ")}` : ""}`,
              details: <PrsDetails score={p.score} severity={p.severity_label} scales={p.scales ?? []} />,
            })),
          ],
          selected: [...current.prs_ids.map((id) => `main:${id}`), ...current.session_prs_ids.map((id) => `session:${id}`)],
          wide: true,
          apply: (ids) =>
            applyPick({
              prs_ids: ids.filter((i) => i.startsWith("main:")).map((i) => i.slice(5)),
              session_prs_ids: ids.filter((i) => i.startsWith("session:")).map((i) => i.slice(8)),
            }),
        };
      case "notes":
        return {
          title: "05 Doctor's notes",
          items: candidates.notes.map((n) => ({ id: n.id, label: `${n.category} · ${formatReportDate(n.created_at)}`, sub: n.note_text })),
          selected: current.note_ids,
          apply: (ids) => applyPick({ note_ids: ids }),
        };
      case "medicines":
        return {
          title: "06 Prescribed medication",
          items: candidates.medicines.map((m) => ({
            id: m.id,
            label: [m.medicine_name, m.dose].filter(Boolean).join(" "),
            sub: `${m.status === "active" ? "Active" : "Stopped"} · since ${formatReportDate(m.started_at)}`,
          })),
          selected: current.medicine_ids,
          apply: (ids) => applyPick({ medicine_ids: ids }),
        };
      case "protocols":
        return {
          title: "07 Treatment protocol",
          items: candidates.protocols.map((p) => ({
            id: p.id,
            label: `${p.instance_number != null ? `Instance ${p.instance_number} · ` : ""}${p.device_name?.trim() ?? "Protocol"} v${p.version}`,
            sub: `${words(p.status)} · created ${formatReportDate(p.created_at)}`,
          })),
          selected: current.protocol_ids,
          apply: (ids) => applyPick({ protocol_ids: ids }),
        };
      case "sessions":
        return {
          title: "08 Device session details",
          items: candidates.sessions.map((x) => ({
            id: x.id,
            label: `Session${x.session_number != null ? ` #${x.session_number}` : ""} · ${formatReportDate(x.date)}`,
            sub: [x.device_name?.trim(), words(x.status)].filter(Boolean).join(" · "),
          })),
          selected: current.session_ids,
          apply: (ids) => applyPick({ session_ids: ids }),
        };
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker, candidates, current]);

  const pencil = (key: PickerKey, label: string) =>
    locked || !preview ? null : (
      <PencilButton onClick={() => setPicker(key)} label={editors?.[key as keyof FinalReportEditors] ? `Choose or edit ${label}` : `Choose ${label}`} />
    );
  const devices = sections?.prs.device_sessions ?? [];
  const prsRows = (sections?.prs.diseases.reduce((n, d) => n + d.entries.length, 0) ?? 0) + devices.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="space-y-4">
      {/* ── header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-neutral-900">Final Report</h2>
            {locked ? <Pill className="bg-green-50 text-green-700">Signed — locked</Pill> : <Pill className="bg-amber-50 text-amber-700">Draft — not signed</Pill>}
          </div>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            {locked
              ? `Signed on ${formatReportDate(signed.signature.signed_at)} and shared with ${patientName}. It can no longer be edited.`
              : `Compiled from ${patientName}'s clinical record. Use the pencil on a section to choose what goes in. Nothing is saved until you sign.`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {!locked && (
            <div className="flex rounded-lg border border-neutral-300 overflow-hidden" role="group" aria-label="Report covers">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => changeScope(s.value)}
                  aria-pressed={scope === s.value}
                  className={`h-9 px-3.5 text-xs font-semibold ${scope === s.value ? "bg-primary-600 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {locked ? (
            <>
              <button onClick={startNew} className="h-9 px-3.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700">
                Start a new report
              </button>
              <button onClick={() => print(signed)} className="h-9 px-4 rounded-lg bg-brand-gradient text-white text-xs font-semibold flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => print(null)}
                disabled={!preview || loading}
                className="h-9 px-3.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" /> Print draft
              </button>
              <button
                onClick={handleSign}
                disabled={!canSign}
                title={!diagnosis.trim() ? "Enter the diagnosis first" : !confirmed ? "Tick the confirmation at the bottom to sign" : undefined}
                className="h-9 px-4 rounded-lg bg-brand-gradient text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Sign &amp; Print
              </button>
            </>
          )}
        </div>
      </div>

      {loadError && !locked ? (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg p-4">{loadError}</p>
      ) : !sections ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={`space-y-4 ${loading && !locked ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Stat label="Anamnesis" value={String(sections.anamnesis.length)} sub="records included" />
            <Stat label="PRS" value={String(prsRows)} sub="assessments included" />
            <Stat label="Doctor's notes" value={String(sections.doctor_notes.length)} sub="notes included" />
            <Stat label="Medication" value={String(sections.medications.length)} sub="medicines included" />
            <Stat label="Protocols" value={String(sections.treatment_plans.length)} sub="treatment protocols" />
            <Stat label="Device sessions" value={String(sections.sessions.length)} sub="sessions included" />
          </div>

          {locked && (
            <div className="flex items-start gap-2.5 border border-green-200 bg-green-50 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-green-700 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-green-800">
                Signed by {signed.signature.typed_name} on {formatReportDate(signed.signature.signed_at)} · Report ID {signed.report_id}
              </p>
            </div>
          )}

          <Card title="01 Anamnesis" sub="Consultation anamnesis records" right={pencil("anamnesis", "anamnesis records")}>
            <AnamnesisBody sections={sections} />
          </Card>

          <Card title="02 Diagnosis" sub="Required to sign. ICD-10 codes come from the selected treatment protocols." right={pencil("diagnosis", "a previous diagnosis")}>
            {locked ? (
              <p className="text-[15px] font-bold text-neutral-900 whitespace-pre-wrap">{signed.diagnosis}</p>
            ) : (
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="e.g. MDD + mild psychotic episodes"
                className={textareaCls}
                aria-label="Diagnosis"
              />
            )}
            {sections.diagnosis_codes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {sections.diagnosis_codes.map((c) => (
                  <span key={c.icd10_code} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-primary-50 text-primary-700" title={c.icd10_description ?? undefined}>
                    {c.icd10_code}
                    {c.icd10_description && <span className="font-normal text-neutral-600"> · {c.icd10_description}</span>}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card title="03 Brain mapping" sub="Not built yet — prints as “Not available”.">
            <Empty>Not available.</Empty>
          </Card>

          <Card title="04 Patient-reported scores (PRS)" sub="Main PRS per condition, then device-session PRS per device instance." right={pencil("prs", "PRS assessments")}>
            <PrsBody sections={sections} />
          </Card>

          <Card title="05 Doctor's notes" right={pencil("notes", "doctor's notes")}>
            {sections.doctor_notes.length === 0 ? (
              <Empty>No notes selected.</Empty>
            ) : (
              <div className="space-y-2">
                {sections.doctor_notes.map((n) => (
                  <div key={n.note_id} className="border-l-2 border-primary-200 bg-neutral-50 rounded-r-lg px-3 py-2">
                    <p className="text-[11px] font-semibold text-neutral-500">
                      {n.category} · {formatReportDate(n.created_at)}
                      {n.doctor_name && ` · ${n.doctor_name}`}
                    </p>
                    <p className="text-[12.5px] text-neutral-800 whitespace-pre-wrap">{n.note_text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="06 Prescribed medication" right={pencil("medicines", "medicines")}>
            {sections.medications.length === 0 ? (
              <Empty>No medication selected.</Empty>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Medicine</th>
                    <th className={TH}>Dose</th>
                    <th className={TH}>Timing</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.medications.map((m, i) => (
                    <tr key={m.medicine_id ?? i}>
                      <td className={`${TD} font-semibold`}>{m.medicine_name}</td>
                      <td className={TD}>{m.dose ?? "—"}</td>
                      <td className={TD}>{[m.timing, m.meal_instruction].filter(Boolean).join(", ") || "—"}</td>
                      <td className={TD}>{m.status === "active" ? `Active since ${formatReportDate(m.started_at)}` : `Stopped ${formatReportDate(m.stopped_at)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="07 Treatment protocol" right={pencil("protocols", "treatment protocols")}>
            {sections.treatment_plans.length === 0 ? (
              <Empty>No treatment protocol selected.</Empty>
            ) : (
              <div className="space-y-2.5">
                {sections.treatment_plans.map((plan) => (
                  <div key={plan.protocol_id} className="border border-neutral-200 rounded-lg px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[13px] font-bold text-neutral-900">
                        {plan.instance_number != null && <span className="text-neutral-500 font-semibold">Instance {plan.instance_number} · </span>}
                        {plan.device_name?.trim() ?? plan.modality ?? "Protocol"} <span className="text-neutral-400 font-normal">v{plan.version}</span>
                      </p>
                      <Pill className={plan.status === "active" ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"}>{words(plan.status)}</Pill>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      {[plan.conditions.join(", "), plan.placement?.replace(/->/g, "→"), plan.session_count != null ? `${plan.session_count} sessions` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="08 Device session details" right={pencil("sessions", "device sessions")}>
            {sections.sessions.length === 0 ? (
              <Empty>No device sessions selected.</Empty>
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
                  {sections.sessions.map((x, i) => (
                    <tr key={x.appointment_id ?? i}>
                      <td className={TD}>{x.session_number ?? "—"}</td>
                      <td className={`${TD} whitespace-nowrap`}>{formatReportDate(x.date)}</td>
                      <td className={TD}>{x.device_name?.trim() ?? "—"}</td>
                      <td className={TD}>{x.actual_intensity_ma != null ? `${x.actual_intensity_ma} mA` : "—"}</td>
                      <td className={TD}>{x.actual_duration_min != null ? `${x.actual_duration_min} min` : "—"}</td>
                      <td className={TD}>
                        {x.status === "stopped_early" ? "Stopped early" : "Completed"}
                        {x.deviations.length > 0 && <span className="block text-[11px] text-amber-700">Deviated: {x.deviations.join(", ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="09 Doctor's signature">
            {locked ? (
              <p className="text-[12.5px] text-neutral-700">
                Electronically signed by <b>{signed.signature.typed_name}</b>
                {signed.signature.license_number && ` (Reg. no. ${signed.signature.license_number})`} on {formatReportDate(signed.signature.signed_at)}. The report is
                locked and visible to the patient under My Results.
              </p>
            ) : (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span className="text-[12.5px] text-neutral-700">
                  I confirm this report is accurate and sign it as <b>{sections.doctor?.name ?? "the treating doctor"}</b>. Once signed it is locked and shared
                  with the patient.
                </span>
              </label>
            )}
          </Card>

          <Card title="Previous final reports" sub="Signed reports stay as they were signed.">
            <PatientFinalReports patientId={patientId} refreshKey={previousKey} />
          </Card>
        </div>
      )}

      {/* The printed report: the template, rendered off-screen and copied into
          the print window by printFinalReport. */}
      {sections && (
        <div className="hidden" aria-hidden="true">
          <FinalReportDocument
            ref={docRef}
            sections={sections}
            diagnosis={signed?.diagnosis ?? diagnosis}
            signature={signed?.signature ?? null}
            reportId={signed?.report_id}
          />
        </div>
      )}

      {pickerConfig && (
        <SectionPicker
          // A fresh picker per section: its ticks never carry over from another one.
          key={picker ?? ""}
          title={pickerConfig.title}
          items={pickerConfig.items}
          selected={pickerConfig.selected}
          wide={pickerConfig.wide}
          editor={picker && picker !== "sessions" && picker !== "diagnosis" ? editors?.[picker] : undefined}
          onEdited={() => setReloadKey((k) => k + 1)}
          onApply={pickerConfig.apply}
          onClose={() => setPicker(null)}
        />
      )}

      {picker === "diagnosis" && candidates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4" role="dialog" aria-modal="true" aria-label="Previous diagnoses">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-full flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">02 Diagnosis</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Diagnoses from this patient&apos;s earlier signed reports. Pick one to start from.</p>
              </div>
              <button onClick={() => setPicker(null)} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-3 space-y-1.5">
              {candidates.diagnoses.length === 0 ? (
                <p className="text-sm text-neutral-400 py-6 text-center">No earlier reports for this patient.</p>
              ) : (
                candidates.diagnoses.map((d) => (
                  <button
                    key={d.report_id}
                    onClick={() => {
                      setDiagnosis(d.diagnosis);
                      setPicker(null);
                    }}
                    className="w-full flex items-start gap-2.5 text-left rounded-lg px-2 py-2 hover:bg-neutral-50"
                  >
                    <FileCheck2 className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-neutral-800 whitespace-pre-wrap">{d.diagnosis}</span>
                      <span className="block text-xs text-neutral-500">Signed {formatReportDate(d.signed_at)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
