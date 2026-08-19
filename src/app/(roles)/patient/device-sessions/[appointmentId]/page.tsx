"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Siren, Wind, Grid3x3, Sparkles, ArrowLeft } from "lucide-react";
import { useDeviceSession } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services";
import { Button, Card, CardContent, Modal, PageLoader, ProgressBar } from "@/components/ui";
import type { Appointment } from "@/types/domain.types";
import type { SosType } from "@/types/deviceSession.types";

type View = "home" | "breathe" | "game" | "visuals";

const SOS_OPTIONS: { value: SosType; label: string; tone: string }[] = [
  { value: "discomfort", label: "Discomfort or tingling too strong", tone: "border-neutral-200" },
  { value: "unwell", label: "I feel unwell — dizzy, headache, nauseous", tone: "border-neutral-200" },
  { value: "other", label: "I need something else", tone: "border-neutral-200" },
  { value: "emergency", label: "Emergency", tone: "border-danger-400 bg-danger-50" },
];

function BreathingView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-neutral-500"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="w-40 h-40 rounded-full bg-primary-100 border-2 border-primary-300 animate-[pulse_8s_ease-in-out_infinite]" />
      <p className="text-sm text-neutral-500">Breathe in for 4s, hold for 4s, out for 6s.</p>
    </div>
  );
}

function VisualsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative h-full overflow-hidden">
      <button onClick={onBack} className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-sm text-white/90"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div
        className="absolute inset-0 animate-[pulse_10s_ease-in-out_infinite]"
        style={{ background: "linear-gradient(135deg, #00A1E4, #6366f1, #09172E)", backgroundSize: "200% 200%" }}
      />
    </div>
  );
}

function GameView({ onBack }: { onBack: () => void }) {
  const [cards] = useState(() => {
    const symbols = ["🌙", "⭐", "🌸", "🍃", "☀️", "🌊"];
    return [...symbols, ...symbols].sort(() => Math.random() - 0.5);
  });
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);

  const handleFlip = (i: number) => {
    if (flipped.length === 2 || flipped.includes(i) || matched.has(i)) return;
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      if (cards[next[0]] === cards[next[1]]) {
        setMatched((prev) => new Set([...prev, ...next]));
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 700);
      }
    }
  };

  const won = matched.size === cards.length;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-neutral-500"><ArrowLeft className="h-4 w-4" /> Back</button>
      <p className="text-xs text-neutral-400">Moves: {moves}</p>
      {won && <p className="text-sm text-success-600 font-medium">You matched them all — your assistant may note this in your session record.</p>}
      <div className="grid grid-cols-4 gap-2 max-w-xs">
        {cards.map((c, i) => {
          const isVisible = flipped.includes(i) || matched.has(i);
          return (
            <button
              key={i}
              onClick={() => handleFlip(i)}
              className={`h-16 rounded-lg border text-2xl flex items-center justify-center transition-colors ${
                isVisible ? "bg-primary-50 border-primary-300" : "bg-neutral-100 border-neutral-200"
              }`}
            >
              {isVisible ? c : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PatientDeviceSessionPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { session, isLoading, raiseSos } = useDeviceSession(appointmentId);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [view, setView] = useState<View>("home");
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    appointmentsService.getById(appointmentId).then(setAppointment);
  }, [appointmentId]);

  if (!appointment || isLoading) return <PageLoader />;

  const handleSos = async (type: SosType) => {
    await raiseSos(type);
    setSosSent(true);
  };

  const isLive = session?.session_status === "in_progress" || session?.session_status === "paused";

  return (
    <div className="relative h-[calc(100vh-4rem)] -mx-6 -mb-6 overflow-y-auto">
      {view === "home" && (
        <div className="p-6 space-y-5 max-w-2xl mx-auto">
          <Card>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-neutral-900">Today&apos;s Session</h2>
                {isLive && <span className="px-2.5 py-1 bg-danger-50 text-danger-600 rounded-full text-xs font-medium animate-pulse">Session in progress</span>}
              </div>
              <p className="text-sm text-neutral-500">{appointment.appointment_date} · {appointment.start_time || "Time TBD"}</p>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">While You&apos;re in Your Session</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setView("breathe")} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 text-left space-y-1">
                <Wind className="h-5 w-5 text-primary-500" />
                <p className="text-sm font-medium">Breathing Exercise</p>
              </button>
              <button onClick={() => setView("game")} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 text-left space-y-1">
                <Grid3x3 className="h-5 w-5 text-primary-500" />
                <p className="text-sm font-medium">Memory Match</p>
              </button>
              <button onClick={() => setView("visuals")} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 text-left space-y-1 col-span-2">
                <Sparkles className="h-5 w-5 text-primary-500" />
                <p className="text-sm font-medium">Calming Visuals</p>
              </button>
            </div>
          </div>

          {session && session.scales.filter((s) => s.status !== "completed").length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Your Check-ins for Today</h3>
              <div className="space-y-2">
                {session.scales.map((sc) => (
                  <Card key={sc.session_scale_id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <span className="text-sm">{sc.scale_name ?? sc.protocol_scale_id}</span>
                      <span className="text-xs text-neutral-400 capitalize">{sc.status.replace(/_/g, " ")}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "breathe" && <div className="h-full p-6"><BreathingView onBack={() => setView("home")} /></div>}
      {view === "game" && <div className="p-6"><GameView onBack={() => setView("home")} /></div>}
      {view === "visuals" && <VisualsView onBack={() => setView("home")} />}

      {/* SOS floating button */}
      <button
        onClick={() => { setSosOpen(true); setSosSent(false); }}
        className="fixed bottom-6 right-6 z-20 flex items-center gap-2 px-4 py-3 rounded-full bg-danger-500 text-white shadow-lg hover:bg-danger-700 transition-colors"
      >
        <Siren className="h-4 w-4" /> Reach Out to Clinical Assistant
      </button>

      <Modal isOpen={sosOpen} onClose={() => setSosOpen(false)} title="Need help?">
        {sosSent ? (
          <div className="space-y-3 text-center py-4">
            <p className="text-sm font-medium text-success-700">Help is on the way — your clinical assistant has been notified.</p>
            <Button onClick={() => setSosOpen(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {SOS_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleSos(o.value)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors hover:bg-neutral-50 ${o.tone}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
