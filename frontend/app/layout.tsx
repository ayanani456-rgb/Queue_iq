import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QueueIQ — Skip the Wait. Not the Appointment.',
  description: 'AI-powered real-time queue management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#111827] text-white antialiased">{children}</body>
    </html>
  );
}
