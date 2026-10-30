// Projects as index cards pinned to the cork strip under the desk: title typed, logline, a genre stamp, who is in
// it, and whether this device holds a seat. A blank card taped beside them starts a new one.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { ProjectSummary } from '@shared/types';

import { Paper } from '@/components/board/paper';
import { Badge, Caption, Card, EmptyState, Heading, Icon } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import type { Identity } from '@/lib/session';
import { fonts, palettes, spacing, useTheme } from '@/theme';

const CARD = 252;
const CARD_WIDE = 262;
const NEW_NARROW = 148;

export interface ProjectCardsProps {
  projects: ProjectSummary[] | null;
  error: string | null;
  identities: Record<string, Identity>;
  online: boolean;
  wide: boolean;
  onOpen: (p: ProjectSummary) => void;
  onCreate: () => void;
}

export function ProjectCards({ projects, error, identities, online, wide, onOpen, onCreate }: ProjectCardsProps) {
  if (!projects) {
    return error ? (
      <EmptyState icon="offline" title="Can’t see the board" message="Projects appear here once the server is reachable." />
    ) : (
      <Row wide={wide}>
        {[0, 1, 2].map((i) => (
          <BlankCard key={i} width={wide ? CARD_WIDE : CARD} />
        ))}
      </Row>
    );
  }
  if (projects.length === 0) {
    return (
      <EmptyState
        icon="film"
        title="No projects yet"
        message="Start with the Undertow sample story to see the rehearsal loop, or begin from a blank project."
        action={{ label: 'New project', icon: 'plus', onPress: onCreate }}
      />
    );
  }
  // Seats on this device first; the server already orders by last update.
  const sorted = [...projects].sort((a, b) => Number(!!identities[b.id]) - Number(!!identities[a.id]));
  const cards = sorted.map((p) => (
    <ProjectCard key={p.id} project={p} joined={!!identities[p.id]} width={wide ? CARD_WIDE : CARD} onOpen={onOpen} />
  ));
  const blank = <NewCard key="new" width={wide ? CARD_WIDE : NEW_NARROW} online={online} onCreate={onCreate} />;
  // Phones: a strip you flick through, with the blank card first so it is never off-screen. Wide: rows of cards.
  return <Row wide={wide}>{wide ? [...cards, blank] : [blank, ...cards]}</Row>;
}

function Row({ wide, children }: { wide: boolean; children: ReactNode }) {
  if (wide) return <View style={styles.grid}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      style={styles.strip}
      contentContainerStyle={styles.stripContent}>
      {children}
    </ScrollView>
  );
}

function ProjectCard({
  project: p,
  joined,
  width,
  onOpen,
}: {
  project: ProjectSummary;
  joined: boolean;
  width: number;
  onOpen: (p: ProjectSummary) => void;
}) {
  const title = p.title || 'Untitled project';
  const people = `${p.participantCount} ${p.participantCount === 1 ? 'person' : 'people'}`;
  const updated = `updated ${timeAgo(p.updatedAt)}`;
  return (
    <Card
      tilt={p.id}
      pin={joined ? 'brass' : 'red'}
      onPress={() => onOpen(p)}
      accessibilityLabel={[title, p.genre, `${people}, ${updated}`, joined ? 'Joined, opens the project' : 'Not joined, choose a name and role to join']
        .filter(Boolean)
        .join('. ')}
      style={[styles.card, { width }]}>
      <ProjectFace title={title} project={p} joined={joined} meta={`${people}, ${updated}`} />
    </Card>
  );
}

function ProjectFace({ title, project: p, joined, meta }: { title: string; project: ProjectSummary; joined: boolean; meta: string }) {
  const { colors } = useTheme(); // paper
  return (
    <>
      <View style={styles.face}>
        <Heading numberOfLines={2} style={styles.title}>
          {title.toUpperCase()}
        </Heading>
        {p.logline ? (
          <Caption numberOfLines={4} style={styles.logline}>
            {p.logline}
          </Caption>
        ) : (
          <Caption tone="tertiary">No logline yet.</Caption>
        )}
      </View>
      <View style={styles.foot}>
        {p.genre ? <Badge label={p.genre} /> : null}
        <Caption tone="tertiary" numberOfLines={2}>
          {meta}
        </Caption>
        <View style={[styles.seat, { borderTopColor: colors.separator }]}>
          {joined ? (
            <Badge label="Joined" color={colors.canon.canon} />
          ) : (
            <View style={styles.join}>
              <Icon name="person-add" size={15} color={colors.accentText} />
              <Caption tone="accent" strong>
                Join
              </Caption>
            </View>
          )}
          <Icon name="arrow-right" size={14} color={joined ? colors.textTertiary : colors.accentText} />
        </View>
      </View>
    </>
  );
}

/** A blank card taped to the cork: start a new project. */
function NewCard({ width, online, onCreate }: { width: number; online: boolean; onCreate: () => void }) {
  return (
    <Card
      fasten="tape"
      tilt="new-project"
      onPress={online ? onCreate : undefined}
      accessibilityLabel="New project"
      style={[styles.card, styles.newCard, { width }, !online && styles.offline]}>
      <NewFace online={online} />
    </Card>
  );
}

function NewFace({ online }: { online: boolean }) {
  const { colors } = useTheme(); // paper
  return (
    <View style={styles.newFace}>
      <View style={[styles.plus, { borderColor: colors.border }]}>
        <Icon name="plus" size={26} color={colors.text} />
      </View>
      <Heading style={styles.centre}>New project</Heading>
      <Caption style={styles.centre}>{online ? 'The Undertow sample or a blank board.' : 'Needs the server.'}</Caption>
    </View>
  );
}

/** Loading: blank ruled cards where the projects will be pinned. */
function BlankCard({ width }: { width: number }) {
  return (
    <View style={[styles.blank, { width }]} accessibilityLabel="Loading projects">
      <Paper style={styles.blankPaper}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.rule, { backgroundColor: palettes.paper.separator }, i === 0 && styles.ruleTitle]} />
        ))}
      </Paper>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: -spacing.lg },
  // Room above for pins and tape, below for the paper's shadow: the scroll view clips its content.
  stripContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg, alignItems: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, paddingTop: spacing.sm },
  card: { minHeight: 236, justifyContent: 'space-between' },
  face: { gap: spacing.sm },
  title: { letterSpacing: 1.2 },
  logline: { fontFamily: fonts.typewriterItalic },
  foot: { gap: spacing.sm, marginTop: spacing.md },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    minHeight: 34,
  },
  join: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  newCard: { justifyContent: 'center', paddingLeft: spacing.lg },
  newFace: { alignItems: 'center', gap: spacing.sm },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  centre: { textAlign: 'center' },
  offline: { opacity: 0.6 },
  blank: { opacity: 0.45 },
  blankPaper: { minHeight: 236, padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  rule: { height: 1 },
  ruleTitle: { height: 3, width: '60%' },
});
