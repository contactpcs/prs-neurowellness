"use client";

import { usePathname } from "next/navigation";

/** The doctor's patient-workspace components (session tabs, treatment
 * protocol panel + wizard) are shared with the clinical assistant portal.
 * Returns the portal the current page lives under, and whether its role
 * prescribes — a clinical assistant only amends an existing protocol, never
 * starts, completes or cancels one (backend SQL/v1/106 enforces the same). */
export function useWorkspaceBase(): { base: "/doctor" | "/clinical-assistant"; canPrescribe: boolean } {
  const isClinicalAssistant = (usePathname() ?? "").startsWith("/clinical-assistant");
  return { base: isClinicalAssistant ? "/clinical-assistant" : "/doctor", canPrescribe: !isClinicalAssistant };
}
