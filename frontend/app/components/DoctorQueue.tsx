"use client";

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  SkipForward,
  Clock,
  User,
  Phone,
  RefreshCw,
  Plus,
  AlertCircle,
  Activity,
  Check,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface TokenItem {
  id: string | number;
  token_number: string;
  token?: string;
  status: 'Serving' | 'Waiting' | 'Paused' | 'Completed' | 'Done' | 'Cancelled';
  patient_name?: string;
  phone?: string;
  department?: string;
  doctor_id?: string;
  organization_id?: string;
  created_at?: string;
  slot_time?: string;
  service?: string;
  is_emergency?: boolean;
}

interface DoctorQueueProps {
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  organizationId?: string;
  organizationName?: string;
}

const DEFAULT_ORG_ID = 'bcb69e0a-b1e1-4f03-8184-1017d8e8e9eb';
const DEFAULT_DOCTOR_ID = '024f24eb-a440-4079-acb3-ad8cffe85015';

const INITIAL_DEMO_TOKENS: TokenItem[] = [
  {
    id: 'demo-112',
    token_number: 'Q-112',
    status: 'Serving',
    patient_name: 'Sara Ahmed',
    phone: '+92 300 1234567',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
    slot_time: '02:00 PM',
  },
  {
    id: 'demo-113',
    token_number: 'Q-113',
    status: 'Waiting',
    patient_name: 'Zainab Bibi',
    phone: '+92 321 9876543',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    slot_time: '02:15 PM',
  },
  {
    id: 'demo-114',
    token_number: 'Q-114',
    status: 'Waiting',
    patient_name: 'Maryam Nawaz',
    phone: '+92 333 4567890',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    slot_time: '02:30 PM',
  },
  {
    id: 'demo-115',
    token_number: 'Q-115',
    status: 'Waiting',
    patient_name: 'Hina Tariq',
    phone: '+92 312 3456789',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    slot_time: '02:45 PM',
  },
  {
    id: 'demo-116',
    token_number: 'Q-116',
    status: 'Paused',
    patient_name: 'Ayesha Noor (Step Out)',
    phone: '+92 345 6789012',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    slot_time: '03:00 PM',
  },
  {
    id: 'demo-117',
    token_number: 'Q-117',
    status: 'Waiting',
    patient_name: 'Rubina Yasmin',
    phone: '+92 301 2345678',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    slot_time: '03:15 PM',
  },
  {
    id: 'demo-118',
    token_number: 'Q-118',
    status: 'Waiting',
    patient_name: 'Bushra Khan',
    phone: '+92 304 8901234',
    department: 'Gynecology',
    doctor_id: DEFAULT_DOCTOR_ID,
    organization_id: DEFAULT_ORG_ID,
    created_at: new Date().toISOString(),
    slot_time: '03:30 PM',
  },
];

export default function DoctorQueue({
  doctorId = DEFAULT_DOCTOR_ID,
  doctorName = 'Dr. Ayesha',
  specialty = 'Gynecologist',
  organizationId = DEFAULT_ORG_ID,
  organizationName = 'Al-Shifa Clinic',
}: DoctorQueueProps) {
  const [tokens, setTokens] = useState<TokenItem[]>(INITIAL_DEMO_TOKENS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Serving' | 'Waiting' | 'Paused'>('All');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Fetch tokens from Supabase
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['Serving', 'Waiting', 'Paused'])
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase fetch error, fallback to demo data:', error);
      } else if (data && data.length > 0) {
        // Map data safely
        const mapped: TokenItem[] = data.map((t: any) => ({
          id: t.id || t.token_number,
          token_number: t.token_number || t.token || `Q-${t.position || 100}`,
          status: (t.status === 'serving' ? 'Serving' : t.status === 'paused' ? 'Paused' : t.status === 'completed' ? 'Completed' : t.status || 'Waiting') as any,
          patient_name: t.patient_name || t.name || 'Patient',
          phone: t.phone || '',
          department: t.department || specialty,
          doctor_id: t.doctor_id || doctorId,
          organization_id: t.organization_id || organizationId,
          created_at: t.created_at,
          slot_time: t.slot_time,
          is_emergency: !!t.emergency_type || !!t.is_emergency,
        }));
        setTokens(mapped);
      } else {
        // Empty DB: Seed or keep default demo queue
        setTokens(INITIAL_DEMO_TOKENS);
      }
    } catch (err) {
      console.warn('Network error loading tokens:', err);
      setTokens(INITIAL_DEMO_TOKENS);
    } finally {
      setLoading(false);
    }
  }, [organizationId, doctorId, specialty]);

  useEffect(() => {
    fetchTokens();

    // Supabase real-time subscription
    try {
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tokens',
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            fetchTokens();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Real-time subscription skipped:', e);
    }
  }, [fetchTokens, organizationId]);

  // 1. Pause Token
  const handlePause = async (tokenNumber: string) => {
    startTransition(() => {
      setTokens((prev) =>
        prev.map((t) => (t.token_number === tokenNumber ? { ...t, status: 'Paused' } : t))
      );
    });
    showToast(`Token ${tokenNumber} paused`);

    try {
      await supabase
        .from('tokens')
        .update({ status: 'Paused' })
        .eq('token_number', tokenNumber);
    } catch (err) {
      console.error('Failed to pause token in Supabase:', err);
    }
  };

  // 2. Resume Token
  const handleResume = async (tokenNumber: string) => {
    startTransition(() => {
      setTokens((prev) =>
        prev.map((t) => (t.token_number === tokenNumber ? { ...t, status: 'Waiting' } : t))
      );
    });
    showToast(`Token ${tokenNumber} resumed to Waiting`);

    try {
      await supabase
        .from('tokens')
        .update({ status: 'Waiting' })
        .eq('token_number', tokenNumber);
    } catch (err) {
      console.error('Failed to resume token in Supabase:', err);
    }
  };

  // 3. Complete Token
  const handleComplete = async (tokenNumber: string) => {
    startTransition(() => {
      setTokens((prev) => prev.filter((t) => t.token_number !== tokenNumber));
    });
    showToast(`Token ${tokenNumber} marked as Completed`);

    try {
      await supabase
        .from('tokens')
        .update({ status: 'Completed' })
        .eq('token_number', tokenNumber);
    } catch (err) {
      console.error('Failed to complete token in Supabase:', err);
    }
  };

  // 4. Next Token (Set current Serving to Completed & Next Waiting to Serving)
  const handleNext = async () => {
    const currentServing = tokens.find((t) => t.status === 'Serving');
    const nextWaiting = tokens.find((t) => t.status === 'Waiting');

    if (!nextWaiting && !currentServing) {
      showToast('No patients left in queue');
      return;
    }

    startTransition(() => {
      setTokens((prev) => {
        let updated = prev;
        if (currentServing) {
          updated = updated.filter((t) => t.token_number !== currentServing.token_number);
        }
        if (nextWaiting) {
          updated = updated.map((t) =>
            t.token_number === nextWaiting.token_number ? { ...t, status: 'Serving' } : t
          );
        }
        return updated;
      });
    });

    if (currentServing && nextWaiting) {
      showToast(`Completed ${currentServing.token_number} • Now Serving ${nextWaiting.token_number}`);
    } else if (nextWaiting) {
      showToast(`Now Serving ${nextWaiting.token_number}`);
    } else if (currentServing) {
      showToast(`Completed ${currentServing.token_number}`);
    }

    try {
      if (currentServing) {
        await supabase
          .from('tokens')
          .update({ status: 'Completed' })
          .eq('token_number', currentServing.token_number);
      }
      if (nextWaiting) {
        await supabase
          .from('tokens')
          .update({ status: 'Serving' })
          .eq('token_number', nextWaiting.token_number);
      }
    } catch (err) {
      console.error('Failed to advance queue in Supabase:', err);
    }
  };

  // Quick Add Demo Token
  const handleAddToken = async () => {
    const lastNum = tokens.reduce((max, t) => {
      const n = parseInt(t.token_number.replace(/\D/g, ''), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 118);

    const newNumber = `Q-${lastNum + 1}`;
    const newToken: TokenItem = {
      id: `manual-${Date.now()}`,
      token_number: newNumber,
      status: 'Waiting',
      patient_name: `Walk-in Patient #${lastNum + 1}`,
      phone: '+92 300 ' + Math.floor(1000000 + Math.random() * 9000000),
      department: specialty,
      doctor_id: doctorId,
      organization_id: organizationId,
      created_at: new Date().toISOString(),
      slot_time: 'Live Token',
    };

    setTokens((prev) => [...prev, newToken]);
    showToast(`Added token ${newNumber} to queue`);

    try {
      await supabase.from('tokens').insert([
        {
          token_number: newNumber,
          status: 'Waiting',
          organization_id: organizationId,
          doctor_id: doctorId,
          phone: newToken.phone,
        },
      ]);
    } catch (err) {
      console.warn('Manual insert to Supabase skipped:', err);
    }
  };

  // Filtered List
  const filteredTokens = tokens.filter((t) => {
    if (filter === 'All') return true;
    return t.status === filter;
  });

  const servingToken = tokens.find((t) => t.status === 'Serving');
  const waitingCount = tokens.filter((t) => t.status === 'Waiting').length;
  const pausedCount = tokens.filter((t) => t.status === 'Paused').length;

  return (
    <div className="w-full space-y-6">
      {/* Toast Banner */}
      {actionMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/90 backdrop-blur-md px-4 py-3 text-sm font-semibold text-emerald-200 shadow-2xl animate-in fade-in slide-in-from-top-3">
          <Check className="h-4 w-4 text-emerald-400" />
          {actionMessage}
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-xl shadow-inner">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">{doctorName}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live On Duty
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">
                {specialty} • {organizationName} • Timing: 02:00 PM - 03:00 AM
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleNext}
              disabled={tokens.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward className="h-4 w-4" />
              Call Next Patient
            </button>

            <button
              onClick={handleAddToken}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 text-slate-500" />
              Issue Token
            </button>

            <button
              onClick={fetchTokens}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              title="Refresh Queue"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 border-t border-slate-100 pt-5">
          <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Now Serving</p>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-600">
              {servingToken ? servingToken.token_number : 'None'}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">Inside Consultation Room</p>
          </div>

          <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waiting Patients</p>
            <p className="mt-1 font-mono text-2xl font-black text-amber-600">{waitingCount}</p>
            <p className="text-[11px] text-slate-400 font-medium">Avg wait ~10 mins</p>
          </div>

          <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paused Tokens</p>
            <p className="mt-1 font-mono text-2xl font-black text-purple-600">{pausedCount}</p>
            <p className="text-[11px] text-slate-400 font-medium">Stepped out / on hold</p>
          </div>

          <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total in Queue</p>
            <p className="mt-1 font-mono text-2xl font-black text-slate-800">{tokens.length}</p>
            <p className="text-[11px] text-slate-400 font-medium">Active today</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['All', 'Serving', 'Waiting', 'Paused'] as const).map((tab) => {
            const count =
              tab === 'All'
                ? tokens.length
                : tab === 'Serving'
                ? servingToken
                  ? 1
                  : 0
                : tab === 'Waiting'
                ? waitingCount
                : pausedCount;

            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab}
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-800">{filteredTokens.length}</span> patient{filteredTokens.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Tokens List */}
      {filteredTokens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <Activity className="mx-auto h-10 w-10 text-slate-400 stroke-1" />
          <p className="mt-3 text-sm font-bold text-slate-800">No tokens match filter &quot;{filter}&quot;</p>
          <p className="mt-1 text-xs text-slate-500">All patients in this category have been attended to.</p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filteredTokens.map((token, index) => {
            const isServing = token.status === 'Serving';
            const isWaiting = token.status === 'Waiting';
            const isPaused = token.status === 'Paused';

            return (
              <div
                key={String(token.id || token.token_number || index)}
                className={`group relative rounded-2xl border p-5 transition-all duration-200 ${
                  isServing
                    ? 'border-emerald-400 bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-white shadow-md ring-2 ring-emerald-500/20'
                    : isPaused
                    ? 'border-purple-200 bg-purple-50/30 shadow-xs opacity-90'
                    : 'border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left Token Info */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl font-mono font-black text-xl transition-all ${
                        isServing
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg scale-105'
                          : isPaused
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <span>{token.token_number}</span>
                      <span className="text-[9px] font-sans font-bold uppercase tracking-wider opacity-80">
                        {isServing ? 'Active' : isPaused ? 'Hold' : `#${index + 1}`}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-base">
                          {token.patient_name || 'Patient'}
                        </span>

                        {/* Status Badge */}
                        {isServing && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-700 animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Serving - Inside
                          </span>
                        )}

                        {isWaiting && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-xs font-bold text-amber-700">
                            <Clock className="h-3 w-3 text-amber-600" />
                            Waiting
                          </span>
                        )}

                        {isPaused && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 px-3 py-0.5 text-xs font-bold text-purple-700">
                            <Pause className="h-3 w-3 text-purple-600" />
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {token.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {token.phone}
                          </span>
                        )}
                        {token.slot_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Slot: {token.slot_time}
                          </span>
                        )}
                        <span className="text-slate-400">• {token.department || specialty}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 sm:self-center">
                    {/* Pause Button (Shows for Serving & Waiting) */}
                    {(isServing || isWaiting) && (
                      <button
                        onClick={() => handlePause(token.token_number)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 hover:border-purple-300 active:scale-95 transition-all"
                        title="Pause this token (Patient stepped out)"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </button>
                    )}

                    {/* Resume Button (Shows only for Paused) */}
                    {isPaused && (
                      <button
                        onClick={() => handleResume(token.token_number)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 active:scale-95 transition-all shadow-xs"
                        title="Resume to Waiting"
                      >
                        <Play className="h-3.5 w-3.5 fill-emerald-600" />
                        Resume
                      </button>
                    )}

                    {/* Complete Button */}
                    <button
                      onClick={() => handleComplete(token.token_number)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
                      title="Mark as completed"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete
                    </button>

                    {/* Next Button (Quick advance if Serving) */}
                    {isServing && (
                      <button
                        onClick={handleNext}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
                        title="Complete current and call next patient"
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                        Next
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
