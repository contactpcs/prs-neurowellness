"use client";

/** Tap-to-stamp signature — matches the tDCS Treatment Protocol Flow
 * wireframe's pre-session consent step: tapping the box stamps the
 * signer's name in a cursive style rather than capturing a hand-drawn
 * signature. Captures the signer's name string, not a PNG — the backend's
 * ConsentBlock.signature field just stores whatever string is passed. */
export function SignatureCapture({
  signerName,
  onCapture,
  disabled,
}: {
  signerName: string;
  onCapture: (signature: string) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onCapture(signerName)}
      disabled={disabled}
      className={`w-full h-14 rounded-lg flex items-center justify-center transition-colors ${
        disabled
          ? "border border-dashed border-neutral-300 bg-neutral-50 text-neutral-300 cursor-not-allowed"
          : "border border-dashed border-neutral-300 bg-white text-neutral-400 hover:border-primary-300 hover:bg-primary-50 cursor-pointer text-sm"
      }`}
    >
      Tap to sign — {signerName}
    </button>
  );
}
