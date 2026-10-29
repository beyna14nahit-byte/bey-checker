"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the page from the server the moment a promotion starts or ends, so a page left open
 * never keeps showing an old price. The server price is always the one charged.
 */
export function PriceWatcher({ changesAt, serverTime }: { changesAt: string | null; serverTime: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!changesAt) return;
    // Use the server's clock offset so a wrong device clock does not matter.
    const offset = Date.parse(serverTime) - Date.now();
    const wait = Date.parse(changesAt) - (Date.now() + offset) + 500;
    if (wait > 2_147_000_000) return; // beyond setTimeout's range (about 24 days)
    const id = setTimeout(() => router.refresh(), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [changesAt, serverTime, router]);
  return null;
}
