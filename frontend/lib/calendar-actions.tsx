"use client";

import { CalendarPlus, Download } from 'lucide-react';

export function CalendarActions({ clinicName, date, time, token }: { clinicName: string; date?: string; time?: string; token: string }) {
  if (!date) return null;
  const safeDate = date.toLowerCase() === 'today' ? new Date().toISOString().split('T')[0] : date;
  const safeTime = time || '10:00';
  const appointmentDate = new Date(`${safeDate}T${safeTime}`);
  if (Number.isNaN(appointmentDate.getTime())) return null;

  const endDate = new Date(appointmentDate.getTime() + 30 * 60 * 1000);

  const formatICSDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const downloadICS = () => {
    const startFormatted = formatICSDate(appointmentDate);
    const endFormatted = formatICSDate(endDate);
    const nowFormatted = formatICSDate(new Date());

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//QueueIQ//Appointment Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:queueiq-${Date.now()}-${Math.floor(Math.random() * 10000)}@queueiq.pk`,
      `DTSTAMP:${nowFormatted}`,
      `DTSTART:${startFormatted}`,
      `DTEND:${endFormatted}`,
      `SUMMARY:Appointment at ${clinicName} (Token: ${token})`,
      `DESCRIPTION:QueueIQ Appointment at ${clinicName}\\nToken Number: ${token}\\nDate: ${safeDate}\\nTime: ${safeTime}`,
      `LOCATION:${clinicName}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `appointment-${token || 'queueiq'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appointment at ${clinicName}`)}&details=${encodeURIComponent(`Token: ${token}`)}&location=${encodeURIComponent(clinicName)}`;

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <a
        href={calendarLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 ease-in-out hover:bg-[#0D9D6E] hover:shadow-lg hover:-translate-y-0.5"
      >
        <CalendarPlus className="h-4 w-4" /> Add to Google Calendar
      </a>
      <button
        type="button"
        onClick={downloadICS}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#10B981] bg-white px-4 py-2.5 text-sm font-bold text-[#10B981] transition-all duration-300 ease-in-out hover:bg-[#10B981] hover:text-white hover:shadow-md hover:-translate-y-0.5"
      >
        <Download className="h-4 w-4" /> Download .ics
      </button>
    </div>
  );
}