// Character Lab (PRD §9–11, §26, §31).
import { Stack, useLocalSearchParams } from 'expo-router';

import { CharacterLab } from '@/components/story/character-lab';
import { useWide } from '@/components/story/common';
import { EmptyState, Screen } from '@/components/ui';
import { useProject } from '@/lib/session';

export default function CharacterScreen() {
  const { cid } = useLocalSearchParams<{ cid: string }>();
  const { project, character, refresh } = useProject();
  const c = character(cid);
  const wide = useWide();
  if (!project) return null;

  return (
    <Screen onRefresh={refresh} contentStyle={wide ? { maxWidth: 1120 } : undefined}>
      <Stack.Screen options={{ title: c?.name ?? 'Character', headerLargeTitleEnabled: false }} />
      {c ? (
        <CharacterLab character={c} />
      ) : (
        <EmptyState icon="person" title="Character not found" message="It may have been removed from the story." />
      )}
    </Screen>
  );
}
