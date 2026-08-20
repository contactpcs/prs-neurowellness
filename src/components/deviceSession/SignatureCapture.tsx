"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";

/** Minimal canvas signature pad — no library exists for this in the repo.
 * Captures a data-URL PNG, not a cryptographic signature (matches
 * device_sessions.patient_consent/ca_declaration's "captured signature-pad
 * payload" comment in the SQL migration). Used for both the patient consent
 * and CA declaration blocks on the pre-session checklist. */
export function SignatureCapture({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = getPos(e);
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#171717"; // neutral-900 — canvas 2D API needs a literal, not a CSS var
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    setHasDrawn(true);
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    onCapture(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={320}
        height={100}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className={`w-full rounded-lg border border-dashed border-neutral-300 bg-neutral-50 touch-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-crosshair"}`}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={clear} disabled={disabled}>Clear</Button>
        <Button size="sm" onClick={confirm} disabled={disabled || !hasDrawn}>Confirm signature</Button>
      </div>
    </div>
  );
}
