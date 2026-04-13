import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { WellbeingMonitor } from "@/components/layout/wellbeing-monitor";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GrindUp - Master Your Coding Skills",
  description: "A comprehensive learning platform with LeetCode-style challenges, AI-powered roadmaps, and personalized learning.",
  keywords: ["coding", "leetcode", "programming", "interview prep", "algorithms", "data structures"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
          {children}
          <WellbeingMonitor />
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
