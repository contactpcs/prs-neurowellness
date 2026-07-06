"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Admins split into two real sub-sections — Regional Admins and Clinic
// Admins — each its own route/nav entry. This bare path just forwards
// anyone hitting the old combined URL.
export default function AdminAdminsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/admins/regional"); }, [router]);
  return null;
}
