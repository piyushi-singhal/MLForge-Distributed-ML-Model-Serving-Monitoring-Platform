import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import '@/styles/globals.css';
import { Sidebar } from '@/components/Sidebar';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MLForge Operational Dashboard",
  description: "Real‑time observability and control center for MLForge services",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex h-screen bg-zinc-950 text-zinc-100 antialiased overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto h-full">
          {children}
        </main>
      </body>
    </html>
  );
}
