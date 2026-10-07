"use client";

// Same wizard the doctor uses. It reads its portal from the URL
// (useWorkspaceBase), so "back" and "View Treatment Protocol" return to the
// clinical assistant workspace. A clinical assistant only ever reaches it in
// ?mode=modify — the backend refuses a new protocol from this role.
import TreatmentProtocolWizardPage from "@/app/(roles)/doctor/patients/[id]/treatment-protocol/wizard/page";

export default TreatmentProtocolWizardPage;
