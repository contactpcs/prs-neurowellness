"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Siren, Wind, Grid3x3, Puzzle, ArrowLeft, Lock, ClipboardList, CheckCircle2, UserCog } from "lucide-react";
import { useDeviceSession } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services";
import { Button, Card, CardContent, Modal, PageLoader } from "@/components/ui";
import { deviceSessionLabel, deviceSessionTone } from "@/lib/utils/deviceSessionStatus";
import type { Appointment } from "@/types/domain.types";
import type { SosType } from "@/types/deviceSession.types";

type View = "home" | "breathe" | "game" | "puzzle";

const SOS_OPTIONS: { value: SosType; label: string; tone: string }[] = [
  { value: "discomfort", label: "Discomfort or tingling too strong", tone: "border-neutral-200" },
  { value: "unwell", label: "I feel unwell — dizzy, headache, nauseous", tone: "border-neutral-200" },
  { value: "other", label: "I need something else", tone: "border-neutral-200" },
  { value: "emergency", label: "Emergency", tone: "border-danger-400 bg-danger-50" },
];

function scheduledAt(a: Appointment): number {
  const t = a.start_time && a.start_time.length >= 4 ? a.start_time : "23:59";
  const d = new Date(`${a.appointment_date}T${t}`);
  return Number.isNaN(d.getTime()) ? new Date(`${a.appointment_date}T23:59`).getTime() : d.getTime();
}

function fmtWhen(a: Appointment): string {
  const d = new Date(`${a.appointment_date}T${a.start_time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return a.appointment_date;
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return a.start_time ? `${date} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : date;
}

function BreathingView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-neutral-500"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="w-40 h-40 rounded-full bg-primary-100 border-2 border-primary-300 animate-[pulse_8s_ease-in-out_infinite]" />
      <p className="text-sm text-neutral-500">Breathe in for 4s, hold for 4s, out for 6s.</p>
    </div>
  );
}

/** 3×3 sliding-tile puzzle. Click a tile next to the gap to slide it; solved
 * when tiles 1–8 are back in order. Self-contained, no library. */
function PuzzleView({ onBack }: { onBack: () => void }) {
  const SIZE = 3;
  const solved = [1, 2, 3, 4, 5, 6, 7, 8, 0];

  const shuffle = (): number[] => {
    // Walk the blank around at random from the solved state — guarantees a
    // solvable arrangement without a parity check.
    const board = [...solved];
    let gap = 8;
    for (let i = 0; i < 120; i++) {
      const r = Math.floor(gap / SIZE), c = gap % SIZE;
      const moves: number[] = [];
      if (r > 0) moves.push(gap - SIZE);
      if (r < SIZE - 1) moves.push(gap + SIZE);
      if (c > 0) moves.push(gap - 1);
      if (c < SIZE - 1) moves.push(gap + 1);
      const pick = moves[Math.floor(Math.random() * moves.length)];
      [board[gap], board[pick]] = [board[pick], board[gap]];
      gap = pick;
    }
    return board;
  };

  const [board, setBoard] = useState<number[]>(shuffle);
  const [moves, setMoves] = useState(0);
  const won = board.every((v, i) => v === solved[i]);

  const tryMove = (idx: number) => {
    if (won) return;
    const gap = board.indexOf(0);
    const r = Math.floor(idx / SIZE), c = idx % SIZE;
    const gr = Math.floor(gap / SIZE), gc = gap % SIZE;
    const adjacent = (Math.abs(r - gr) === 1 && c === gc) || (Math.abs(c - gc) === 1 && r === gr);
    if (!adjacent) return;
    const next = [...board];
    [next[idx], next[gap]] = [next[gap], next[idx]];
    setBoard(next);
    setMoves((m) => m + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-neutral-500"><ArrowLeft className="h-4 w-4" /> Back</button>
        <button onClick={() => { setBoard(shuffle()); setMoves(0); }} className="text-xs font-medium text-primary-600 hover:text-primary-800">Shuffle</button>
      </div>
      <p className="text-xs text-neutral-400">Moves: {moves}</p>
      {won && <p className="text-sm text-success-600 font-medium">Solved in {moves} moves — nicely done.</p>}
      <div className="grid grid-cols-3 gap-2 max-w-[240px]">
        {board.map((v, i) => (
          <button
            key={i}
            onClick={() => tryMove(i)}
            disabled={v === 0}
            className={`h-[72px] rounded-lg border text-xl font-semibold flex items-center justify-center transition-colors ${
              v === 0 ? "border-transparent bg-transparent" : "bg-primary-50 border-primary-200 text-primary-800 hover:bg-primary-100"
            }`}
          >
            {v === 0 ? "" : v}
          </button>
        ))}
      </div>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightScaleId = searchParams.get("assessment");

  const { session, isLoading, raiseSos } = useDeviceSession(appointmentId);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [view, setView] = useState<View>("home");
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    appointmentsService.getById(appointmentId).then(setAppointment).catch(() => setAppointment(null));
  }, [appointmentId]);

  if (!appointment || isLoading) return <PageLoader />;

  const locked =
    scheduledAt(appointment) > Date.now() &&
    appointment.status !== "in_progress" &&
    appointment.status !== "completed";
  const closed = appointment.status === "cancelled" || appointment.status === "no_show";

  const handleSos = async (type: SosType) => {
    await raiseSos(type);
    setSosSent(true);
  };

  const isLive = session?.session_status === "in_progress" || session?.session_status === "paused";
  const scales = session?.scales ?? [];

  return (
    <div className="relative h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 -mb-6 overflow-y-auto">
      {view === "home" && (
        <div className="p-4 sm:p-6 space-y-5">
          <button
            onClick={() => router.push("/patient/device-sessions")}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All sessions
          </button>

          <Card>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-neutral-900">
                  Session {appointment.session_number ?? ""}
                </h2>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${deviceSessionTone(appointment.status)}`}>
                  {isLive ? "In progress" : deviceSessionLabel(appointment.status)}
                </span>
              </div>
              <p className="text-sm text-neutral-500">{fmtWhen(appointment)}</p>
            </CardContent>
          </Card>

          {locked ? (
            <Card>
              <CardContent className="flex items-start gap-3 py-5">
                <Lock className="h-5 w-5 text-neutral-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">This session isn&apos;t open yet</p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    Its activities and assessment become available at the scheduled time — {fmtWhen(appointment)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : closed ? (
            <Card>
              <CardContent className="py-5">
                <p className="text-sm text-neutral-500">
                  This session was {appointment.status === "no_show" ? "missed" : "cancelled"}. Nothing to complete here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ─── Assessments assigned to this session ─── */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">Assessment for this session</h3>
                {scales.length === 0 ? (
                  <Card><CardContent className="py-4"><p className="text-sm text-neutral-400">No assessment was assigned to this session.</p></CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {scales.map((sc) => {
                      const name = sc.scale_name ?? sc.scale_code ?? sc.protocol_scale_id;
                      const highlighted = highlightScaleId != null && highlightScaleId === sc.protocol_scale_id;
                      const done = sc.status === "completed";
                      const patientCanAnswer = sc.delivery_mode === "patient_app" && !done;

                      return (
                        <Card key={sc.session_scale_id} className={highlighted ? "border-primary-400 ring-2 ring-primary-100" : ""}>
                          <CardContent className="flex items-center justify-between gap-3 py-3.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-neutral-900">{name}</p>
                              <p className="text-xs mt-0.5 flex items-center gap-1.5">
                                {done ? (
                                  <span className="text-success-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Completed</span>
                                ) : patientCanAnswer ? (
                                  <span className="text-warning-700 flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> Ready for you to complete</span>
                                ) : (
                                  <span className="text-neutral-500 flex items-center gap-1"><UserCog className="h-3.5 w-3.5" /> Your clinical assistant will complete this with you</span>
                                )}
                              </p>
                            </div>
                            {done ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(sc.prs_instance_id ? `/patient/results/${sc.prs_instance_id}` : "/patient/results")}
                              >
                                View score
                              </Button>
                            ) : patientCanAnswer ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/patient/device-sessions/${appointmentId}/assessment/${sc.protocol_scale_id}?scale_code=${encodeURIComponent(sc.scale_code ?? "")}`,
                                  )
                                }
                              >
                                {sc.status === "in_progress" ? "Continue" : "Start"}
                              </Button>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── In-session calming tools ─── */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">While you&apos;re in your session</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setView("breathe")} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 text-left space-y-1">
                    <Wind className="h-5 w-5 text-primary-500" />
                    <p className="text-sm font-medium">Breathing Exercise</p>
                  </button>
                  <button onClick={() => setView("game")} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 text-left space-y-1">
                    <Grid3x3 className="h-5 w-5 text-primary-500" />
                    <p className="text-sm font-medium">Memory Match</p>
                  </button>
                  <button onClick={() => setView("puzzle")} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 text-left space-y-1 col-span-2">
                    <Puzzle className="h-5 w-5 text-primary-500" />
                    <p className="text-sm font-medium">Puzzle</p>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {view === "breathe" && <div className="h-full p-6"><BreathingView onBack={() => setView("home")} /></div>}
      {view === "game" && <div className="p-6"><GameView onBack={() => setView("home")} /></div>}
      {view === "puzzle" && <div className="p-4 sm:p-6"><PuzzleView onBack={() => setView("home")} /></div>}

      {/* SOS floating button — only meaningful while the session is live */}
      {isLive && (
        <button
          onClick={() => { setSosOpen(true); setSosSent(false); }}
          className="fixed bottom-6 right-6 z-20 flex items-center gap-2 px-4 py-3 rounded-full bg-danger-500 text-white shadow-lg hover:bg-danger-700 transition-colors"
        >
          <Siren className="h-4 w-4" /> Reach Out to Clinical Assistant
        </button>
      )}

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
