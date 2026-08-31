"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useDeviceSession } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services";
import { Button, Card, CardHeader, CardContent, PageLoader, DetailFieldList } from "@/components/ui";
import { SessionLogTimeline } from "@/components/deviceSession/SessionLogTimeline";
import type { Appointment } from "@/types/domain.types";

export default function DeviceSessionSummaryPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { session, isLoading } = useDeviceSession(appointmentId);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!appointmentId) return;
    appointmentsService.getById(appointmentId).then(setAppointment);
  }, [appointmentId]);

  if (!session || isLoading || !appointment) return <PageLoader />;

  const completedFully = session.session_status === "completed";
  const stoppedEarly = session.session_status === "stopped_early";

  return (
    <div className="space-y-5 max-w-4xl">
      <button
        onClick={() => router.push("/clinical-assistant/appointments")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </button>

      <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${completedFully ? "bg-success-50 border-success-200" : "bg-danger-50 border-danger-200"}`}>
        <div>
          <p className={`text-sm font-semibold ${completedFully ? "text-success-800" : "text-danger-800"}`}>
            {completedFully ? "Session completed" : stoppedEarly ? "Session stopped early" : "Session summary"}
          </p>
          <p className="text-xs text-neutral-500">{appointment.patient_name} · {appointment.appointment_date}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/clinical-assistant/appointments")}>Return to Today&apos;s Sessions</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold">Delivered Stimulation</h3></CardHeader>
          <CardContent>
            <DetailFieldList
              data={{
                brand: session.device_brand,
                serial: session.device_serial_number,
                intensity_ma: session.actual_intensity_ma,
                duration_min: session.actual_duration_min,
                ramp_up_sec: session.actual_ramp_up_sec,
                ramp_down_sec: session.actual_ramp_down_sec,
                impedance_kohm: session.impedance_kohm,
                dose: stoppedEarly ? "Stopped early" : "Full dose",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold">Observations</h3></CardHeader>
          <CardContent>
            <DetailFieldList
              data={{
                symptoms: session.symptoms.length,
                adverse_events: session.adverse_events.length,
                notes: session.notes.length,
                activities: session.activities.length,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold">Scales & Assessments</h3></CardHeader>
          <CardContent className="space-y-2">
            {session.scales.length === 0 && <p className="text-sm text-neutral-400">None due this session.</p>}
            {session.scales.map((sc) => (
              <div key={sc.session_scale_id} className="flex items-center justify-between text-sm">
                <span>{sc.scale_name ?? sc.protocol_scale_id}</span>
                <span className="text-neutral-400 text-xs capitalize">{sc.delivery_mode?.replace(/_/g, " ") ?? "—"} · {sc.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold">Patient Feedback & Next Session</h3></CardHeader>
          <CardContent>
            {session.feedback ? (
              <DetailFieldList data={session.feedback.answers as unknown as Record<string, unknown>} />
            ) : (
              <p className="text-sm text-neutral-400">No feedback recorded.</p>
            )}
            {session.next_session_confirmation && (
              <p className="text-sm text-neutral-600 mt-2">
                Next session: {session.next_session_confirmation.patient_confirmed ? "confirmed by patient" : "flagged for change"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold">Session Log</h3></CardHeader>
        <CardContent><SessionLogTimeline events={session.events} /></CardContent>
      </Card>
    </div>
  );
}
