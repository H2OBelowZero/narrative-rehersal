import { useState } from 'react';

import { Caption } from '@/components/ui';
import { errorMessage } from '@/lib/format';

/**
 * Tracks this component's mutations: which one is in flight and the last failure, keyed by name.
 * `useProject().call` already toasts errors; this keeps a working state and an inline message next to the control.
 */
export function useMutation() {
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  const run = async (key: string, task: () => Promise<unknown>): Promise<boolean> => {
    setBusy(key);
    setFailure(null);
    try {
      await task();
      return true;
    } catch (e) {
      setFailure({ key, message: errorMessage(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { busy, run, error: (key: string) => (failure?.key === key ? failure.message : null) };
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Caption tone="danger" accessibilityLiveRegion="polite">
      {message}
    </Caption>
  );
}
