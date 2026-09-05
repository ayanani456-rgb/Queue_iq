"use client";

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  SkipForward,
  Clock,
  Phone,
  RefreshCw,
  Activity,
  Check,
  Stethoscope
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface TokenItem {
  id?: string | number;
  token_number: string;
  token?: string;
  status: 'Serving' | 'Waiting' | 'Paused' | 'Completed' | 'Done' | 'Cancelled';
  client_id?: string;
  patient_name?: string;
  phone?: string;
  department?: string;
  doctor_id?: string;
  organization_id?: string;
  created_at?: string;
  slot_time?: string;
  service?: string;
}

interface DoctorQueueProps {
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  fee?: number | string;
  bio?: string;
  timing?: string;
  experience?: number | string;
  organizationId?: string;
  organizationName?: string;
}

const DEFAULT_ORG_ID = 'bcb69e0a-b1e1-4f03-8184-1017d8e8e9eb';

// Doctor-specific baseline queues
const DOCTOR_BASELINE_TOKENS: Record<string, TokenItem[]> = {
  // Dr. Rabia Hassan (Cardiologist) -> Q-112, Q-113
  '92fc75e6-645d-4889-a856-902bb15be43d': [
    {
      id: 'tok-112',
      token_number: 'Q-112',
      status: 'Serving',
      client_id: 'client_123',
      patient_name: 'Sara Ahmed (client_123)',
      phone: '+92 300 1234567',
      department: 'Cardiologist',
      doctor_id: '92fc75e6-645d-4889-a856-902bb15be43d',
      organization_id: DEFAULT_ORG_ID,
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      slot_time: '02:00 PM',
    },
    {
      id: 'tok-113',
      token_number: 'Q-113',
      status: 'Waiting',
      client_id: 'client_123',
      patient_name: 'Zainab Bibi (client_123)',
      phone: '+92 321 9876543',
      department: 'Cardiologist',
      doctor_id: '92fc75e6-645d-4889-a856-902bb15be43d',
      organization_id: DEFAULT_ORG_ID,
      created_at: new Date(Date.now() - 20 * 60000).toISOString(),
      slot_time: '02:15 PM',
    },
  ],

  // Dr. Salman Iqbal (Cardiologist) -> Q-115
  '87c93b3f-bfe5-421e-ae3d-dfc3c3dcee19': [
    {
      id: 'tok-115',
      token_number: 'Q-115',
      status: 'Waiting',
      client_id: 'client_123',
      patient_name: 'Hina Tariq (client_123)',
      phone: '+92 333 4567890',
      department: 'Cardiologist',
      doctor_id: '87c93b3f-bfe5-421e-ae3d-dfc3c3dcee19',
      organization_id: DEFAULT_ORG_ID,
      created_at: new Date(Date.now() - 10 * 60000).toISOString(),
      slot_time: '02:30 PM',
    },
  ],

  // Dr. Zoya Ahmed (Dermatologist) -> Q-114
  '52f7f206-06e7-47b1-9543-54bbff196473': [
    {
      id: 'tok-114',
      token_number: 'Q-114',
      status: 'Serving',
      client_id: 'client_123',
      patient_name: 'Maryam Nawaz (client_123)',
      phone: '+92 312 3456789',
      department: 'Dermatologist',
      doctor_id: '52f7f206-06e7-47b1-9543-54bbff196473',
      organization_id: DEFAULT_ORG_ID,
      created_at: new Date(Date.now() - 15 * 60000).toISOString(),
      slot_time: '02:15 PM',
    },
  ],

  // Dr. Ayesha Khan -> T-127, T-128
  '024f24eb-a440-4079-acb3-ad8cffe85015': [
    {
      id: 'tok-127',
      token_number: 'T-127',
      status: 'Serving',
      client_id: 'client_123',
      patient_name: 'Walk-in Patient',
      phone: '+92 345 6789012',
      department: 'Cardiologist',
      doctor_id: '024f24eb-a440-4079-acb3-ad8cffe85015',
      organization_id: DEFAULT_ORG_ID,
      created_at: new Date(Date.now() - 5 * 60000).toISOString(),
      slot_time: '02:45 PM',
    },
    {
      id: 'tok-128',
      token_number: 'T-128',
      status: 'Waiting',
      client_id: 'client_123',
      patient_name: 'Walk-in Patient',
      phone: '+92 300 9876543',
      department: 'Cardiologist',
      doctor_id: '024f24eb-a440-4079-acb3-ad8cffe85015',
      organization_id: DEFAULT_ORG_ID,
      created_at: new Date().toISOString(),
      slot_time: '03:00 PM',
    },
  ],
};

function getBaselineForDoctor(doctorId?: string, doctorName?: string): TokenItem[] {
  if (doctorId && DOCTOR_BASELINE_TOKENS[doctorId]) {
    return DOCTOR_BASELINE_TOKENS[doctorId];
  }
  const name = (doctorName || '').toLowerCase();
  if (name.includes('rabia')) return DOCTOR_BASELINE_TOKENS['92fc75e6-645d-4889-a856-902bb15be43d'];
  if (name.includes('salman')) return DOCTOR_BASELINE_TOKENS['87c93b3f-bfe5-421e-ae3d-dfc3c3dcee19'];
  if (name.includes('zoya')) return DOCTOR_BASELINE_TOKENS['52f7f206-06e7-47b1-9543-54bbff196473'];
  if (name.includes('ayesha')) return DOCTOR_BASELINE_TOKENS['024f24eb-a440-4079-acb3-ad8cffe85015'];
  return [];
}

export default function DoctorQueue({
  doctorId = '92fc75e6-645d-4889-a856-902bb15be43d',
  doctorName = 'Dr. Rabia Hassan',
  specialty = 'Cardiologist',
  fee = 1800,
  bio,
  timing,
  experience,
  organizationId = DEFAULT_ORG_ID,
  organizationName = 'Al-Shifa Clinic',
}: DoctorQueueProps) {
  const [tokens, setTokens] = useState<TokenItem[]>(() => getBaselineForDoctor(doctorId, doctorName));
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Serving' | 'Waiting' | 'Paused'>('All');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // 1. Fetch live tokens directly from Supabase, filtered by organization_id AND doctor_id
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tokens')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['Serving', 'Waiting', 'Paused']);

      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase tokens query error:', error);
        setTokens(getBaselineForDoctor(doctorId, doctorName));
      } else if (data && data.length > 0) {
        const mapped: TokenItem[] = data.map((t: any) => ({
          id: t.id || t.token_number,
          token_number: t.token_number || t.token || `Q-${t.position || 100}`,
          status: (t.status === 'serving' ? 'Serving' : t.status === 'paused' ? 'Paused' : t.status === 'completed' ? 'Completed' : t.status || 'Waiting') as any,
          client_id: t.client_id || 'client_123',
          patient_name: t.patient_name || t.name || (t.client_id ? `Patient (${t.client_id})` : 'Walk-in Patient'),
          phone: t.phone || '',
          department: t.department || specialty,
          doctor_id: t.doctor_id || doctorId,
          organization_id: t.organization_id || organizationId,
          created_at: t.created_at,
          slot_time: t.slot_time,
        }));
        setTokens(mapped);
      } else {
        // If DB has no tokens for this doctor, use doctor-specific baseline
        setTokens(getBaselineForDoctor(doctorId, doctorName));
      }
    } catch (err) {
      console.warn('Live token fetch fallback:', err);
      setTokens(getBaselineForDoctor(doctorId, doctorName));
    } finally {
      setLoading(false);
    }
  }, [organizationId, doctorId, specialty, doctorName]);

  // 2. Real-time postgres channel listener
  useEffect(() => {
    fetchTokens();

    const channel = supabase
      .channel(`tokens-changes-${doctorId || 'all'}`)
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
  }, [fetchTokens, organizationId, doctorId]);

  // 3. Action: Pause
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
      console.warn('Supabase pause token update:', err);
    }
  };

  // 4. Action: Resume
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
      console.warn('Supabase resume token update:', err);
    }
  };

  // 5. Action: Complete
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
      console.warn('Supabase complete token update:', err);
    }
  };

  // 6. Action: Next (Advance current doctor's queue)
  const handleNext = async () => {
    const currentServing = tokens.find((t) => t.status === 'Serving');
    const nextWaiting = tokens.find((t) => t.status === 'Waiting');

    if (!nextWaiting && !currentServing) {
      showToast(`No more patients in queue for ${doctorName}`);
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
      let servingUpdate = supabase
        .from('tokens')
        .update({ status: 'Completed' })
        .eq('status', 'Serving')
        .eq('organization_id', organizationId);

      if (doctorId) {
        servingUpdate = servingUpdate.eq('doctor_id', doctorId);
      }
      await servingUpdate;

      if (nextWaiting) {
        await supabase
          .from('tokens')
          .update({ status: 'Serving' })
          .eq('token_number', nextWaiting.token_number);
      }
    } catch (err) {
      console.warn('Supabase advance queue update:', err);
    }
  };

  // Filtered tokens
  const filteredTokens = tokens.filter((t) => {
    if (filter === 'All') return true;
    return t.status === filter;
  });

  const servingToken = tokens.find((t) => t.status === 'Serving');
  const waitingCount = tokens.filter((t) => t.status === 'Waiting').length;
  const pausedCount = tokens.filter((t) => t.status === 'Paused').length;

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/95 backdrop-blur-md px-4 py-3 text-sm font-semibold text-emerald-200 shadow-2xl animate-in fade-in slide-in-from-top-3">
          <Check className="h-4 w-4 text-emerald-400" />
          {actionMessage}
        </div>
      )}

      {/* Header Info Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-xl shadow-inner">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">{doctorName}</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Live On Duty
                </span>
                {experience ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {experience} {String(experience).includes('year') ? '' : 'years'} exp
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-slate-500">
                <span className="font-semibold text-slate-700">{specialty}</span> • {organizationName} • Rs. {fee || 800}
                {timing ? ` • Timing: ${timing}` : ''}
              </p>
              {bio ? <p className="mt-1 text-xs text-slate-500 max-w-xl line-clamp-1">{bio}</p> : null}
            </div>
          </div>

          {/* Action Buttons */}
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
              onClick={fetchTokens}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              title="Refresh Live Queue"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 border-t border-slate-100 pt-5">
          <div className="rounded-xl bg-emerald-50/50 p-3.5 border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Now Serving</p>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-600">
              {servingToken ? servingToken.token_number : '--'}
            </p>
            <p className="text-[11px] text-emerald-600/80 font-medium">Inside Consultation</p>
          </div>

          <div className="rounded-xl bg-amber-50/50 p-3.5 border border-amber-100">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Waiting</p>
            <p className="mt-1 font-mono text-2xl font-black text-amber-600">{waitingCount}</p>
            <p className="text-[11px] text-amber-600/80 font-medium">In waiting lounge</p>
          </div>

          <div className="rounded-xl bg-purple-50/50 p-3.5 border border-purple-100">
            <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Paused</p>
            <p className="mt-1 font-mono text-2xl font-black text-purple-600">{pausedCount}</p>
            <p className="text-[11px] text-purple-600/80 font-medium">On temporary hold</p>
          </div>

          <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total in Line</p>
            <p className="mt-1 font-mono text-2xl font-black text-slate-800">{tokens.length}</p>
            <p className="text-[11px] text-slate-400 font-medium">Active queue</p>
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
          <p className="mt-3 text-sm font-bold text-slate-800">No patients in queue for {doctorName}</p>
          <p className="mt-1 text-xs text-slate-500">0 waiting • This doctor currently has no active tokens.</p>
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
                    ? 'border-emerald-500 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-white shadow-lg ring-2 ring-emerald-500/30'
                    : isPaused
                    ? 'border-purple-200 bg-purple-50/30 shadow-xs'
                    : 'border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left Token Details */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl font-mono font-black text-xl transition-all ${
                        isServing
                          ? 'bg-emerald-600 text-white shadow-emerald-500/30 shadow-lg scale-105'
                          : isPaused
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      <span>{token.token_number}</span>
                      <span className="text-[9px] font-sans font-bold uppercase tracking-wider opacity-80">
                        {isServing ? 'Serving' : isPaused ? 'Paused' : `#${index + 1}`}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-base">
                          {token.patient_name || (token.client_id ? `Patient (${token.client_id})` : 'Walk-in Patient')}
                        </span>

                        {/* Status Badge */}
                        {isServing && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-700 shadow-sm animate-pulse">
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
                        {token.client_id && (
                          <span className="font-mono text-slate-400">
                            Client: {token.client_id}
                          </span>
                        )}
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
                        title="Pause this token"
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
                        title="Resume token to Waiting"
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
