import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";
import { WellbeingMonitor } from "@/components/layout/wellbeing-monitor";
import { Toaster } from "@/components/ui/toaster";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  let userStats = { streak: 0, xp: 0, level: 1 };
  let displayName = session?.user?.name || "User";
  let displayInitial = displayName.charAt(0).toUpperCase();

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        username: true,
        xp: true,
        currentStreak: true,
        level: true,
      },
    });

    if (user) {
      displayName = user.name || user.username || session.user.name || "User";
      displayInitial = displayName.charAt(0).toUpperCase();
      userStats = {
        streak: user.currentStreak,
        xp: user.xp,
        level: user.level,
      };
    }
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
          <AppShell
            isLoggedIn={!!session?.user?.id}
            userStats={userStats}
            displayName={displayName}
            displayInitial={displayInitial}
          >
            {children}
          </AppShell>
          <WellbeingMonitor />
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
