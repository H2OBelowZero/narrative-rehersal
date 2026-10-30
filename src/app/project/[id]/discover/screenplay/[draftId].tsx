// One compiled screenplay draft, in page format with provenance (PRD §41–43).
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { BlindLock, useBlindSession } from '@/components/discover/blind-lock';
import { ScreenplayPage } from '@/components/discover/screenplay-page';
import { EmptyState, Screen } from '@/components/ui';
import { useProject } from '@/lib/session';

export default function ScreenplayDraftScreen() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const { project, projectId } = useProject();
  const blind = useBlindSession();
  if (!project) return null;

  const draft = project.screenplays.find((d) => d.id === draftId);
  if (draft && !blind) return <ScreenplayPage draft={draft} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Screenplay', headerLargeTitleEnabled: false }} />
      {blind ? (
        <BlindLock />
      ) : (
        <EmptyState
          icon="script"
          title="Draft not found"
          message="This draft isn’t part of the project you have open."
          action={{
            label: 'All drafts',
            onPress: () => router.dismissTo({ pathname: '/project/[id]/discover', params: { id: projectId, view: 'screenplay' } }),
          }}
        />
      )}
    </Screen>
  );
}
