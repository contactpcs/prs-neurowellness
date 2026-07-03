"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, UserCog, ClipboardList, ShoppingBag, Building2, RefreshCw,
  CalendarDays, CheckCircle2, Stethoscope, Package, Receipt, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import { staffRequestsService } from "@/lib/api/services/staffRequests.service";
import { storeService, type Product, type StoreOrder } from "@/lib/api/services/store.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { paymentsService, type Payment } from "@/lib/api/services/payments.service";
import { inventoryService, type InventoryItem } from "@/lib/api/services/inventory.service";
import type { AdminClinic, AdminStaffMember, AdminPatient } from "@/types/admin.types";
import type { Appointment } from "@/types/domain.types";

const STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup", active: "Active", pending_closure: "Closing", closed: "Closed",
};
const STATUS_COLORS: Record<AdminClinic["status"], { color: string; bg: string }> = {
  setup: { color: "text-amber-600", bg: "bg-amber-50" },
  active: { color: "text-green-600", bg: "bg-green-50" },
  pending_closure: { color: "text-orange-600", bg: "bg-orange-50" },
  closed: { color: "text-neutral-500", bg: "bg-neutral-100" },
};

const OPEN_ORDER_STATUSES = new Set(["pending_doctor_approval", "doctor_approved", "pending_dispatch", "dispatched_to_clinic"]);
const ORDER_STATUS_STYLES: Record<string, string> = {
  pending_doctor_approval: "bg-amber-100 text-amber-700",
  doctor_approved: "bg-blue-100 text-blue-700",
  pending_dispatch: "bg-amber-100 text-amber-700",
  dispatched_to_clinic: "bg-indigo-100 text-indigo-700",
  received_at_clinic: "bg-teal-100 text-teal-700",
  collected_by_patient: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-200 text-neutral-600",
};
const APPT_STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-blue-100 text-blue-700",
  checked_in: "bg-teal-100 text-teal-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-200 text-neutral-600",
  no_show: "bg-red-100 text-red-600",
  rescheduled: "bg-purple-100 text-purple-700",
};
const PAYMENT_STATUS_COLORS: Record<Payment["status"], { bar: string; badge: string }> = {
  pending: { bar: "bg-amber-400", badge: "bg-amber-100 text-amber-700" },
  paid: { bar: "bg-green-500", badge: "bg-green-100 text-green-700" },
  waived: { bar: "bg-blue-400", badge: "bg-blue-100 text-blue-700" },
  failed: { bar: "bg-red-400", badge: "bg-red-100 text-red-600" },
  refunded: { bar: "bg-neutral-300", badge: "bg-neutral-200 text-neutral-600" },
};
const LOW_STOCK_THRESHOLD = 5;

interface DoctorSchedule { day_of_week: number; start_time: string; end_time: string; slot_duration_minutes: number }

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-4 space-y-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function timeLabel(t: string) {
  // "14:30:00" -> "2:30 PM"
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ClinicAdminDashboardPage() {
  const { user } = useAuth();
  const [clinic, setClinic] = useState<AdminClinic | null>(null);
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [doctorSchedules, setDoctorSchedules] = useState<Record<string, DoctorSchedule[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user?.clinic_id) return;
    const clinicId = user.clinic_id;
    setError(null);
    try {
      const [clinicRes, staffRes, patientsRes, requestsRes, ordersRes, appointmentsRes, paymentsRes, inventoryRes, productsRes] = await Promise.all([
        adminService.getClinic(clinicId),
        adminService.getStaff({ clinic_id: clinicId }),
        adminService.getPatients({ clinic_id: clinicId }),
        staffRequestsService.list({ clinic_id: clinicId }),
        storeService.listOrders({ clinic_id: clinicId }),
        appointmentsService.list({ clinic_id: clinicId }),
        paymentsService.list({ clinic_id: clinicId }),
        inventoryService.list({ clinic_id: clinicId }),
        storeService.listProducts(),
      ]);
      setClinic(clinicRes);
      setStaff(staffRes.staff);
      setPatients(patientsRes.patients);
      setPendingRequests(requestsRes.filter((r) => r.status === "pending" || r.status === "under_review").length);
      setOrders(ordersRes);
      setAppointments(appointmentsRes.appointments);
      setPayments(paymentsRes);
      setInventory(inventoryRes);
      setProducts(productsRes);

      const doctors = staffRes.staff.filter((s) => s.role === "doctor");
      const scheduleResults = await Promise.all(doctors.map((d) => doctorsService.listWeeklySchedules(d.id)));
      const scheduleMap: Record<string, DoctorSchedule[]> = {};
      doctors.forEach((d, i) => { scheduleMap[d.id] = scheduleResults[i]; });
      setDoctorSchedules(scheduleMap);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load dashboard");
    }
  }

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [user?.clinic_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (isLoading) return <DashboardSkeleton />;

  const statusColor = clinic ? STATUS_COLORS[clinic.status] : { color: "text-neutral-500", bg: "bg-neutral-100" };
  const openOrders = orders.filter((o) => OPEN_ORDER_STATUSES.has(o.status)).length;

  const stats = [
    { label: "Staff Members",   value: staff.length,             icon: UserCog,      color: "text-blue-600",   bg: "bg-blue-50",   href: "/clinic-admin/staff" },
    { label: "Patients",        value: patients.length,          icon: Users,        color: "text-green-600",  bg: "bg-green-50",  href: "/clinic-admin/patients" },
    { label: "Staff Requests",  value: pendingRequests,          icon: ClipboardList,color: "text-amber-600",  bg: "bg-amber-50",  href: "/clinic-admin/staff-requests", sublabel: "pending" },
    { label: "Store Orders",    value: openOrders,               icon: ShoppingBag,  color: "text-purple-600", bg: "bg-purple-50", href: "/clinic-admin/store-orders",   sublabel: "in progress" },
    { label: "Clinic Status",   value: clinic ? STATUS_LABELS[clinic.status] : "—", icon: Building2, color: statusColor.color, bg: statusColor.bg, href: "/clinic-admin/my-clinic", isText: true },
  ];

  // ── Appointments ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const patientName = (id: string) => { const p = patients.find((x) => x.id === id); return p ? `${p.first_name} ${p.last_name}` : id; };
  const staffName = (id: string) => { const s = staff.find((x) => x.id === id); return s ? `${s.first_name} ${s.last_name}` : id; };

  const todaysAppointments = appointments
    .filter((a) => a.appointment_date === todayStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const upcomingAppointments = appointments
    .filter((a) => a.appointment_date > todayStr)
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time))
    .slice(0, 5);
  // No checked_in_at on AppointmentRead — start_time is the closest real
  // field to sort "recent" check-ins by (same-day, so this is a fine proxy).
  const recentCheckins = appointments
    .filter((a) => a.appointment_date === todayStr && a.status === "checked_in")
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  // ── Staff working hours (doctors only) ──
  const todayDow = new Date().getDay(); // 0=Sunday...6=Saturday
  const doctors = staff.filter((s) => s.role === "doctor");

  // ── Payments ──
  const totalCollected = payments.filter((p) => p.status === "paid" || p.status === "waived").reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0);
  const paymentStatusCounts = (["pending", "paid", "waived", "failed", "refunded"] as const).map((status) => ({
    status, count: payments.filter((p) => p.status === status).length,
  })).filter((s) => s.count > 0);
  const recentPayments = [...payments].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  // ── Inventory ──
  const productName = (id: string) => products.find((p) => p.product_id === id)?.name ?? id;

  // ── Latest orders ──
  const latestOrders = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome, {user?.first_name}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{clinic?.clinic_name ?? "Your clinic"} at a glance</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
          className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="py-4 px-4">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <p className={`font-bold text-neutral-900 ${s.isText ? "text-lg" : "text-2xl"}`}>{s.value}</p>
                <p className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                  {s.label}{s.sublabel && <span className="block text-neutral-400">{s.sublabel}</span>}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Appointments + Check-ins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />Today &amp; Upcoming Appointments
            </h2>
          </div>
          <Card>
            {todaysAppointments.length === 0 && upcomingAppointments.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-neutral-500">No appointments scheduled</CardContent>
            ) : (
              <div className="divide-y divide-neutral-100">
                {todaysAppointments.map((a) => (
                  <div key={a.appointment_id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{patientName(a.patient_id)}</p>
                      <p className="text-xs text-neutral-400">Today {timeLabel(a.start_time)} · Dr. {staffName(a.doctor_id)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APPT_STATUS_STYLES[a.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
                {upcomingAppointments.map((a) => (
                  <div key={a.appointment_id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{patientName(a.patient_id)}</p>
                      <p className="text-xs text-neutral-400">{a.appointment_date} {timeLabel(a.start_time)} · Dr. {staffName(a.doctor_id)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APPT_STATUS_STYLES[a.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />Recent Patient Check-ins
            </h2>
          </div>
          <Card>
            {recentCheckins.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-neutral-500">No check-ins today yet</CardContent>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recentCheckins.map((a) => (
                  <div key={a.appointment_id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{patientName(a.patient_id)}</p>
                      <p className="text-xs text-neutral-400">{timeLabel(a.start_time)} · Dr. {staffName(a.doctor_id)}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Checked In</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Staff working hours + Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4" />Doctor Working Hours Today
            </h2>
          </div>
          <Card>
            {doctors.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-neutral-500">No doctors at this clinic</CardContent>
            ) : (
              <div className="divide-y divide-neutral-100">
                {doctors.map((d) => {
                  const todaysSlot = (doctorSchedules[d.id] ?? []).find((sch) => sch.day_of_week === todayDow);
                  return (
                    <div key={d.id} className="flex items-center justify-between px-5 py-3">
                      <p className="text-sm font-medium text-neutral-900">Dr. {d.first_name} {d.last_name}</p>
                      {todaysSlot ? (
                        <span className="text-xs font-medium text-neutral-700">{timeLabel(todaysSlot.start_time)} – {timeLabel(todaysSlot.end_time)}</span>
                      ) : (
                        <span className="text-xs text-neutral-400">No hours scheduled today</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <p className="text-xs text-neutral-400 mt-2">Clinical Assistants and Receptionists don't have tracked working hours in this system yet.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
              <Package className="h-4 w-4" />Inventory
            </h2>
          </div>
          <Card>
            {inventory.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-neutral-500">No inventory recorded for this clinic</CardContent>
            ) : (
              <div className="divide-y divide-neutral-100">
                {inventory.map((item) => (
                  <div key={item.inventory_id} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-medium text-neutral-900">{productName(item.product_id)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-700">{item.quantity}</span>
                      {item.quantity < LOW_STOCK_THRESHOLD && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Low stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Payments overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
            <Receipt className="h-4 w-4" />Payments Overview
          </h2>
          <Link href="/clinic-admin/payments" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            Waive a Payment <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xl font-bold text-green-600">₹{totalCollected.toFixed(2)}</p>
                <p className="text-xs text-neutral-500">Collected (paid + waived)</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">₹{pendingAmount.toFixed(2)}</p>
                <p className="text-xs text-neutral-500">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold text-neutral-900">{payments.length}</p>
                <p className="text-xs text-neutral-500">Total payments</p>
              </div>
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">No payments recorded for this clinic yet</p>
            ) : (
              <>
                <div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-neutral-100">
                    {paymentStatusCounts.map((s) => (
                      <div
                        key={s.status}
                        className={PAYMENT_STATUS_COLORS[s.status].bar}
                        style={{ flexBasis: `${(s.count / payments.length) * 100}%` }}
                        title={`${s.status}: ${s.count}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {paymentStatusCounts.map((s) => (
                      <span key={s.status} className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PAYMENT_STATUS_COLORS[s.status].badge}`}>
                        {s.status} ({s.count})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
                  {recentPayments.map((p) => (
                    <div key={p.payment_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-neutral-700">{p.currency} {p.amount}{p.payment_method ? ` · ${p.payment_method}` : ""}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PAYMENT_STATUS_COLORS[p.status].badge}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latest orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4" />Latest Store Orders
          </h2>
          <Link href="/clinic-admin/store-orders" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <Card>
          {latestOrders.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-neutral-500">No store orders yet</CardContent>
          ) : (
            <div className="divide-y divide-neutral-100">
              {latestOrders.map((o) => (
                <div key={o.order_id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 capitalize">{o.order_type} order — {patientName(o.patient_id)}</p>
                    <p className="text-xs text-neutral-400">{new Date(o.created_at).toLocaleDateString()}{o.total_amount != null && <> · ₹{o.total_amount}</>}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ORDER_STATUS_STYLES[o.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {o.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
