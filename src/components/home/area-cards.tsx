// The project board's four areas, pinned in nav order and joined by one red string (thread 'flow'). Each card is
// what the area holds right now; tapping it follows the string there. Structure stays with those who steer
// (seeMeta), analysis with those who analyse, and nothing here judges a choice.
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { beatDef, HGS_GUIDE, ROLE_LABEL, STC_BEATS, TIER_LABEL } from '@shared/structure';
import type { Discovery, StoryEvent } from '@shared/types';

import { fillImage, sceneImage } from '@/components/board/materials';
import { paperShadow, tiltFor } from '@/components/board/paper';
import { followString, type TabName } from '@/components/string-nav';
import {
  Avatar,
  Badge,
  beatIcon,
  Body,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Icon,
  Term,
  InkMark,
  List,
  ListRow,
  Mono,
  ProgressBar,
  Section,
  TierBadge,
} from '@/components/ui';
import { DISCOVERY_KIND_LABEL, DISCOVERY_STATUS_LABEL, isActive, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { useNow } from '@/lib/use-now';
import { fonts, spacing, useTheme, world, type Palette } from '@/theme';

const ACT = ['', 'I', 'II', 'III'] as const;
const ACT_GUIDE: Record<1 | 2 | 3, string> = {
  1: `${HGS_GUIDE.act1}`,
  2: `${HGS_GUIDE.act2}`,
  3: `${HGS_GUIDE.act3[0]}-${HGS_GUIDE.act3[1]}`,
};

/** Emerged and taken seriously (PRD §54): being considered or promoted. */
const isMeaningful = (d: Discovery) => d.status === 'considering' || d.status === 'promoted';

function lastResolution(events: StoryEvent[]): StoryEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i]!.kind === 'resolution' && events[i]!.resolution) return events[i];
  return undefined;
}

// ───────── The pinned card every area shares ─────────

function AreaCard({
  tab,
  order,
  title,
  note,
  label,
  children,
}: {
  tab: Exclude<TabName, 'home'>;
  order: number;
  title: string;
  note: string;
  /** Spoken summary: the card is one button. */
  label: string;
  children: ReactNode;
}) {
  const { projectId } = useProject();
  return (
    <Section title={title} note={note}>
      <Card
        thread="flow"
        order={order}
        tilt={tab}
        accessibilityLabel={`${title}. ${label} Opens ${title}.`}
        onPress={() => followString(projectId, tab)}>
        {children}
        <Follow title={title} />
      </Card>
    </Section>
  );
}

/** The card's own affordance: where the string goes next. */
function Follow({ title }: { title: string }) {
  const { colors } = useTheme(); // paper
  return (
    <View style={[styles.follow, { borderTopColor: colors.separator }]}>
      <Caption tone="accent" strong>
        Open {title}
      </Caption>
      <Icon name="arrow-right" size={14} color={colors.accentText} />
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  const { colors } = useTheme(); // paper
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Caption numberOfLines={2}>{label}</Caption>
      {note ? <Caption tone="tertiary">{note}</Caption> : null}
    </View>
  );
}

// ───────── Story ─────────

export function StoryCard({ order }: { order: number }) {
  const { beat, sequence, sim, can } = useProject();
  const meta = can('seeMeta') && !!beat && !!sim;
  const label = [
    meta && beat && sim ? `${beat.def.name}, act ${ACT[beat.def.act]}, beat ${sim.beatIndex + 1} of ${STC_BEATS.length}.` : '',
    sequence ? `Current goal: ${sequence.goal}.` : 'No goal is open yet.',
  ].join(' ');
  return (
    <AreaCard tab="story" order={order} title="Story" note="where it stands" label={label}>
      {meta && <Structure />}
      <Goal />
    </AreaCard>
  );
}

/** Administrative structure (owner / director / producer): beat, requirements, sequences, theme. */
function Structure() {
  const { colors } = useTheme(); // paper
  const { project, sim, beat, sequence } = useProject();
  if (!project || !sim || !beat) return null;
  const { def, state } = beat;
  const next = STC_BEATS[sim.beatIndex + 1];
  const met = new Set(state.conditionsMet.map((c) => c.requirementId));
  const actSequences = sim.sequences.filter((s) => beatDef(s.beatKey).act === def.act).length;

  return (
    <>
      <View style={styles.beatHead}>
        <InkMark name={beatIcon(def.key)} />
        <View style={[styles.grow, styles.tight]}>
          <Heading style={styles.beatName}>{def.name.toUpperCase()}</Heading>
          <Caption>
            Act {ACT[def.act]} · beat {sim.beatIndex + 1} of {STC_BEATS.length}
          </Caption>
        </View>
      </View>
      <Filmstrip index={sim.beatIndex} satisfied={state.status === 'satisfied'} name={def.name} />
      <Body tone="secondary">{def.purpose}</Body>

      <View style={styles.tight}>
        <Eyebrow>To land this beat</Eyebrow>
        {def.requirements.map((r) => (
          <View key={r.id} style={styles.requirement}>
            <View style={styles.requirementIcon}>
              <Icon
                name={met.has(r.id) ? 'check' : 'dot'}
                size={met.has(r.id) ? 16 : 6}
                color={met.has(r.id) ? colors.tier.success : colors.textTertiary}
              />
            </View>
            <Body style={styles.grow} tone={met.has(r.id) ? 'secondary' : 'primary'}>
              {r.text}
            </Body>
          </View>
        ))}
      </View>

      <View style={styles.terms}>
        <Term
          icon="target"
          text={sequence ? `HGS ${sequence.number}` : 'No HGS open'}
          spoken={
            sequence
              ? `Hero goal sequence ${sequence.number} of a typical ${HGS_GUIDE.total[0]} to ${HGS_GUIDE.total[1]}.`
              : 'No hero goal sequence is open.'
          }
        />
        <Term
          icon="structure"
          text={`Act ${ACT[def.act]}: ${actSequences} of ~${ACT_GUIDE[def.act]}`}
          spoken={`Act ${ACT[def.act]} has ${actSequences} sequences so far, about ${ACT_GUIDE[def.act]} is usual.`}
        />
        {next && <Term icon={beatIcon(next.key)} text={`Next: ${next.name}`} spoken={`${next.name} approaching.`} />}
      </View>

      {project.model.thematicConflict ? (
        <Term icon="graph" text={project.model.thematicConflict} spoken={`Theme pressure: ${project.model.thematicConflict}`} />
      ) : null}
    </>
  );
}

/** The fifteen beats as frames of film: exposed up to where the story stands, the current frame outlined. */
function Filmstrip({ index, satisfied, name }: { index: number; satisfied: boolean; name: string }) {
  const covered = index + (satisfied ? 1 : 0);
  return (
    <View
      style={styles.film}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Beats covered: ${covered} of ${STC_BEATS.length}. Current beat: ${name}.`}
      accessibilityValue={{ min: 0, max: STC_BEATS.length, now: covered }}>
      <Sprockets />
      <View style={styles.frames}>
        {STC_BEATS.map((b, i) => (
          <View key={b.key} style={[styles.frame, i < covered && styles.exposed, i === index && styles.current]} />
        ))}
      </View>
      <Sprockets />
    </View>
  );
}

const Sprockets = () => (
  <View style={styles.sprockets}>
    {Array.from({ length: 22 }, (_, i) => (
      <View key={i} style={styles.hole} />
    ))}
  </View>
);

function Goal() {
  const { sequence } = useProject();
  if (!sequence) return <Term icon="target" text="No goal open yet" spoken="No goal is open yet." />;
  return (
    <View style={styles.tight}>
      <Eyebrow>Current goal</Eyebrow>
      <Body strong>{sequence.goal}</Body>
      {sequence.stake ? <Term icon="warning" text={sequence.stake} spoken={`Stake: ${sequence.stake}`} /> : null}
      {sequence.obstacle ? <Term icon="lock" text={sequence.obstacle} spoken={`Obstacle: ${sequence.obstacle}`} /> : null}
      <View style={styles.row}>
        <ProgressBar value={sequence.progress} max={sequence.required} label="Goal progress" style={styles.grow} />
        <Caption>
          {Math.min(sequence.progress, sequence.required)} of {sequence.required}
        </Caption>
      </View>
    </View>
  );
}

// ───────── Rehearse ─────────

export function RehearseCard({ order }: { order: number }) {
  const { project, sim, scene, me, charName } = useProject();
  const { colors } = useTheme(); // the desk: Icon carries it onto the card
  if (!project) return null;
  const photo = scene ? sceneImage(scene) : undefined;
  const last = lastResolution(sim?.events ?? []);
  const pending = sim?.pending;
  const declarer = pending ? (project.participants.find((p) => p.id === pending.participantId)?.name ?? 'Someone') : null;
  const move = pending
    ? pending.participantId === me?.id
      ? 'Your move. Choose an approach in Rehearse.'
      : `${declarer} is choosing a move.`
    : 'The floor is open.';
  const label = [
    scene ? `${scene.heading}.` : 'No scene is open.',
    move,
    last?.resolution ? `Last consequence: ${TIER_LABEL[last.resolution.tier]}, ${last.resolution.approachLabel}.` : '',
  ].join(' ');

  return (
    <AreaCard tab="rehearse" order={order} title="Rehearse" note="the scene in play" label={label}>
      {photo && (
        <View style={[styles.print, paperShadow, { transform: [{ rotate: `${tiltFor(scene?.id, 1).toFixed(2)}deg` }] }]}>
          <View style={styles.printPhoto}>
            <Image source={photo} style={fillImage} resizeMode="cover" accessible={false} />
          </View>
        </View>
      )}
      {scene ? (
        <View style={styles.tight}>
          <Mono style={styles.slug}>{scene.heading.toUpperCase()}</Mono>
          {scene.situation ? <Body numberOfLines={4}>{scene.situation}</Body> : null}
        </View>
      ) : (
        <Caption>No scene is open.</Caption>
      )}

      <View style={styles.tight}>
        <Eyebrow>Whose move</Eyebrow>
        <View style={styles.row}>
          <Icon name="dice" size={17} color={colors.accentText} />
          <Body style={styles.grow}>{move}</Body>
        </View>
      </View>

      <View style={styles.tight}>
        <Eyebrow>Last consequence</Eyebrow>
        {last?.resolution ? (
          <>
            <View style={styles.rowWrap}>
              <TierBadge tier={last.resolution.tier} />
              <Caption tone="primary" strong style={styles.grow}>
                {charName(last.actorId)}: {last.resolution.approachLabel}
              </Caption>
            </View>
            <Body numberOfLines={4}>{last.text}</Body>
            <Caption tone="tertiary">{timeAgo(last.at)}</Caption>
          </>
        ) : (
          <Caption>Nothing has been played on this branch yet.</Caption>
        )}
      </View>
    </AreaCard>
  );
}

// ───────── Crew ─────────

export function CrewCard({ order }: { order: number }) {
  const { project } = useProject();
  const now = useNow();
  if (!project) return null;
  const crew = [...project.participants].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  const active = crew.filter((p) => isActive(p, now)).length;
  const blind = project.settings.blindMode;
  const summary = `${active} active now, ${crew.length} in the crew.`;
  return (
    <AreaCard tab="crew" order={order} title="Crew" note="who’s in the room" label={`${summary}${blind ? ' Blind mode is on.' : ''}`}>
      <View style={styles.spread}>
        <Body strong style={styles.grow}>
          {summary}
        </Body>
        {blind && <Badge icon="eye-off" label="Blind mode" />}
      </View>
      <CrewList now={now} />
    </AreaCard>
  );
}

function CrewList({ now }: { now: number }) {
  const { colors } = useTheme(); // paper
  const { project, me, charName } = useProject();
  if (!project) return null;
  const crew = [...project.participants].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  return (
    <List>
      {crew.map((p) => (
        <ListRow
          key={p.id}
          style={styles.flushRow}
          leading={<Avatar name={p.name} role={p.role} size={34} />}
          title={p.id === me?.id ? `${p.name} (you)` : p.name}
          subtitle={[ROLE_LABEL[p.role], p.characterId && `plays ${charName(p.characterId)}`].filter(Boolean).join(', ')}
          trailing={
            isActive(p, now) ? (
              <Badge label="Active" color={colors.accentText} />
            ) : (
              <Caption tone="tertiary">{timeAgo(p.lastSeenAt, now)}</Caption>
            )
          }
        />
      ))}
    </List>
  );
}

// ───────── Discover ─────────

const discoveryColor = (colors: Palette, d: Discovery) =>
  ({
    new: colors.accentText,
    considering: colors.textSecondary,
    promoted: colors.canon.canon,
    rejected: colors.canon.rejected,
  })[d.status];

export function DiscoverCard({ order }: { order: number }) {
  const { project } = useProject();
  if (!project) return null;
  const meaningful = project.discoveries.filter(isMeaningful);
  const session = project.activeSessionId;
  const thisSession = session ? meaningful.filter((d) => d.sessionId === session).length : null;
  const label =
    thisSession === null
      ? `No session running. ${meaningful.length} meaningful discoveries across the project.`
      : `${thisSession} meaningful ${thisSession === 1 ? 'discovery' : 'discoveries'} this session.`;
  return (
    <AreaCard tab="discover" order={order} title="Discover" note="what emerged" label={label}>
      <NorthStar thisSession={thisSession} total={meaningful.length} />
      <Latest />
      <Unresolved />
    </AreaCard>
  );
}

/** North-star metric (PRD §54): a count of discoveries, never a score. */
function NorthStar({ thisSession, total }: { thisSession: number | null; total: number }) {
  return (
    <View style={styles.beatHead}>
      <InkMark name="discover" />
      <View style={[styles.grow, styles.tight]}>
        <Body strong>
          {thisSession !== null ? `${thisSession} meaningful ${thisSession === 1 ? 'discovery' : 'discoveries'} this session` : 'No session running'}
        </Body>
        <Caption>{total} across the project</Caption>
      </View>
    </View>
  );
}

function Latest() {
  const { colors } = useTheme(); // paper
  const { project } = useProject();
  if (!project) return null;
  const latest = [...project.discoveries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  return (
    <View style={styles.tight}>
      <Eyebrow>Latest discoveries</Eyebrow>
      {latest.length === 0 ? (
        <Caption>Nothing yet. Discoveries appear once the team has rehearsed and run an analysis.</Caption>
      ) : (
        <List>
          {latest.map((d) => (
            <ListRow
              key={d.id}
              style={styles.flushRow}
              title={d.title}
              subtitle={`${DISCOVERY_KIND_LABEL[d.kind]}, ${timeAgo(d.createdAt)}`}
              trailing={<Badge label={DISCOVERY_STATUS_LABEL[d.status]} color={discoveryColor(colors, d)} strike={d.status === 'rejected'} />}
            />
          ))}
        </List>
      )}
    </View>
  );
}

/** Open threads the analysts watch (analyze permission): setups, payoff candidates, undecided discoveries. */
function Unresolved() {
  const { project, sim, can } = useProject();
  if (!project || !can('analyze')) return null;
  const setups = sim?.setups ?? [];
  const candidates = setups.filter((s) => s.status === 'payoff-candidate');
  const open = setups.filter((s) => s.status === 'open');
  const awaiting = project.discoveries.filter((d) => d.status === 'new' || d.status === 'considering');
  const shown = [...candidates, ...open].slice(0, 3);
  return (
    <View style={styles.tight}>
      <Eyebrow>Unresolved</Eyebrow>
      <View style={styles.stats}>
        <Stat label="Open setups" value={`${open.length}`} />
        <Stat label="Payoff candidates" value={`${candidates.length}`} />
        <Stat label="Awaiting a decision" value={`${awaiting.length}`} />
      </View>
      {shown.length > 0 && (
        <List>
          {shown.map((s) => (
            <ListRow
              key={s.id}
              style={styles.flushRow}
              title={s.text}
              subtitle={
                s.reinforcementEventIds.length
                  ? `Reinforced ${s.reinforcementEventIds.length} ${s.reinforcementEventIds.length === 1 ? 'time' : 'times'}`
                  : undefined
              }
              trailing={<Badge label={s.status === 'payoff-candidate' ? 'Payoff candidate' : 'Open setup'} />}
            />
          ))}
        </List>
      )}
    </View>
  );
}

const FRAME_UNEXPOSED = '#3A3128';
const FRAME_EXPOSED = '#C9B48A';

const styles = StyleSheet.create({
  grow: { flex: 1 },
  tight: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  spread: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  beatName: { letterSpacing: 1 },
  // The beat's mark, inked into the card like a rubber stamp.
  beatHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  terms: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  requirement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  requirementIcon: { width: 16, height: 22, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  statValue: { fontFamily: fonts.typewriterBold, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  northStar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  northValue: { fontFamily: fonts.typewriterBold, fontSize: 52, lineHeight: 56, fontVariant: ['tabular-nums'] },
  flushRow: { paddingHorizontal: 0 },
  slug: { letterSpacing: 0.5 },
  // A print pinned to the card: white border, cinematic crop.
  print: { backgroundColor: '#F3EEE3', padding: 5, borderRadius: 1 },
  printPhoto: { aspectRatio: 2.1, backgroundColor: '#1A1714', overflow: 'hidden' },
  film: { backgroundColor: '#1C1712', borderRadius: 2, paddingHorizontal: 4, paddingVertical: 3, gap: 3 },
  sprockets: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  hole: { width: 4, height: 3, borderRadius: 0.5, backgroundColor: 'rgba(237, 227, 204, 0.5)' },
  frames: { flexDirection: 'row', gap: 3 },
  frame: { flex: 1, height: 15, borderRadius: 1, backgroundColor: FRAME_UNEXPOSED },
  exposed: { backgroundColor: FRAME_EXPOSED },
  current: { borderWidth: 2, borderColor: world.stringHighlight, backgroundColor: '#E8D6A8' },
});
