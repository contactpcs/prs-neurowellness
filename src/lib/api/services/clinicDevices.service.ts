import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  ClinicDeviceRead,
  ClinicDeviceCreate,
  ClinicDeviceUpdate,
  DeviceUnitRead,
  DeviceUnitCreate,
  DeviceUnitUpdate,
} from "@/types/treatmentProtocol.types";

// Settings → Clinic Devices. What this clinic owns — gates the treatment
// protocol wizard's Step 1 device picker (treatmentProtocol.service.ts
// listDevices({ clinicId })), and is independently enforced by a database
// trigger, so this screen is a convenience, never the only guard.
export const clinicDevicesService = {
  list: async (clinicId: string, activeOnly = true): Promise<ClinicDeviceRead[]> => {
    const { data } = await apiClient.get(ENDPOINTS.CLINIC_DEVICE_INVENTORY.LIST(clinicId), {
      params: { active_only: activeOnly },
    });
    return Array.isArray(data) ? data : [];
  },

  add: async (clinicId: string, payload: ClinicDeviceCreate): Promise<ClinicDeviceRead> => {
    const { data } = await apiClient.post(ENDPOINTS.CLINIC_DEVICE_INVENTORY.LIST(clinicId), payload);
    return data;
  },

  update: async (clinicId: string, clinicDeviceId: string, payload: ClinicDeviceUpdate): Promise<ClinicDeviceRead> => {
    const { data } = await apiClient.patch(ENDPOINTS.CLINIC_DEVICE_INVENTORY.ITEM(clinicId, clinicDeviceId), payload);
    return data;
  },

  // Refuses with CLINIC_DEVICE_IN_USE (409) if a protocol at this clinic has
  // ever prescribed the device — the caller should catch that and suggest
  // `update(..., { is_active: false })` instead of deleting.
  remove: async (clinicId: string, clinicDeviceId: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.CLINIC_DEVICE_INVENTORY.ITEM(clinicId, clinicDeviceId));
  },

  // Serial-numbered physical units under one clinic_device row. Optional —
  // a clinic can keep using quantity alone with no units listed.
  listUnits: async (clinicId: string, clinicDeviceId: string, activeOnly = true): Promise<DeviceUnitRead[]> => {
    const { data } = await apiClient.get(ENDPOINTS.CLINIC_DEVICE_INVENTORY.UNITS(clinicId, clinicDeviceId), {
      params: { active_only: activeOnly },
    });
    return Array.isArray(data) ? data : [];
  },

  addUnit: async (clinicId: string, clinicDeviceId: string, payload: DeviceUnitCreate): Promise<DeviceUnitRead> => {
    const { data } = await apiClient.post(ENDPOINTS.CLINIC_DEVICE_INVENTORY.UNITS(clinicId, clinicDeviceId), payload);
    return data;
  },

  updateUnit: async (
    clinicId: string,
    clinicDeviceId: string,
    deviceUnitId: string,
    payload: DeviceUnitUpdate,
  ): Promise<DeviceUnitRead> => {
    const { data } = await apiClient.patch(ENDPOINTS.CLINIC_DEVICE_INVENTORY.UNIT(clinicId, clinicDeviceId, deviceUnitId), payload);
    return data;
  },

  // Refuses with DEVICE_UNIT_IN_USE (409) if a protocol has pinned this
  // unit — the caller should catch that and suggest retiring instead.
  removeUnit: async (clinicId: string, clinicDeviceId: string, deviceUnitId: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.CLINIC_DEVICE_INVENTORY.UNIT(clinicId, clinicDeviceId, deviceUnitId));
  },
};
