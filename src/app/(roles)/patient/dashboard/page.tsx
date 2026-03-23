"use client";

import { useEffect } from "react";
import { useSessions } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { AssessmentCard } from "@/components/assessment";

export default function PatientDashboard() {
  const { pendingSessions, inProgressSessions, completedSessions, isLoading, loadMySessions } = useSessions();

  useEffect(() => { loadMySessions(); }, [loadMySessions]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Assessments</h1>
        <p className="text-sm text-neutral-500 mt-1">Complete your assigned assessments below</p>
      </div>

      {pendingSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Pending</h2>
          <div className="space-y-3">
            {pendingSessions.map((s) => (
              <AssessmentCard key={s.id} session={s} basePath="/patient" />
            ))}
          </div>
        </section>
      )}

      {inProgressSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">In Progress</h2>
          <div className="space-y-3">
            {inProgressSessions.map((s) => (
              <AssessmentCard key={s.id} session={s} basePath="/patient" />
            ))}
          </div>
        </section>
      )}

      {completedSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Completed</h2>
          <div className="space-y-3">
            {completedSessions.map((s) => (
              <AssessmentCard key={s.id} session={s} basePath="/patient" />
            ))}
          </div>
        </section>
      )}

      {pendingSessions.length === 0 && inProgressSessions.length === 0 && completedSessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-neutral-500">No assessments assigned yet.</p>
          <p className="text-sm text-neutral-400 mt-1">Your doctor will assign assessments for you.</p>
        </div>
      )}
    </div>
  );
}
