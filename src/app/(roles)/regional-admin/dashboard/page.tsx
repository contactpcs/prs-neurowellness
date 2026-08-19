"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Users, UserCog, ClipboardCheck, ClipboardList, AlertTriangle, RefreshCw,
  CalendarDays, CheckCircle2, Stethoscope, Package, Receipt, ShoppingBag, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import { staffRequestsService } from "@/lib/api/services/staffRequests.service";
import type { StaffRequest } from "@/lib/api/services/staffRequests.service";
import { clinicRequestsService } from "@/lib/api/services/clinicRequests.service";
import type { ClinicRequest } from "@/lib/api/services/clinicRequests.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { paymentsService, type Payment } from "@/lib/api/services/payments.service";
import { inventoryService, type InventoryItem } from "@/lib/api/services/inventory.service";
import { storeService, type Product, type StoreOrder } from "@/lib/api/services/store.service";
import type { AdminClinic, AdminStaffMember, AdminPatient } from "@/types/admin.types";
import type { Appointment } from "@/types/domain.types";

const APPT_STATUS_STYLES: Record<string, string> = {
  planned: "bg-neutral-100 text-neutral-600",
  selected: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  checked_in: "bg-teal-100 text-teal-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-200 text-neutral-600",
  no_show: "bg-red-100 text-red-600",
  rescheduled: "bg-purple-100 text-purple-700",
};
const ORDER_STATUS_STYLES: Record<string, string> = {
  pending_doctor_approval: "bg-amber-100 text-amber-700",
  doctor_approved: "bg-blue-100 text-blue-700",
  pending_dispatch: "bg-amber-100 text-amber-700",
  dispatched_to_clinic: "bg-indigo-100 text-indigo-700",
  received_at_clinic: "bg-teal-100 text-teal-700",
  collected_by_patient: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-200 text-neutral-600",
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
interface ClinicPayment extends Payment { clinic_id: string }
interface ClinicInventoryItem extends InventoryItem { clinic_id: string }

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-4 space-y-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
      </div>
    </div>
  );
}

function timeLabel(t: string | null | undefined) {
  if (!t) return "No time booked yet";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function RegionalAdminDashboardPage() {
  const { user } = useAuth();
  const [allClinics, setAllClinics] = useState<AdminClinic[]>([]);
  const [allStaff, setAllStaff] = useState<AdminStaffMember[]>([]);
  const [allPatients, setAllPatients] = useState<AdminPatient[]>([]);
  const [allStaffRequests, setAllStaffRequests] = useState<StaffRequest[]>([]);
  const [allClinicRequests, setAllClinicRequests] = useState<ClinicRequest[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [allPayments, setAllPayments] = useState<ClinicPayment[]>([]);
  const [allInventory, setAllInventory] = useState<ClinicInventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<StoreOrder[]>([]);
  const [doctorSchedules, setDoctorSchedules] = useState<Record<string, DoctorSchedule[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  async function load() {
    if (!user?.region_id) return;
    setError(null);
    try {
      const clinicList = await adminService.getClinics({ region_id: user.region_id });
      setAllClinics(clinicList);

      const [staffResults, patientResults, staffRequests, clinicRequests, appointmentResults, paymentResults, inventoryResults, orderResults, productsRes] = await Promise.all([
        Promise.all(clinicList.map((c) => adminService.getStaff({ clinic_id: c.clinic_id }))),
        Promise.all(clinicList.map((c) => adminService.getPatients({ clinic_id: c.clinic_id }))),
        staffRequestsService.list({ status: "pending" }),
        clinicRequestsService.list({ region_id: user.region_id, status: "pending" }),
        Promise.all(clinicList.map((c) => appointmentsService.list({ clinic_id: c.clinic_id }))),
        Promise.all(clinicList.map((c) => paymentsService.list({ clinic_id: c.clinic_id }))),
        Promise.all(clinicList.map((c) => inventoryService.list({ clinic_id: c.clinic_id }))),
        Promise.all(clinicList.map((c) => storeService.listOrders({ clinic_id: c.clinic_id }))),
        storeService.listProducts(),
      ]);

      const staffList = staffResults.flatMap((r) => r.staff);
      setAllStaff(staffList);
      setAllPatients(patientResults.flatMap((r) => r.patients));
      setAllStaffRequests(staffRequests);
      setAllClinicRequests(clinicRequests);
      setAllAppointments(appointmentResults.flatMap((r) => r.appointments));
      setAllPayments(paymentResults.flatMap((res, i) => res.map((p) => ({ ...p, clinic_id: clinicList[i].clinic_id }))));
      setAllInventory(inventoryResults.flatMap((res, i) => res.map((item) => ({ ...item, clinic_id: clinicList[i].clinic_id }))));
      setAllOrders(orderResults.flat());
      setProducts(productsRes);

      const doctors = staffList.filter((s) => s.role === "doctor");
      const scheduleResults = await Promise.all(doctors.map((d) => doctorsService.listWeeklySchedules(d.id)));
      const scheduleMap: Record<string, DoctorSchedule[]> = {};
      doctors.forEach((d, i) => { scheduleMap[d.id] = scheduleResults[i]; });
      setDoctorSchedules(scheduleMap);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load dashboard");
    }
  }

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [user?.region_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (isLoading) return <DashboardSkeleton />;

  // ── Scope every section to the selected clinic, or the whole region when
  // none is selected — all source data is already tagged with clinic_id
  // from the fan-out fetch above, so this is a pure client-side filter,
  // no re-fetch needed on selector change.
  const clinics = selectedClinicId ? allClinics.filter((c) => c.clinic_id === selectedClinicId) : allClinics;
  const staff = selectedClinicId ? allStaff.filter((s) => s.clinic_id === selectedClinicId) : allStaff;
  const patients = selectedClinicId ? allPatients.filter((p) => p.clinic_id === selectedClinicId) : allPatients;
  const staffRequestsScoped = selectedClinicId ? allStaffRequests.filter((r) => r.clinic_id === selectedClinicId) : allStaffRequests;
  const clinicRequestsScoped = selectedClinicId ? allClinicRequests.filter((r) => r.clinic_id === selectedClinicId) : allClinicRequests;
  const appointments = selectedClinicId ? allAppointments.filter((a) => a.clinic_id === selectedClinicId) : allAppointments;
  const payments = selectedClinicId ? allPayments.filter((p) => p.clinic_id === selectedClinicId) : allPayments;
  const inventory = selectedClinicId ? allInventory.filter((i) => i.clinic_id === selectedClinicId) : allInventory;
  const orders = selectedClinicId ? allOrders.filter((o) => o.clinic_id === selectedClinicId) : allOrders;

  const clinicsMissingAdmin = clinics.filter((c) => !c.clinic_admin_id).length;
  const clinicName = (id: string) => allClinics.find((c) => c.clinic_id === id)?.clinic_name ?? id;
  const patientName = (id: string) => { const p = allPatients.find((x) => x.id === id); return p ? `${p.first_name} ${p.last_name}` : id; };
  const staffName = (id: string) => { const s = allStaff.find((x) => x.id === id); return s ? `${s.first_name} ${s.last_name}` : id; };
  const productName = (id: string) => products.find((p) => p.product_id === id)?.name ?? id;
  const doctors = staff.filter((s) => s.role === "doctor");

  const stats = [
    { label: "Clinics",                href: "/regional-admin/clinics",         value: clinics.length,                icon: Building2,      color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Staff Members",          href: "/regional-admin/staff",           value: staff.length,                  icon: UserCog,        color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Patients",               href: "/regional-admin/patients",        value: patients.length,               icon: Users,          color: "text-green-600",  bg: "bg-green-50" },
    { label: "Staff Approvals",        href: "/regional-admin/staff-approvals", value: staffRequestsScoped.length,    icon: ClipboardCheck, color: "text-amber-600",  bg: "bg-amber-50",  sublabel: "pending" },
    { label: "Clinic Requests",        href: "/regional-admin/clinics",         value: clinicRequestsScoped.length,   icon: ClipboardList,  color: "text-purple-600", bg: "bg-purple-50", sublabel: "pending" },
    { label: "Clinics Missing Admin",  href: "/regional-admin/clinics",         value: clinicsMissingAdmin,           icon: AlertTriangle,  color: "text-red-600",    bg: "bg-red-50" },
  ];

  // ── Appointments ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysAppointments = appointments.filter((a) => a.appointment_date === todayStr).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const upcomingAppointments = appointments.filter((a) => a.appointment_date > todayStr)
    .sort((a, b) => (a.appointment_date ?? "").localeCompare(b.appointment_date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? "")).slice(0, 5);
  const recentCheckins = appointments.filter((a) => a.appointment_date === todayStr && a.status === "checked_in")
    .sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""));

  const todayDow = new Date().getDay();

  // ── Payments ──
  const totalCollected = payments.filter((p) => p.status === "paid" || p.status === "waived").reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0);
  const paymentStatusCounts = (["pending", "paid", "waived", "failed", "refunded"] as const).map((status) => ({
    status, count: payments.filter((p) => p.status === status).length,
  })).filter((s) => s.count > 0);
  const recentPayments = [...payments].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 5);

  // ── Inventory (flagged low-stock) ──
  const lowStockItems = inventory.filter((i) => i.quantity < LOW_STOCK_THRESHOLD);

  // ── Latest orders ──
  const latestOrders = [...orders].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome, {user?.first_name}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {selectedClinicId ? `Viewing ${clinicName(selectedClinicId)}` : "Your region at a glance"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClinicId ?? "all"}
            onChange={(e) => setSelectedClinicId(e.target.value === "all" ? null : e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Region (combined)</option>
            {allClinics.map((c) => <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}</option>)}
          </select>
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="py-4 px-4">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
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
            <Link href="/regional-admin/appointments" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
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
                      <p className="text-xs text-neutral-400">Today {timeLabel(a.start_time)} · Dr. {staffName(a.doctor_id)}{!selectedClinicId && <> · {clinicName(a.clinic_id)}</>}</p>
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
                      <p className="text-xs text-neutral-400">{a.appointment_date} {timeLabel(a.start_time)} · Dr. {staffName(a.doctor_id)}{!selectedClinicId && <> · {clinicName(a.clinic_id)}</>}</p>
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
                      <p className="text-xs text-neutral-400">{timeLabel(a.start_time)} · Dr. {staffName(a.doctor_id)}{!selectedClinicId && <> · {clinicName(a.clinic_id)}</>}</p>
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
              <CardContent className="py-10 text-center text-sm text-neutral-500">{selectedClinicId ? "No doctors at this clinic" : "No doctors in your region"}</CardContent>
            ) : (
              <div className="divide-y divide-neutral-100">
                {doctors.map((d) => {
                  const todaysSlot = (doctorSchedules[d.id] ?? []).find((sch) => sch.day_of_week === todayDow);
                  return (
                    <div key={d.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Dr. {d.first_name} {d.last_name}</p>
                        {!selectedClinicId && <p className="text-xs text-neutral-400">{d.clinic_id ? clinicName(d.clinic_id) : "—"}</p>}
                      </div>
                      {todaysSlot ? (
                        <span className="text-xs font-medium text-neutral-700">{timeLabel(todaysSlot.start_time)} – {timeLabel(todaysSlot.end_time)}</span>
                      ) : (
                        <span className="text-xs text-neutral-400">No hours today</span>
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
              <Package className="h-4 w-4" />{selectedClinicId ? "Low Stock" : "Low Stock Across Region"}
            </h2>
          </div>
          <Card>
            {lowStockItems.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-neutral-500">{inventory.length === 0 ? "No inventory recorded yet" : "No low-stock items"}</CardContent>
            ) : (
              <div className="divide-y divide-neutral-100">
                {lowStockItems.map((item) => (
                  <div key={item.inventory_id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{productName(item.product_id)}</p>
                      {!selectedClinicId && <p className="text-xs text-neutral-400">{clinicName(item.clinic_id)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-700">{item.quantity}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Low stock</span>
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
              <p className="text-sm text-neutral-500 text-center py-4">{selectedClinicId ? "No payments recorded for this clinic yet" : "No payments recorded across your region yet"}</p>
            ) : (
              <>
                <div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-neutral-100">
                    {paymentStatusCounts.map((s) => (
                      <div key={s.status} className={PAYMENT_STATUS_COLORS[s.status].bar} style={{ flexBasis: `${(s.count / payments.length) * 100}%` }} title={`${s.status}: ${s.count}`} />
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
                      <span className="text-neutral-700">{p.currency} {p.amount}{p.payment_method ? ` · ${p.payment_method}` : ""}{!selectedClinicId && <> · {clinicName(p.clinic_id)}</>}</span>
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
                    <p className="text-xs text-neutral-400">{new Date(o.created_at).toLocaleDateString()}{!selectedClinicId && <> · {clinicName(o.clinic_id)}</>}{o.total_amount != null && <> · ₹{o.total_amount}</>}</p>
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
