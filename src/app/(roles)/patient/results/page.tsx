"use client";

import { useEffect } from "react";
import { useSessions } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { AssessmentCard } from "@/components/assessment";

export default function PatientResultsPage() {
  const { completedSessions, isLoading, loadMySessions } = useSessions();

  useEffect(() => { loadMySessions(); }, [loadMySessions]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">My Results</h1>

      {completedSessions.length > 0 ? (
        <div className="space-y-3">
          {completedSessions.map((s) => (
            <AssessmentCard key={s.id} session={s} basePath="/patient" />
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-center py-12">No completed assessments yet.</p>
      )}
    </div>
  );
}
