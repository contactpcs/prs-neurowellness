"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSessions } from "@/lib/hooks";
import { prsService } from "@/lib/api/services";
import { PageLoader, Card, CardContent } from "@/components/ui";
import { ScaleResultCard, RiskAlertBanner } from "@/components/assessment";
import type { Scale } from "@/types/prs.types";

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentSession, loadSession } = useSessions();
  const [scales, setScales] = useState<Record<string, Scale>>({});

  useEffect(() => { loadSession(id); }, [id, loadSession]);

  useEffect(() => {
    prsService.getScales().then(({ scales: all }) => {
      const map: Record<string, Scale> = {};
      all.forEach((s) => { map[s.scale_id] = s; });
      setScales(map);
    });
  }, []);

  if (!currentSession) return <PageLoader />;

  const responses = currentSession.scale_responses || [];
  const alerts = currentSession.risk_alerts || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">
        {currentSession.title || "Assessment Results"}
      </h1>

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {responses.map((r) => (
          <ScaleResultCard
            key={r.id}
            response={r}
            scaleName={scales[r.scale_id]?.full_name || r.scale_id}
          />
        ))}
      </div>
    </div>
  );
}
