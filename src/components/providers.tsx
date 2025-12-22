"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import { Toaster } from "@/components/ui/toaster";

export function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      {children}
      <Toaster />
    </SessionProvider>
  );
}
