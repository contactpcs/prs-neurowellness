"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt as ReceiptIcon, Download, Search } from "lucide-react";
import { PageLoader, Card, Button, Input } from "@/components/ui";
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
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    paymentsService.myList().then(setPayments).finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesQuery = !q || `${p.appointment_type ?? ""} ${p.status} ${p.payment_id}`.toLowerCase().includes(q);
      const matchesDate = !dateFilter || p.appointment_date === dateFilter;
      return matchesQuery && matchesDate;
    });
  }, [payments, search, dateFilter]);

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
    <div className="flex flex-col space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap flex-shrink-0">
        <h1 className="text-2xl font-bold text-neutral-900">Payments &amp; Bills</h1>
        {payments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search type or status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-36">
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} title="Filter by appointment date" />
            </div>
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-700 whitespace-nowrap"
              >
                Clear date
              </button>
            )}
          </div>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="text-neutral-500 text-center py-12">No payments yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-neutral-500 text-center py-12">No payments match your search.</p>
      ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="overflow-y-auto max-h-[calc(100vh-14rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-neutral-200 z-10">
                <tr className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const canDownload = p.status === "paid" || p.status === "waived" || p.status === "refunded";
                  return (
                    <tr key={p.payment_id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <ReceiptIcon className="h-4.5 w-4.5 text-indigo-600" />
                          </div>
                          <span className="font-semibold text-neutral-900 truncate capitalize">
                            {p.appointment_type ? p.appointment_type.replace("_", " ") : "Payment"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDate(p.appointment_date)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-neutral-900">
                          {p.currency} {p.amount.toLocaleString("en-IN")}
                        </p>
                        {p.base_fee_amount != null && p.platform_fee_amount != null && p.platform_fee_amount > 0 && (
                          <p className="text-xs text-neutral-400">
                            {p.currency} {p.base_fee_amount.toLocaleString("en-IN")} + {p.currency} {p.platform_fee_amount.toLocaleString("en-IN")} fee
                          </p>
                        )}
                        {p.cancellation_refund_amount != null && (
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Refund due: {p.currency} {p.cancellation_refund_amount.toLocaleString("en-IN")} ({p.cancellation_refund_percent}%)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${STATUS_STYLES[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
