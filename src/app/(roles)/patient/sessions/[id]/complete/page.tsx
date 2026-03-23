"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export default function SessionCompletePage() {
  return (
    <div className="max-w-md mx-auto text-center py-16 space-y-6">
      <CheckCircle2 className="h-20 w-20 text-success-500 mx-auto" />

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Assessment Complete</h1>
        <p className="text-neutral-500 mt-2">
          Thank you for completing all questionnaires. Your responses have been saved securely.
        </p>
      </div>

      <div className="bg-primary-50 rounded-xl px-6 py-4">
        <p className="text-sm text-primary-800">
          Your doctor will review the results and discuss them with you at your next consultation.
        </p>
      </div>

      <Link href="/patient/dashboard">
        <Button size="lg" className="mt-4">
          Back to Dashboard <ArrowRight className="h-5 w-5" />
        </Button>
      </Link>
    </div>
  );
}
