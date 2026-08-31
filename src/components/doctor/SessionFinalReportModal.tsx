"use client";

import { useRef } from "react";
import { X, Printer } from "lucide-react";
import type { ClinicalSessionTab } from "@/lib/hooks/usePatientClinicalSessions";
import type { AnamnesisRecord } from "@/types/domain.types";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Compiles what's currently on record for a completed session into a
 * printable summary and hands it to the browser's print dialog ("Save as
 * PDF" from there) — there is no backend report-generation endpoint, so this
 * is a client-side export of the same data already shown in the workspace,
 * not a fabricated document. */
export function SessionFinalReportModal({
  patientName, mrn, session, anamnesis, scoreSummary, doctorNoteText, protocol, onClose,
}: {
  patientName: string;
  mrn?: string | null;
  session: ClinicalSessionTab;
  anamnesis: AnamnesisRecord | null;
  scoreSummary: string | null;
  doctorNoteText: string | null;
  protocol: ProtocolRead | null;
  onClose: () => void;
}) {
  const printedRef = useRef(false);

  function handlePrint() {
    if (printedRef.current) return;
    printedRef.current = true;
    const win = window.open("", "_blank", "width=850,height=1100");
    if (!win) { printedRef.current = false; return; }

    const rows: [string, string][] = [
      ["Patient", `${esc(patientName)}${mrn ? ` (${esc(mrn)})` : ""}`],
      ["Session", esc(session.label)],
      ["Date", fmtDate(session.appointment.appointment_date)],
      ["Chief Complaint", anamnesis?.chief_complaint ? esc(anamnesis.chief_complaint) : "—"],
      ["PRS / Clinical Assessment", scoreSummary ? esc(scoreSummary) : "—"],
      ["Treatment Protocol", protocol ? esc(`${protocol.device_name || protocol.modality || "Protocol"} — ${protocol.prescribed_current_ma ?? "—"} mA, ${protocol.prescribed_duration_min ?? "—"} min, ${protocol.sessions_per_week ?? "—"}/week`) : "—"],
      ["Doctor Notes", doctorNoteText ? esc(doctorNoteText) : "—"],
    ];

    win.document.write(`<!doctype html><html><head><title>${esc(session.label)} — ${esc(patientName)}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,sans-serif;color:#111;padding:40px;max-width:720px;margin:0 auto;}
        h1{font-size:20px;margin:0 0 4px;} p.sub{color:#666;font-size:13px;margin:0 0 28px;}
        table{width:100%;border-collapse:collapse;} td{padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;}
        td:first-child{width:180px;color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;}
        td:last-child{font-size:14px;white-space:pre-wrap;}
        .footer{margin-top:32px;font-size:11px;color:#999;}
      </style></head><body>
      <h1>Final Report — ${esc(session.label)}</h1>
      <p class="sub">Generated ${fmtDate(new Date().toISOString())} · Session frozen, this reflects the clinical record as recorded.</p>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
      <p class="footer">This report compiles clinical data already on record — it is not a new clinical entry.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); printedRef.current = false; }, 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="text-base font-semibold text-neutral-900">Generate Final Report</h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm text-neutral-600">
          <p><b>{session.label}</b> · {fmtDate(session.appointment.appointment_date)} is now frozen — this compiles the Anamnesis, PRS, Treatment Protocol, and Doctor Notes recorded for it into a printable summary.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-gradient rounded-lg transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
