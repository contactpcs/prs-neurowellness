"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, FileDown, XCircle } from "lucide-react";
import { consentService, type ConsentPlaceholder, type FullFormAnalysis } from "@/lib/api/services/consent.service";

// Super admin guide for building a consent type's full HTML form, and the
// check of an uploaded form. Field names, required/recommended levels and the
// starter HTML all come from the backend catalogue (app/modules/consent/fill.py,
// starters.py) — Documents/design_consent_v2.md H16-H18.

const LEVEL_LABEL = { required: "Required", recommended: "Recommended", optional: "Optional" } as const;
const LEVEL_CLASS = {
  required: "bg-red-50 text-red-700 border-red-200",
  recommended: "bg-amber-50 text-amber-800 border-amber-200",
  optional: "bg-neutral-50 text-neutral-600 border-neutral-200",
} as const;

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(() => { setCopied(text); setTimeout(() => setCopied(null), 1200); }).catch(() => {});
  return { copied, copy };
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/html;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const typeLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function FullFormGuide({
  consentType,
  role,
  hasForm,
  onUseStarter,
}: {
  consentType: string;
  role: string | null;
  hasForm: boolean;
  onUseStarter: (html: string) => void;
}) {
  const [items, setItems] = useState<ConsentPlaceholder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  useEffect(() => {
    consentService.getPlaceholders(consentType, role).then(setItems).catch(() => setItems([]));
  }, [consentType, role]);

  const starter = async (mode: "load" | "download") => {
    setError(null);
    try {
      const s = await consentService.getStarter(consentType, role);
      if (mode === "download") downloadText(s.filename, s.html);
      else if (!hasForm || window.confirm("Replace the current full form with the starter template?")) onUseStarter(s.html);
    } catch {
      setError("Could not load the starter template");
    }
  };

  const groups = (["required", "recommended", "optional"] as const).map((level) => ({ level, rows: items.filter((p) => p.level === level) }));
  const isPatient = consentType.startsWith("patient_");

  return (
    <details open={!hasForm} className="border border-indigo-100 bg-indigo-50/40 rounded-lg p-3 text-xs text-neutral-700">
      <summary className="cursor-pointer font-medium text-indigo-900">
        How to build the full form for {typeLabel(consentType)}{role ? ` · ${typeLabel(role)}` : ""}
      </summary>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => starter("load")} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
            <FileDown className="h-3.5 w-3.5" /> Start from the template
          </button>
          <button onClick={() => starter("download")} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-medium hover:bg-indigo-50">
            <Download className="h-3.5 w-3.5" /> Download template .html
          </button>
          {error && <span className="text-red-600 self-center">{error}</span>}
        </div>

        <ol className="list-decimal pl-4 space-y-1.5">
          <li>
            Every personal detail is captured automatically from Anava&apos;s records — the patient never types it. Put it in
            the HTML as a <strong>field</strong> <code className="font-mono bg-white px-1 rounded">&lt;input name=&quot;PATIENT_NAME&quot;&gt;</code>{" "}
            (filled and locked) or as <strong>text</strong> <code className="font-mono bg-white px-1 rounded">[PATIENT_NAME]</code>.
            Use the names below to have them filled; any other name is allowed but stays blank.
          </li>
          {isPatient && (
            <li>
              Guardian details go inside <code className="font-mono bg-white px-1 rounded">&lt;div data-show-if=&quot;guardian&quot;&gt;…&lt;/div&gt;</code>{" "}
              — shown only when a guardian signs (patient under 18, or an adult who cannot consent). Text for a patient
              signing for themselves goes in <code className="font-mono bg-white px-1 rounded">data-show-if=&quot;self&quot;</code>.
            </li>
          )}
          <li>
            Put <code className="font-mono bg-white px-1 rounded">[SIGNATURE_BLOCK]</code> where the acceptance (name, time, IP) should appear.
          </li>
          <li>
            One self-contained file: CSS inside &lt;style&gt;, images and fonts as data: URIs, no scripts, no external links to
            fonts or images, under 1 MB.
          </li>
          <li>
            The summary, title and checkboxes must not contain personal details — those are only in this full form. Fields
            marked <em>full form only</em> are refused there.
          </li>
        </ol>

        {groups.map(({ level, rows }) => rows.length > 0 && (
          <div key={level}>
            <p className="font-medium mb-1">
              {LEVEL_LABEL[level]} fields
              {level === "required" && <span className="font-normal text-neutral-500"> — the form cannot be published without them</span>}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white rounded">
                <tbody>
                  {rows.map((p) => {
                    const field = p.name === "SIGNATURE_BLOCK" ? null : `<input name="${p.name}">`;
                    return (
                      <tr key={p.name} className="border-b border-neutral-100 last:border-0">
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${LEVEL_CLASS[level]}`}>{p.name}</span>
                        </td>
                        <td className="px-2 py-1">
                          {p.description}
                          {p.full_form_only && <span className="ml-1 text-[10px] text-blue-700">(full form only)</span>}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-right">
                          {field && (
                            <button onClick={() => copy(field)} className="inline-flex items-center gap-1 text-indigo-600 hover:underline mr-2">
                              <Copy className="h-3 w-3" />{copied === field ? "copied" : "field"}
                            </button>
                          )}
                          <button onClick={() => copy(`[${p.name}]`)} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                            <Copy className="h-3 w-3" />{copied === `[${p.name}]` ? "copied" : "text"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Live check of the uploaded form: what it will capture and what blocks it.
 * Reports the result up so the editor can block publishing. */
export function DetectedFields({
  consentType,
  role,
  html,
  onResult,
}: {
  consentType: string;
  role: string | null;
  html: string;
  onResult: (a: FullFormAnalysis | null) => void;
}) {
  const [analysis, setAnalysis] = useState<FullFormAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!html.trim()) { setAnalysis(null); onResult(null); return; }
    let live = true;
    const t = setTimeout(() => {
      consentService.analyzeFullHtml(consentType, role, html)
        .then((a) => { if (live) { setAnalysis(a); setError(null); onResult(a); } })
        .catch(() => { if (live) { setError("Could not check the form"); onResult(null); } });
    }, 500);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentType, role, html]);

  if (!html.trim()) return null;
  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!analysis) return <p className="text-xs text-neutral-400">Checking the form…</p>;

  // Only required fields and unsafe HTML block publishing; unknown names are allowed (shown blank).
  const blocked = analysis.problems.length + analysis.missing_required.length > 0;
  return (
    <div className={`rounded-lg border p-3 text-xs space-y-2 ${blocked ? "border-red-200 bg-red-50/40" : "border-green-200 bg-green-50/40"}`}>
      <p className="font-medium flex items-center gap-1.5">
        {blocked ? <XCircle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
        {blocked
          ? "This form can be saved as a draft but not published yet"
          : `Ready — this form captures ${analysis.fields.length} field${analysis.fields.length === 1 ? "" : "s"} automatically at signing`}
      </p>

      {analysis.fields.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-100">
                <th className="px-2 py-1 font-medium">Field in your HTML</th>
                <th className="px-2 py-1 font-medium">Captured as</th>
                <th className="px-2 py-1 font-medium">How</th>
              </tr>
            </thead>
            <tbody>
              {analysis.fields.map((f) => (
                <tr key={f.name} className="border-b border-neutral-100 last:border-0">
                  <td className="px-2 py-1 font-mono whitespace-nowrap">
                    {f.known ? <CheckCircle2 className="inline h-3 w-3 text-green-600 mr-1" /> : <AlertTriangle className="inline h-3 w-3 text-amber-600 mr-1" />}
                    {f.name}
                    {f.required && <span className="ml-1 text-[10px] text-red-700 font-sans">required</span>}
                  </td>
                  <td className={`px-2 py-1 ${f.known ? "" : "text-amber-800"}`}>{f.description}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-neutral-500">
                    {[f.as_input && "input field", f.as_text && "text"].filter(Boolean).join(" + ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analysis.missing_required.length > 0 && (
        <p className="text-red-700">
          <strong>Missing required:</strong> {analysis.missing_required.map((n) => `[${n}]`).join(", ")} — add them before publishing.
        </p>
      )}
      {analysis.unknown.length > 0 && (
        <p className="text-amber-800 flex gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Not filled by Anava:</strong> {analysis.unknown.join(", ")} — allowed, but they will show blank (—). Rename them
            to a field from the guide if you want them filled.
          </span>
        </p>
      )}
      {analysis.problems.length > 0 && (
        <div className="text-red-700">
          <strong>Not allowed in the HTML:</strong>
          <ul className="list-disc pl-5">{analysis.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {analysis.missing_recommended.length > 0 && (
        <p className="text-amber-800 flex gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span><strong>Recommended, not in the form:</strong> {analysis.missing_recommended.map((n) => `[${n}]`).join(", ")}</span>
        </p>
      )}
      {consentType.startsWith("patient_") && !analysis.has_guardian_section && (
        <p className="text-amber-800 flex gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>No <code className="font-mono">data-show-if=&quot;guardian&quot;</code> section — patients signing for themselves will also see the guardian part, with blanks (—).</span>
        </p>
      )}
    </div>
  );
}
