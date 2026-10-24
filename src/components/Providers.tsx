"use client";
import { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { startSync, stopSync } from "@/lib/progressSync";

// Turns progress syncing on while a player is signed in (see progressSync).
function ProgressSync() {
  const { data, status } = useSession();
  const id = (data?.user as { id?: string } | undefined)?.id;
  useEffect(() => {
    if (status === "authenticated" && id) startSync(id);
    else if (status === "unauthenticated") stopSync();
  }, [status, id]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProgressSync />
      {children}
    </SessionProvider>
  );
}
