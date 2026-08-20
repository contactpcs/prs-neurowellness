"use client";

import { useEffect, useState } from "react";
import { Receipt as ReceiptIcon, Download } from "lucide-react";
import { PageLoader, Card, CardContent, Button } from "@/components/ui";
import { paymentsService, saveBlobAsFile, type PaymentHistory } from "@/lib/api/services/payments.service";

const STATUS_STYLES: Record<PaymentHistory["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  waived: "bg-blue-100 text-blue-700",
  refunded: "bg-neutral-200 text-neutral-600",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PatientPaymentsPage() {
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    paymentsService.myList().then(setPayments).finally(() => setIsLoading(false));
  }, []);

  async function handleDownload(p: PaymentHistory) {
    if (!p.appointment_id) return;
    setDownloadingId(p.payment_id);
    try {
      const blob = await paymentsService.downloadReceipt(p.appointment_id);
      saveBlobAsFile(blob, `receipt-${p.appointment_id}.pdf`);
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Payments &amp; Bills</h1>

      {payments.length === 0 ? (
        <p className="text-neutral-500 text-center py-12">No payments yet.</p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const canDownload = p.status === "paid" || p.status === "waived" || p.status === "refunded";
            return (
              <Card key={p.payment_id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <ReceiptIcon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {p.appointment_type ? p.appointment_type.replace("_", " ") : "Payment"}
                      </p>
                      <p className="text-xs text-neutral-400">{fmtDate(p.appointment_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">
                        {p.currency} {p.amount.toLocaleString("en-IN")}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[p.status]}`}>
                        {p.status}
                      </span>
                    </div>
                    {canDownload && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={downloadingId === p.payment_id}
                        onClick={() => handleDownload(p)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
