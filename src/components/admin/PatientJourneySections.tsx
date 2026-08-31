"use client";

import { ClipboardList, Activity } from "lucide-react";

interface AnamnesisQuestion {
  question_id: string;
  question_text: string;
}

interface AnamnesisResponse {
  question_id: string;
  response_value: string | null;
  response_values: string[] | null;
}

interface ScaleResult {
  scale_result_id: string;
  scale_id: string;
  calculated_value: number;
  max_possible: number;
  percentage: number | null;
}

interface GeneralPrs {
  instance: { instance_id: string; status: string; completed_at: string | null };
  scale_results?: ScaleResult[];
  final_result?: { calculated_value: number; max_possible: number; percentage: number | null } | null;
}

export interface PatientJourneyDetail {
  anamnesis?: { status: string } | null;
  anamnesis_responses?: AnamnesisResponse[];
  anamnesis_catalog?: AnamnesisQuestion[];
  general_prs?: GeneralPrs | null;
}

function SectionShell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {icon}{title}
      </p>
      {children}
    </div>
  );
}

/** Shared across admin/regional-admin/clinic-admin patient-detail modals —
 * shows what a patient answered during the registration wizard (anamnesis
 * responses, general PRS results). Disease selection was removed from
 * registration (70_remove_disease_selection.sql, 27 Aug 2026). */
export function PatientJourneySections({ detail }: { detail: PatientJourneyDetail }) {
  const responses = detail.anamnesis_responses ?? [];
  const catalog = detail.anamnesis_catalog ?? [];
  const questionText = (questionId: string) => catalog.find((q) => q.question_id === questionId)?.question_text ?? questionId;

  return (
    <>
      <SectionShell icon={<ClipboardList className="h-3.5 w-3.5" />} title="Patient Complaints">
        {!detail.anamnesis ? (
          <p className="text-xs text-neutral-400">Not started yet.</p>
        ) : responses.length === 0 ? (
          <p className="text-xs text-neutral-400">Status: {detail.anamnesis.status} — no responses recorded.</p>
        ) : (
          <div className="border border-neutral-100 rounded-lg overflow-hidden">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide w-1/2 border-r border-neutral-200">Question</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {responses.map((r) => (
                  <tr key={r.question_id}>
                    <td className="px-4 py-3 align-top text-neutral-700 border-r border-neutral-200">{questionText(r.question_id)}</td>
                    <td className="px-4 py-3 align-top text-neutral-900 font-semibold">
                      {r.response_values?.length ? r.response_values.join(", ") : r.response_value ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionShell>

      <SectionShell icon={<Activity className="h-3.5 w-3.5" />} title="General PRS">
        {!detail.general_prs ? (
          <p className="text-xs text-neutral-400">Not completed yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
            {(detail.general_prs.scale_results ?? []).map((sr) => (
              <div key={sr.scale_result_id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-neutral-700">{sr.scale_id}</span>
                <span className="text-neutral-800 font-medium">
                  {sr.calculated_value} / {sr.max_possible}
                  {sr.percentage != null && <span className="text-neutral-400 ml-1">({Math.round(sr.percentage)}%)</span>}
                </span>
              </div>
            ))}
            {detail.general_prs.final_result && (
              <div className="flex items-center justify-between px-4 py-2 text-sm bg-neutral-50">
                <span className="text-neutral-700 font-medium">Final</span>
                <span className="text-neutral-900 font-semibold">
                  {detail.general_prs.final_result.calculated_value} / {detail.general_prs.final_result.max_possible}
                  {detail.general_prs.final_result.percentage != null && (
                    <span className="text-neutral-400 ml-1 font-normal">({Math.round(detail.general_prs.final_result.percentage)}%)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </SectionShell>
    </>
  );
}
