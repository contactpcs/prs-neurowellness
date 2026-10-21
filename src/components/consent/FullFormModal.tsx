"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";

// The full consent form is the super admin's own HTML, shown exactly as
// uploaded. sandbox without allow-scripts: nothing in it can run or reach the
// patient's session (the backend also rejects scripts on upload). Links open
// in a new tab (the backend adds <base target="_blank">).
export function FullFormFrame({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className="w-full h-[70vh] rounded-lg border border-neutral-200 bg-white"
    />
  );
}

/** Loads the form only when opened; closing keeps the caller's state (ticked boxes). */
export function FullFormModal({
  isOpen,
  onClose,
  load,
  title = "Full consent form",
}: {
  isOpen: boolean;
  onClose: () => void;
  load: () => Promise<string>;
  title?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    setHtml(null);
    setError(null);
    load()
      .then((h) => live && setHtml(h))
      .catch((e) => live && setError(e?.response?.data?.error?.message || "Could not load the full consent form."));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-4xl">
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      ) : html === null ? (
        <div className="h-[70vh] flex items-center justify-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <FullFormFrame html={html} title={title} />
      )}
      <div className="flex justify-end mt-3">
        <button onClick={onClose} className="text-sm font-medium text-indigo-600 hover:underline">Back to the summary</button>
      </div>
    </Modal>
  );
}
