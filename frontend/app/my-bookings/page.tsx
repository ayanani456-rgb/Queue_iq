"use client";

import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Clock3, LoaderCircle, Phone, Ticket, XCircle } from 'lucide-react';
import Link from 'next/link';
import { CalendarActions } from '../../lib/calendar-actions';
import { supabase } from '../../lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://queueiq-backend-production.up.railway.app";
const DEFAULT_ORG_ID = 'bcb69e0a-b1e1-4f03-8184-1017d8e8e9eb';

// Demo backend has no per-user auth yet: bookings without a real 32-char client
// UUID are stored under this placeholder patient (see booking.controller.js), so
// this is the id we query to list them back. Replace with the logged-in user id
// once real auth is wired.
const CLIENT_ID = "00000000-0000-0000-0000-000000000123";

type Booking = {
  id?: string | number;
  token_id?: string | number;
  token_number?: string | number;
  token?: string | number;
  tokenNumber?: string | number;
  tokenNo?: string | number;
  yourToken?: string | number;
  voucherId?: string;
  organization_name?: string;
  organization?: { name?: string } | string;
  orgName?: string;
  category?: string;
  phone?: string;
  slot_time?: string;
  date?: string;
  time?: string;
  clinic_name?: string;
  doctor_name?: string;
  status?: string;
  payment_status?: string;
  paymentStatus?: string;
  payment?: string;
  salon?: string;
  service?: string;
  price?: number;
};

function getBookingId(booking: Booking) {
  return booking.voucherId ?? booking.token_id ?? booking.tokenNumber ?? booking.token ?? booking.id;
}

function getBookings(payload: unknown): Booking[] {
  if (Array.isArray(payload)) return payload as Booking[];
  if (!payload || typeof payload !== 'object') return [];

  const response = payload as { bookings?: unknown; tokens?: unknown; data?: unknown };
  if (Array.isArray(response.bookings)) return response.bookings as Booking[];
  if (Array.isArray(response.tokens)) return response.tokens as Booking[];
  if (Array.isArray(response.data)) return response.data as Booking[];
  return [];
}

function getCombinedLocalBookings(): Booking[] {
  if (typeof window === 'undefined') return [];
  const list1 = getBookings(JSON.parse(window.localStorage.getItem('myBookings') || '[]'));
  const list2 = getBookings(JSON.parse(window.localStorage.getItem('queueiq_my_bookings') || '[]'));
  
  const merged = [...list1, ...list2];
  const seen = new Set<string>();
  const unique: Booking[] = [];

  for (const b of merged) {
    const key = String(getBookingId(b) || `${b.orgName}-${b.date}-${b.token}`);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(b);
    }
  }
  return unique;
}

function formatDate(value?: string) {
  if (!value) return 'Date not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | number | null>(null);

  const loadBookings = async () => {
    setLoading(true);
    setError('');
    const localList = getCombinedLocalBookings();

    try {
      const myClientId = typeof window !== 'undefined' ? (window.localStorage.getItem('client_id') || 'client_123') : 'client_123';
      
      const { data: supaData, error: supaError } = await supabase
        .from('tokens')
        .select('*')
        .eq('client_id', myClientId)
        .eq('organization_id', DEFAULT_ORG_ID)
        .neq('status', 'Completed')
        .order('created_at', { ascending: true });

      let supaBookings: Booking[] = [];
      if (!supaError && supaData && supaData.length > 0) {
        supaBookings = supaData.map((t: any) => ({
          id: t.id || t.token_number,
          token: t.token_number || t.token,
          token_number: t.token_number,
          organization_name: 'Al-Shifa Clinic',
          orgName: 'Al-Shifa Clinic',
          doctor_name: 'Dr. Ayesha',
          clinic_name: 'Al-Shifa Clinic',
          category: 'Healthcare',
          status: t.status || 'Active',
          phone: t.phone || '',
          slot_time: t.slot_time || '02:00 PM',
          payment_status: 'Paid',
        }));
      }

      // Merge user's Supabase tokens and local bookings
      const seen = new Set<string>();
      const merged: Booking[] = [];

      for (const item of [...localList, ...supaBookings]) {
        const key = String(getBookingId(item) || `${item.orgName}-${item.date}-${item.token}`);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
      setBookings(merged);
    } catch (requestError) {
      console.warn('Using local bookings:', requestError);
      setBookings(localList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const localList = getCombinedLocalBookings();
    setBookings(localList);
    const timeoutId = window.setTimeout(() => void loadBookings(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const cancelBooking = async (booking: Booking) => {
    const bookingId = getBookingId(booking);
    if (bookingId === undefined || cancellingId !== null) return;
    if (!window.confirm('Cancel this booking?')) return;

    // Remove from local storage keys
    const remaining = bookings.filter((item) => getBookingId(item) !== bookingId);
    setBookings(remaining);
    try {
      window.localStorage.setItem('myBookings', JSON.stringify(remaining));
      window.localStorage.setItem('queueiq_my_bookings', JSON.stringify(remaining));
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }

    if (!booking.salon) {
      setCancellingId(bookingId);
      // Cancel by the backend token label (e.g. "T-109"), not the client-side
      // voucherId — the backend only knows tokens.
      const backendToken = booking.token ?? booking.tokenNumber ?? booking.token_number ?? bookingId;
      try {
        await fetch(`${BACKEND_URL}/api/bookings/${encodeURIComponent(String(backendToken))}/cancel`, {
          method: 'POST',
        });
      } catch (err) {
        console.warn('Backend cancellation offline:', err);
      } finally {
        setCancellingId(null);
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-4 py-10 text-[#111827] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] transition-colors duration-300 hover:text-[#10B981]">
          <ArrowLeft className="h-4 w-4" /> Back to QueueIQ
        </Link>
        <div className="mt-8 flex items-end justify-between gap-4 border-b border-[#E5E7EB] pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#10B981]">QueueIQ</p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#111827]">My bookings</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Manage your active tokens and appointments.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadBookings()}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-bold text-[#111827] shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-[#10B981] hover:bg-[#10B981] hover:text-white hover:shadow-lg"
          >
            Refresh
          </button>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm font-semibold text-[#EF4444]">{error}</div> : null}

        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-2.5 text-sm font-medium text-[#6B7280]"><LoaderCircle className="h-5 w-5 animate-spin text-[#10B981]" /> Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10B981]/10 text-2xl">🗂️</div>
            <p className="text-base font-bold text-[#111827]">You have no bookings yet.</p>
            <p className="mt-1 text-sm text-[#6B7280]">Book a token from the home page and it will appear here.</p>
            <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-5 py-2.5 text-sm font-bold text-[#111827] shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-[#0D9D6E] hover:shadow-lg">
              Browse Locations
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {bookings.map((booking, index) => {
              const bookingId = getBookingId(booking);
              const rawToken = booking?.token ?? booking?.tokenNumber ?? booking?.token_number ?? booking?.tokenNo ?? booking?.yourToken ?? booking?.id ?? '?';
              const token = String(rawToken).includes('-') ? String(rawToken) : (String(rawToken).startsWith('T-') ? String(rawToken) : `T-${rawToken}`);
              const orgName = typeof booking.organization === 'string' ? booking.organization : (booking.organization?.name ?? booking.organization_name ?? booking.orgName ?? booking.salon ?? 'QueueIQ booking');
              const appointmentDate = booking.date ?? booking.slot_time?.slice(0, 10) ?? 'Today';
              const appointmentTime = booking.time ?? booking.slot_time?.slice(11, 16);
              const status = booking.status ?? 'Active';
              const canCancel = ['cancelled', 'canceled', 'completed', 'done'].indexOf(status.toLowerCase()) === -1;
              const paymentStatus = booking.payment_status ?? booking.paymentStatus ?? (booking.payment === 'online' ? 'Paid' : 'Pending');

              return (
                <article
                  key={String(bookingId ?? index)}
                  className="group relative rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-[#10B981] hover:bg-[#10B981] hover:shadow-2xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-bold text-[#111827] transition-colors duration-300 group-hover:text-white">{orgName}</p>
                      {booking.service ? <p className="mt-1 text-sm font-medium text-[#4B5563] transition-colors duration-300 group-hover:text-white/90">{booking.service} {booking.price ? `· Rs. ${booking.price}` : ''}</p> : null}
                      <p className="mt-2 font-mono text-3xl font-extrabold text-[#10B981] transition-colors duration-300 group-hover:text-white">{token}</p>
                    </div>
                    <span className="rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-1 text-xs font-bold text-[#10B981] transition-colors duration-300 group-hover:border-white/40 group-hover:bg-white/20 group-hover:text-white">{status}</span>
                  </div>
                  <div className="mt-4 grid gap-2.5 text-sm text-[#4B5563] transition-colors duration-300 group-hover:text-white/90 sm:grid-cols-2">
                    <span className="flex items-center gap-2 font-medium"><Calendar className="h-4 w-4 text-[#10B981] transition-colors duration-300 group-hover:text-white" />{formatDate(appointmentDate)}</span>
                    {appointmentTime ? <span className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4 text-[#10B981] transition-colors duration-300 group-hover:text-white" />{appointmentTime}</span> : null}
                    {booking.phone ? <span className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4 text-[#10B981] transition-colors duration-300 group-hover:text-white" />{booking.phone}</span> : null}
                    {booking.category ? <span className="flex items-center gap-2 font-medium"><Ticket className="h-4 w-4 text-[#10B981] transition-colors duration-300 group-hover:text-white" />{booking.category}</span> : null}
                    {paymentStatus ? <span className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4 text-[#10B981] transition-colors duration-300 group-hover:text-white" />Payment: {paymentStatus}</span> : null}
                    {booking.voucherId ? <span className="flex items-center gap-2 font-mono text-xs font-medium"><Ticket className="h-4 w-4 text-[#10B981] transition-colors duration-300 group-hover:text-white" />Voucher: {booking.voucherId}</span> : null}
                  </div>
                  {canCancel ? <button type="button" disabled={cancellingId === bookingId} onClick={() => void cancelBooking(booking)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#EF4444] bg-white px-4 py-2 text-sm font-semibold text-[#EF4444] shadow-sm transition-all duration-300 ease-in-out hover:bg-[#EF4444] hover:text-white group-hover:border-white group-hover:bg-white group-hover:text-[#EF4444] group-hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"><XCircle className="h-4 w-4" />{cancellingId === bookingId ? 'Cancelling...' : 'Cancel booking'}</button> : null}
                  <CalendarActions clinicName={booking.clinic_name ?? orgName} date={appointmentDate} time={appointmentTime} token={token} />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}