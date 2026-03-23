"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserCircle } from "lucide-react";
import { Input, Card, PageLoader } from "@/components/ui";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mrn?: string;
}

export default function CAPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get(ENDPOINTS.PATIENTS.LIST).then(({ data }) => {
      setPatients(data.patients || data || []);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email} ${p.mrn || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Patients</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <div className="divide-y divide-neutral-100">
          {filtered.map((p) => (
            <Link key={p.id} href={`/clinical-assistant/patients/${p.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
                {p.first_name?.[0]}{p.last_name?.[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-neutral-500">{p.email}</p>
              </div>
              {p.mrn && <span className="text-xs text-neutral-400">MRN: {p.mrn}</span>}
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="px-6 py-8 text-center text-neutral-500 text-sm">No patients found</div>
          )}
        </div>
      </Card>
    </div>
  );
}
