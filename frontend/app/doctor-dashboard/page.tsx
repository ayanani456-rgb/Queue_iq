"use client";

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Stethoscope,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  UserCheck,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import DoctorQueue from '@/app/components/DoctorQueue';

const DR_AYESHA = {
  id: '024f24eb-a440-4079-acb3-ad8cffe85015',
  name: 'Dr. Ayesha',
  fullName: 'Dr. Ayesha Khan',
  specialty: 'Gynecologist',
  department: 'Gynecology',
  organization_id: 'bcb69e0a-b1e1-4f03-8184-1017d8e8e9eb',
  organization_name: 'Al-Shifa Clinic',
  room: 'Consultation Room 3',
  timing: '02:00 PM - 03:00 AM (Demo Live)',
  fee: 'Rs. 500',
  isDemo: true,
};

export default function DoctorDashboardPage() {
  const [selectedDoctor, setSelectedDoctor] = useState(DR_AYESHA);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Banner Bar */}
      <div className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left Brand / Breadcrumb */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-emerald-700 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to QueueIQ
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">
                Doctor Portal
              </span>
            </div>

            {/* Right Active Profile badge */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm">
                DA
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {selectedDoctor.name} ({selectedDoctor.specialty})
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  {selectedDoctor.organization_name} • {selectedDoctor.room}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {/* Welcome Doctor Banner */}
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                Live Demo Session Active
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome, {selectedDoctor.fullName || selectedDoctor.name}
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl font-normal">
                Manage your real-time consultation queue, pause tokens for stepped-out patients, advance live queue, and complete visits.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 text-left">
                <p className="text-[11px] uppercase font-bold tracking-wider text-emerald-300">Live Timing</p>
                <p className="font-semibold text-sm text-white">02:00 PM - 03:00 AM</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 text-left">
                <p className="text-[11px] uppercase font-bold tracking-wider text-emerald-300">Room</p>
                <p className="font-semibold text-sm text-white">{selectedDoctor.room}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Queue Controller Component */}
        <DoctorQueue
          doctorId={selectedDoctor.id}
          doctorName={selectedDoctor.name}
          specialty={selectedDoctor.specialty}
          organizationId={selectedDoctor.organization_id}
          organizationName={selectedDoctor.organization_name}
        />
      </div>
    </main>
  );
}
