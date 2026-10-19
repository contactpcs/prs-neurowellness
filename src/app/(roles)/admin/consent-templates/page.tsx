"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSignature, Plus, Trash2, Eye, Pencil } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Skeleton } from "@/components/ui";
import { consentService, type ConsentClause, type ConsentTemplate } from "@/lib/api/services/consent.service";

// Super admin manages every consent form here: text + any number of
// checkboxes, versioned. A published version is frozen (the backend refuses
// edits); a change is a new version. Documents/design_consent_v2.md.

const CONSENT_TYPES = [
  "patient_onboarding", "patient_clinic_exit", "patient_clinic_transfer", "patient_relocation_transfer",
  "staff_onboarding", "staff_offboarding", "clinic_join_anava", "clinic_leave_anava",
];
const STAFF_ROLES = ["super_admin", "regional_admin", "clinic_admin", "doctor", "clinical_assistant", "receptionist"];
const PLACEHOLDERS = ["[PATIENT_NAME]", "[SIGNER_NAME]", "[GUARDIAN_NAME]", "[CLINIC_NAME]", "[ROLE]"];

const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const groupKey = (t: { consent_type: string; role: string | null; language: string }) => `${t.consent_type}|${t.role ?? ""}|${t.language}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function errorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail?.[0]?.msg || fallback;
}

const textareaClass =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-800";
const selectClass = textareaClass;

// ─── Draft editor ─────────────────────────────────────────────────────────

function DraftEditor({ draft, onChanged, onClose }: { draft: ConsentTemplate; onChanged: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(draft.title);
  const [content, setContent] = useState(draft.content);
  const [clauses, setClauses] = useState<ConsentClause[]>(draft.clauses);
  const [reconsent, setReconsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const setClause = (i: number, patch: Partial<ConsentClause>) =>
    setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const clausesValid = clauses.length > 0 && clauses.every((c) => /^[a-z0-9_]{2,40}$/.test(c.code) && c.label.trim())
    && new Set(clauses.map((c) => c.code)).size === clauses.length;

  async function run(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorMessage(e, "Something went wrong"));
      return false;
    } finally {
      setBusy(null);
    }
  }

  const save = () => run("save", () => consentService.updateTemplate(draft.template_id, { title, content, clauses })).then((ok) => ok && onChanged());
  const remove = () => run("delete", () => consentService.deleteTemplate(draft.template_id)).then((ok) => { if (ok) { onChanged(); onClose(); } });
  const publish = async () => {
    const ok = await run("publish", async () => {
      await consentService.updateTemplate(draft.template_id, { title, content, clauses });
      const r = await consentService.publishTemplate(draft.template_id, reconsent);
      if (reconsent) window.alert(`${r.reconsent_count} patient(s) will be asked to sign the new version.`);
    });
    if (ok) { onChanged(); onClose(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        {label(draft.consent_type)}{draft.role ? ` · ${label(draft.role)}` : ""} · version {draft.version} (draft) · {draft.language}
      </p>
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1.5">Consent text</label>
        <textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} className={textareaClass} />
        <p className="text-[11px] text-neutral-400 mt-1">Filled in when shown: {PLACEHOLDERS.join("  ")}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-neutral-700">Checkboxes the signer must answer</label>
          <Button size="sm" variant="outline" onClick={() => setClauses((cs) => [...cs, { code: "", label: "", required: true }])}>
            <Plus className="h-3.5 w-3.5" /> Add checkbox
          </Button>
        </div>
        {clauses.length === 0 && <p className="text-xs text-amber-700">Add at least one checkbox before publishing.</p>}
        <div className="space-y-3">
          {clauses.map((c, i) => (
            <div key={i} className="border border-neutral-200 rounded-lg p-3 space-y-2">
              <textarea
                rows={2}
                placeholder="Statement the signer ticks, e.g. I consent to processing of my health data for my treatment."
                value={c.label}
                onChange={(e) => setClause(i, { label: e.target.value, code: c.code || slug(e.target.value) })}
                className={textareaClass}
              />
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={c.code}
                  onChange={(e) => setClause(i, { code: slug(e.target.value) })}
                  placeholder="code"
                  className="w-48 text-xs font-mono border border-neutral-200 rounded px-2 py-1"
                />
                <label className="flex items-center gap-1.5 text-xs text-neutral-700">
                  <input type="checkbox" checked={c.required} onChange={(e) => setClause(i, { required: e.target.checked })} />
                  Required
                </label>
                <button onClick={() => setClauses((cs) => cs.filter((_, j) => j !== i))} className="ml-auto text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {confirmPublish ? (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
          <p className="text-sm text-amber-900">
            Publishing makes version {draft.version} live and freezes it — it can never be edited or deleted. New signers get this version.
          </p>
          {draft.consent_type === "patient_onboarding" && (
            <label className="flex items-start gap-2 text-sm text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={reconsent} onChange={(e) => setReconsent(e.target.checked)} />
              Ask every existing patient to sign this version (they can&apos;t use the portal until they do)
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" isLoading={busy === "publish"} disabled={!clausesValid || !title.trim() || !content.trim()} onClick={publish}>Publish</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmPublish(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" isLoading={busy === "save"} onClick={save}>Save draft</Button>
          <Button size="sm" disabled={!clausesValid} onClick={() => setConfirmPublish(true)}>Publish…</Button>
          <Button size="sm" variant="ghost" isLoading={busy === "delete"} onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" /> Delete draft
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Read-only view of a published version ────────────────────────────────

function PublishedView({ t }: { t: ConsentTemplate }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Version {t.version} · published {t.published_at ? new Date(t.published_at).toLocaleString() : "—"} · {t.is_active ? "active" : "retired"}
      </p>
      <div className="max-h-80 overflow-y-auto text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg p-4 whitespace-pre-wrap">
        {t.content}
      </div>
      <ul className="space-y-1">
        {t.clauses.map((c) => (
          <li key={c.code} className="text-sm text-neutral-700">☐ {c.label}{!c.required && <span className="text-xs text-neutral-400"> (optional)</span>}</li>
        ))}
        {t.clauses.length === 0 && <li className="text-xs text-neutral-400">No checkboxes (legacy version)</li>}
      </ul>
      <p className="text-[11px] font-mono text-neutral-400 break-all">hash {t.content_hash}</p>
    </div>
  );
}

// ─── New consent form (type without any version yet, or another language) ──

function NewFormDialog({ onCreated }: { onCreated: (t: ConsentTemplate) => void }) {
  const [consentType, setConsentType] = useState(CONSENT_TYPES[0]);
  const [role, setRole] = useState(STAFF_ROLES[0]);
  const [language, setLanguage] = useState("en");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await consentService.createTemplate({
        consent_type: consentType,
        role: consentType === "staff_onboarding" ? role : null,
        language,
        title: label(consentType),
        content: "Consent text…",
        clauses: [],
      }));
    } catch (e) {
      setError(errorMessage(e, "Could not create the draft"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <select value={consentType} onChange={(e) => setConsentType(e.target.value)} className={selectClass}>
        {CONSENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
      </select>
      {consentType === "staff_onboarding" && (
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
      )}
      <Input label="Language code (e.g. en, hi, te)" value={language} maxLength={2} onChange={(e) => setLanguage(e.target.value.toLowerCase())} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button isLoading={busy} onClick={create}>Create draft</Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function ConsentTemplatesPage() {
  const [templates, setTemplates] = useState<ConsentTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [viewing, setViewing] = useState<ConsentTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    consentService.listTemplates(true).then(setTemplates).catch((e) => setError(errorMessage(e, "Could not load consent forms")));
  }, []);
  useEffect(load, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, ConsentTemplate[]>();
    for (const t of templates ?? []) map.set(groupKey(t), [...(map.get(groupKey(t)) ?? []), t]);
    return [...map.values()].map((vs) => vs.sort((a, b) => b.version - a.version));
  }, [templates]);

  const newVersion = async (latest: ConsentTemplate) => {
    try {
      const draft = await consentService.createTemplate({
        consent_type: latest.consent_type,
        role: latest.role,
        language: latest.language,
        title: latest.title,
        content: latest.content,
        clauses: latest.clauses,
      });
      load();
      setEditing(draft);
    } catch (e) {
      setError(errorMessage(e, "Could not create a new version"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Consent Forms</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Text and checkboxes shown to patients and staff. Published versions are permanent; signed records keep the exact version they signed.
          </p>
        </div>
        <Button variant="outline" className="whitespace-nowrap flex-shrink-0" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New form</Button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {templates === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {groups.map((versions) => {
            const active = versions.find((v) => v.is_active);
            const draft = versions.find((v) => !v.published_at);
            const head = versions[0];
            return (
              <Card key={groupKey(head)}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileSignature className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">
                          {label(head.consent_type)}{head.role ? ` · ${label(head.role)}` : ""}
                          <span className="ml-2 text-xs font-normal text-neutral-400">{head.language}</span>
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {active ? `Live: version ${active.version} · ${active.clauses.length} checkbox${active.clauses.length === 1 ? "" : "es"}` : "No live version"}
                          {draft ? ` · draft version ${draft.version} in progress` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft ? (
                        <Button size="sm" onClick={() => setEditing(draft)}><Pencil className="h-3.5 w-3.5" /> Edit draft</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => newVersion(active ?? head)}><Plus className="h-3.5 w-3.5" /> New version</Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {versions.filter((v) => v.published_at).map((v) => (
                      <button
                        key={v.template_id}
                        onClick={() => setViewing(v)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                          v.is_active ? "border-green-300 bg-green-50 text-green-700" : "border-neutral-200 text-neutral-500"
                        }`}
                      >
                        <Eye className="h-3 w-3" /> v{v.version}{v.is_active ? " (live)" : ""}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal className="max-w-2xl" isOpen={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit draft — ${label(editing.consent_type)}` : ""}>
        {editing && <DraftEditor key={editing.template_id} draft={editing} onChanged={load} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal className="max-w-2xl" isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ""}>
        {viewing && <PublishedView t={viewing} />}
      </Modal>
      <Modal isOpen={creating} onClose={() => setCreating(false)} title="New consent form">
        <NewFormDialog onCreated={(t) => { setCreating(false); load(); setEditing(t); }} />
      </Modal>
    </div>
  );
}
