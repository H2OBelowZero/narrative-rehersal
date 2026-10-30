import { EmptyState } from '@/components/ui';
import { useProject } from '@/lib/session';

/**
 * A performer in a blind session (PRD §32): the server strips discoveries and other branches' history from
 * their view, and drafts replay moments they didn't witness — so the whole Discover tab stays closed.
 */
export function useBlindSession(): boolean {
  const { project, role } = useProject();
  return !!project?.redacted && project.settings.blindMode && role === 'performer';
}

export function BlindLock() {
  return (
    <EmptyState
      icon="lock"
      title="You’re rehearsing blind"
      message="Discoveries, screenplay drafts and branches open once blind mode ends, so what you play stays your own reading of the role."
    />
  );
}
