// Story tab (PRD §46): Story Bible, cast and the Structure (beat) board. Deep-linkable with ?view=bible|characters|structure.
// On wide screens the board keeps an opened beat in a panel beside it (the desk mockup's right-hand column).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { STC_BEATS } from '@shared/structure';
import type { StcBeatKey } from '@shared/types';

import { BibleView } from '@/components/story/bible';
import { CharactersView } from '@/components/story/characters';
import { useWide } from '@/components/story/common';
import { BeatPanel, StructureView } from '@/components/story/structure';
import { Screen, SegmentedControl } from '@/components/ui';
import { useProject } from '@/lib/session';

const VIEWS = [
  { value: 'bible', label: 'Bible' },
  { value: 'characters', label: 'Characters' },
  { value: 'structure', label: 'Structure' },
] as const;

type StoryView = (typeof VIEWS)[number]['value'];

/** How far each board may spread on wide screens: reading stays narrower than the wall of cards. */
const WIDE_CONTENT: Record<StoryView, number> = { bible: 1040, characters: 1120, structure: 1400 };

export default function StoryScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const { project, sim, can, refresh } = useProject();
  const wide = useWide();
  // undefined: nothing chosen yet (wide screens open the active beat); null: closed.
  const [picked, setPicked] = useState<StcBeatKey | null | undefined>(undefined);
  const view: StoryView = VIEWS.find((v) => v.value === params.view)?.value ?? 'bible';
  if (!project) return null; // the project layout only mounts tabs once loaded

  const active = sim ? STC_BEATS[sim.beatIndex]!.key : null;
  const selected = picked === undefined ? (wide ? active : null) : picked;
  const panel = wide && view === 'structure' && can('seeMeta') && selected ? selected : null;

  return (
    <View style={styles.split}>
      <Screen onRefresh={refresh} contentStyle={wide ? { maxWidth: WIDE_CONTENT[view], alignSelf: 'flex-start' } : undefined}>
        <SegmentedControl
          accessibilityLabel="Story section"
          options={VIEWS}
          value={view}
          onChange={(next) => router.setParams({ view: next })}
          style={wide && styles.tabs}
        />
        {view === 'bible' ? (
          <BibleView />
        ) : view === 'characters' ? (
          <CharactersView />
        ) : (
          <StructureView selected={selected} onSelect={setPicked} />
        )}
      </Screen>
      {panel && <BeatPanel beatKey={panel} onSelect={setPicked} />}
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  tabs: { width: '100%', maxWidth: 520 },
});
