import { useEffect, useState } from 'react';

/** Current time that re-renders every `intervalMs` — keeps render pure while "active"/"ago" labels stay fresh. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
