"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Play, FileText, Eye } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { prsService } from "@/lib/api/services";
import { PageLoader, Button, Card, CardContent, Badge } from "@/components/ui";
import { RiskAlertBanner, ScaleResultCard } from "@/components/assessment";
import type { Scale } from "@/types/prs.types";

export default function SessionDetailPage() {
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
  const isCompleted = currentSession.status === "completed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{currentSession.title || "Session Detail"}</h1>
          <p className="text-sm text-neutral-500 capitalize mt-1">Status: {currentSession.status.replace("_", " ")}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/doctor/sessions/${id}/conduct`}>
            <Button variant="outline"><Play className="h-4 w-4" /> Conduct Assessment</Button>
          </Link>
          {isCompleted && (
            <Link href={`/doctor/sessions/${id}/report`}>
              <Button><FileText className="h-4 w-4" /> View Report</Button>
            </Link>
          )}
        </div>
      </div>

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {responses.map((r) => (
          <ScaleResultCard key={r.id} response={r} scaleName={scales[r.scale_id]?.full_name || r.scale_id} />
        ))}
      </div>
    </div>
  );
}
