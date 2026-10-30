// The project board (PRD §14, §46, §54): a title card, then the four areas pinned in nav order and joined by one
// red string. Story state, structural position, the scene in play, the crew, discoveries and the north-star count
// all live on the cards; tapping a card follows the string to that area.
import { Stack } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Project } from '@shared/types';

import { CrewCard, DiscoverCard, RehearseCard, StoryCard } from '@/components/home/area-cards';
import { HeaderWordmark, WIDE } from '@/components/home/desk-hero';
import { Badge, Body, Caption, Card, CanonBadge, Icon, Screen, Title } from '@/components/ui';
import { BRANCH_MODE_LABEL } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, spacing, useTheme } from '@/theme';

export default function ProjectBoard() {
  const { project, error, refresh } = useProject();
  const wide = useWindowDimensions().width >= WIDE;
  if (!project) return null; // the project layout only mounts tabs once loaded

  return (
    <Screen onRefresh={refresh} edges={wide ? ['top'] : []} contentStyle={wide ? styles.wide : undefined}>
      <Stack.Screen
        options={{
          title: project.model.title || 'Untitled project',
          // Phones: the wordmark heads the board (and leads back to every project). Wide: the sidebar carries it.
          headerTitle: () => <HeaderWordmark />,
          headerLargeTitleEnabled: false,
          headerShown: !wide,
        }}
      />
      <Card pin="brass" tilt="title">
        <TitleFace project={project} offline={!!error} />
      </Card>
      {wide ? (
        // Two rows, read along the string: Story to Rehearse, down to Crew, back across to Discover.
        <>
          <View style={styles.row}>
            <View style={styles.cell}>
              <StoryCard order={1} />
            </View>
            <View style={styles.cell}>
              <RehearseCard order={2} />
            </View>
          </View>
          <View style={[styles.row, styles.reverse]}>
            <View style={styles.cell}>
              <CrewCard order={3} />
            </View>
            <View style={styles.cell}>
              <DiscoverCard order={4} />
            </View>
          </View>
        </>
      ) : (
        <>
          <StoryCard order={1} />
          <RehearseCard order={2} />
          <CrewCard order={3} />
          <DiscoverCard order={4} />
        </>
      )}
    </Screen>
  );
}

/** Typed title, logline, what kind of story, which branch is live and whether a session is running. */
function TitleFace({ project, offline }: { project: Project; offline: boolean }) {
  const { colors } = useTheme(); // paper
  const { branch } = useProject();
  const { model, activeSessionId } = project;
  const kind = [model.genre, model.medium].filter(Boolean).join(', ');
  return (
    <>
      <Title style={styles.title}>{(model.title || 'Untitled project').toUpperCase()}</Title>
      {model.logline ? <Body style={styles.logline}>{model.logline}</Body> : <Body tone="tertiary">No logline yet.</Body>}
      <View style={styles.stamps}>
        {kind ? <Badge label={kind} /> : null}
        {branch && <Badge icon="branch" label={`${branch.name}: ${BRANCH_MODE_LABEL[branch.mode]}`} color={colors.text} />}
        {branch?.status === 'canon' && <CanonBadge status="canon" />}
        {activeSessionId ? (
          <Badge label="Session live" color={colors.accentText} />
        ) : (
          <Badge label="No session running" variant="outline" />
        )}
      </View>
      {offline && (
        <Card tone="sunken" style={styles.offline}>
          <Icon name="offline" size={18} color={colors.textSecondary} />
          <Caption style={styles.grow}>Can’t reach the server. Showing the last known state; pull to retry.</Caption>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wide: { maxWidth: 1180, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  reverse: { flexDirection: 'row-reverse' },
  cell: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: 2 },
  logline: { fontFamily: fonts.typewriterItalic },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
});
