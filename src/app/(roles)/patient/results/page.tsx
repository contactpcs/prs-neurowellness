"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { scoresService } from "@/lib/api/services/scores.service";
import { PageLoader, Card, CardContent } from "@/components/ui";
import type { ScoreSummaryItem } from "@/types/domain.types";

export default function PatientResultsPage() {
  const [scores, setScores] = useState<ScoreSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    scoresService.getMyScoresSummary()
      .then(({ scores: s }) => setScores(s))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">My Results</h1>

      {scores.length > 0 ? (
        <div className="space-y-3">
          {scores.map((score, i) => (
            <Card key={score.scale_id + i}>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {score.scale_name ?? score.scale_id}
                    </p>
                    {score.scale_code && (
                      <p className="text-xs text-neutral-400">{score.scale_code}</p>
                    )}
                    {(score.recorded_at ?? score.completed_at) && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(score.recorded_at ?? score.completed_at!).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {score.total_score != null && (
                    <p className="text-sm font-bold text-neutral-900">
                      {score.total_score}
                      {score.max_possible_score != null && (
                        <span className="text-neutral-400 font-normal"> / {score.max_possible_score}</span>
                      )}
                    </p>
                  )}
                  {score.percentage != null && (
                    <p className="text-xs text-neutral-500">{score.percentage.toFixed(0)}%</p>
                  )}
                  {score.severity_label && (
                    <p className="text-xs text-neutral-500">{score.severity_label}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-center py-12">No completed assessments yet.</p>
      )}
    </div>
  );
}
