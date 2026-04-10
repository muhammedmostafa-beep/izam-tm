"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 ml-[260px] transition-all duration-300">
            <Header />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}
