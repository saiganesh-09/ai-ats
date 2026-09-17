import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "AI ATS — Hire smarter",
    template: "%s · AI ATS",
  },
  description:
    "AI-powered applicant tracking system: resume parsing, match scoring, and hiring pipelines.",
  openGraph: {
    title: "AI ATS — Hire smarter",
    description:
      "Multi-tenant ATS with AI resume parsing, match scoring, and a full hiring pipeline.",
    images: ["/og.png"],
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <DemoBanner />
          <Navbar />
          <div className="flex-1">{children}</div>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            AI ATS · Next.js, NestJS, PostgreSQL, Prisma ·
            portfolio demo — not a real recruiting service
          </footer>
        </Providers>
      </body>
    </html>
  );
}
