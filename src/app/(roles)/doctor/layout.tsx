import { ActiveConsultationBar } from "@/components/appointments/ActiveConsultationBar";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ActiveConsultationBar />
    </>
  );
}
