"use client";

import { useEffect, useState } from "react";

/**
 * Pulsing dot that checks server reachability via a lightweight health endpoint.
 * Green = reachable, Red = unreachable.
 */
export function ServerStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/trpc/version.getCurrentVersion?input=%7B%7D", {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) setIsOnline(res.ok);
      } catch {
        if (!cancelled) setIsOnline(false);
      }
    };

    void check();
    const id = setInterval(() => void check(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <span
      className={`relative inline-block h-2.5 w-2.5 rounded-full ${
        isOnline ? "bg-emerald-500" : "bg-red-500"
      }`}
      title={isOnline ? "Server reachable" : "Server unreachable"}
    >
      <span
        className={`absolute inset-0 animate-ping rounded-full opacity-75 ${
          isOnline ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
    </span>
  );
}
