"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Check, ChevronRight, ChevronDown, ChevronUp, Loader2, Plus, X, AlertTriangle, ShieldCheck,
  Cpu, ClipboardCheck, MapPin, BarChart2, ClipboardList, Calendar,
} from "lucide-react";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { clinicDevicesService } from "@/lib/api/services/clinicDevices.service";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Input, Select, Button, PageLoader } from "@/components/ui";
import { PlacementMap } from "./PlacementMap";
import { PatientClinicalSnapshot } from "@/components/doctor/PatientClinicalSnapshot";
import type {
  DeviceRead, ConditionRead, DiagnosisRead, DiagnosisResolution, PlacementRead, DosingRead, ScaleRead,
  SchedulePreview, ProtocolCreate, ProtocolScaleAssignment, ProtocolRead, CustomMontageCreate,
  DeviceScheduleRead, DeviceOverrideRead, DeviceSlotRead,
} from "@/types/treatmentProtocol.types";

const STEP_LABELS = ["Device", "Condition", "Diagnosis", "Placement", "Dosing", "Scales", "Schedule", "Review"];
const REASON_OPTIONS = ["Patient discomfort", "Patient tolerance", "Clinical reassessment", "Treatment response", "Other"];
const CADENCE_OPTIONS = ["After every session", "Weekly", "Every 2 weeks", "At re-assessment only", "Baseline & end only", "Monthly"];
const FREQ_OPTIONS = [1, 2, 3, 5, 7];

interface AssignedScale extends ProtocolScaleAssignment {
  displayName: string;
}

interface WizardState {
  deviceId: string | null;
  conditionIds: string[];
  diagnosisIds: string[];
  placementId: string | null;
  anodeSite: string | null;
  cathodeSites: string[];
  /** "custom" once a freeform combination with no catalogue match has been
   *  saved as a custom montage (customMontageId set) — see Step 4. Dosing
   *  (Step 5) becomes manual-only in this mode: no dosingId, current/
   *  duration/ramp are the sole prescription (54). */
  montageMode: "catalogue" | "custom";
  customMontageId: string | null;
  dosingId: string | null;
  currentMa: string;
  sessionDurationMin: string;
  rampSeconds: string;
  sessionCount: string;
  sessionsPerWeek: number;
  followUpEveryN: string;
  startDate: string;
  skipDates: string[];
  extraDates: string[];
  scales: AssignedScale[];
  protocolNote: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function emptyState(): WizardState {
  return {
    deviceId: null, conditionIds: [], diagnosisIds: [],
    placementId: null, anodeSite: null, cathodeSites: [],
    montageMode: "catalogue", customMontageId: null,
    dosingId: null, currentMa: "", sessionDurationMin: "", rampSeconds: "30",
    sessionCount: "20", sessionsPerWeek: 5, followUpEveryN: "",
    startDate: todayIso(), skipDates: [], extraDates: [],
    scales: [], protocolNote: "",
  };
}

const PUSH_ERROR_MESSAGES: Record<string, string> = {
  DEVICE_NOT_AVAILABLE_AT_CLINIC: "That device isn't in this clinic's inventory anymore — go back to Step 1 and re-pick a device.",
  PROTOCOL_NOT_ACTIVE: "The protocol being modified is no longer active — refresh and try again.",
  PROTOCOL_NOT_CANCELLABLE: "The prior protocol version couldn't be cancelled — it may have already been superseded.",
  DEVICE_NOT_FOUND: "That device no longer exists — go back to Step 1 and re-pick a device.",
};

function describePushError(e: any): string {
  const code = e?.response?.data?.error?.code;
  if (code && PUSH_ERROR_MESSAGES[code]) return PUSH_ERROR_MESSAGES[code];
  return e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to push the protocol. Please try again.";
}

export default function TreatmentProtocolWizardPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const mode = searchParams.get("mode") === "modify" ? "modify" : "new";
  const priorProtocolId = searchParams.get("protocolId");

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(emptyState());
  const [reasonGateOpen, setReasonGateOpen] = useState(mode === "modify");
  const [reasonLabel, setReasonLabel] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(mode === "modify");
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setState((s) => ({ ...s, [k]: v }));

  // ─── Catalogue caches ───
  const [devices, setDevices] = useState<DeviceRead[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [conditions, setConditions] = useState<ConditionRead[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRead[]>([]);
  const [dxQuery, setDxQuery] = useState("");
  const [resolution, setResolution] = useState<DiagnosisResolution | null>(null);
  const [placements, setPlacements] = useState<PlacementRead[]>([]);
  const [dosingRows, setDosingRows] = useState<DosingRead[]>([]);
  const [scaleCatalogue, setScaleCatalogue] = useState<ScaleRead[]>([]);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [clinicDeviceId, setClinicDeviceId] = useState<string | null>(null);
  const [deviceSchedules, setDeviceSchedules] = useState<DeviceScheduleRead[]>([]);
  const [deviceOverrides, setDeviceOverrides] = useState<DeviceOverrideRead[]>([]);
  const [deviceSlots, setDeviceSlots] = useState<DeviceSlotRead[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[]; maxCathodes: number } | null>(null);

  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState<ProtocolRead | null>(null);

  const selectedDevice = devices.find((d) => d.device_id === state.deviceId) || null;
  const primaryConditionId = resolution?.driving_condition_id || state.conditionIds[0] || undefined;
  const selectedDosing = dosingRows.find((d) => d.dosing_id === state.dosingId) || null;
  const isHD = selectedDevice?.modality === "HD-tDCS";

  // ─── Prefill from an existing active protocol when modifying ───
  useEffect(() => {
    if (mode !== "modify" || !priorProtocolId) return;
    treatmentProtocolService.getProtocolDetail(priorProtocolId).then((detail) => {
      setState((s) => ({
        ...s,
        deviceId: detail.device_id,
        placementId: detail.placement_id || null,
        anodeSite: detail.placement?.anode_site || null,
        cathodeSites: detail.placement?.cathode_site ? [detail.placement.cathode_site] : (detail.placement?.return_sites || []),
        dosingId: detail.dosing_id || null,
        // Read the prescription from its typed columns, falling back to
        // device_settings only for protocols written before the dose moved out
        // of that jsonb bag. Without the fallback, amending an older protocol
        // silently starts with empty dose fields.
        currentMa: String(detail.prescribed_current_ma ?? (detail.device_settings as any)?.current_ma ?? ""),
        sessionDurationMin: String(detail.prescribed_duration_min ?? (detail.device_settings as any)?.duration_min ?? ""),
        rampSeconds: String(detail.ramp_seconds ?? (detail.device_settings as any)?.ramp_seconds ?? "30"),
        sessionCount: String(detail.session_count),
        sessionsPerWeek: detail.sessions_per_week ?? s.sessionsPerWeek,
        followUpEveryN: detail.follow_up_every_n ? String(detail.follow_up_every_n) : "",
      }));
    }).catch(() => setErr("Couldn't load the current protocol to modify.")).finally(() => setPrefillLoading(false));
  }, [mode, priorProtocolId]);

  // ─── Step 1: Device ─── clinicId is required — otherwise the picker
  // offers devices this clinic doesn't own, and the DB trigger rejects
  // the protocol at Step 8 after the doctor has filled in everything else.
  useEffect(() => {
    if (!user?.clinic_id) return;
    setDevicesLoading(true);
    treatmentProtocolService.listDevices({ clinicId: user.clinic_id })
      .then(setDevices).catch(() => setDevices([])).finally(() => setDevicesLoading(false));
  }, [user?.clinic_id]);

  // ─── Step 2: Condition ───
  useEffect(() => {
    if (!state.deviceId) return;
    treatmentProtocolService.listConditions(state.deviceId).then(setConditions).catch(() => {});
  }, [state.deviceId]);

  // ─── Step 3: Diagnosis ───
  useEffect(() => {
    if (!state.deviceId || state.conditionIds.length === 0) { setDiagnoses([]); return; }
    const t = setTimeout(() => {
      treatmentProtocolService.listDiagnoses({ conditionIds: state.conditionIds, deviceId: state.deviceId!, q: dxQuery || undefined })
        .then(setDiagnoses).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.deviceId, state.conditionIds, dxQuery]);

  useEffect(() => {
    if (!state.deviceId || state.diagnosisIds.length === 0) { setResolution(null); return; }
    treatmentProtocolService.resolveDiagnoses(state.deviceId, state.diagnosisIds).then((r) => {
      setResolution(r);
      // Auto-apply the driving suggestion the first time a placement/dosing hasn't been chosen yet.
      setState((s) => (s.placementId ? s : { ...s, placementId: r.placement_id || s.placementId, dosingId: r.dosing_id || s.dosingId }));
    }).catch(() => setResolution(null));
  }, [state.deviceId, state.diagnosisIds]);

  // ─── Step 4: Placement ───
  useEffect(() => {
    if (!state.deviceId) return;
    treatmentProtocolService.listPlacements(state.deviceId, primaryConditionId).then(setPlacements).catch(() => {});
  }, [state.deviceId, primaryConditionId]);

  // ─── Step 5: Dosing ───
  useEffect(() => {
    if (!state.deviceId) return;
    treatmentProtocolService.listDosing(state.deviceId, primaryConditionId, state.placementId || undefined).then((rows) => {
      setDosingRows(rows);
      if (rows.length === 1) setState((s) => ({ ...s, dosingId: rows[0].dosing_id }));
    }).catch(() => {});
  }, [state.deviceId, primaryConditionId, state.placementId]);

  useEffect(() => {
    if (selectedDosing) {
      setState((s) => ({
        ...s,
        currentMa: s.currentMa || String(selectedDosing.current_ma_min ?? selectedDosing.total_current_ma ?? ""),
        sessionDurationMin: s.sessionDurationMin || String(selectedDosing.session_duration_min ?? ""),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dosingId]);

  // ─── Step 6: Scales ───
  useEffect(() => {
    if (state.conditionIds.length === 0) return;
    treatmentProtocolService.listScales(state.conditionIds).then(setScaleCatalogue).catch(() => {});
  }, [state.conditionIds]);

  // ─── Step 7: Schedule preview ───
  useEffect(() => {
    if (step !== 6 || !state.startDate || !state.sessionCount) return;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      treatmentProtocolService.previewSchedule({
        start_date: state.startDate,
        session_count: Math.max(1, Math.min(90, parseInt(state.sessionCount) || 20)),
        sessions_per_week: state.sessionsPerWeek,
        follow_up_every_n: state.followUpEveryN ? parseInt(state.followUpEveryN) : undefined,
        skip_dates: state.skipDates,
        extra_dates: state.extraDates,
      }).then(setPreview).catch(() => setPreview(null)).finally(() => setPreviewLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [step, state.startDate, state.sessionCount, state.sessionsPerWeek, state.followUpEveryN, state.skipDates, state.extraDates]);

  // ─── Step 7: Availability panel (device schedule + overrides + slot capacity) ───
  // Every pool below belongs to the ONE device this protocol prescribes
  // (state.deviceId), not the whole clinic — resolve its clinic_device_id
  // (the clinic's inventory row for that device) once, then scope every call
  // to it. A clinic with several devices of different modalities has an
  // independent pool per device; this panel only ever shows this protocol's.
  useEffect(() => {
    if (step !== 6 || !user?.clinic_id || !state.deviceId) { setClinicDeviceId(null); return; }
    clinicDevicesService.list(user.clinic_id, true)
      .then((rows) => setClinicDeviceId(rows.find((r) => r.device_id === state.deviceId)?.clinic_device_id ?? null))
      .catch(() => setClinicDeviceId(null));
  }, [step, user?.clinic_id, state.deviceId]);

  useEffect(() => {
    if (step !== 6 || !user?.clinic_id || !clinicDeviceId) return;
    treatmentProtocolService.listDeviceSchedule(user.clinic_id, clinicDeviceId).then(setDeviceSchedules).catch(() => setDeviceSchedules([]));
  }, [step, user?.clinic_id, clinicDeviceId]);

  useEffect(() => {
    if (step !== 6 || !user?.clinic_id || !clinicDeviceId || !state.startDate) return;
    treatmentProtocolService.listDeviceOverrides(user.clinic_id, clinicDeviceId, state.startDate).then(setDeviceOverrides).catch(() => setDeviceOverrides([]));
    const toDate = new Date(state.startDate + "T00:00:00Z");
    toDate.setUTCDate(toDate.getUTCDate() + 7);
    treatmentProtocolService.listDeviceAvailability(user.clinic_id, clinicDeviceId, state.startDate, toDate.toISOString().slice(0, 10))
      .then(setDeviceSlots).catch(() => setDeviceSlots([]));
  }, [step, user?.clinic_id, clinicDeviceId, state.startDate]);

  // ─── Placement node clicks ───
  const maxCathodes = validation?.maxCathodes ?? (isHD ? 4 : 1);
  const handleNodeClick = async (nodeId: string) => {
    let anodeSite = state.anodeSite;
    let cathodeSites = state.cathodeSites;
    if (anodeSite === nodeId) { anodeSite = null; }
    else if (cathodeSites.includes(nodeId)) { cathodeSites = cathodeSites.filter((c) => c !== nodeId); }
    else if (!anodeSite) { anodeSite = nodeId; }
    else if (cathodeSites.length < maxCathodes) { cathodeSites = [...cathodeSites, nodeId]; }
    else { return; }

    const matched = placements.find((p) => p.anode_site === anodeSite
      && (p.cathode_site ? [p.cathode_site].join(",") === cathodeSites.join(",") : (p.return_sites || []).slice().sort().join(",") === cathodeSites.slice().sort().join(",")));

    // Redrawing the map always returns to catalogue mode — a previously
    // saved custom montage is a snapshot of one specific combination, and
    // this new combination (matched or not) supersedes it until the doctor
    // explicitly saves a new one via the "Save as Custom Montage" panel.
    setState((s) => ({ ...s, anodeSite, cathodeSites, placementId: matched ? matched.placement_id : null, montageMode: "catalogue", customMontageId: null }));

    if (state.deviceId && anodeSite) {
      try {
        const v = await treatmentProtocolService.validatePlacement({ device_id: state.deviceId, anode_site: anodeSite, cathode_sites: cathodeSites });
        setValidation({ valid: v.valid, errors: v.errors, warnings: v.warnings, maxCathodes: v.max_cathodes });
      } catch { setValidation(null); }
    } else {
      setValidation(null);
    }
  };

  const applyPlacement = (p: PlacementRead) => {
    setState((s) => ({
      ...s, placementId: p.placement_id, anodeSite: p.anode_site || null,
      cathodeSites: p.cathode_site ? [p.cathode_site] : (p.return_sites || []),
      montageMode: "catalogue", customMontageId: null,
    }));
    setValidation(null);
  };

  // ─── Custom montage — save the freeform combination the doctor drew ───
  const [savingMontage, setSavingMontage] = useState(false);
  const [montageErr, setMontageErr] = useState<string | null>(null);
  const saveCustomMontage = async (montageName: string, clinicalReasoning: string, description: string) => {
    if (!state.deviceId || !state.anodeSite || state.cathodeSites.length === 0) return;
    setMontageErr(null);
    setSavingMontage(true);
    try {
      const body: CustomMontageCreate = {
        device_id: state.deviceId,
        montage_name: montageName,
        anode_sites: [state.anodeSite],
        cathode_sites: state.cathodeSites,
        condition_id: primaryConditionId || undefined,
        description: description || undefined,
        clinical_reasoning: clinicalReasoning,
      };
      const created = await treatmentProtocolService.createCustomMontage(body);
      setState((s) => ({ ...s, placementId: null, customMontageId: created.custom_montage_id, montageMode: "custom" }));
    } catch (e: any) {
      setMontageErr(e?.response?.data?.detail?.message || e?.response?.data?.message || "Couldn't save this montage — try a different name.");
    } finally {
      setSavingMontage(false);
    }
  };

  // ─── Nav guards ───
  const canContinue: Record<number, boolean> = {
    0: !!state.deviceId,
    1: state.conditionIds.length > 0,
    2: state.diagnosisIds.length > 0,
    3: !!state.placementId || !!state.customMontageId,
    4: state.montageMode === "custom"
      ? !!state.currentMa && !!state.sessionDurationMin && !!state.sessionCount
      : !!state.dosingId && !!state.sessionCount,
    5: true,
    6: !!preview,
    7: false,
  };

  const goNext = () => setStep((s) => Math.min(7, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // ─── Push ───
  const handlePush = async () => {
    if (!user?.doctor_id || !user?.clinic_id) { setErr("Your account has no doctor/clinic assignment — cannot create a protocol."); return; }
    if (!state.deviceId || (!state.placementId && !state.customMontageId)) return;
    if (state.montageMode === "catalogue" && !state.dosingId) return;
    setErr(null);
    setPushing(true);
    try {
      const finalNotes = mode === "modify"
        ? `Reason: ${reasonLabel || "Other"} — ${reasonNote}${state.protocolNote ? ` | ${state.protocolNote}` : ""}`
        : (state.protocolNote || null);

      // A protocol belongs to a protocol INSTANCE — one course of device
      // treatment — not to a treatment cycle. The cycle is the episode of
      // care and allows one active per patient, so opening a cycle per
      // protocol always failed with "Patient already has an active treatment
      // cycle". This reuses the patient's cycle and opens (or reuses) an
      // instance on it.
      const instanceId = await treatmentProtocolService.resolveOrCreateInstanceId({
        patientId, doctorId: user.doctor_id, clinicId: user.clinic_id,
      });

      // Step 5's numbers are the PRESCRIPTION, not a deviation from it, so they
      // go in the typed, range-checked columns. They used to be written only
      // into device_settings — an untyped jsonb bag — which left
      // prescribed_current_ma and prescribed_duration_min NULL and made every
      // activation fail: fn_check_protocol_prescription_complete refuses to
      // make a protocol live without a current, a duration and a cadence,
      // because a clinical assistant reads those off the screen and sets them
      // on the machine.
      //
      // device_settings keeps its original meaning: per-patient DEVIATIONS
      // from the catalogue dose, which is genuinely open-ended.
      const currentMa = state.currentMa ? parseFloat(state.currentMa) : null;
      const durationMin = state.sessionDurationMin ? parseInt(state.sessionDurationMin) : null;
      const rampSeconds = state.rampSeconds ? parseInt(state.rampSeconds) : 30;

      const payload: ProtocolCreate = {
        instance_id: instanceId,
        device_id: state.deviceId,
        // Exactly one of placement_id (catalogue) or custom_montage_id
        // (doctor-authored, 38/54). dosing_id only accompanies the
        // catalogue path — a custom montage has no catalogued dose to
        // point at, so the manual prescribed_* columns below are its sole
        // dose source.
        ...(state.montageMode === "custom"
          ? { custom_montage_id: state.customMontageId }
          : { placement_id: state.placementId, dosing_id: state.dosingId }),
        session_count: Math.max(1, Math.min(90, parseInt(state.sessionCount) || 20)),
        follow_up_every_n: state.followUpEveryN ? parseInt(state.followUpEveryN) : undefined,
        start_date: state.startDate,
        sessions_per_week: state.sessionsPerWeek,
        skip_dates: state.skipDates,
        extra_dates: state.extraDates,
        // Step 2. Recorded so "what was this patient treated for" is
        // answerable later; previously selected, used to rank suggestions,
        // and then discarded.
        conditions: state.conditionIds.map((condition_id) => ({ condition_id })),
        diagnosis_ids: state.diagnosisIds,
        // Only catalogued scales can be prescribed: protocol_scales.scale_id is
        // NOT NULL with an FK into reference.neuromod_scales, because a scale
        // the catalogue does not know cannot be released to the patient as a
        // PRS task. A free-typed name is dropped here rather than silently
        // accepted and stored nowhere — see the warning shown on step 6.
        scales: state.scales
          .filter((s): s is typeof s & { scale_id: string } => Boolean(s.scale_id))
          .map(({ scale_id, cadence }) => ({ scale_id, cadence })),
        prescribed_current_ma: currentMa,
        prescribed_duration_min: durationMin,
        ramp_seconds: rampSeconds,
        device_settings: {},
        notes: finalNotes,
        // Amending rather than replacing: the server inherits priorProtocolId's
        // version_major, bumps version_minor, and — in the same request —
        // cancels its planned sessions and flips it to 'superseded'. Replaces
        // the old create+activate+cancel three-call dance below, which is no
        // longer valid once the server marks the prior row 'superseded'
        // (cancelProtocol only accepts draft/active).
        ...(mode === "modify" && priorProtocolId ? { supersedes_protocol_id: priorProtocolId } : {}),
      };

      const created = await treatmentProtocolService.createProtocol(payload);
      await treatmentProtocolService.activateProtocol(created.protocol_id);
      setPushed(created);
    } catch (e: any) {
      setErr(describePushError(e));
    } finally {
      setPushing(false);
    }
  };

  if (prefillLoading) return <PageLoader />;

  if (reasonGateOpen) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Modify Treatment Protocol</h1>
          <p className="text-sm text-neutral-500 mt-1">This creates protocol v-next. Sessions already performed keep the current version exactly as delivered.</p>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-2">Reason for Modification <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {REASON_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReasonLabel(r)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${reasonLabel === r ? "border-blue-500 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Clinical Note <span className="text-red-500">*</span></label>
              <textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Clinical rationale for the change…"
                rows={4}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            {reasonError && <p className="text-sm text-red-600">{reasonError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!reasonLabel || !reasonNote.trim()) { setReasonError("Both a reason and a clinical note are required."); return; }
                  setReasonError(null);
                  setReasonGateOpen(false);
                }}
              >
                Continue to Protocol
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pushed) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 mx-auto flex items-center justify-center">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Treatment Protocol Pushed</h2>
            <p className="text-sm text-neutral-500">Protocol is now active and visible to the care team.</p>
            <div className="grid grid-cols-2 gap-3 text-left mt-4">
              {[
                ["Status", pushed.status],
                ["Sessions", String(pushed.session_count)],
                ["Scales queued", String(state.scales.length)],
                ["Device", pushed.device_name || pushed.modality || "—"],
              ].map(([k, v]) => (
                <div key={k} className="border border-neutral-100 rounded-lg bg-neutral-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">{k}</p>
                  <p className="text-sm font-bold text-neutral-900 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <Button className="mt-2" onClick={() => router.push(`/doctor/patients/${patientId}/treatment-protocol`)}>
              View Treatment Protocol
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{mode === "modify" ? "Modify Treatment Protocol" : "New Treatment Protocol"}</h1>
        <p className="text-xs text-neutral-400 mt-0.5">Step {step + 1} of 8 · {STEP_LABELS[step]}</p>
      </div>

      <PatientClinicalSnapshot patientId={patientId} />

      {/* Stepper */}
      <div className="flex items-stretch overflow-hidden rounded-xl border border-neutral-200 bg-white overflow-x-auto">
        {STEP_LABELS.map((label, i) => {
          const active = i === step, done = i < step;
          return (
            <button
              key={label}
              onClick={() => i < step && setStep(i)}
              className="flex-1 min-w-[110px] flex items-center gap-2 px-3 py-3 text-left"
              style={{ background: active ? "#eff6ff" : "#fff", boxShadow: active ? "inset 0 -2px 0 #2563eb" : "none", borderRight: i < 7 ? "1px solid #f1f1f1" : "none" }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: done ? "#2563eb" : active ? "#fff" : "#f5f5f5", border: `1px solid ${done || active ? "#2563eb" : "#e5e5e5"}`, color: done ? "#fff" : active ? "#1d4ed8" : "#a3a3a3" }}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap ${active ? "text-blue-900" : done ? "text-neutral-800" : "text-neutral-400"}`}>{label}</span>
            </button>
          );
        })}
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent>
              {step === 0 && (
                <DeviceStep devices={devices} loading={devicesLoading} selected={state.deviceId} onSelect={(id) => set("deviceId", id)} />
              )}
              {step === 1 && (
                <ConditionStep conditions={conditions} selected={state.conditionIds} onToggle={(id) => {
                  const has = state.conditionIds.includes(id);
                  set("conditionIds", has ? state.conditionIds.filter((c) => c !== id) : [...state.conditionIds, id]);
                }} />
              )}
              {step === 2 && (
                <DiagnosisStep
                  diagnoses={diagnoses} selected={state.diagnosisIds} query={dxQuery} onQuery={setDxQuery}
                  resolution={resolution}
                  onToggle={(id) => {
                    const has = state.diagnosisIds.includes(id);
                    set("diagnosisIds", has ? state.diagnosisIds.filter((d) => d !== id) : [...state.diagnosisIds, id]);
                  }}
                />
              )}
              {step === 3 && (
                <PlacementStep
                  placements={placements} state={state} validation={validation}
                  onApply={applyPlacement}
                  onSaveCustomMontage={saveCustomMontage}
                  savingMontage={savingMontage}
                  montageErr={montageErr}
                />
              )}
              {step === 4 && (
                <DosingStep
                  dosingRows={dosingRows} state={state}
                  onSelectDosing={(id) => set("dosingId", id)}
                  onField={(k, v) => set(k, v)}
                  onReset={() => {
                    if (!selectedDosing) return;
                    setState((s) => ({
                      ...s,
                      currentMa: String(selectedDosing.current_ma_min ?? selectedDosing.total_current_ma ?? ""),
                      sessionDurationMin: String(selectedDosing.session_duration_min ?? ""),
                      rampSeconds: "30",
                    }));
                  }}
                />
              )}
              {step === 5 && (
                <ScalesStep
                  catalogue={scaleCatalogue} assigned={state.scales}
                  onAdd={(a) => set("scales", [...state.scales, a])}
                  onRemove={(i) => set("scales", state.scales.filter((_, j) => j !== i))}
                  onCadence={(i, cadence) => set("scales", state.scales.map((s, j) => (j === i ? { ...s, cadence } : s)))}
                />
              )}
              {step === 6 && (
                <ScheduleStep
                  state={state} preview={preview} loading={previewLoading}
                  deviceSchedules={deviceSchedules} deviceOverrides={deviceOverrides} deviceSlots={deviceSlots}
                  onStartDate={(v) => set("startDate", v)}
                  onDayClick={(k, isSession) => {
                    if (isSession) {
                      set("skipDates", state.skipDates.includes(k) ? state.skipDates.filter((d) => d !== k) : [...state.skipDates, k]);
                    } else {
                      set("extraDates", state.extraDates.includes(k) ? state.extraDates.filter((d) => d !== k) : [...state.extraDates, k]);
                    }
                  }}
                  onRegenerate={() => { set("skipDates", []); set("extraDates", []); }}
                  onFollowUpEveryN={(v) => set("followUpEveryN", v)}
                />
              )}
              {step === 7 && (
                <ReviewStep
                  state={state} device={selectedDevice} resolution={resolution} preview={preview}
                  conditions={conditions} diagnoses={diagnoses}
                  onNote={(v) => set("protocolNote", v)}
                  onGoToStep={setStep}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {step >= 3 && (
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">10-20 Placement</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step === 3 ? "bg-green-50 text-green-700 border border-green-100" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                    {step === 3 ? "Editable" : "View only"}
                  </span>
                </div>
                <PlacementMap
                  anodeSite={state.anodeSite} cathodeSites={state.cathodeSites}
                  suggestedAnode={resolution?.placement_id ? placements.find((p) => p.placement_id === resolution.placement_id)?.anode_site : undefined}
                  suggestedCathodes={resolution?.placement_id ? (placements.find((p) => p.placement_id === resolution.placement_id)?.return_sites || []) : undefined}
                  onNodeClick={handleNodeClick} interactive={step === 3}
                />
                <div className="mt-8 pt-3 border-t border-neutral-100 flex gap-3 text-xs">
                  <div className="flex-1">
                    <p className="text-neutral-400 uppercase tracking-wide">Anode</p>
                    <p className="font-bold text-neutral-900">{state.anodeSite || "—"}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-neutral-400 uppercase tracking-wide">Cathode</p>
                    <p className="font-bold text-neutral-900">{state.cathodeSites.join(", ") || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <LiveSummary
              device={selectedDevice} conditions={conditions} conditionIds={state.conditionIds}
              diagnosisCount={state.diagnosisIds.length} state={state} preview={preview}
            />
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-16 bg-white/95 backdrop-blur border-t border-neutral-200 px-4 sm:px-8 py-3 flex items-center gap-3 z-10">
        <Button variant="outline" disabled={step === 0} onClick={goBack}>Back</Button>
        <div className="flex-1" />
        {step < 7 ? (
          <Button disabled={!canContinue[step]} onClick={goNext}>
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button disabled={pushing} onClick={handlePush}>
            {pushing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {mode === "modify" ? "Push Updated Protocol" : "Push Treatment Protocol"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Live Summary — mirrors the mock's "Protocol so far" sidebar card, built
// entirely from real wizard state / API responses as the doctor progresses.
// ─────────────────────────────────────────────────────────────────────────
function LiveSummary({
  device, conditions, conditionIds, diagnosisCount, state, preview,
}: {
  device: DeviceRead | null; conditions: ConditionRead[]; conditionIds: string[]; diagnosisCount: number;
  state: WizardState; preview: SchedulePreview | null;
}) {
  const conditionNames = conditions.filter((c) => conditionIds.includes(c.condition_id)).map((c) => c.condition_name);
  const rows: [string, string][] = [
    ["Device", device ? `${device.device_name} (${device.modality})` : "—"],
    ["Condition", conditionNames.length ? conditionNames.join(", ") : "—"],
    ["Dx codes", diagnosisCount ? `${diagnosisCount} selected` : "—"],
    ["Montage", state.anodeSite ? `${state.anodeSite} → ${state.cathodeSites.join(", ") || "—"}` : "—"],
    ["Dose", state.currentMa || state.sessionDurationMin ? `${state.currentMa || "—"} mA · ${state.sessionDurationMin || "—"} min` : "—"],
    ["Frequency", `${state.sessionsPerWeek === 7 ? "Daily" : `${state.sessionsPerWeek}×/week`} × ${state.sessionCount || "—"} sessions`],
    ["Scales", state.scales.length ? state.scales.map((s) => s.displayName).join(", ") : "—"],
    ["Schedule", preview ? `${preview.session_count} booked · ${preview.follow_up_count} follow-ups` : "—"],
  ];
  return (
    <Card>
      <CardContent>
        <p className="text-sm font-semibold text-neutral-900 mb-2">Protocol so far</p>
        <div className="divide-y divide-neutral-100 -mx-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2.5 px-1 py-2 items-start">
              <span className="w-20 flex-shrink-0 text-[10px] uppercase tracking-wide text-neutral-400 font-bold pt-0.5">{k}</span>
              <span className="flex-1 text-xs text-neutral-700 leading-relaxed">{v}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 1 — Device
// ─────────────────────────────────────────────────────────────────────────
function DeviceStep({
  devices, loading, selected, onSelect,
}: {
  devices: DeviceRead[]; loading: boolean; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">1 · Neuromodulation Device</h2>
        <p className="text-sm text-neutral-500 mt-1">Select the device for this protocol, scoped to your clinic&apos;s inventory. Phase 2 devices are catalogued but not yet configurable.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {devices.map((d) => {
          const on = selected === d.device_id;
          const disabled = d.phase === 2;
          return (
            <button
              key={d.device_id}
              disabled={disabled}
              onClick={() => onSelect(d.device_id)}
              className={`text-left px-4 py-3.5 rounded-lg border-2 transition-colors ${disabled ? "opacity-50 cursor-not-allowed border-neutral-200" : on ? "border-blue-600 bg-blue-50" : "border-neutral-200 hover:border-neutral-300"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-4.5 h-4.5 rounded flex items-center justify-center border ${on ? "bg-blue-600 border-blue-600" : "border-neutral-300"}`}>
                  {on && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className="font-semibold text-neutral-900">{d.device_name}</span>
                <span className="flex-1" />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.phase === 1 ? "bg-green-50 text-green-700 border border-green-100" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                  Phase {d.phase}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">{d.company_name ? `${d.company_name} · ` : ""}{d.modality}{d.model_number ? ` · ${d.model_number}` : ""}</p>
              {d.clinic_quantity != null && (
                <p className="text-[11px] text-neutral-400 mt-1">{d.clinic_quantity} unit{d.clinic_quantity === 1 ? "" : "s"} at this clinic</p>
              )}
            </button>
          );
        })}
        {loading && <p className="text-sm text-neutral-400">Loading devices…</p>}
        {!loading && devices.length === 0 && (
          <p className="text-sm text-neutral-400 col-span-full">
            No devices configured for this clinic — contact your clinic admin.
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2 — Condition
// ─────────────────────────────────────────────────────────────────────────
function ConditionStep({ conditions, selected, onToggle }: { conditions: ConditionRead[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">2 · Condition</h2>
        <p className="text-sm text-neutral-500 mt-1">One or more. Drives which ICD-10 diagnosis codes are offered next.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {conditions.map((c) => {
          const on = selected.includes(c.condition_id);
          return (
            <button
              key={c.condition_id}
              onClick={() => onToggle(c.condition_id)}
              className={`text-left px-4 py-3.5 rounded-lg border-2 flex items-center gap-3 transition-colors ${on ? "border-blue-600 bg-blue-50" : "border-neutral-200 hover:border-neutral-300"}`}
            >
              <span className={`w-4.5 h-4.5 rounded flex items-center justify-center border flex-shrink-0 ${on ? "bg-blue-600 border-blue-600" : "border-neutral-300"}`}>
                {on && <Check className="h-3 w-3 text-white" />}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900 truncate">{c.condition_name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{c.diagnosis_count} codes{c.evidence_level ? ` · Evidence ${c.evidence_level}` : ""}</p>
              </div>
            </button>
          );
        })}
        {conditions.length === 0 && <p className="text-sm text-neutral-400">Select a device first.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3 — Diagnosis
// ─────────────────────────────────────────────────────────────────────────
function DiagnosisStep({
  diagnoses, selected, query, onQuery, onToggle, resolution,
}: {
  diagnoses: DiagnosisRead[]; selected: string[]; query: string; onQuery: (v: string) => void;
  onToggle: (id: string) => void; resolution: DiagnosisResolution | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900">3 · Diagnosis Codes (ICD-10)</h2>
          <p className="text-sm text-neutral-500 mt-1">{selected.length ? `${selected.length} selected` : "None selected"}</p>
        </div>
        <div className="w-64 flex-shrink-0">
          <Input placeholder="Search code or description" value={query} onChange={(e) => onQuery(e.target.value)} />
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
          {diagnoses.map((d) => {
            const on = selected.includes(d.diagnosis_id);
            return (
              <button
                key={d.diagnosis_id}
                onClick={() => onToggle(d.diagnosis_id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${on ? "bg-blue-50" : "hover:bg-neutral-50"}`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${on ? "bg-blue-600 border-blue-600" : "border-neutral-300"}`}>
                  {on && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="text-xs font-semibold text-blue-700 w-20 flex-shrink-0">{d.icd10_code}</span>
                <span className="text-xs text-neutral-700 flex-1 min-w-0">{d.icd10_description}</span>
                {d.evidence_level && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 flex-shrink-0">Ev. {d.evidence_level}</span>
                )}
              </button>
            );
          })}
          {diagnoses.length === 0 && <p className="text-sm text-neutral-400 px-3 py-6 text-center">No matching codes — try a different search or select a condition first.</p>}
        </div>
      </div>

      {resolution && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3.5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Resolution — ranked by evidence level</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            {resolution.driving_condition_name
              ? `Suggested: ${resolution.driving_condition_name}${resolution.evidence_level ? ` (Evidence ${resolution.evidence_level})` : ""}${resolution.placement_summary ? ` — ${resolution.placement_summary}` : ""}`
              : resolution.note || "No catalogued suggestion for this combination — set placement and dosing manually."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 4 — Placement
// ─────────────────────────────────────────────────────────────────────────
function PlacementStep({
  placements, state, validation, onApply, onSaveCustomMontage, savingMontage, montageErr,
}: {
  placements: PlacementRead[]; state: WizardState;
  validation: { valid: boolean; errors: string[]; warnings: string[]; maxCathodes: number } | null;
  onApply: (p: PlacementRead) => void;
  onSaveCustomMontage: (name: string, clinicalReasoning: string, description: string) => Promise<void>;
  savingMontage: boolean;
  montageErr: string | null;
}) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [montageName, setMontageName] = useState("");
  const [clinicalReasoning, setClinicalReasoning] = useState("");
  const [description, setDescription] = useState("");

  const hasFreeformCombo = state.anodeSite && state.cathodeSites.length > 0;
  const isCustomSaved = state.montageMode === "custom" && !!state.customMontageId;

  const handleSave = async () => {
    if (!montageName.trim() || !clinicalReasoning.trim()) return;
    await onSaveCustomMontage(montageName.trim(), clinicalReasoning.trim(), description.trim());
    setShowCustomForm(false);
    setMontageName(""); setClinicalReasoning(""); setDescription("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">4 · Electrode Placement</h2>
        <p className="text-sm text-neutral-500 mt-1">Pick a catalogued montage, or click nodes on the map at right to draw your own and save it as a custom montage.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {placements.map((p) => {
          const on = state.placementId === p.placement_id;
          return (
            <button
              key={p.placement_id}
              onClick={() => onApply(p)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${on ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-200 text-neutral-700 hover:border-neutral-300"}`}
            >
              {p.montage_label}
            </button>
          );
        })}
        {placements.length === 0 && <p className="text-sm text-neutral-400">No catalogued montages for this device/condition yet.</p>}
      </div>

      {isCustomSaved && (
        <div className="flex items-start gap-2.5 border border-blue-100 bg-blue-50 rounded-lg px-3.5 py-2.5">
          <ShieldCheck className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">Custom montage saved — this protocol will use it instead of a catalogue placement. Redraw the map to change it.</p>
        </div>
      )}

      {!state.placementId && !isCustomSaved && hasFreeformCombo && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 border border-amber-100 bg-amber-50 rounded-lg px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              This combination isn&apos;t in the catalogue for this device. Select a library montage above,
              or save it as a custom montage to continue with it.
            </p>
          </div>

          {!showCustomForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowCustomForm(true)}>Save as Custom Montage</Button>
          ) : (
            <div className="border border-neutral-200 rounded-lg p-3.5 space-y-2.5">
              <Input label="Montage name" value={montageName} onChange={(e) => setMontageName(e.target.value)} placeholder="e.g. Left DLPFC — modified" />
              <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input label="Clinical reasoning" value={clinicalReasoning} onChange={(e) => setClinicalReasoning(e.target.value)} placeholder="Why this montage departs from the catalogue" />
              {montageErr && <p className="text-xs text-red-600">{montageErr}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={savingMontage || !montageName.trim() || !clinicalReasoning.trim()}>
                  {savingMontage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Montage
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCustomForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {validation && (
        <div className={`border rounded-lg px-3.5 py-2.5 text-xs ${validation.valid ? "border-green-100 bg-green-50 text-green-800" : "border-red-100 bg-red-50 text-red-700"}`}>
          <p className="font-semibold">{validation.valid ? "Valid electrode combination" : "Invalid electrode combination"}</p>
          {validation.errors.map((e, i) => <p key={i} className="mt-1">{e}</p>)}
          {validation.warnings.map((w, i) => <p key={i} className="mt-1">{w}</p>)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 5 — Dosing
// ─────────────────────────────────────────────────────────────────────────
function DosingStep({
  dosingRows, state, onSelectDosing, onField, onReset,
}: {
  dosingRows: DosingRead[]; state: WizardState;
  onSelectDosing: (id: string) => void;
  onField: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  onReset: () => void;
}) {
  const isCustom = state.montageMode === "custom";
  const selected = isCustom ? null : dosingRows.find((d) => d.dosing_id === state.dosingId) || null;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900">5 · Stimulation Parameters</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {isCustom
              ? "This protocol uses a custom montage — there's no catalogued dose to reference. Enter the prescribed parameters manually."
              : "Catalogue dose for this montage — override below only for a documented per-patient deviation."}
          </p>
        </div>
        {selected && (
          <Button variant="outline" size="sm" onClick={onReset} className="flex-shrink-0">Reset to suggested</Button>
        )}
      </div>

      {!isCustom && dosingRows.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {dosingRows.map((d) => (
            <button
              key={d.dosing_id}
              onClick={() => onSelectDosing(d.dosing_id)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium ${state.dosingId === d.dosing_id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600"}`}
            >
              {d.num_sessions_text || d.evidence_level} · Ev. {d.evidence_level}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border border-neutral-100 bg-neutral-50 rounded-lg px-3.5 py-3 text-xs text-neutral-600 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div><span className="text-neutral-400">Evidence</span><p className="font-semibold text-neutral-800">{selected.evidence_level}</p></div>
          <div><span className="text-neutral-400">Suggested sessions</span><p className="font-semibold text-neutral-800">{selected.num_sessions_text || "—"}</p></div>
          {selected.notes && <div className="col-span-2 sm:col-span-3"><span className="text-neutral-400">Notes</span><p className="font-semibold text-neutral-800">{selected.notes}</p></div>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input label="Current intensity (mA)" value={state.currentMa} onChange={(e) => onField("currentMa", e.target.value)} />
        <Input label="Session duration (min)" value={state.sessionDurationMin} onChange={(e) => onField("sessionDurationMin", e.target.value)} />
        <Input label="Ramp up/down (sec)" value={state.rampSeconds} onChange={(e) => onField("rampSeconds", e.target.value)} />
        <Input label="Total sessions" value={state.sessionCount} onChange={(e) => onField("sessionCount", e.target.value)} />
      </div>

      <div>
        <p className="text-xs font-medium text-neutral-700 mb-2">Frequency</p>
        <div className="flex flex-wrap gap-2">
          {FREQ_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onField("sessionsPerWeek", n)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border ${state.sessionsPerWeek === n ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300 text-neutral-600"}`}
            >
              {n === 7 ? "Daily" : `${n}× / week`}
            </button>
          ))}
        </div>
      </div>

      <Input label="Follow-up every N sessions (optional)" value={state.followUpEveryN} onChange={(e) => onField("followUpEveryN", e.target.value)} placeholder="e.g. 10" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 6 — Scales
// ─────────────────────────────────────────────────────────────────────────
function ScalesStep({
  catalogue, assigned, onAdd, onRemove, onCadence,
}: {
  catalogue: ScaleRead[]; assigned: AssignedScale[];
  onAdd: (a: AssignedScale) => void; onRemove: (i: number) => void; onCadence: (i: number, c: string) => void;
}) {
  const usedIds = assigned.map((a) => a.scale_id).filter(Boolean);
  const pool = catalogue.filter((s) => !usedIds.includes(s.scale_id));
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">6 · Assessment Scales &amp; Cadence</h2>
        <p className="text-sm text-neutral-500 mt-1">Suggested from the selected conditions. These become patient PRS tasks.</p>
      </div>

      <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
        {assigned.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-neutral-900 flex-1">
              {a.displayName}
            </span>
            <div className="w-52">
              <Select value={a.cadence} onChange={(e) => onCadence(i, e.target.value)} options={CADENCE_OPTIONS.map((c) => ({ value: c, label: c }))} />
            </div>
            <button onClick={() => onRemove(i)} className="text-neutral-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        ))}
        {assigned.length === 0 && <p className="text-sm text-neutral-400 px-3.5 py-6 text-center">No scales assigned yet.</p>}
      </div>

      <div className="border border-neutral-100 bg-neutral-50 rounded-lg p-3.5">
        <p className="text-xs font-medium text-neutral-700 mb-2">Add a scale</p>
        <div className="flex flex-wrap gap-2">
          {pool.map((s) => (
            <button
              key={s.scale_id}
              onClick={() => onAdd({ scale_id: s.scale_id, cadence: "At re-assessment only", displayName: s.scale_name })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-300 text-xs font-medium text-neutral-600 hover:border-blue-400 hover:text-blue-700"
            >
              <Plus className="h-3 w-3" />{s.scale_code}
            </button>
          ))}
        </div>
        {/* The free-text "type a scale not listed" box is gone deliberately.
            Scales come from the PRS catalogue (reference.prs_scales) and
            protocol_scales has an FK into it, so a typed name cannot be
            released to the patient as a questionnaire — it was accepted by the
            form and then silently dropped at submit. A scale that is genuinely
            missing belongs in the PRS catalogue first. */}
        <p className="mt-3 text-xs text-neutral-400">
          Scales come from the PRS catalogue. To prescribe one that is not listed, add it to PRS first.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 7 — Schedule
// ─────────────────────────────────────────────────────────────────────────
function ScheduleStep({
  state, preview, loading, deviceSchedules, deviceOverrides, deviceSlots, onStartDate, onDayClick, onRegenerate, onFollowUpEveryN,
}: {
  state: WizardState; preview: SchedulePreview | null; loading: boolean;
  deviceSchedules: DeviceScheduleRead[]; deviceOverrides: DeviceOverrideRead[]; deviceSlots: DeviceSlotRead[];
  onStartDate: (v: string) => void; onDayClick: (isoDate: string, isSession: boolean) => void; onRegenerate: () => void;
  onFollowUpEveryN: (v: string) => void;
}) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const sessionsByDate = new Map((preview?.sessions || []).map((s) => [s.planned_date, s.session_number]));
  const followUpsByDate = new Set((preview?.follow_ups || []).map((f) => f.planned_date));

  const weeks: { label: string; days: { date: string; iso: string; session?: number; isFollowUp: boolean }[] }[] = [];
  if (preview?.first_date && preview?.last_date) {
    const first = new Date(preview.first_date + "T00:00:00Z");
    const monday = new Date(first); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const last = new Date(preview.last_date + "T00:00:00Z");
    const nWeeks = Math.min(10, Math.max(1, Math.ceil((+last - +monday) / (7 * 86400000)) + 1));
    for (let w = 0; w < nWeeks; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(monday); dt.setUTCDate(dt.getUTCDate() + w * 7 + d);
        const iso = dt.toISOString().slice(0, 10);
        days.push({ date: String(dt.getUTCDate()) + (dt.getUTCDate() === 1 ? ` ${MON[dt.getUTCMonth()]}` : ""), iso, session: sessionsByDate.get(iso), isFollowUp: followUpsByDate.has(iso) });
      }
      weeks.push({ label: `Week ${w + 1}`, days });
    }
  }

  // ─── Availability panel — 3 of the 4 mock rows are real; Assistant/Patient aren't modelled ───
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const activeSchedules = deviceSchedules.filter((s) => s.is_active).sort((a, b) => a.day_of_week - b.day_of_week);
  const clinicHoursSummary = activeSchedules.length
    ? (() => {
        const first = activeSchedules[0], last = activeSchedules[activeSchedules.length - 1];
        const sameHours = activeSchedules.every((s) => s.start_time === first.start_time && s.end_time === last.end_time);
        const dayRange = activeSchedules.length > 1 ? `${DOW[first.day_of_week]}–${DOW[last.day_of_week]}` : DOW[first.day_of_week];
        return sameHours ? `${dayRange}, ${first.start_time.slice(0, 5)}–${last.end_time.slice(0, 5)}` : `${activeSchedules.length} day(s) configured`;
      })()
    : "Not configured";
  // Capacity now lives only on DeviceSlotRead (derived from clinic_devices.
  // quantity at read time) — the weekly DeviceScheduleRead rows no longer
  // carry their own number to fall back to.
  const maxCapacity = deviceSlots.length ? Math.max(...deviceSlots.map((s) => s.capacity)) : undefined;
  const closedOverrides = deviceOverrides.filter((o) => !o.is_available);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-neutral-900">7 · Session Schedule</h2>
            <p className="text-sm text-neutral-500 mt-1">
              {preview ? `${preview.session_count} sessions · ${preview.week_count} weeks · ${preview.follow_up_count} follow-ups` : "Set a start date to preview."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={state.startDate} onChange={(e) => onStartDate(e.target.value)} />
            <Button variant="outline" size="sm" onClick={onRegenerate}>Regenerate</Button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />Session</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />Follow-up</span>
          <span>Click a scheduled day to skip it · click an empty weekday to add an extra session</span>
        </div>

        {loading && <p className="text-xs text-neutral-400">Refreshing preview…</p>}

        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[64px_repeat(7,1fr)] bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold uppercase text-neutral-400">
            <div className="px-2 py-2">Week</div>
            {DAYS.map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
          </div>
          {weeks.map((w) => (
            <div key={w.label} className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-neutral-100 last:border-0">
              <div className="px-2 py-2 bg-neutral-50 border-r border-neutral-100 text-[11px] font-semibold text-neutral-700">{w.label}</div>
              {w.days.map((d) => {
                const closed = closedOverrides.some((o) => o.override_date === d.iso);
                return (
                  <div
                    key={d.iso}
                    onClick={() => onDayClick(d.iso, d.session != null)}
                    className={`min-h-[54px] px-1.5 py-1.5 border-r border-neutral-50 last:border-0 cursor-pointer hover:bg-blue-50/40 ${closed ? "bg-neutral-100" : ""}`}
                  >
                    <p className="text-[10px] text-neutral-400">{d.date}</p>
                    {closed && <p className="text-[9.5px] text-neutral-400 mt-0.5">Closed</p>}
                    {d.session != null && (
                      <div className="mt-1 rounded px-1 py-0.5 text-[10px] font-semibold text-white bg-blue-600 text-center">S{d.session}</div>
                    )}
                    {d.isFollowUp && (
                      <div className="mt-1 rounded px-1 py-0.5 text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-dashed border-amber-400 text-center">Follow-up</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {weeks.length === 0 && <p className="text-sm text-neutral-400 px-3 py-8 text-center">No preview yet.</p>}
        </div>

        <div className="border border-neutral-200 rounded-lg p-3.5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Re-assessment checkpoints</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-neutral-600">Follow-up after every</span>
            <div className="w-16">
              <Input value={state.followUpEveryN} onChange={(e) => onFollowUpEveryN(e.target.value)} placeholder="10" />
            </div>
            <span className="text-xs text-neutral-600">sessions</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">Each checkpoint books a follow-up appointment on the calendar above.</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(preview?.follow_ups || []).map((f) => (
              <span key={f.planned_date} className="h-6 flex items-center gap-1 px-2.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-100 text-amber-700">
                Follow-up · {new Date(f.planned_date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            ))}
            {(!preview || preview.follow_ups.length === 0) && (
              <span className="text-xs text-neutral-400">No re-assessment checkpoints scheduled.</span>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Availability</p>
          <div className="space-y-2.5 text-xs">
            <div>
              <p className="text-neutral-400">Clinic</p>
              <p className="font-medium text-neutral-800 mt-0.5">{clinicHoursSummary}</p>
            </div>
            <div>
              <p className="text-neutral-400">Device</p>
              <p className="font-medium text-neutral-800 mt-0.5">{maxCapacity != null ? `${maxCapacity} slots/day` : "—"}</p>
            </div>
            <div>
              <p className="text-neutral-400">Clinic closed</p>
              {closedOverrides.length === 0 ? (
                <p className="font-medium text-neutral-800 mt-0.5">None in this window</p>
              ) : (
                <p className="font-medium text-neutral-800 mt-0.5">{closedOverrides.map((o) => o.override_date).join(", ")}</p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
            Assistant and patient availability aren&apos;t tracked by this system yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 8 — Review
// ─────────────────────────────────────────────────────────────────────────
function ReviewStep({
  state, device, resolution, preview, conditions, diagnoses, onNote, onGoToStep,
}: {
  state: WizardState; device: DeviceRead | null; resolution: DiagnosisResolution | null; preview: SchedulePreview | null;
  conditions: ConditionRead[]; diagnoses: DiagnosisRead[];
  onNote: (v: string) => void; onGoToStep: (step: number) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ device: true });
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const conditionNames = conditions.filter((c) => state.conditionIds.includes(c.condition_id)).map((c) => c.condition_name);
  const selectedDx = diagnoses.filter((d) => state.diagnosisIds.includes(d.diagnosis_id));

  const sections: {
    key: string; icon: React.ElementType; title: string; preview: string; rows: [string, string][]; step: number;
  }[] = [
    {
      key: "device", icon: Cpu, title: "Device", step: 0,
      preview: device ? `${device.device_name} · ${device.modality}` : "—",
      rows: [
        ["Device", device ? device.device_name : "—"],
        ["Modality", device?.modality || "—"],
        ["Phase", device ? `Phase ${device.phase}` : "—"],
      ],
    },
    {
      key: "condition", icon: ClipboardCheck, title: "Condition & Diagnosis", step: 1,
      preview: conditionNames.join(", ") || "—",
      rows: [
        ["Conditions", conditionNames.join(", ") || "—"],
        ["Diagnosis codes", selectedDx.length ? selectedDx.map((d) => d.icd10_code).join(", ") : "—"],
        ["Driving suggestion", resolution?.driving_condition_name ? `${resolution.driving_condition_name}${resolution.evidence_level ? ` (Evidence ${resolution.evidence_level})` : ""}` : "—"],
      ],
    },
    {
      key: "placement", icon: MapPin, title: "Placement", step: 3,
      preview: state.anodeSite
        ? `${state.anodeSite} → ${state.cathodeSites.join(", ") || "—"}${state.montageMode === "custom" ? " (custom)" : ""}`
        : "—",
      rows: [
        ["Anode", state.anodeSite || "—"],
        ["Cathode", state.cathodeSites.join(", ") || "—"],
        [
          "Montage source",
          state.montageMode === "custom"
            ? "Custom montage (doctor-authored)"
            : state.placementId ? "Catalogued montage selected" : "—",
        ],
      ],
    },
    {
      key: "dosing", icon: BarChart2, title: "Stimulation Parameters", step: 4,
      preview: `${state.currentMa || "—"} mA · ${state.sessionDurationMin || "—"} min`,
      rows: [
        ["Current intensity", state.currentMa ? `${state.currentMa} mA` : "—"],
        ["Session duration", state.sessionDurationMin ? `${state.sessionDurationMin} min` : "—"],
        ["Ramp up/down", state.rampSeconds ? `${state.rampSeconds} s` : "—"],
        ["Frequency", `${state.sessionsPerWeek === 7 ? "Daily" : `${state.sessionsPerWeek}×/week`}`],
        ["Total sessions", state.sessionCount || "—"],
      ],
    },
    {
      key: "scales", icon: ClipboardList, title: "Assessment Scales", step: 5,
      preview: state.scales.map((s) => s.displayName).join(", ") || "None",
      rows: state.scales.length ? state.scales.map((s): [string, string] => [s.displayName, s.cadence]) : [["Scales", "None assigned"]],
    },
    {
      key: "schedule", icon: Calendar, title: "Schedule", step: 6,
      preview: preview ? `${preview.session_count} booked · ${preview.follow_up_count} follow-ups` : "—",
      rows: [
        ["Start date", state.startDate],
        ["Sessions booked", preview ? String(preview.session_count) : "—"],
        ["Span", preview ? `${preview.week_count} weeks` : "—"],
        ["Re-assessments", preview?.follow_ups.length ? preview.follow_ups.map((f) => new Date(f.planned_date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })).join(", ") : "None"],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">8 · Review &amp; Push</h2>
        <p className="text-sm text-neutral-500 mt-1">Everything below is written to the patient record as one protocol object.</p>
      </div>

      <div className="space-y-2">
        {sections.map((sec) => {
          const isOpen = !!open[sec.key];
          const Icon = sec.icon;
          return (
            <div key={sec.key} className="border border-neutral-200 rounded-lg overflow-hidden">
              <div
                onClick={() => toggle(sec.key)}
                className="flex items-center gap-3 px-3 py-2.5 bg-white cursor-pointer hover:bg-neutral-50"
              >
                <span className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-semibold text-neutral-900 w-48 flex-shrink-0">{sec.title}</span>
                <span className="flex-1 text-xs text-neutral-400 truncate">{sec.preview}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onGoToStep(sec.step); }}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex-shrink-0"
                >
                  Edit
                </button>
                {isOpen ? <ChevronUp className="h-4 w-4 text-neutral-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-neutral-400 flex-shrink-0" />}
              </div>
              {isOpen && (
                <div className="px-3.5 py-3 border-t border-neutral-100 bg-neutral-50 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                  {sec.rows.map(([k, v]) => (
                    <div key={k} className="flex gap-2.5 text-xs">
                      <span className="w-36 flex-shrink-0 text-neutral-400">{k}</span>
                      <span className="flex-1 text-neutral-700">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border border-neutral-200 rounded-lg bg-neutral-50 p-3.5">
        <label className="block text-xs font-medium text-neutral-700 mb-1.5">Protocol note to care team (optional)</label>
        <textarea
          value={state.protocolNote}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Add any note for the care team…"
          rows={3}
          className="w-full text-sm border border-neutral-300 rounded-lg bg-white px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="flex items-start gap-2.5 border border-blue-100 bg-blue-50 rounded-lg px-3.5 py-2.5">
        <ShieldCheck className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          Pushing creates {preview?.session_count ?? state.sessionCount} appointments and activates this protocol immediately.
        </p>
      </div>
    </div>
  );
}