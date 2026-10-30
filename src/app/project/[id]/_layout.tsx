import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { StringNav } from '@/components/string-nav';
import { Body, Button, Card, EmptyState, Screen } from '@/components/ui';
import { ProjectProvider, useProject, useSession } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

export default function ProjectLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, identities } = useSession();
  if (!ready) return null;
  // No seat on this device yet: go join first (the Welcome screen opens the join sheet).
  if (!identities[id]) return <Redirect href={{ pathname: '/', params: { join: id } }} />;
  return (
    <ProjectProvider key={id} projectId={id}>
      <ProjectShell />
    </ProjectProvider>
  );
}

/** The string nav once the project is loaded; until then the empty board, with a card or a note pinned to it. */
function ProjectShell() {
  const { forget } = useSession();
  const { projectId, project, loading, error, me, refresh } = useProject();

  if (project && me) return <StringNav />;

  return (
    <Screen scroll={false} edges={['top', 'bottom']} contentStyle={styles.centre}>
      {loading ? (
        <Card tilt="opening" pin="brass" style={styles.opening} accessibilityLabel="Opening the project">
          <Opening />
        </Card>
      ) : project ? (
        <EmptyState
          icon="person"
          title="Your seat wasn’t found"
          message="This device’s identity is no longer part of the project. Join again to continue."
          action={{ label: 'Join again', icon: 'person-add', onPress: () => forget(projectId) }}
        />
      ) : (
        <EmptyState
          icon="offline"
          title="Couldn’t open this project"
          message={error ?? undefined}
          action={{ label: 'Try again', icon: 'refresh', onPress: () => void refresh() }}
        />
      )}
      {!loading && <Button title="All projects" icon="back" variant="secondary" style={styles.back} onPress={() => router.dismissTo('/')} />}
    </Screen>
  );
}

function Opening() {
  const { colors } = useTheme(); // paper
  return (
    <View style={styles.openingRow}>
      <ActivityIndicator color={colors.text} />
      <Body>Opening the board…</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', maxWidth: 420 },
  opening: { alignSelf: 'center' },
  openingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { alignSelf: 'center' },
});
