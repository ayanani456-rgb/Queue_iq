"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  HeartPulse,
  Landmark,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  ShoppingBag,
  Smartphone,
  Scissors,
  Ticket,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { SALONS_DATA } from '@/app/data/salons';
import { categories } from '@/app/data/categories';
import UniversalCard from '@/app/components/common/UniversalCard';
import SearchAndFilter from '@/app/components/common/SearchAndFilter';
import ChatBotModal from '@/components/ChatBotModal';
import { CATEGORY_MAP, CLINICS, DOCTORS_BY_DEPT, CITY_DOCTORS_BY_DEPT } from '../../../lib/data';
import { supabase } from '../../../lib/supabase';
import DoctorQueue from '@/app/components/DoctorQueue';
import { CalendarActions } from '../../../lib/calendar-actions';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://queueiq-backend-production.up.railway.app";
const BACKEND_URL = API_URL;
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMERGENCY_TYPES = ['Chest Pain / Dil ka dard', 'Accident / Chot', 'High Fever', 'Breathing Issue', 'Uncontrolled Bleeding', 'Severe Pain', 'Other'];
const EMERGENCY_MAX = 3;
const EXPRESS_MAX = 10;
const DEMO_ALWAYS_OPEN = true;

function parseTimeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(mins: number) {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function googleCalendarLink(appointment: { clinicName: string; doctor: string; date: string; time: string; voucherId: string }) {
  const start = `${appointment.date.replace(/-/g, '')}T${appointment.time.replace(':', '')}00`;
  const endDate = new Date(`${appointment.date}T${appointment.time}`);
  endDate.setMinutes(endDate.getMinutes() + 30);
  const end = `${endDate.toISOString().replace(/[-:]/g, '').replace('.000', '')}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Appointment with ${appointment.doctor}`,
    dates: `${start}Z/${end}`,
    details: `Voucher ${appointment.voucherId}`,
    location: appointment.clinicName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function roundUpTo30(mins: number) {
  return Math.ceil(mins / 30) * 30;
}

function generateToken(orgCode: string, isFuture = false) {
  const prefix = isFuture ? 'F' : orgCode.charAt(0).toUpperCase();
  const num = Math.floor(100 + Math.random() * 899);
  return `${prefix}-${num}`;
}

function generateGenericToken(orgType: string, isFuture = false, orgName = '') {
  const nameLower = (orgName || '').toLowerCase();
  const typeLower = (orgType || '').toLowerCase();
  let prefix = 'T';

  if (nameLower.includes('nadra') || typeLower.includes('nadra') || typeLower === 'government') {
    prefix = 'N';
  } else if (nameLower.includes('salon') || typeLower.includes('salon') || typeLower === 'beauty' || typeLower === 'spa') {
    prefix = 'S';
  } else if (nameLower.includes('bank') || typeLower.includes('bank')) {
    prefix = 'B';
  } else if (nameLower.includes('lab') || typeLower.includes('lab') || nameLower.includes('diagnostic')) {
    prefix = 'L';
  } else if (nameLower.includes('hospital') || typeLower.includes('hospital')) {
    prefix = 'H';
  } else if (nameLower.includes('clinic') || typeLower.includes('clinic')) {
    prefix = 'C';
  }

  if (isFuture) prefix = 'F';
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

function tokenNum(label: string) {
  return parseInt(label.split('-')[1], 10) || 119;
}

function isValidPhone(code: string, raw: string) {
  const digits = (raw || '').replace(/\D/g, '');
  if (code === '+92') return /^03\d{9}$/.test(digits);
  return digits.length >= 8 && digits.length <= 15;
}

function computeClinicOpenStatus(clinic: any) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = parseTimeToMinutes(clinic.hours.open);
  const closeMin = parseTimeToMinutes(clinic.hours.close);
  const isOpen = DEMO_ALWAYS_OPEN || (nowMin >= openMin && nowMin < closeMin);
  return isOpen ? { open: true, text: `Open • Closes ${formatMinutes(closeMin)}` } : { open: false, text: `Closed • Opens Tomorrow ${formatMinutes(openMin)}` };
}

function findNextScheduledDay(schedule: any[]) {
  const today = new Date();
  const todayIdx = today.getDay();
  for (let i = 1; i <= 7; i++) {
    const idx = (todayIdx + i) % 7;
    const abbr = DAY_ABBR[idx];
    const block = schedule.find((b) => b.days.includes(abbr));
    if (block) {
      const label = i === 1 ? 'Tomorrow' : abbr;
      return { abbr, block, label: `${label} ${formatMinutes(parseTimeToMinutes(block.start))}` };
    }
  }
  return { label: 'later this week' };
}

function computeDoctorStatus(doctor: any, clinicOpen: boolean) {
  if (doctor.isDemo || doctor.name?.toLowerCase().includes('ayesha') || doctor.id === 'd1' || doctor.id === 'ayesha-1') {
    return {
      level: 'today-available',
      dot: 'green',
      canBookToday: true,
      text: 'Available Today (02:00 PM - 03:00 AM) • Live Queue Q-112'
    };
  }

  const now = new Date();
  const todayAbbr = DAY_ABBR[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const block = doctor.schedule?.find((b: any) => b.days?.includes(todayAbbr));

  if (block) {
    if (block.nextDayEnd || block.isDemo) {
      return {
        level: 'today-available',
        dot: 'green',
        canBookToday: true,
        text: 'Available Today (02:00 PM - 03:00 AM) • Live Queue Q-112'
      };
    }
    const startMin = parseTimeToMinutes(block.start);
    const endMin = parseTimeToMinutes(block.end);
    if (clinicOpen && nowMin < endMin) {
      const nextSlot = Math.max(startMin, roundUpTo30(nowMin));
      return { level: 'today-available', dot: 'green', canBookToday: true, text: `Available Today • Next: ${formatMinutes(nextSlot)}` };
    }
    const next = findNextScheduledDay(doctor.schedule);
    return { level: 'today-over', dot: 'yellow', canBookToday: false, text: `Slots over today • Next: ${next.label}` };
  }

  const next = findNextScheduledDay(doctor.schedule);
  return { level: 'not-today', dot: 'grey', canBookToday: false, text: `Not available today • Next: ${next.label}` };
}

function scheduleToText(schedule: any[]) {
  return schedule.map((b) => `${b.days.join(', ')} - ${formatMinutes(parseTimeToMinutes(b.start))} to ${formatMinutes(parseTimeToMinutes(b.end))}`).join(' | ');
}

function getClinicById(clinicId: string | undefined) {
  if (!clinicId) return CLINICS.alshifa;
  const cid = String(clinicId).toLowerCase();
  if (cid === 'citymedical' || cid.includes('city')) return CLINICS.citymedical;
  if (cid === 'alshifa' || cid.includes('shif')) return CLINICS.alshifa;
  return CLINICS[clinicId as keyof typeof CLINICS] || CLINICS.alshifa;
}

const categoryIcons = {
  Health: HeartPulse,
  Government: Landmark,
  Beauty: Scissors,
  Dining: UtensilsCrossed,
  Retail: ShoppingBag,
  Others: MoreHorizontal,
};

export default function HomePage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [view, setView] = useState<'user' | 'business'>('user');
  const [showSwitchOverlay, setShowSwitchOverlay] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<'user' | 'business' | null>(null);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [showBookingOverlay, setShowBookingOverlay] = useState(false);
  const [selectedSalon, setSelectedSalon] = useState<any>(null);
  const [selectedClinic, setSelectedClinic] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingState, setBookingState] = useState<any>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactTab, setContactTab] = useState<'patient' | 'business'>('patient');
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPassword, setBusinessPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bizError, setBizError] = useState('');
  const [currentBusiness, setCurrentBusiness] = useState<any>(null);
  // Role-based dashboard, driven live by the backend (per-doctor queues).
  const [bizDepartments, setBizDepartments] = useState<any[]>([]);
  const [bizDoctors, setBizDoctors] = useState<any[]>([]);
  const [bizDeptId, setBizDeptId] = useState<string | null>(null);
  const [bizDoctorId, setBizDoctorId] = useState<string | null>(null);
  const [bizQueue, setBizQueue] = useState<{ summary: any; tokens: any[] }>({ summary: {}, tokens: [] });
  const [bizConn, setBizConn] = useState(false);
  const [bizErr, setBizErr] = useState('');
  const [tokenSlotsUsed, setTokenSlotsUsed] = useState({ emergency: 2, express: 9 });
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingPhoneCode, setBookingPhoneCode] = useState('+92');
  const [bookingPhoneValid, setBookingPhoneValid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [liveTokenInterval, setLiveTokenInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [reservationInterval, setReservationInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', issue: '', message: '' });
  const [businessContactForm, setBusinessContactForm] = useState({ name: '', businessName: '', businessType: '', phone: '', email: '', city: '', volume: '', message: '' });
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('JazzCash');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [txnId, setTxnId] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);
   const [phoneInputFocused, setPhoneInputFocused] = useState(false);
  const showToast = (message: string) => setToast(message);

  const handleCompletePayment = () => {
    const selectedService = bookingState?.selectedService || (bookingState?.category ? { name: bookingState.category } : null);
    const selectedDate = bookingState?.selectedDate;
    const selectedTime = bookingState?.selectedTime;
    const existingBookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
    const existingQueueiq = JSON.parse(localStorage.getItem('queueiq_my_bookings') || '[]');
    const newBooking = {
      id: Date.now(),
      salon: selectedSalon?.name || 'Selected Salon',
      service: selectedService?.name || bookingState?.service || 'Haircut',
      price: selectedSalon?.price || bookingState?.price || 500,
      date: bookingState?.date || selectedDate || 'Today',
      time: bookingState?.time || selectedTime || '10:30 AM',
      status: 'Confirmed',
    };
    localStorage.setItem('myBookings', JSON.stringify([...existingBookings, newBooking]));
    localStorage.setItem('queueiq_my_bookings', JSON.stringify([...existingQueueiq, newBooking]));
    setPaymentSuccess(true);
    setTimeout(() => {
      setShowBookingOverlay(false);
      setShowBookingModal(false);
      setBookingState(null);
      router.push('/my-bookings');
    }, 1500);
  };

  const REAL_ORG_ID = "bcb69e0a-b1e1-4f03-8184-1017d8e6e9eb";

  const getApiHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Prefer the staff JWT issued by our backend (POST /api/auth/login); fall back
    // to a Supabase session token if one exists.
    let token: string | null = null;
    if (typeof window !== 'undefined') token = localStorage.getItem('queueiq_staff_token');
    if (!token) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || null;
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  // Emergency booking (Option B): book through the real /api/tokens/book endpoint
  // with tokenType:'emergency'. The backend runs the AI triage and holds the token
  // as PendingApproval for staff approval, returning { token, status, triage }.
  const bookEmergencyToken = async () => {
    setEmergencyLoading(true);
    try {
      // Resolve the doctor the patient picked so the emergency enters THAT doctor's
      // line on approval (per-doctor queues), not the generic no-doctor line.
      const deptDoctors = getDoctorsForDept(bookingState?.deptId);
      const doc = deptDoctors.find((d: any) => d.id === bookingState?.doctorId);
      const response = await fetch(`${API_URL}/api/tokens/book`, {
        method: 'POST',
        headers: await getApiHeaders(),
        body: JSON.stringify({
          phone: bookingPhone ? `${bookingPhoneCode} ${bookingPhone}` : bookingState?.phone || '',
          clientId: "00000000-0000-0000-0000-000000000123",
          doctorId: doc?.id,
          doctor: doc?.name,
          tokenType: 'emergency',
          emergencyType: bookingState?.emergencyType,
          description: bookingState?.emergencyDesc,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Status ${response.status}: ${text.slice(0, 200)}`);
      const result = JSON.parse(text);
      // The book response carries the AI triage — show it to the patient.
      if (result?.triage) setBookingState((current: any) => ({ ...current, emergencyResult: result.triage }));
      return result; // { token, status, triage }
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleRealBook = async (clinic: any, doc: any) => {
    const targetApiUrl = API_URL;
    showToast("Booking...");

    const phoneStr = bookingPhone ? `${bookingPhoneCode} ${bookingPhone}` : bookingState?.phone || '';
    const clinicName = clinic?.name || selectedClinic?.name || 'Clinic';
    const doctorName = doc?.name || 'Doctor';
    const randomNum = Math.floor(100 + Math.random() * 900);
    const defaultToken = `Q-${randomNum}`;
    const defaultVoucherId = `Q-${randomNum}-${Date.now().toString().slice(-4)}`;

    let realToken = defaultToken;
    let voucherId = defaultVoucherId;
    let queuePosition = (randomNum % 15) + 1;
    let bookingData: any = null;

    try {
      const payload = {
        user_id: "00000000-0000-0000-0000-000000000123",
        organization_id: REAL_ORG_ID,
        clientId: bookingState?.clientId || bookingState?.clinicId || clinic?.id,
        // Send the chosen doctor so the token joins THAT doctor's line (per-doctor
        // queues). The backend validates the UUID and falls back to the generic
        // line if it's missing/malformed (e.g. offline mock doctor ids).
        doctor_id: doc?.id,
        doctor: doc?.name,
        phone: phoneStr,
        slot_time: new Date().toISOString(),
        tokenType: bookingState?.tokenType || "normal",
      };
      console.log("BOOK PAYLOAD:", payload);
      console.log("Booking to:", `${targetApiUrl}/api/tokens/book`);

      const res = await fetch(`${targetApiUrl}/api/tokens/book`, {
        method: 'POST',
        headers: await getApiHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const responseText = await res.text();
        try {
          bookingData = JSON.parse(responseText);
          const myToken = bookingData.tokenNumber ?? bookingData.token ?? bookingData.tokenNo ?? bookingData.token_number ?? bookingData.token_id ?? bookingData.id ?? bookingData.number ?? bookingData.queue_position;
          if (myToken !== undefined && myToken !== null) {
            realToken = String(myToken).startsWith('Q-') || String(myToken).startsWith('T-') ? String(myToken) : `Q-${myToken}`;
          }
          voucherId = bookingData.voucherId || bookingData.bookingId || bookingData.appointmentId || bookingData.receiptId || bookingData.reference || bookingData.id || bookingData._id || bookingData.booking_id || bookingData.appointment_id || bookingData.receipt_id || bookingData.voucher_id || `Q-${String(realToken).replace(/[^0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
          queuePosition = bookingData.queue_position ?? bookingData.position ?? queuePosition;
        } catch {
          console.warn("Server returned non-JSON response, using mock token");
        }
      } else {
        console.warn(`Booking endpoint returned status ${res.status}, using mock token`);
      }
    } catch (e: any) {
      console.warn("Backend fetch failed, falling back to offline mock token:", e);
    }

    const voucher = {
      id: Date.now(),
      voucherId,
      bookingId: bookingData?.booking_id ?? bookingData?.bookingId ?? voucherId,
      yourToken: realToken,
      token: realToken,
      tokenNumber: realToken,
      currentTokenNum: Math.max(0, queuePosition - 3),
      yourTokenNum: queuePosition,
      peopleAhead: Math.max(0, queuePosition - 1),
      etaMin: bookingData?.etaMin ?? queuePosition * 5,
      etaMax: bookingData?.etaMax ?? queuePosition * 5 + 10,
      paymentStatus: 'paid',
      tokenType: bookingState?.tokenType || 'normal',
      phone: phoneStr,
      salon: clinicName,
      orgName: clinicName,
      service: doctorName,
      category: doctorName,
      doctor: doctorName,
      doctor_name: doctorName,
      clinic_name: clinicName,
      price: bookingState?.tokenType === 'express' ? 1200 : 800,
      date: 'Today',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Confirmed',
    };

    // Update state
    const nextBookings = [...myBookings, voucher];
    setMyBookings(nextBookings);
    setPaymentSuccess(true);
    showToast(`Ho gaya! Token ${realToken} Position: ${queuePosition}`);

    // Save to both localStorage keys
    if (typeof window !== 'undefined') {
      try {
        const existingMyBookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
        localStorage.setItem('myBookings', JSON.stringify([...existingMyBookings, voucher]));
      } catch (err) {
        console.error('Error saving to myBookings:', err);
      }
      try {
        const existingQueueiq = JSON.parse(localStorage.getItem('queueiq_my_bookings') || '[]');
        localStorage.setItem('queueiq_my_bookings', JSON.stringify([...existingQueueiq, voucher]));
      } catch (err) {
        console.error('Error saving to queueiq_my_bookings:', err);
      }
    }

    // Close modal after success
    setTimeout(() => {
      setShowBookingOverlay(false);
      setShowBookingModal(false);
      setBookingState(null);
      setPaymentSuccess(false);
    }, 1500);
  };

  const handleGenericBookSuccess = async (paymentType: 'online' | 'reception', customTxnId?: string) => {
    const org = bookingState?.org || {};
    const token = generateGenericToken(org.type, org.status === 'closed', org.name);
    const randomNum = Math.floor(100 + Math.random() * 900);
    const voucherId = `Q-${randomNum}-${Date.now().toString().slice(-4)}`;
    const dateStr = formatDateLabel(bookingState?.date || new Date());
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const phoneStr = bookingState?.phone || (bookingPhone ? `${bookingPhoneCode} ${bookingPhone}` : '');
    const usedTxnId = customTxnId || (paymentType === 'online' ? (txnId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`) : null);

    console.log("handleGenericBookSuccess invoked:", { paymentType, org, token, phoneStr, method: paymentMethod });

    if (paymentType === 'online') {
      try {
        const res = await fetch('/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: org.id || org.clinicId || 'org-1',
            organization_type: org.type || 'service',
            amount: org.price ?? 1500,
            token: token,
            phone: phoneStr,
            method: paymentMethod || 'JazzCash'
          })
        });
        const data = await res.json().catch(() => ({}));
        console.log("Payment create API response:", data);
        showToast(`Payment initiated! Token ${token}`);
      } catch (err) {
        console.error("Payment API call error:", err);
        showToast(`Token ${token} booked successfully!`);
      }
    } else {
      showToast(`Token ${token} booked! Pay at counter / reception`);
    }

    const record = {
      id: Date.now(),
      token: token,
      tokenNumber: token,
      token_number: token,
      yourToken: token,
      voucherId: voucherId,
      organization: org.name || 'Service',
      organization_name: org.name || 'Service',
      orgName: org.name || 'Service',
      salon: org.name || 'Service',
      service: bookingState?.category || 'Service',
      category: bookingState?.category || 'Service',
      price: org.price ?? 1500,
      phone: phoneStr,
      status: 'active',
      payment: paymentType,
      payment_status: paymentType === 'online' ? 'paid' : 'pending',
      paymentStatus: paymentType === 'online' ? 'Paid' : 'Pending',
      txnId: usedTxnId,
      method: paymentType === 'online' ? (paymentMethod || 'Online') : 'Reception',
      date: dateStr,
      time: timeStr,
      createdAt: new Date().toISOString(),
    };

    setMyBookings((prev) => [...prev, record]);
    setBookingState((prev: any) => ({ ...prev, genericRecord: record, step: 'g-confirm' }));

    if (typeof window !== 'undefined') {
      try {
        const existingMyBookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
        localStorage.setItem('myBookings', JSON.stringify([...existingMyBookings, record]));
      } catch (err) {
        console.error('Error saving to myBookings:', err);
      }
      try {
        const existingQueueiq = JSON.parse(localStorage.getItem('queueiq_my_bookings') || '[]');
        localStorage.setItem('queueiq_my_bookings', JSON.stringify([...existingQueueiq, record]));
      } catch (err) {
        console.error('Error saving to queueiq_my_bookings:', err);
      }
    }
  };



    const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filteredData = SALONS_DATA.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase() ||
        item.type?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
    const arr = [...filteredData];
    if (sortBy === 'rating') arr.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'distance') arr.sort((a, b) => a.distance - b.distance);
    if (sortBy === 'wait') arr.sort((a, b) => (a.wait ?? Infinity) - (b.wait ?? Infinity));
    return arr;
  }, [searchQuery, selectedCategory, sortBy]);

  const [realDoctorsByDept, setRealDoctorsByDept] = useState<any>(DOCTORS_BY_DEPT)

  const getDoctorsForDept = (deptId: string | undefined, clinicId?: string) => {
    const targetClinic = (clinicId || bookingState?.clinicId || bookingState?.org?.clinicId || bookingState?.org?.name || '').toString().toLowerCase();
    const isCity = targetClinic === 'citymedical' || targetClinic.includes('city medical');
    const source = isCity ? CITY_DOCTORS_BY_DEPT : realDoctorsByDept;

    if (deptId === 'all') {
      const seen = new Set<string>();
      return Object.values(source).flat().filter((doctor: any) => {
        const key = doctor.name || doctor.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return source[deptId as keyof typeof DOCTORS_BY_DEPT] || [];
  };

  useEffect(() => {
    async function loadRealDoctors() {
      const { data } = await supabase.from('doctors').select('*')
      console.log("DOCTORS FROM SUPABASE:", data)
      if (data && data.length > 0) {
        const grouped: any = {...DOCTORS_BY_DEPT}
        data.forEach((doc: any) => {
          const specialty = (doc.specialty || doc.department || '').toLowerCase();
          const deptId = specialty.includes('cardio') ? 'cardio'
            : specialty.includes('derma') ? 'derma'
            : specialty.includes('dent') ? 'dentist'
            : specialty.includes('neuro') ? 'neuro'
            : specialty.includes('ortho') ? 'ortho'
            : 'gp';
          if(!grouped[deptId].find((d:any)=>d.name === doc.name)){
            grouped[deptId].push({
              id: doc.id,
              name: doc.name,
              specialty: doc.specialty || 'GP',
              experience: doc.experience || 5,
              rating: 4.5,
              reviews: 10,
              fee: doc.fee || 1000,
              schedule: [{ days: ['Mon','Tue','Wed','Thu','Fri'], start: '09:00', end: '17:00' }]
            })
          }
        })
        setRealDoctorsByDept(grouped)
      }
    }
    loadRealDoctors()
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('queueiq_my_bookings');
    if (saved) setMyBookings(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('queueiq_my_bookings', JSON.stringify(myBookings));
  }, [myBookings]);

  // When a staff member logs in, load the doctors/departments they manage.
  useEffect(() => {
    if (currentBusiness) loadBizRoster(currentBusiness);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness]);

  // Live queue: refetch the selected doctor's line every 2.5s while on the panel.
  useEffect(() => {
    if (view !== 'business' || !currentBusiness || !bizDoctorId) return;
    loadBizQueue(bizDoctorId);
    const id = setInterval(() => loadBizQueue(bizDoctorId), 2500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentBusiness, bizDoctorId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (liveTokenInterval) clearInterval(liveTokenInterval);
      if (reservationInterval) clearInterval(reservationInterval);
    };
  }, [liveTokenInterval, reservationInterval]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSearchOverlay) closeSearch();
        else if (showBookingOverlay) closeBooking();
        else if (showContactModal) setShowContactModal(false);
        else if (showMyBookings) setShowMyBookings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchOverlay, showBookingOverlay, showContactModal, showMyBookings]);

  const closeAllOverlays = () => {
    setShowSearchOverlay(false);
    setShowBookingOverlay(false);
    setShowContactModal(false);
    setShowMyBookings(false);
  };

  const openSearch = (query = '') => {
    setSearchQuery(query);
    closeAllOverlays();
    setShowSearchOverlay(true);
    setTimeout(() => {
      const el = document.getElementById('overlaySearchInput');
      if (el) (el as HTMLInputElement).focus();
    }, 150);
  };

  const closeSearch = () => {
    closeAllOverlays();
  };

  const openBooking = (org: any) => {
    closeAllOverlays();
    setSelectedSalon(org);
    setSelectedClinic(org);
    setPaymentSuccess(false);
    setShowBookingOverlay(true);
    setShowBookingModal(true);

    const orgType = (org.type || '').toLowerCase();
    const orgCat = (org.category || '').toLowerCase();
    const orgName = (org.name || '').toLowerCase();

    const isClinicOrHospital =
      Boolean(org.clinicId) ||
      orgType === 'clinic' ||
      orgType === 'hospital' ||
      orgCat === 'clinic' ||
      orgCat === 'hospital' ||
      orgName.includes('clinic') ||
      orgName.includes('medical') ||
      orgName.includes('shifa');

    const clinicId = org.clinicId || (orgName.includes('city') ? 'citymedical' : 'alshifa');

    setBookingState({
      flow: isClinicOrHospital ? 'clinic' : 'generic',
      org,
      clinicId: isClinicOrHospital ? clinicId : null,
      deptId: isClinicOrHospital ? 'all' : undefined,
      step: isClinicOrHospital ? 'clinic-detail' : (org.status === 'closed' ? 'g-date' : 'g-category')
    });
    setBookingPhone('');
    setBookingPhoneCode('+92');
    setBookingPhoneValid(false);
  };

  const closeBooking = () => {
    if (liveTokenInterval) clearInterval(liveTokenInterval);
    if (reservationInterval) clearInterval(reservationInterval);
    closeAllOverlays();
    setShowBookingModal(false);
    setSelectedSalon(null);
    setSelectedClinic(null);
    setBookingState(null);
    setPaymentSuccess(false);
    setBookingPhone('');
    setBookingPhoneValid(false);
  };

 
  const openMyBookings = () => {
    window.location.href = '/my-bookings';
  };

  const closeMyBookings = () => setShowMyBookings(false);

  const switchToBusiness = () => {
    setIsSwitching(true);
    setSwitchTarget('business');
    setShowSwitchOverlay(true);
    setMobileMenuOpen(false);
    setTimeout(() => {
      setView('business');
      setShowSwitchOverlay(false);
      setIsSwitching(false);
      setSwitchTarget(null);
      showToast('Switching to business view');
    }, 700);
  };

  const switchToUser = () => {
    setIsSwitching(true);
    setSwitchTarget('user');
    setShowSwitchOverlay(true);
    setTimeout(() => {
      setView('user');
      setShowSwitchOverlay(false);
      setIsSwitching(false);
      setSwitchTarget(null);
      showToast('Back to QueueIQ');
    }, 700);
  };

  // Log in against backend / Supabase demo staff
  const businessLogin = async () => {
    const email = businessEmail.trim().toLowerCase();
    if (!email || !businessPassword) {
      setBizError('Enter email and password.');
      return;
    }
    setBizError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: businessPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token && data.user) {
        if (typeof window !== 'undefined') localStorage.setItem('queueiq_staff_token', data.token);
        setShowContactModal(false);
        setCurrentBusiness(data.user);
        return;
      }
    } catch (err) {
      console.warn('Backend staff login connecting locally:', err);
    }

    // Direct fallback for demo accounts with password '123456'
    if (businessPassword === '123456') {
      if (email === 'owner@alshifa.com' || email === 'admin@alshifa.com') {
        const user = {
          email,
          role: 'owner',
          displayName: email === 'owner@alshifa.com' ? 'Al-Shifa Owner' : 'System Admin',
          orgId: REAL_ORG_ID,
          orgSlug: 'alshifa',
        };
        setCurrentBusiness(user);
        setShowContactModal(false);
        return;
      }
      if (email === 'reception.cardio@alshifa.com' || email === 'reception@alshifa.com') {
        const user = {
          email,
          role: 'receptionist',
          departmentId: '5ac8026b-d915-4397-87cc-7dfdef2aad28',
          departmentName: 'Cardiology',
          displayName: 'Cardiology Receptionist',
          orgId: REAL_ORG_ID,
          orgSlug: 'alshifa',
        };
        setCurrentBusiness(user);
        setShowContactModal(false);
        return;
      }
      if (email === 'dr.ayesha@alshifa.com') {
        const user = {
          email,
          role: 'doctor',
          doctorId: '024f24eb-a440-4079-acb3-ad8cffe85015',
          doctorName: 'Dr. Ayesha',
          departmentId: '5ac8026b-d915-4397-87cc-7dfdef2aad28',
          displayName: 'Dr. Ayesha Khan',
          orgId: REAL_ORG_ID,
          orgSlug: 'alshifa',
        };
        setCurrentBusiness(user);
        setShowContactModal(false);
        return;
      }
    }

    setBizError('Invalid email or password.');
  };

  const bizLogout = () => {
    setCurrentBusiness(null);
    setBusinessEmail('');
    setBusinessPassword('');
    setBizError('');
    setBizDepartments([]);
    setBizDoctors([]);
    setBizDeptId(null);
    setBizDoctorId(null);
    setBizQueue({ summary: {}, tokens: [] });
    setBizConn(false);
    if (typeof window !== 'undefined') localStorage.removeItem('queueiq_staff_token');
  };

  // Load the doctors/departments this role manages (from Supabase, like the test
  // harness): doctor -> just self; receptionist -> their department; owner -> all.
  const loadBizRoster = async (user: any) => {
    setBizErr('');
    if (user?.role === 'doctor') {
      setBizDepartments([]);
      setBizDoctors([{ id: user.doctorId, name: user.doctorName || 'My line', department_id: user.departmentId }]);
      setBizDeptId(user.departmentId || null);
      setBizDoctorId(user.doctorId || null);
      return;
    }
    // login() returns org_slug (not organization_id) — resolve the id from it,
    // falling back to the configured org so a single-clinic demo still works.
    let orgId = user?.orgId || null;
    if (!orgId && user?.orgSlug) {
      try {
        const { data } = await supabase.from('organizations').select('id').eq('slug', user.orgSlug).maybeSingle();
        orgId = data?.id || null;
      } catch (e) { /* fall back below */ }
    }
    if (!orgId) orgId = REAL_ORG_ID;
    try {
      const { data: depts } = await supabase.from('departments').select('id,name,icon').eq('organization_id', orgId).order('name');
      let docQuery = supabase.from('doctors').select('id,name,department_id,specialty,fee,experience,bio,schedule').eq('organization_id', orgId).order('name');
      if (user?.role === 'receptionist' && user?.departmentId) docQuery = docQuery.eq('department_id', user.departmentId);
      const { data: docs } = await docQuery;
      const deptList = depts || [];
      const docList = docs || [];
      setBizDepartments(deptList);
      setBizDoctors(docList);
      const defaultDept = user?.role === 'receptionist' ? (user.departmentId || null) : (deptList[0]?.id || null);
      setBizDeptId(defaultDept);
      const firstDoc = docList.find((d: any) => !defaultDept || d.department_id === defaultDept) || docList[0];
      setBizDoctorId(firstDoc ? firstDoc.id : null);
    } catch (e) {
      setBizErr('Could not load doctors from the catalog.');
    }
  };

  // Fetch one doctor's live queue from the backend (auth-protected).
  const loadBizQueue = async (doctorId: string | null) => {
    if (!doctorId) { setBizQueue({ summary: {}, tokens: [] }); return; }
    try {
      const res = await fetch(`${API_URL}/api/business/tokens?doctorId=${encodeURIComponent(doctorId)}`, { headers: await getApiHeaders() });
      if (!res.ok) { setBizConn(false); return; }
      const d = await res.json();
      setBizQueue({ summary: d.summary || {}, tokens: d.tokens || [] });
      setBizConn(true);
    } catch (e) {
      setBizConn(false);
    }
  };

  const bizCallNext = async () => {
    try {
      const res = await fetch(`${API_URL}/api/business/call-next`, {
        method: 'POST', headers: await getApiHeaders(), body: JSON.stringify({ doctorId: bizDoctorId }),
      });
      const d = await res.json();
      showToast(d.message || 'Called next');
      loadBizQueue(bizDoctorId);
    } catch (e) { showToast('Cannot reach backend'); }
  };

  const bizComplete = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/business/complete`, {
        method: 'POST', headers: await getApiHeaders(), body: JSON.stringify({ token }),
      });
      const d = await res.json();
      showToast(d.message || 'Completed');
      try {
        await supabase.from('tokens').update({ status: 'Completed' }).eq('token_number', token);
      } catch (e) { /* ignore */ }
      loadBizQueue(bizDoctorId);
    } catch (e) { showToast('Cannot reach backend'); }
  };

  const bizPause = async (token: string) => {
    try {
      await supabase.from('tokens').update({ status: 'Paused' }).eq('token_number', token);
      showToast(`Token ${token} paused`);
      loadBizQueue(bizDoctorId);
    } catch (e) {
      showToast('Cannot update token status');
    }
  };

  const bizResume = async (token: string) => {
    try {
      await supabase.from('tokens').update({ status: 'Waiting' }).eq('token_number', token);
      showToast(`Token ${token} resumed to Waiting`);
      loadBizQueue(bizDoctorId);
    } catch (e) {
      showToast('Cannot update token status');
    }
  };

  const bizApproveEmergency = async (token: string, decision: 'approve' | 'reject') => {
    try {
      const res = await fetch(`${API_URL}/api/business/approve-emergency`, {
        method: 'POST', headers: await getApiHeaders(), body: JSON.stringify({ token, decision }),
      });
      const d = await res.json();
      if (!res.ok) { showToast('Error: ' + (d.error || res.status)); return; }
      showToast(d.message || decision);
      if (d.note) setTimeout(() => showToast(d.note), 950);
      loadBizQueue(bizDoctorId);
    } catch (e) { showToast('Cannot reach backend'); }
  };

  const pickBizDept = (deptId: string) => {
    setBizDeptId(deptId);
    const firstDoc = bizDoctors.find((d: any) => d.department_id === deptId);
    setBizDoctorId(firstDoc ? firstDoc.id : null);
  };

  const renderClinicDetail = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const status = computeClinicOpenStatus(clinic);
    return (
      <div>
        <h2 className="text-xl font-bold text-white">{clinic.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#9CA3AF]">
          <span className="inline-flex items-center gap-1 text-[#F59E0B]">⭐ {clinic.rating}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{clinic.distance} km away</span>
        </div>
        <p className="mt-1 text-sm text-[#9CA3AF]">{clinic.address}</p>
        <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${status.open ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]' : 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.open ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />{status.text}
        </span>
        <p className="mt-6 text-sm font-medium text-white">Departments</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setBookingState({ ...bookingState, deptId: 'all', step: 'doctor-list', doctorListLoaded: false }); }} className="cat-btn col-span-2 flex flex-col items-start gap-1 rounded-xl px-4 py-3 text-left">
            <span className="text-xl">👩‍⚕️</span>
            <span className="text-sm font-medium text-white">All Doctors</span>
            <span className="text-xs text-[#9CA3AF]">Browse every doctor</span>
          </button>
          {clinic.departments.map((d: any) => (
            <button key={d.id} type="button" onClick={() => { setBookingState({ ...bookingState, deptId: d.id, step: 'doctor-list', doctorListLoaded: false }); }} className="cat-btn flex flex-col items-start gap-1 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">{d.icon}</span>
              <span className="text-sm font-medium text-white">{d.name}</span>
              <span className="text-xs text-[#9CA3AF]">{d.count} doctors</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderDoctorList = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const status = computeClinicOpenStatus(clinic);
    const dept = clinic.departments.find((d: any) => d.id === bookingState.deptId);
    const deptDoctors = getDoctorsForDept(bookingState.deptId);
    let doctors = deptDoctors.map((doc: any) => ({ doc, status: computeDoctorStatus(doc, status.open) }));
    if (bookingState.doctorSearch) {
      const q = bookingState.doctorSearch.toLowerCase();
      doctors = doctors.filter((x: any) => x.doc.name.toLowerCase().includes(q));
    }
    const rank: Record<string, number> = { 'today-available': 0, 'today-over': 1, 'not-today': 2 };
    if (bookingState.doctorSort === 'today') doctors.sort((a: any, b: any) => rank[a.status.level] - rank[b.status.level]);
    if (bookingState.doctorSort === 'rating') doctors.sort((a: any, b: any) => b.doc.rating - a.doc.rating);
    if (bookingState.doctorSort === 'experience') doctors.sort((a: any, b: any) => b.doc.experience - a.doc.experience);
    return (
      <div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input id="doctorSearchInput" value={bookingState.doctorSearch || ''} onChange={(e) => setBookingState({ ...bookingState, doctorSearch: e.target.value })} placeholder="Search doctor by name..." className="w-full rounded-lg border border-[#374151] bg-[#111827] py-2 pl-9 pr-3 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" />
          </div>
          <select id="doctorSortSelect" value={bookingState.doctorSort || 'today'} onChange={(e) => setBookingState({ ...bookingState, doctorSort: e.target.value })} className="rounded-lg border border-[#374151] bg-[#111827] py-2 px-2 text-xs text-white focus:border-[#10B981] focus:outline-none">
            <option value="today">Available Today First</option>
            <option value="rating">Rating</option>
            <option value="experience">Experience</option>
          </select>
        </div>
        <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-2">
          {doctors.map(({ doc, status }: any) => (
            <div key={doc.id} className="rounded-xl border border-[#374151] bg-[#111827] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{doc.name}</p>
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">{doc.specialty} | {doc.experience} years exp | ⭐ {doc.rating} ({doc.reviews} reviews)</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-white">Rs. {doc.fee}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#9CA3AF]">{scheduleToText(doc.schedule)}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#10B981]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />{status.text}
              </div>
              <button
                type="button"
                onClick={() => setBookingState({ ...bookingState, doctorId: doc.id, step: status.canBookToday ? 'token-type' : 'future-date' })}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:bg-[#0D9D6E] hover:shadow-xl"
              >
                <Calendar className="h-4 w-4" />
                Book Your Appointment
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFutureAppointment = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const deptDoctors = getDoctorsForDept(bookingState.deptId);
    const doc = deptDoctors.find((d: any) => d.id === bookingState.doctorId);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    const minDateValue = minDate.toISOString().split('T')[0];
    const selectedDate = bookingState.futureDate || minDateValue;
    const selectedTime = bookingState.futureTime || '09:00';
    const futurePhone = bookingState.futurePhone || '';
    const phoneIsValid = isValidPhone('+92', futurePhone);
    return (
      <div>
        <p className="text-sm text-[#9CA3AF]">{doc?.name} — Future Appointment</p>
        <div className="mt-4 rounded-xl border border-[#374151] bg-[#111827] p-4">
          <label className="block text-sm font-medium text-white">Select a preferred date and time</label>
          <input
            type="date"
            min={minDateValue}
            value={selectedDate}
            onChange={(e) => setBookingState({ ...bookingState, futureDate: e.target.value })}
            className="mt-2 w-full rounded-lg border border-[#374151] bg-[#1F2937] px-3 py-2.5 text-sm text-white focus:border-[#10B981] focus:outline-none"
          />
          <input
            type="time"
            value={selectedTime}
            onChange={(e) => setBookingState({ ...bookingState, futureTime: e.target.value })}
            className="mt-2 w-full rounded-lg border border-[#374151] bg-[#1F2937] px-3 py-2.5 text-sm text-white focus:border-[#10B981] focus:outline-none"
          />
          <label className="mt-3 block text-sm font-medium text-white">Phone Number *</label>
          <input
            type="tel"
            placeholder="03XX-XXXXXXX"
            value={futurePhone}
            onChange={(e) => setBookingState({ ...bookingState, futurePhone: e.target.value })}
            className="mt-2 w-full rounded-lg border border-[#374151] bg-[#1F2937] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none"
          />
          <label className="mt-3 block text-sm font-medium text-white">Reason for visit <span className="font-normal text-[#9CA3AF]">(optional)</span></label>
          <textarea
            rows={2}
            value={bookingState.futureReason || ''}
            onChange={(e) => setBookingState({ ...bookingState, futureReason: e.target.value })}
            className="mt-2 w-full rounded-lg border border-[#374151] bg-[#1F2937] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none"
            placeholder="What would you like help with?"
          />
        </div>
        <div className="mt-4 rounded-xl border border-[#374151] bg-[#111827] p-4 text-sm text-[#9CA3AF]">
          <p className="font-medium text-white">{clinic.name}</p>
          <p className="mt-1">Your request will be saved for {doc?.name} on {selectedDate} at {selectedTime}.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!phoneIsValid) {
              showToast('Please enter a valid Pakistani phone number.');
              return;
            }
            const randomNum = Math.floor(100 + Math.random() * 900);
            const voucherId = `V-${Date.now().toString().slice(-3)}-${randomNum}`;
            const token = generateToken(clinic.orgCode, true);
            const futureBooking = {
              id: Date.now(),
              voucherId,
              bookingId: voucherId,
              yourToken: token,
              token: token,
              tokenNumber: token,
              organization: clinic.name,
              organization_name: clinic.name,
              orgName: clinic.name,
              salon: clinic.name,
              service: doc?.name || 'Doctor',
              category: doc?.name || 'Doctor',
              doctor: doc?.name,
              doctor_name: doc?.name,
              clinic_name: clinic.name,
              phone: futurePhone,
              reason: bookingState.futureReason || '',
              date: selectedDate,
              time: selectedTime,
              paymentStatus: 'Pending',
              tokenType: 'future',
              status: 'Confirmed',
              createdAt: new Date().toISOString(),
            };
            const savedAppointment = { date: selectedDate, time: selectedTime, doctor: doc?.name || 'Doctor', phone: futurePhone, voucherId, paid: false };
            if (typeof window !== 'undefined') {
              localStorage.setItem(`future_${voucherId}`, JSON.stringify(savedAppointment));
              try {
                const existingMy = JSON.parse(localStorage.getItem('myBookings') || '[]');
                localStorage.setItem('myBookings', JSON.stringify([...existingMy, futureBooking]));
              } catch (e) {
                console.error('Error saving myBookings:', e);
              }
              try {
                const existingQ = JSON.parse(localStorage.getItem('queueiq_my_bookings') || '[]');
                localStorage.setItem('queueiq_my_bookings', JSON.stringify([...existingQ, futureBooking]));
              } catch (e) {
                console.error('Error saving queueiq_my_bookings:', e);
              }
            }
            setMyBookings([...myBookings, futureBooking]);
            setBookingState({ ...bookingState, futureBooking, futureWhatsApp: { ...savedAppointment, clinicName: clinic.name }, step: 'future-whatsapp' });
            showToast(`WhatsApp sent to ${futurePhone}`);
          }}
          className="mt-5 w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90"
        >
          Confirm Future Appointment
        </button>
      </div>
    );
  };

  const renderTokenType = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const deptDoctors = getDoctorsForDept(bookingState.deptId);
    const doc = deptDoctors.find((d: any) => d.id === bookingState.doctorId);
    const emergencyFull = tokenSlotsUsed.emergency >= EMERGENCY_MAX;
    const expressFull = tokenSlotsUsed.express >= EXPRESS_MAX;
    return (
      <div>
        <p className="text-sm text-[#9CA3AF]">{doc?.name} — {doc?.specialty}</p>
        <div className="mt-4 space-y-3">
          <button type="button" onClick={() => { setBookingState({ ...bookingState, tokenType: 'normal', step: 'contact-voucher' }); setBookingPhone(''); setBookingPhoneValid(false); }} className="token-card w-full rounded-xl p-4 text-left">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">Normal Token</p>
              <p className="text-sm font-bold text-[#10B981]">Rs. 800</p>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">Regular queue • Avg 40 min wait • Your token: {generateToken(clinic.orgCode, false)}</p>
          </button>
          <button type="button" disabled={expressFull} onClick={() => { setBookingState({ ...bookingState, tokenType: 'express', step: 'contact-voucher' }); setBookingPhone(''); setBookingPhoneValid(false); }} className={`token-card w-full rounded-xl p-4 text-left ${expressFull ? 'disabled' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold text-white">Express Token <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${expressFull ? 'bg-[#374151] text-[#9CA3AF]' : 'bg-[#10B981]/15 text-[#10B981]'}`}>{expressFull ? `FULL (${tokenSlotsUsed.express}/${EXPRESS_MAX})` : '2x FASTER'}</span></p>
              <p className="text-sm font-bold text-[#10B981]">Rs. 1200</p>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">Skip 50% of queue • Avg 15 min wait • Limited {EXPRESS_MAX}/day</p>
          </button>
          <button type="button" disabled={emergencyFull} onClick={() => { setBookingState({ ...bookingState, tokenType: 'emergency', step: 'emergency-form' }); setBookingPhone(''); setBookingPhoneValid(false); }} className={`token-card emergency w-full rounded-xl p-4 text-left ${emergencyFull ? 'disabled' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold text-white">Emergency Token <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${emergencyFull ? 'bg-[#374151] text-[#9CA3AF]' : 'bg-[#EF4444]/15 text-[#EF4444]'}`}>{emergencyFull ? `FULL (${tokenSlotsUsed.emergency}/${EMERGENCY_MAX})` : `PRIORITY • LIMITED ${EMERGENCY_MAX}/DAY`}</span></p>
              <p className="text-sm font-bold text-[#EF4444]">Rs. 1800</p>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">Immediate • Verification required</p>
          </button>
        </div>
      </div>
    );
  };

  const renderEmergencyForm = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const deptDoctors = getDoctorsForDept(bookingState.deptId);
    const doc = deptDoctors.find((d: any) => d.id === bookingState.doctorId);
    return (
      <div>
        <p className="text-sm text-[#9CA3AF]">{doc?.name} — {doc?.specialty}</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white">Emergency Type *</label>
            <select value={bookingState.emergencyType || ''} onChange={(e) => setBookingState({ ...bookingState, emergencyType: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white focus:border-[#10B981] focus:outline-none">
              <option value="">Select type...</option>
              {EMERGENCY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Describe emergency reason in detail *</label>
            <textarea rows={3} value={bookingState.emergencyDesc || ''} onChange={(e) => setBookingState({ ...bookingState, emergencyDesc: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" placeholder="e.g. Patient has severe chest pain for 2 hours, BP 180/110" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">WhatsApp Number *</label>
            <div className="mt-1.5 flex gap-2">
              <select value={bookingPhoneCode} onChange={(e) => setBookingPhoneCode(e.target.value)} className="rounded-lg border border-[#374151] bg-[#111827] px-2 py-2.5 text-sm text-white">
                <option value="+92">🇵🇰 +92</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+1">🇺🇸 +1</option>
              </select>
              <input value={bookingPhone} onBlur={() => setPhoneInputFocused(false)} onFocus={() => setPhoneInputFocused(true)} onChange={(e) => { setBookingPhone(e.target.value); setBookingPhoneValid(isValidPhone(bookingPhoneCode, e.target.value)); }} className="flex-1 rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" placeholder="03XXXXXXXXX" />
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-[#9CA3AF]">
            <input type="checkbox" checked={bookingState.emergencyConfirm || false} onChange={(e) => setBookingState({ ...bookingState, emergencyConfirm: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-[#374151] bg-[#111827] accent-[#10B981]" />
            I confirm this is a real medical emergency.
          </label>
          {bookingState.emergencyResult ? <div className="mt-4 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs text-[#D1FAE5]"><p className="font-semibold">{bookingState.emergencyResult.recommendation || 'Emergency review complete'}</p>{bookingState.emergencyResult.matchedSignals?.length ? <p className="mt-1">Signals: {bookingState.emergencyResult.matchedSignals.join(', ')}</p> : null}</div> : null}
          <button type="button" disabled={emergencyLoading || !bookingState.emergencyType || !bookingState.emergencyDesc || !bookingPhoneValid || !bookingState.emergencyConfirm} onClick={async () => {
            const randomNum = Math.floor(100 + Math.random() * 900);
            const voucherId = `EMG-${randomNum}-${Date.now().toString().slice(-4)}`;
            // Book on the real backend first; fall back to an offline mock token.
            let token = `E-${randomNum}`;
            let voucherStatus = 'Active';
            try {
              const bookingData = await bookEmergencyToken();
              if (bookingData?.token) token = String(bookingData.token);
              if (bookingData?.status === 'PendingApproval') voucherStatus = 'Pending Approval';
              else if (bookingData?.status) voucherStatus = String(bookingData.status);
            } catch (error: any) {
              console.warn('Emergency booking offline fallback:', error);
            }
            const voucher = {
              id: Date.now(),
              voucherId,
              bookingId: voucherId,
              yourToken: token,
              token: token,
              tokenNumber: token,
              currentTokenNum: 12,
              yourTokenNum: 16,
              paymentStatus: 'pending_verification',
              tokenType: 'emergency',
              phone: `${bookingPhoneCode} ${bookingPhone}`,
              salon: clinic.name,
              orgName: clinic.name,
              organization: clinic.name,
              organization_name: clinic.name,
              service: `Emergency: ${doc?.specialty || 'Doctor'}`,
              category: doc?.specialty || 'Emergency',
              doctor: doc?.name,
              doctor_name: doc?.name,
              clinic_name: clinic.name,
              date: 'Today',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: voucherStatus,
              createdAt: new Date().toISOString(),
            };

            const nextBookings = [...myBookings, voucher];
            setMyBookings(nextBookings);
            setBookingState((current: any) => ({ ...current, voucher, step: 'live-token' }));
            setTokenSlotsUsed((prev) => ({ ...prev, emergency: prev.emergency + 1 }));
            showToast(`Emergency Token ${token} registered`);

            if (typeof window !== 'undefined') {
              try {
                const existingMy = JSON.parse(localStorage.getItem('myBookings') || '[]');
                localStorage.setItem('myBookings', JSON.stringify([...existingMy, voucher]));
              } catch (e) {
                console.error('Error saving myBookings:', e);
              }
              try {
                const existingQ = JSON.parse(localStorage.getItem('queueiq_my_bookings') || '[]');
                localStorage.setItem('queueiq_my_bookings', JSON.stringify([...existingQ, voucher]));
              } catch (e) {
                console.error('Error saving queueiq_my_bookings:', e);
              }
            }
          }} className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90 disabled:cursor-not-allowed disabled:bg-[#374151] disabled:text-[#9CA3AF]">{emergencyLoading ? 'Checking emergency...' : 'Submit for Verification'}</button>
        </div>
      </div>
    );
  };

  const renderContactVoucher = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const deptDoctors = getDoctorsForDept(bookingState.deptId);
    const doc = deptDoctors.find((d: any) => d.id === bookingState.doctorId);
    const amount = bookingState.tokenType === 'express' ? 1200 : 800;
    const tokenLabel = generateToken(clinic.orgCode, false);
    return (
      <div>
        <p className="text-sm text-[#9CA3AF]">{doc?.name} — {bookingState.tokenType === 'express' ? 'Express' : 'Normal'} Token • Rs. {amount}</p>
        <div className="mt-4 flex gap-2 border-b border-[#374151] pb-3">
          <button type="button" onClick={() => setBookingState({ ...bookingState, paymentTab: 'online' })} className={`flex-1 rounded-lg py-2 text-xs font-semibold leading-tight transition ${bookingState.paymentTab === 'online' ? 'bg-[#10B981] text-[#111827]' : 'border border-[#374151] text-[#9CA3AF] hover:text-white'}`}>Pay Online</button>
          <button type="button" onClick={() => setBookingState({ ...bookingState, paymentTab: 'reception' })} className={`flex-1 rounded-lg py-2 text-xs font-semibold leading-tight transition ${bookingState.paymentTab === 'reception' ? 'bg-[#10B981] text-[#111827]' : 'border border-[#374151] text-[#9CA3AF] hover:text-white'}`}>Pay at Reception<br className="sm:hidden" /><span className="hidden sm:inline"> - </span>No Account Needed</button>
        </div>
        <div className="mt-4">
          {bookingState.paymentTab === 'online' ? (
            <div>
              <div className="flex gap-2">
                {['jazzcash', 'bank', 'card'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setBookingState({ ...bookingState, paymentSubTab: tab })} className={`flex-1 rounded-lg border py-2 text-[11px] font-medium transition ${bookingState.paymentSubTab === tab ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10' : 'border-[#374151] text-[#9CA3AF] hover:text-white'}`}>{tab === 'jazzcash' ? 'JazzCash / EasyPaisa' : tab === 'bank' ? 'Bank Transfer' : 'Card / Apple Pay'}</button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-[#374151] bg-[#111827] p-4 text-xs">
                <p className="text-sm font-semibold text-white">WhatsApp Number *</p>
                <div className="mt-2 flex gap-2">
                  <select value={bookingPhoneCode} onChange={(e) => setBookingPhoneCode(e.target.value)} className="rounded-lg border border-[#374151] bg-[#111827] px-2 py-2.5 text-sm text-white">
                    <option value="+92">🇵🇰 +92</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+1">🇺🇸 +1</option>
                  </select>
                  <input value={bookingPhone} onChange={(e) => { setBookingPhone(e.target.value); setBookingPhoneValid(isValidPhone(bookingPhoneCode, e.target.value)); }} className="flex-1 rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" placeholder="03XXXXXXXXX" />
                </div>

<button type="button" disabled={!bookingPhoneValid} onClick={() => {
  const clinic = getClinicById(bookingState?.clinicId);
  const deptDoctors = getDoctorsForDept(bookingState.deptId);
  const doc = deptDoctors.find((d:any) => d.id === bookingState.doctorId);
  handleRealBook(clinic, doc);
}} className="mt-4 w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90 disabled:cursor-not-allowed disabled:bg-[#374151] disabled:text-[#9CA3AF]">Generate Voucher ID - Real Booking</button>

                


              </div>
            </div>
          ) : (
            <div>
              <div className="rounded-xl border border-[#374151] bg-[#111827] p-4">
                <p className="text-sm font-semibold text-white">Rs. 0 now, pay Rs. {amount} at reception.</p>
                <p className="mt-1 text-xs text-[#9CA3AF]">No bank account needed.</p>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-white">WhatsApp Number *</label>
                <div className="mt-1.5 flex gap-2">
                  <select value={bookingPhoneCode} onChange={(e) => setBookingPhoneCode(e.target.value)} className="rounded-lg border border-[#374151] bg-[#111827] px-2 py-2.5 text-sm text-white">
                    <option value="+92">🇵🇰 +92</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+1">🇺🇸 +1</option>
                  </select>
                  <input value={bookingPhone} onChange={(e) => { setBookingPhone(e.target.value); setBookingPhoneValid(isValidPhone(bookingPhoneCode, e.target.value)); }} className="flex-1 rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" placeholder="03XXXXXXXXX" />
                </div>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-[#9CA3AF]">
                <input type="checkbox" checked={bookingState.receptionAgree || false} onChange={(e) => setBookingState({ ...bookingState, receptionAgree: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-[#374151] bg-[#111827] accent-[#10B981]" />
                I will pay within 20 mins
              </label>
              <button type="button" disabled={!bookingPhoneValid || !bookingState.receptionAgree} onClick={() => {
                const randomNum = tokenNum(tokenLabel);
                const voucherId = `Q-${randomNum}-${Date.now().toString().slice(-4)}`;
                const voucher = {
                  id: Date.now(),
                  voucherId,
                  bookingId: voucherId,
                  yourToken: tokenLabel,
                  token: tokenLabel,
                  tokenNumber: tokenLabel,
                  currentTokenNum: Math.max(2, randomNum - 4),
                  yourTokenNum: randomNum,
                  paymentStatus: 'reserved_unpaid',
                  tokenType: bookingState.tokenType,
                  method: 'reception',
                  phone: `${bookingPhoneCode} ${bookingPhone}`,
                  reservedAt: Date.now(),
                  reserveWindowSec: 20 * 60,
                  organization: clinic.name,
                  organization_name: clinic.name,
                  orgName: clinic.name,
                  salon: clinic.name,
                  service: doc?.name || 'Doctor',
                  category: doc?.name || 'Doctor',
                  doctor: doc?.name,
                  doctor_name: doc?.name,
                  clinic_name: clinic.name,
                  date: 'Today',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  status: 'Active',
                  createdAt: new Date().toISOString(),
                };
                const nextBookings = [...myBookings, voucher];
                setMyBookings(nextBookings);
                setBookingState({ ...bookingState, voucher, step: 'live-token' });
                showToast(`Token reserved: ${tokenLabel}`);

                if (typeof window !== 'undefined') {
                  try {
                    const existingMy = JSON.parse(localStorage.getItem('myBookings') || '[]');
                    localStorage.setItem('myBookings', JSON.stringify([...existingMy, voucher]));
                  } catch (e) {
                    console.error('Error saving to myBookings:', e);
                  }
                  try {
                    const existingQ = JSON.parse(localStorage.getItem('queueiq_my_bookings') || '[]');
                    localStorage.setItem('queueiq_my_bookings', JSON.stringify([...existingQ, voucher]));
                  } catch (e) {
                    console.error('Error saving to queueiq_my_bookings:', e);
                  }
                }
              }} className="mt-4 w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90 disabled:cursor-not-allowed disabled:bg-[#374151] disabled:text-[#9CA3AF]">Reserve Token - No Payment Needed</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVoucherStatus = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const v = bookingState.voucher;
    const paidStorageKey = `paid_${v.voucherId}`;
    const isPaid = v.paymentStatus !== 'processing' && (v.paymentStatus === 'paid' || (typeof window !== 'undefined' && localStorage.getItem(paidStorageKey) === 'true'));
    const amount = v.tokenType === 'express' ? 1200 : 800;
    const payNow = () => {
      localStorage.setItem(paidStorageKey, 'true');
      setBookingState({ ...bookingState, voucher: { ...v, paymentStatus: 'processing' } });
      const updated = { ...v, paymentStatus: 'paid' };
      setBookingState((current: any) => ({ ...current, voucher: updated }));
      setMyBookings((currentBookings) => currentBookings.map((item) => item.voucherId === updated.voucherId ? { ...item, paymentStatus: 'paid' } : item));
      if (v.tokenType === 'future') {
        const saved = localStorage.getItem(`future_${v.voucherId}`);
        if (saved) localStorage.setItem(`future_${v.voucherId}`, JSON.stringify({ ...JSON.parse(saved), paid: true }));
      }
      showToast('Payment successful');
      handleCompletePayment();
    };
    return (
      <div>
        <div className={`rounded-xl border ${isPaid ? 'border-[#10B981]/40' : 'border-[#374151]'} bg-[#111827] p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#9CA3AF]">Voucher ID</p>
            <button type="button" onClick={() => navigator.clipboard?.writeText(v.voucherId)} className="flex items-center gap-1 text-xs text-[#10B981] hover:underline"><Copy className="h-3 w-3" />Copy</button>
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-white">{v.voucherId}</p>
          <div className="mt-3 flex items-center gap-2">
            {isPaid ? <><span className="pulse-dot h-2.5 w-2.5 rounded-full bg-[#10B981]" /><span className="text-sm font-medium text-[#10B981]">Paid — Verified</span></> : v.paymentStatus === 'processing' ? <><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#F59E0B]" /><span className="text-sm font-medium text-[#F59E0B]">Processing payment...</span></> : <><span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /><span className="text-sm font-medium text-[#EF4444]">Unpaid</span></>}
          </div>
          <p className={`mt-4 font-mono text-2xl font-bold ${isPaid ? 'text-white' : 'text-white/30 blur-sm'}`}>{v.yourToken}</p>
          {v.tokenType === 'future' && isPaid ? <><p className="mt-3 text-sm text-[#D1D5DB]">Appointment fixed for {v.date} at {v.time}</p><a href={googleCalendarLink({ clinicName: clinic.name, doctor: v.doctor || 'Doctor', date: v.date, time: v.time, voucherId: v.voucherId })} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]">📅 Add to Calendar</a></> : null}
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-[#9CA3AF]">Amount</p><p className="font-semibold text-white">Rs. {amount}</p></div>
            <div><p className="text-[#9CA3AF]">Bank</p><p className="font-semibold text-white">HBL / JazzCash / EasyPaisa</p></div>
            <div className="col-span-2"><p className="text-[#9CA3AF]">Account</p><p className="font-semibold text-white">1234-XXXX-XXXX</p></div>
          </div>
        </div>
        <div className="mt-4">
          {paymentSuccess ? <div className="rounded-lg bg-[#10B981] py-2.5 text-center text-sm font-bold text-[#111827]">Payment Successful ✓</div> : !isPaid ? <button type="button" disabled={v.paymentStatus === 'processing'} onClick={payNow} className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-bold text-[#111827] transition-all duration-300 ease-in-out hover:bg-[#0D9D6E] hover:shadow-lg hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{v.paymentStatus === 'processing' ? 'Processing payment...' : 'Pay Now'}</button> : <button type="button" onClick={() => setBookingState({ ...bookingState, step: 'live-token' })} className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-bold text-[#111827] transition-all duration-300 ease-in-out hover:bg-[#0D9D6E] hover:shadow-lg hover:-translate-y-0.5">View Live Token</button>}
        </div>
      </div>
    );
  };

  const renderFutureWhatsApp = () => {
    const appointment = bookingState.futureWhatsApp;
    const amount = bookingState.tokenType === 'express' ? 1200 : 800;
    return (
      <div className="py-6 text-center">
        <div className="text-5xl">💬</div>
        <p className="mt-4 text-lg font-bold text-white">WhatsApp confirmation</p>
        <p className="mt-3 text-sm leading-6 text-[#D1D5DB]">WhatsApp sent to {appointment.phone}: &quot;Your appointment with {appointment.doctor} on {appointment.date} at {appointment.time} is pending. Voucher: {appointment.voucherId}. Reply YES to confirm and pay Rs.{amount}&quot;</p>
        <p className="mt-5 text-xs text-[#9CA3AF]">Simulate the WhatsApp reply:</p>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={() => setBookingState({ ...bookingState, voucher: { ...bookingState.futureBooking, voucherId: appointment.voucherId, tokenType: 'future', paymentStatus: 'unpaid', doctor: appointment.doctor, date: appointment.date, time: appointment.time }, step: 'voucher-status' })} className="flex-1 rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827]">YES</button>
          <button type="button" onClick={closeBooking} className="flex-1 rounded-lg border border-[#374151] py-2.5 text-sm font-semibold text-white">NO</button>
        </div>
      </div>
    );
  };

  const renderLiveToken = () => {
    const clinic = getClinicById(bookingState?.clinicId);
    if (!clinic) return null;
    const v = bookingState.voucher;
    const deptDoctors = getDoctorsForDept(bookingState.deptId);
    const doc = deptDoctors.find((d: any) => d.id === bookingState.doctorId);
    const bookingData = {
      ...v,
      token: v.token ?? v.tokenNumber ?? v.token_number ?? v.tokenNo ?? v.yourToken,
      doctor_name: v.doctor_name ?? doc?.name,
      date: v.date ?? 'Today',
    };
    console.log(bookingData);
    const tokenDisplay = bookingData?.token ?? bookingData?.tokenNumber ?? bookingData?.token_number ?? bookingData?.tokenNo ?? bookingData?.token_id ?? bookingData?.id ?? bookingData?.number ?? "?";
    const position = Math.max(0, v.yourTokenNum - v.currentTokenNum);
    const peopleAhead = v.peopleAhead ?? position;
    const etaMin = v.etaMin ?? peopleAhead * 5;
    const etaMax = v.etaMax ?? etaMin;
    const progress = Math.min(100, Math.max(0, ((v.currentTokenNum - 10) / (v.yourTokenNum - 10)) * 100));
    const done = v.currentTokenNum >= v.yourTokenNum;
    const prefix = String(tokenDisplay).split('-')[0];
    const displayToken = String(tokenDisplay).includes('-') ? tokenDisplay : `T-${tokenDisplay}`;
    return (
      <div>
        <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 p-4 text-center">
            <p className="text-4xl font-bold text-white">{displayToken}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF]">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#10B981]" />Confirmed • {bookingData.doctor_name || 'Doctor'} • {bookingData.date || 'Date unavailable'}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#374151] bg-[#111827] p-3">
            <p className="text-xs text-[#9CA3AF]">Now Serving</p>
            <p className="mt-1 text-lg font-bold text-white">{prefix}-{v.currentTokenNum}</p>
          </div>
          <div className="rounded-xl border border-[#374151] bg-[#111827] p-3">
            <p className="text-xs text-[#9CA3AF]">Your Turn In</p>
            <p className="mt-1 text-lg font-bold text-white">{done ? "It's now!" : `~${etaMin}-${etaMax} min`}</p>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{peopleAhead} people ahead</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]"><span>Queue Progress</span><span>{Math.round(progress)}%</span></div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#374151]">
            <div className="h-full rounded-full bg-[#10B981] transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#374151] bg-[#111827] p-3 text-xs text-[#9CA3AF]">
          <MessageCircle className="h-4 w-4 shrink-0 text-[#10B981]" />
          <span>WhatsApp: {v.phone || '03XXXXXXXXX'} — You'll get an alert when token {Math.max(v.currentTokenNum, v.yourTokenNum - 2)} is called</span>
        </div>
        <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              closeBooking();
              window.location.href = '/my-bookings';
            }}
            className="flex-1 rounded-xl bg-[#10B981] py-3 text-sm font-bold text-[#111827] transition hover:bg-[#10B981]/90"
          >
            Go to My Bookings
          </button>
          <button
            type="button"
            onClick={closeBooking}
            className="flex-1 rounded-xl border border-[#374151] py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const renderGenericStep = () => {
    const org = bookingState.org;
    switch (bookingState.step) {
      case 'g-date':
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        return (
          <div>
            <h3 className="text-lg font-bold text-white">Select Date</h3>
            <p className="mt-1 text-sm text-[#9CA3AF]">{org.name} is currently closed. Choose when you'd like to book.</p>
            <button type="button" onClick={() => setBookingState({ ...bookingState, date: tomorrow, step: 'g-category' })} className="mt-6 flex w-full items-center justify-between rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 px-4 py-4 text-left transition hover:border-[#10B981]">
              <span><span className="block text-sm font-semibold text-white">📅 Tomorrow</span><span className="block text-xs text-[#9CA3AF]">{formatDateLabel(tomorrow)} — most common</span></span>
              <ChevronRight className="h-4 w-4 text-[#10B981]" />
            </button>
            <div className="mt-4 rounded-xl border border-[#374151] bg-[#111827] p-4">
              <label className="block text-sm font-medium text-white">Pick a date</label>
              <input type="date" min={tomorrow.toISOString().split('T')[0]} onChange={(e) => setBookingState({ ...bookingState, date: new Date(`${e.target.value}T00:00:00`), step: 'g-category' })} className="mt-2 w-full rounded-lg border border-[#374151] bg-[#1F2937] px-3 py-2.5 text-sm text-white focus:border-[#10B981] focus:outline-none" />
            </div>
          </div>
        );
      case 'g-category':
        return (
          <div>
            <h3 className="text-lg font-bold text-white">{org.name}</h3>
            <p className="mt-1 text-sm text-[#9CA3AF]">{org.status !== 'closed' ? `⭐ ${org.rating} rating` : formatDateLabel(bookingState.date)}</p>
            <p className="mt-5 text-sm font-medium text-white">Select a service</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {((CATEGORY_MAP[org.type as keyof typeof CATEGORY_MAP] || []) as Array<{ icon: string; label: string }>).map((c) => <button key={c.label} type="button" onClick={() => setBookingState({ ...bookingState, category: c.label, step: 'g-phone' })} className="cat-btn flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center"><span className="text-2xl">{c.icon}</span><span className="text-xs font-medium text-white">{c.label}</span></button>)}
            </div>
          </div>
        );
      case 'g-phone':
        return (
          <div>
            <p className="text-sm text-[#9CA3AF]">{org.name} — {bookingState.category}</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-white">WhatsApp Number *</label>
              <div className="mt-1.5 flex gap-2">
                <select value={bookingPhoneCode} onChange={(e) => setBookingPhoneCode(e.target.value)} className="rounded-lg border border-[#374151] bg-[#111827] px-2 py-2.5 text-sm text-white">
                  <option value="+92">🇵🇰 +92</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+1">🇺🇸 +1</option>
                </select>
                <input value={bookingPhone} onChange={(e) => { setBookingPhone(e.target.value); setBookingPhoneValid(isValidPhone(bookingPhoneCode, e.target.value)); }} className="flex-1 rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" placeholder="03XXXXXXXXX" />
              </div>
            </div>
            <button type="button" disabled={!bookingPhoneValid} onClick={() => setBookingState({ ...bookingState, phone: `${bookingPhoneCode} ${bookingPhone}`, step: 'g-payment-choice' })} className="mt-5 w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90 disabled:cursor-not-allowed disabled:bg-[#374151] disabled:text-[#9CA3AF]">Continue</button>
          </div>
        );
      case 'g-payment-choice':
        return (
          <div>
            <p className="text-sm text-[#9CA3AF]">{org.name} — {bookingState.category}</p>
            <div className="mt-4 space-y-3">
              <button type="button" onClick={() => setBookingState({ ...bookingState, step: 'g-payment-verify' })} className="token-card w-full rounded-xl p-4 text-left">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">Pay Online Now</p>
                  <p className="text-sm font-bold text-[#10B981]">Rs. {org.price ?? 1500}</p>
                </div>
                <p className="mt-1 text-xs text-[#9CA3AF]">JazzCash / EasyPaisa / Bank Transfer</p>
              </button>
              <button type="button" onClick={() => handleGenericBookSuccess('reception')} className="token-card w-full rounded-xl p-4 text-left">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">Pay at Receptionist</p>
                  <p className="text-sm font-bold text-[#10B981]">Rs. {org.price ?? 1500}</p>
                </div>
                <p className="mt-1 text-xs text-[#9CA3AF]">No online payment needed • Token reserved instantly</p>
              </button>
            </div>
          </div>
        );
      case 'g-payment-verify':
        return (
          <div>
            <p className="text-sm font-semibold text-white">Complete Payment - Rs. {org.price ?? 1500}</p>
            <div className="mt-4 space-y-3">
              {['JazzCash', 'EasyPaisa', 'Bank Transfer'].map((pm) => (
                <button key={pm} type="button" onClick={() => setPaymentMethod(pm)} className={`token-card w-full rounded-xl p-4 text-left ${paymentMethod === pm ? 'border-[#10B981] bg-[#10B981]/10' : ''}`}>
                  <p className="font-semibold text-white">{pm}</p>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-white">Transaction ID</label>
              <input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="Enter Transaction ID / TID (e.g. 110)" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" />
            </div>
            <button type="button" onClick={() => handleGenericBookSuccess('online', txnId.trim() || '110')} className="mt-4 w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90">Verify & Get Token</button>
          </div>
        );
      case 'g-confirm': {
        const record = bookingState.genericRecord;
        if (!record) return null;
        return (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="text-5xl">✅</div>
            <p className="mt-3 text-xl font-bold text-white">Booking Confirmed!</p>
            <div className="mt-4 w-full rounded-2xl border border-[#10B981]/40 bg-[#112240] p-6 text-center shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Your Token</p>
              <p className="mt-2 font-mono text-4xl font-extrabold text-[#10B981]">{record.tokenNumber || record.token}</p>
              <p className="mt-2 text-base font-semibold text-white">{record.organization || record.orgName}</p>
              <p className="text-xs text-[#9CA3AF]">{record.service || record.category} • {record.date}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${record.payment === 'online' || record.paymentStatus === 'Paid' ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]' : 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]'}`}>
                  {record.payment === 'online' || record.paymentStatus === 'Paid' ? 'Paid Online ✓' : 'Pay at Reception'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-0.5 text-xs font-medium text-[#10B981]">
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#10B981]" />Active
                </span>
              </div>
              <p className="mt-3 font-mono text-[11px] text-[#9CA3AF]">Voucher ID: {record.voucherId}</p>
            </div>
            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  closeBooking();
                  window.location.href = '/my-bookings';
                }}
                className="flex-1 rounded-xl bg-[#10B981] py-3 text-sm font-bold text-[#111827] transition hover:bg-[#10B981]/90"
              >
                Go to My Bookings
              </button>
              <button
                type="button"
                onClick={closeBooking}
                className="flex-1 rounded-xl border border-[#374151] py-3 text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        );
      }
      case 'future-confirm': {
        const futureBooking = bookingState.futureBooking;
        return (
          <div className="py-6 text-center">
            <div className="text-5xl">✅</div>
            <p className="mt-4 text-lg font-bold text-white">Appointment Confirmed</p>
            <p className="mt-2 font-mono text-2xl font-bold text-white">{futureBooking.yourToken}</p>
            <p className="mt-3 text-sm text-[#9CA3AF]">{futureBooking.orgName} • {futureBooking.category}</p>
            <p className="mt-1 text-sm text-[#9CA3AF]">{futureBooking.date} at {futureBooking.time}</p>
            <div className="mt-4 flex w-full flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  closeBooking();
                  window.location.href = '/my-bookings';
                }}
                className="flex-1 rounded-xl bg-[#10B981] py-2.5 text-sm font-bold text-[#111827] transition hover:bg-[#10B981]/90"
              >
                Go to My Bookings
              </button>
              <button
                type="button"
                onClick={closeBooking}
                className="flex-1 rounded-xl border border-[#374151] py-2.5 text-sm font-semibold text-white transition hover:border-[#10B981]/50"
              >
                Done
              </button>
            </div>
            <CalendarActions clinicName={futureBooking.orgName} date={futureBooking.date} time={futureBooking.time} token={futureBooking.yourToken} />
          </div>
        );
      }
      default:
        return null;
    }
  };

  const bookingHeader = (title: string, showBack = true, onBack?: () => void) => (
    <div className="flex shrink-0 items-center justify-between border-b border-[#374151] p-5">
      <button type="button" onClick={onBack || (() => setBookingState({ ...bookingState, step: 'clinic-detail' }))} className={`items-center gap-1 text-xs text-[#9CA3AF] transition hover:text-white ${showBack ? 'flex' : 'hidden'}`}><ChevronLeft className="h-3.5 w-3.5" />Back</button>
      <p className="text-sm font-medium text-[#9CA3AF]">{title}</p>
      <button type="button" aria-label="Close booking" onClick={closeBooking} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#374151] text-[#9CA3AF] transition hover:border-[#10B981]/50 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  );

  const renderBookingBody = () => {
    if (!bookingState) return null;
    const titleMap: Record<string, string> = {
      'clinic-detail': 'Clinic',
      'doctor-list': 'Doctors',
      'future-date': 'Future Appointment',
      'token-type': 'Select Token',
      'emergency-form': 'Emergency Verification',
      'contact-voucher': 'Payment',
      'voucher-status': 'Voucher',
      'future-whatsapp': 'WhatsApp Confirmation',
      'live-token': 'Live Token',
      'g-date': 'Select Date',
      'g-category': bookingState.org?.name || 'Booking',
      'g-phone': 'Contact Details',
      'g-payment-choice': 'Choose Payment',
      'g-payment-verify': 'Complete Payment',
      'g-confirm': 'Confirmed',
      'future-confirm': 'Confirmed',
    };
    const handleBookingBack = () => {
      if (bookingState.flow === 'clinic') {
        if (bookingState.step === 'clinic-detail') {
          closeAllOverlays();
          setShowSearchOverlay(true);
          setBookingState(null);
          return;
        }
        if (bookingState.step === 'doctor-list') setBookingState({ ...bookingState, step: 'clinic-detail' });
        else if (bookingState.step === 'future-date') setBookingState({ ...bookingState, step: 'doctor-list' });
        else if (bookingState.step === 'token-type') setBookingState({ ...bookingState, step: 'doctor-list' });
        else if (bookingState.step === 'emergency-form') setBookingState({ ...bookingState, step: 'token-type' });
        else if (bookingState.step === 'contact-voucher') setBookingState({ ...bookingState, step: 'token-type' });
        else if (bookingState.step === 'voucher-status') setBookingState({ ...bookingState, step: 'contact-voucher' });
        else if (bookingState.step === 'live-token') closeBooking();
      } else {
        if (bookingState.step === 'g-phone') setBookingState({ ...bookingState, step: 'g-category' });
        else if (bookingState.step === 'g-payment-choice') setBookingState({ ...bookingState, step: 'g-phone' });
        else if (bookingState.step === 'g-payment-verify') setBookingState({ ...bookingState, step: 'g-payment-choice' });
      }
    };

    return (
      <div className="flex h-full flex-col">
        {bookingHeader(titleMap[bookingState.step] || 'Booking', Boolean(bookingState.step !== 'clinic-detail' && bookingState.flow === 'clinic'), handleBookingBack)}
        <div className="flex-1 overflow-y-auto p-6">
          {bookingState.flow === 'clinic' ? (
            <>
              {bookingState.step === 'clinic-detail' && renderClinicDetail()}
              {bookingState.step === 'doctor-list' && renderDoctorList()}
              {bookingState.step === 'future-date' && renderFutureAppointment()}
              {bookingState.step === 'token-type' && renderTokenType()}
              {bookingState.step === 'emergency-form' && renderEmergencyForm()}
              {bookingState.step === 'contact-voucher' && renderContactVoucher()}
              {bookingState.step === 'voucher-status' && renderVoucherStatus()}
              {bookingState.step === 'future-whatsapp' && renderFutureWhatsApp()}
              {bookingState.step === 'live-token' && renderLiveToken()}
            </>
          ) : renderGenericStep()}
        </div>
      </div>
    );
  };

  const renderBusinessDashboard = () => {
    if (!currentBusiness) {
      return (
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-24">
          <div className="hidden max-w-md lg:block">
            <h1 className="text-4xl font-bold leading-tight text-white">Manage your queues <span className="text-[#10B981]">like a pro.</span></h1>
            <p className="mt-4 text-sm text-[#9CA3AF]">One dashboard for tokens, doctors, payments, and real-time queue analytics.</p>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-[#374151] bg-[#112240] p-8">
            <p className="text-center text-lg font-bold"><span className="text-white">Queue</span><span className="text-[#10B981]">IQ</span><span className="ml-1 text-sm font-medium text-[#9CA3AF]">Business</span></p>
            <p className="mt-1 text-center text-xs text-[#9CA3AF]">Log in to your dashboard</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white">Email *</label>
                <input value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} type="email" placeholder="you@business.com" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white">Password *</label>
                <div className="relative mt-1.5">
                  <input value={businessPassword} onChange={(e) => setBusinessPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 pr-10 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
              {bizError ? <p className="text-[11px] text-[#EF4444]">{bizError}</p> : null}
              <button type="button" onClick={businessLogin} className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90">Log In</button>
              <div className="rounded-lg border border-[#374151] bg-[#111827] p-3 text-[11px] text-[#9CA3AF]">
                <p className="mb-2 font-semibold text-white">Demo accounts (password: <span className="font-mono text-emerald-400">123456</span>):</p>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => { setBusinessEmail('reception.cardio@alshifa.com'); setBusinessPassword('123456'); }}
                    className="w-full text-left p-1.5 rounded bg-[#1F2937]/70 hover:bg-[#10B981]/20 hover:text-white transition flex items-center justify-between border border-transparent hover:border-[#10B981]/40"
                  >
                    <span>reception.cardio@alshifa.com</span>
                    <span className="text-[#9CA3AF] text-[10px]">receptionist - 123456</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBusinessEmail('dr.ayesha@alshifa.com'); setBusinessPassword('123456'); }}
                    className="w-full text-left p-1.5 rounded bg-[#1F2937]/70 hover:bg-[#10B981]/20 hover:text-white transition flex items-center justify-between border border-transparent hover:border-[#10B981]/40"
                  >
                    <span>dr.ayesha@alshifa.com</span>
                    <span className="text-[#9CA3AF] text-[10px]">doctor - 123456</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBusinessEmail('owner@alshifa.com'); setBusinessPassword('123456'); }}
                    className="w-full text-left p-1.5 rounded bg-[#1F2937]/70 hover:bg-[#10B981]/20 hover:text-white transition flex items-center justify-between border border-transparent hover:border-[#10B981]/40"
                  >
                    <span className="text-[#10B981] font-semibold">owner@alshifa.com</span>
                    <span className="text-[#9CA3AF] text-[10px]">owner (All Departments) - 123456</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBusinessEmail('admin@alshifa.com'); setBusinessPassword('123456'); }}
                    className="w-full text-left p-1.5 rounded bg-[#1F2937]/70 hover:bg-[#10B981]/20 hover:text-white transition flex items-center justify-between border border-transparent hover:border-[#10B981]/40"
                  >
                    <span>admin@alshifa.com</span>
                    <span className="text-[#9CA3AF] text-[10px]">admin - 123456</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const role = currentBusiness.role;
    const isDoctor = role === 'doctor';
    const isOwner = role === 'owner';
    const canManage = !isDoctor; // receptionist + owner may act on the queue
    const roleLabel = isDoctor ? 'Doctor' : isOwner ? 'Owner' : 'Reception';
    const who = currentBusiness.displayName || currentBusiness.doctorName || currentBusiness.email || 'there';

    const s = bizQueue.summary || {};
    const allTokens = bizQueue.tokens || [];
    const lineTokens = allTokens.filter((t: any) => t.status !== 'PendingApproval');
    const pending = allTokens.filter((t: any) => t.status === 'PendingApproval');
    const deptDoctors = isOwner ? bizDoctors.filter((d: any) => !bizDeptId || d.department_id === bizDeptId) : bizDoctors;
    const selectedDoctor = bizDoctors.find((d: any) => d.id === bizDoctorId);

    return (
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Welcome back, {who} 👋</h1>
              <span className="rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#10B981]">{roleLabel}</span>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#9CA3AF]">
              <span className={`h-1.5 w-1.5 rounded-full ${bizConn ? 'bg-[#10B981] pulse-dot' : 'bg-[#EF4444]'}`} />
              {bizConn ? 'Live · connected to backend' : 'Connecting to backend…'}
            </p>
          </div>
          <button type="button" onClick={bizLogout} className="rounded-lg border border-[#374151] px-4 py-2 text-sm font-medium text-white transition hover:border-[#EF4444]/50 hover:text-[#EF4444]">Log Out</button>
        </div>

        {bizErr ? <p className="mt-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">{bizErr}</p> : null}

        {/* Owner: choose a department. Doctor: no picker (own line only). */}
        {isOwner && bizDepartments.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Department</p>
            <div className="flex flex-wrap gap-2">
              {bizDepartments.map((d: any) => (
                <button key={d.id} type="button" onClick={() => pickBizDept(d.id)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${bizDeptId === d.id ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]' : 'border-[#374151] text-[#9CA3AF] hover:text-white'}`}>{d.icon ? `${d.icon} ` : ''}{d.name}</button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Reception + Owner: pick which doctor's line to manage. */}
        {canManage ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Doctor's line</p>
            {deptDoctors.length ? (
              <div className="flex flex-wrap gap-2">
                {deptDoctors.map((d: any) => (
                  <button key={d.id} type="button" onClick={() => setBizDoctorId(d.id)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${bizDoctorId === d.id ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]' : 'border-[#374151] text-[#9CA3AF] hover:text-white'}`}>{d.name}</button>
                ))}
              </div>
            ) : <p className="text-sm text-[#6B7280]">No doctors found for this department.</p>}
          </div>
        ) : null}

        {/* Real-time Doctor Queue Controller */}
        <div className="mt-8">
          {(() => {
            const currentDept = bizDepartments.find((d: any) => d.id === (selectedDoctor?.department_id || bizDeptId));
            const doctorSpecialty = selectedDoctor?.specialty || selectedDoctor?.specialization || currentDept?.name || 'Cardiologist';
            const doctorTiming = selectedDoctor?.schedule?.when || selectedDoctor?.schedule?.label || '02:00 PM - 03:00 AM';
            return (
              <DoctorQueue
                key={selectedDoctor?.id || bizDoctorId || currentBusiness?.doctorId || 'doc-queue'}
                doctorId={selectedDoctor?.id || currentBusiness?.doctorId || '92fc75e6-645d-4889-a856-902bb15be43d'}
                doctorName={selectedDoctor?.name || currentBusiness?.doctorName || 'Dr. Rabia Hassan'}
                specialty={doctorSpecialty}
                fee={selectedDoctor?.fee || 1800}
                bio={selectedDoctor?.bio}
                timing={doctorTiming}
                experience={selectedDoctor?.experience}
                organizationId={REAL_ORG_ID}
                organizationName="Al-Shifa Clinic"
              />
            );
          })()}
        </div>
      </div>
    );
  };

  const renderMyBookingsModal = () => (
    <div className={`fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/75 p-4 ${showMyBookings ? '' : 'hidden'}`} role="dialog" aria-modal="true" aria-label="My bookings">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#374151] bg-[#1F2937]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[#374151] px-5 py-4">
          <h3 className="font-semibold text-white">My Bookings</h3>
          <button type="button" onClick={closeMyBookings} className="rounded-lg p-1 text-[#9CA3AF] hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          {myBookings.length === 0 ? <div className="flex flex-col items-center py-10 text-center"><div className="mb-3 text-4xl">🗂️</div><p className="text-sm font-medium text-white">No bookings yet</p><p className="mt-1 text-xs text-[#9CA3AF]">Book a token or appointment and it&apos;ll show up here.</p></div> : <div className="space-y-3">{myBookings.map((booking, idx) => <div key={`${booking.voucherId}-${idx}`} className="result-card flex flex-col rounded-xl p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{booking.orgName}</p><p className="mt-0.5 text-xs text-[#9CA3AF]">{booking.category || ''}</p></div><p className="shrink-0 font-mono text-xl font-bold text-[#10B981]">{booking.token || booking.yourToken}</p></div><div className="mt-3 space-y-1.5 text-xs text-[#9CA3AF]"><div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{booking.date}</div><div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{booking.phone}</div><div className="flex items-center gap-1.5 font-mono"><Ticket className="h-3.5 w-3.5" />{booking.voucherId}</div></div><div className="mt-3 flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${booking.paymentStatus === 'paid' || booking.paymentStatus === 'Paid' ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]' : 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]'}`}>{booking.paymentStatus === 'paid' || booking.paymentStatus === 'Paid' ? 'Paid' : 'Pending'}</span><span className="inline-flex items-center gap-1 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-medium text-[#10B981]"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Live</span></div></div>)}</div>}</div>
      </div>
    </div>
  );

  const renderContactModal = () => (
    <div className={`fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/75 p-4 ${showContactModal ? '' : 'hidden'}`} role="dialog" aria-modal="true" aria-label="Contact us">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#374151] bg-[#1F2937]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[#374151] px-5 py-4">
          <h3 className="font-semibold text-white">Get in Touch</h3>
          <button type="button" onClick={() => setShowContactModal(false)} className="rounded-lg p-1 text-[#9CA3AF] hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="flex gap-2">
            <button type="button" onClick={() => setContactTab('patient')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${contactTab === 'patient' ? 'bg-[#10B981] text-[#111827]' : 'border border-[#374151] text-[#9CA3AF]'}`}>I am a Patient</button>
            <button type="button" onClick={() => setContactTab('business')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${contactTab === 'business' ? 'bg-[#10B981] text-[#111827]' : 'border border-[#374151] text-[#9CA3AF]'}`}>I am a Business</button>
          </div>
          {contactTab === 'patient' ? (
            <div className="mt-4 space-y-4">
              <div><label className="block text-sm font-medium text-white">Name *</label><input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} type="text" placeholder="Your full name" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-white">Phone *</label><input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} type="tel" placeholder="03XXXXXXXXX" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-white">Issue Type *</label><select value={contactForm.issue} onChange={(e) => setContactForm({ ...contactForm, issue: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white focus:border-[#10B981] focus:outline-none"><option value="">Select issue...</option><option value="Token Issue">Token Issue</option><option value="Payment Issue">Payment Issue</option><option value="Other">Other</option></select></div>
              <div><label className="block text-sm font-medium text-white">Message *</label><textarea value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={3} placeholder="Tell us what's going on..." className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <button type="button" onClick={() => { showToast('Thanks! Support will contact you within 24h'); setShowContactModal(false); }} className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90">Submit</button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div><label className="block text-sm font-medium text-white">Full Name *</label><input value={businessContactForm.name} onChange={(e) => setBusinessContactForm({ ...businessContactForm, name: e.target.value })} type="text" placeholder="Your full name" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-white">Business Name *</label><input value={businessContactForm.businessName} onChange={(e) => setBusinessContactForm({ ...businessContactForm, businessName: e.target.value })} type="text" placeholder="e.g. Al-Shifa Clinic" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-white">Business Type *</label><select value={businessContactForm.businessType} onChange={(e) => setBusinessContactForm({ ...businessContactForm, businessType: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white focus:border-[#10B981] focus:outline-none"><option value="">Select type...</option><option>Clinic</option><option>Medical Center</option><option>Lab</option><option>Bank</option><option>Salon</option><option>Govt Office</option><option>Other</option></select></div>
              <div><label className="block text-sm font-medium text-white">Phone *</label><input value={businessContactForm.phone} onChange={(e) => setBusinessContactForm({ ...businessContactForm, phone: e.target.value })} type="tel" placeholder="03XXXXXXXXX" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-white">Email *</label><input value={businessContactForm.email} onChange={(e) => setBusinessContactForm({ ...businessContactForm, email: e.target.value })} type="email" placeholder="you@business.com" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-white">City *</label><input value={businessContactForm.city} onChange={(e) => setBusinessContactForm({ ...businessContactForm, city: e.target.value })} type="text" placeholder="e.g. Lahore" className="mt-1.5 w-full rounded-lg border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:border-[#10B981] focus:outline-none" /></div>
              <button type="button" onClick={() => { showToast('Request received! Our team will call you within 24h to setup your dashboard.'); setShowContactModal(false); }} className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90">Submit</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      <div className={`fixed inset-0 z-[200] flex items-center justify-center bg-[#111827] transition-transform duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${showSwitchOverlay ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/20 via-[#111827] to-[#10B981]/10" />
        <div className="relative flex flex-col items-center">
          <p className="animate-pulse text-3xl font-bold"><span className="text-white">Queue</span><span className="text-[#10B981]">IQ</span></p>
          <p className="mt-2 text-xs tracking-widest text-[#9CA3AF]">SWITCHING TO BUSINESS</p>
        </div>
      </div>

      {view === 'user' ? (
        <div className={`min-h-screen bg-[#111827] text-white transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSwitching && switchTarget === 'business' ? 'translate-y-full opacity-0' : 'opacity-100'}`}>
          <header className="sticky top-0 z-40 border-b border-[#374151] bg-[#111827]/70 backdrop-blur-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
              <a href="#top" className="text-2xl font-bold tracking-tight"><span className="text-white">Queue</span><span className="text-[#10B981]">IQ</span></a>
              <div className="hidden items-center gap-6 md:flex">
                <a href="#how-it-works" className="text-sm text-[#9CA3AF] transition hover:text-white">How it works</a>
                <a href="#about" className="text-sm text-[#9CA3AF] transition hover:text-white">About Us</a>
                <button type="button" onClick={() => { setShowContactModal(true); setContactTab('patient'); }} className="text-sm text-[#9CA3AF] transition hover:text-white">Contact Us</button>
                <button type="button" onClick={openMyBookings} className="text-sm text-[#9CA3AF] transition hover:text-white">My Bookings</button>
                <button type="button" onClick={switchToBusiness} className="rounded-full border border-[#374151] bg-[#1F2937] px-4 py-2 text-sm font-medium text-white transition hover:border-[#10B981]/50 hover:text-[#10B981]">Switch to Business</button>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen((prev) => !prev)} aria-label="Toggle menu" aria-expanded={mobileMenuOpen} className="inline-flex items-center justify-center rounded-lg border border-[#374151] p-2 text-white transition hover:border-[#10B981]/50 md:hidden">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </nav>
            {mobileMenuOpen ? <div className="border-t border-[#374151] bg-[#111827]/95 backdrop-blur-md md:hidden"><div className="flex flex-col gap-1 px-6 py-4"><a href="#how-it-works" className="rounded-lg px-3 py-3 text-sm text-[#9CA3AF] transition hover:bg-[#1F2937] hover:text-white">How it works</a><a href="#about" className="rounded-lg px-3 py-3 text-sm text-[#9CA3AF] transition hover:bg-[#1F2937] hover:text-white">About Us</a><button type="button" onClick={() => { setShowContactModal(true); setMobileMenuOpen(false); }} className="rounded-lg px-3 py-3 text-left text-sm text-[#9CA3AF] transition hover:bg-[#1F2937] hover:text-white">Contact Us</button><button type="button" onClick={() => { openMyBookings(); setMobileMenuOpen(false); }} className="rounded-lg px-3 py-3 text-left text-sm text-[#9CA3AF] transition hover:bg-[#1F2937] hover:text-white">My Bookings</button><div className="mt-2 border-t border-[#374151] pt-3"><button type="button" onClick={() => { switchToBusiness(); setMobileMenuOpen(false); }} className="block rounded-lg border border-[#374151] bg-[#1F2937] px-3 py-3 text-center text-sm font-medium text-white transition hover:border-[#10B981]/50 hover:text-[#10B981]">Switch to Business</button></div></div></div> : null}
          </header>

          <div id="top">
            <main>
              <section className="relative overflow-hidden px-6 pt-20 pb-24 lg:px-8 lg:pt-28 lg:pb-32">
                <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#10B981]/10 blur-[120px]" />
                <div className="relative mx-auto max-w-3xl text-center">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#374151] bg-[#1F2937] px-4 py-1.5 text-xs font-medium text-[#9CA3AF]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />Live queues across 4,000+ organizations
                  </div>
                  <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Skip the Wait.<br /><span className="text-[#10B981]">Not the Appointment.</span></h1>
                  <p className="mx-auto mt-6 max-w-lg text-base text-[#9CA3AF] sm:text-lg">AI-powered real-time queue management.</p>
                  <form onSubmit={(e) => { e.preventDefault(); openSearch(searchQuery); }} className="mx-auto mt-10 max-w-2xl">
                    <div className="flex items-center gap-3 rounded-2xl border border-[#374151] bg-[#1F2937] px-5 py-4 transition focus-within:border-[#10B981]/60 sm:px-6 sm:py-5">
                      <Search className="h-5 w-5 shrink-0 text-[#9CA3AF] sm:h-6 sm:w-6" />
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Search for a clinic, bank, or salon..." className="w-full bg-transparent text-sm text-white placeholder:text-[#9CA3AF] focus:outline-none sm:text-base" />
                      <button type="submit" aria-label="Search" className="flex shrink-0 items-center justify-center rounded-xl bg-[#10B981] p-3 text-sm font-semibold text-[#111827] transition hover:bg-[#10B981]/90 sm:px-5 sm:py-2.5"><Search className="h-5 w-5 sm:hidden" /><span className="hidden sm:inline">Search</span></button>
                    </div>
                  </form>
                  <div className="mt-10 max-w-3xl mx-auto overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                    <div className="flex gap-8 w-max marquee-track">
                      {[
                        { text: 'Al-Shifa Clinic — next token in 12 min', query: 'Al-Shifa' },
                        { text: 'NADRA Gulberg — next token in 6 min', query: 'NADRA' },
                        { text: 'Style Loft Salon — next token in 3 min', query: 'Style Loft' },
                        { text: 'City Diagnostics Lab — next token in 20 min', query: 'City Diagnostics' },
                      ].map((item) => (
                        <button
                          key={item.text}
                          type="button"
                          onClick={() => openSearch(item.query)}
                          className="text-sm text-[#9CA3AF] whitespace-nowrap transition hover:text-[#10B981] hover:underline"
                        >
                          🟢 {item.text}
                        </button>
                      ))}
                      {[
                        { text: 'Al-Shifa Clinic — next token in 12 min', query: 'Al-Shifa' },
                        { text: 'NADRA Gulberg — next token in 6 min', query: 'NADRA' },
                        { text: 'Style Loft Salon — next token in 3 min', query: 'Style Loft' },
                        { text: 'City Diagnostics Lab — next token in 20 min', query: 'City Diagnostics' },
                      ].map((item) => (
                        <button
                          key={`${item.text}-dup`}
                          type="button"
                          onClick={() => openSearch(item.query)}
                          className="text-sm text-[#9CA3AF] whitespace-nowrap transition hover:text-[#10B981] hover:underline"
                        >
                          🟢 {item.text}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section id="categories" className="px-6 py-20 lg:px-8">
                <div className="mx-auto max-w-7xl">
                  <div className="mb-12 text-center">
                    <h2 className="text-2xl font-bold sm:text-3xl">Browse by category</h2>
                    <p className="mt-3 text-sm text-[#9CA3AF] sm:text-base">Every service, one queue system.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      { label: 'Health', subtitle: 'Clinics & medical centers', icon: HeartPulse, category: 'Clinic', query: 'Clinic' },
                      { label: 'Government', subtitle: 'NADRA, banks, offices', icon: Landmark, category: 'Government', query: 'NADRA' },
                      { label: 'Beauty', subtitle: 'Salons & spas', icon: Scissors, category: 'Salon', query: 'Salon' },
                      { label: 'Dining', subtitle: 'Restaurants & cafés', icon: UtensilsCrossed, category: 'All', query: '' },
                      { label: 'Retail', subtitle: 'Stores & showrooms', icon: ShoppingBag, category: 'All', query: '' },
                      { label: 'Others', subtitle: 'Everything else', icon: MoreHorizontal, category: 'All', query: '' },
                    ].map((card) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={card.label}
                          onClick={() => {
                            setSelectedCategory(card.category);
                            openSearch(card.query);
                          }}
                          className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-[#374151] bg-[#112240] px-4 py-8 text-center transition duration-300 hover:-translate-y-1 hover:border-[#10B981]/50 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.35)]"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#10B981]/10 text-[#10B981] transition group-hover:bg-[#10B981]/20">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{card.label}</p>
                            <p className="mt-1 text-xs text-[#9CA3AF]">{card.subtitle}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section id="how-it-works" className="px-6 py-20 lg:px-8">
                <div className="mx-auto max-w-6xl">
                  <div className="mb-14 text-center">
                    <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
                    <p className="mt-3 text-sm text-[#9CA3AF] sm:text-base">Three steps between you and a shorter wait.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {[
                      { title: 'Search for a location', text: 'Find any clinic, bank, salon, or service near you — sorted by rating.', icon: MapPin },
                      { title: 'Join the live queue', text: 'Book a token in seconds over WhatsApp or the app. No calls, no forms.', icon: Smartphone },
                      { title: 'Arrive on your turn', text: 'Wait wherever you like. We notify you exactly when it is time to walk in.', icon: Clock3 },
                    ].map((step, idx) => { const Icon = step.icon; return <div key={step.title} className="relative flex flex-col items-center text-center"><div aria-hidden="true" className="absolute left-1/2 top-8 hidden h-px w-full bg-gradient-to-r from-[#374151] via-[#374151] to-transparent md:block" /> <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#10B981]/30 bg-[#1F2937] text-[#10B981]"><Icon className="h-6 w-6" /></div><h3 className="mt-6 text-lg font-semibold text-white">{step.title}</h3><p className="mt-2 max-w-xs text-sm text-[#9CA3AF]">{step.text}</p></div>;})}
                  </div>
                </div>
              </section>
            </main>

            <section id="about" className="border-t border-[#374151] bg-[#111827] px-6 py-20 lg:px-8">
              <div className="mx-auto max-w-5xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#374151] bg-[#1F2937] px-4 py-1.5 text-xs font-medium text-[#9CA3AF]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />About QueueIQ
                </div>
                <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">We hate waiting. So we fixed it.</h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm text-[#9CA3AF] sm:text-base">QueueIQ was born in Karachi out of a simple frustration: hours lost standing in clinic corridors, bank lines, and government offices with no idea how long the wait would really be.</p>
                <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {['4,000+', '2.3M+', '18 min', '24/7'].map((value, idx) => <div key={value} className="rounded-xl border border-[#374151] bg-[#1F2937] p-5"><p className="text-2xl font-bold text-[#10B981]">{value}</p><p className="mt-1 text-xs text-[#9CA3AF]">{['Orgs','Tokens','Avg saved','Live'][idx]}</p></div>)}
                </div>
              </div>
            </section>
            <footer className="border-t border-[#374151] px-6 py-10 lg:px-8">
              <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-lg font-bold"><span className="text-white">Queue</span><span className="text-[#10B981]">IQ</span></p>
                <p className="text-xs text-[#9CA3AF]">© 2026 QueueIQ. Skip the wait. Not the appointment.</p>
              </div>
            </footer>
          </div>

          <div className={`fade-enter fixed inset-0 z-[60] flex items-end justify-center p-0 md:items-center md:p-6 ${showSearchOverlay ? 'show' : ''}`} role="dialog" aria-modal="true" aria-label="Search results" onClick={closeSearch}>
            <div className="modal-panel panel-anim flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl md:h-auto md:max-h-[85vh] md:max-w-3xl md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="shrink-0 border-b border-[#374151] p-5">
                <div className="flex items-center gap-3">
                  <SearchAndFilter searchQuery={searchQuery} setSearchQuery={setSearchQuery} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
                  <button type="button" onClick={closeSearch} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#374151] text-[#9CA3AF] transition hover:border-[#10B981]/50 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-[#9CA3AF]">{filteredData.length} result{filteredData.length === 1 ? '' : 's'} found</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="mr-1 text-[#9CA3AF]">Sort by:</span>
                    {['rating', 'wait', 'distance'].map((option) => <button key={option} type="button" onClick={() => setSortBy(option)} className={`rounded-full border border-[#374151] px-3 py-1.5 text-[#9CA3AF] transition hover:text-white ${sortBy === option ? 'bg-[#10B981] text-[#111827] border-[#10B981]' : ''}`}>{option === 'rating' ? 'Rating' : option === 'wait' ? 'Wait Time' : 'Distance'}</button>)}
                  </div>
                </div>
              </div>
              <div className="grid flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
                {filteredData.length === 0 ? <div className="col-span-2 flex flex-col items-center justify-center p-10 text-center"><div className="mb-4 text-5xl">😕</div><p className="font-semibold text-white">No results found.</p><p className="mt-1 text-sm text-[#9CA3AF]">Try another search.</p></div> : filteredData.map((item) => <UniversalCard key={item.id} item={item} onBook={(item: any) => openBooking(item)} />)}
              </div>
            </div>
          </div>

          <div className={`fade-enter fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-6 ${showBookingOverlay && showBookingModal ? 'show' : ''}`} role="dialog" aria-modal="true" aria-label="Booking" onClick={closeBooking}>
            <div className="modal-panel panel-anim flex h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl md:h-auto md:max-h-[85vh] md:max-w-lg md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              {renderBookingBody()}
            </div>
          </div>

          {toast ? <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[#374151] bg-[#1F2937] px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div> : null}
        </div>
      ) : (
        <div className={`min-h-screen bg-[#111827] text-white transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSwitching && switchTarget === 'user' ? 'translate-y-full opacity-0' : 'opacity-100'}`}>
          <header className="sticky top-0 z-40 border-b border-[#374151] bg-[#111827]/70 backdrop-blur-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
              <p className="text-2xl font-bold tracking-tight"><span className="text-white">Queue</span><span className="text-[#10B981]">IQ</span><span className="ml-1 align-middle text-xs font-medium text-[#9CA3AF]">Business</span></p>
              <button type="button" onClick={switchToUser} className="flex items-center gap-1.5 rounded-full border border-[#374151] bg-[#1F2937] px-4 py-2 text-sm font-medium text-white transition hover:border-[#10B981]/50 hover:text-[#10B981]"> <ArrowLeft className="h-3.5 w-3.5" /> Back to QueueIQ</button>
            </nav>
          </header>
          {renderBusinessDashboard()}
          {toast ? <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[#374151] bg-[#1F2937] px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div> : null}
        </div>
      )}
      {renderContactModal()}
      {renderMyBookingsModal()}
      {/* TODO: Add business WhatsApp number via NEXT_PUBLIC_WHATSAPP_NUMBER */}
      <button onClick={() => setIsChatBotOpen(true)} style={{ bottom: '20px', right: '20px' }} className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all duration-300 ease-in-out hover:scale-110 hover:bg-[#128C7E] hover:shadow-[0_6px_25px_rgba(18,140,126,0.5)]" aria-label="Open chat"><MessageCircle className="h-7 w-7" /></button>

      <ChatBotModal isOpen={isChatBotOpen} onClose={() => setIsChatBotOpen(false)} />
    </div>
  );
}
