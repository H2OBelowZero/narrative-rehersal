// Discover tab: Discovery Room, Screenplay Room and branches (PRD §29–31, §41–45, §54). Deep link with ?view=.
import { router, useLocalSearchParams } from 'expo-router';

import { BlindLock, useBlindSession } from '@/components/discover/blind-lock';
import { BOARD_MAX, useBoard } from '@/components/discover/board-bits';
import { BranchesView } from '@/components/discover/branches-view';
import { DiscoveriesView } from '@/components/discover/discoveries-view';
import { ScreenplayView } from '@/components/discover/screenplay-view';
import { Screen, SegmentedControl } from '@/components/ui';
import { useProject } from '@/lib/session';

const VIEWS = [
  { value: 'discoveries', label: 'Discoveries' },
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'branches', label: 'Branches' },
] as const;
type View = (typeof VIEWS)[number]['value'];

export default function DiscoverScreen() {
  const { project, refresh } = useProject();
  const blind = useBlindSession();
  const { wide } = useBoard();
  const params = useLocalSearchParams<{ view?: string }>();
  const view: View = VIEWS.find((v) => v.value === params.view)?.value ?? 'discoveries';
  if (!project) return null;

  if (blind) {
    return (
      <Screen onRefresh={refresh}>
        <BlindLock />
      </Screen>
    );
  }

  // Wide boards lay cards in rows, so they outgrow the reading measure; useBoard sizes its columns to BOARD_MAX.
  return (
    <Screen onRefresh={refresh} contentStyle={wide ? { maxWidth: BOARD_MAX } : undefined}>
      <SegmentedControl
        options={VIEWS}
        value={view}
        onChange={(next) => router.setParams({ view: next })}
        accessibilityLabel="Discover section"
      />
      {view === 'discoveries' && <DiscoveriesView />}
      {view === 'screenplay' && <ScreenplayView />}
      {view === 'branches' && <BranchesView />}
    </Screen>
  );
}
