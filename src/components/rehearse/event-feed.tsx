// The story so far (PRD §47–49) as its causal chain on the board: every event is pinned in the order it happened and
// one red string runs through them, so reading the rehearsal means following the string. Scene openings get a tape
// label and a print of the place; narration is typed on plain paper; a move is an index card with the character's
// print; a resolution is a consequence card with its tier stamped on; ripples through the character web (§26–27)
// hang to the right on brass pins; fresh news is a sticky note. Events arrive already redacted for this viewer.
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DOMAIN_LABEL, RISK_LABEL } from '@shared/structure';
import type { HeroGoalSequence, Reaction, Resolution, StoryEvent } from '@shared/types';

import { characterImage, sceneImage } from '@/components/board/materials';
import { Hand, Paper, paperShadow, Pinned, Polaroid, StickyNote, TapeLabel, Tape } from '@/components/board/paper';
import { Badge, Body, Caption, Card, EmptyState, OddsBar, TierBadge, type TextProps } from '@/components/ui';
import { useProject } from '@/lib/session';
import { fonts, palettes, radii, spacing, useTheme } from '@/theme';

import { Disclosure } from './disclosure';
import { EFFECT_GROUP_LABEL, groupEffects, isBlindViewer, signed } from './effects';
import { ReactionNoteSheet, ReactionStrip } from './reactions';
import { CardTitle, FEED } from './scene-cards';

/** Where an event hangs on the feed thread. */
interface Anchor {
  thread: string;
  order: number;
}

interface ItemProps {
  event: StoryEvent;
  anchor: Anchor;
  /** The reaction strip, drawn on the event's own paper. */
  react: ReactNode;
}

export function EventFeed({ events, start = 0 }: { events: StoryEvent[]; start?: number }) {
  const { project } = useProject();
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const reactionsByEvent = new Map<string, Reaction[]>();
  for (const r of project?.reactions ?? []) {
    const list = reactionsByEvent.get(r.eventId);
    if (list) list.push(r);
    else reactionsByEvent.set(r.eventId, [r]);
  }

  return (
    <View style={styles.feed}>
      {events.length === 0 && <EmptyState title="Nothing on the board yet" message="Nothing has happened in this simulation yet." />}
      {events.map((event, i) => (
        <EventItem
          key={event.id}
          event={event}
          previous={events[i - 1]}
          anchor={{ thread: FEED, order: start + i }}
          react={<ReactionStrip eventId={event.id} reactions={reactionsByEvent.get(event.id) ?? []} onNote={setNoteFor} />}
        />
      ))}
      <ReactionNoteSheet eventId={noteFor} onClose={() => setNoteFor(null)} />
    </View>
  );
}

function EventItem({ event, previous, anchor, react }: ItemProps & { previous?: StoryEvent }) {
  const props = { event, anchor, react };
  switch (event.kind) {
    case 'scene-open':
      return <SceneOpen {...props} />;
    case 'narration':
      return <Narration {...props} />;
    case 'action':
      return <ActionCard {...props} />;
    case 'resolution':
      return event.resolution ? (
        <Consequence
          {...props}
          resolution={event.resolution}
          // A chosen move is already named by the action card just above it.
          titled={!(previous?.kind === 'action' && !previous.playerInput && previous.text === event.resolution.approachLabel)}
        />
      ) : (
        <Narration {...props} />
      );
    case 'propagation':
      return <Ripple {...props} />;
    case 'fresh-news':
      return <FreshNews {...props} />;
    case 'scene-close':
      return <Slip {...props} label="Scene closes" />;
    case 'directive':
      return <Slip {...props} label="Director’s choice" meta />;
    case 'beat-advance':
      return <Slip {...props} label="Beat advanced" meta />;
    case 'note':
      return <Slip {...props} />;
  }
}

/** Typed prose (narration, consequences). */
function Prose({ style, ...props }: TextProps) {
  return <Body {...props} style={[styles.prose, style]} />;
}

/** "EXT. CONTAINER YARD – NIGHT" → { place: "container yard", time: "night" }. */
function splitHeading(heading: string): { place: string; time?: string } {
  const rest = heading.replace(/^\s*(INT\.?\s*\/\s*EXT\.?|I\/E\.?|INT\.|EXT\.)\s*/i, '');
  const [place, time] = rest.split(/\s+[–—-]\s+/);
  return { place: (place || heading).toLowerCase(), time: time?.toLowerCase() };
}

/** A new scene: a strip of tape on the board, the slug typed on a card and a print of the place beside it. */
function SceneOpen({ event, anchor, react }: ItemProps) {
  const { sim } = useProject();
  const index = sim?.scenes.findIndex((s) => s.id === event.sceneId) ?? -1;
  const scene = index >= 0 ? sim!.scenes[index] : undefined;
  const heading = scene?.heading ?? event.text;
  const photo = sceneImage({ heading, image: scene?.image });
  const { place, time } = splitHeading(heading);
  return (
    <View style={styles.scene}>
      <TapeLabel note={[place, time].filter(Boolean).join(', ')} style={styles.sceneTape}>
        {index >= 0 ? `Scene ${index + 1}` : 'New scene'}
      </TapeLabel>
      <View style={styles.sceneRow}>
        <View style={styles.grow}>
          <Card {...anchor} tilt={event.id} style={styles.slugCard}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={[styles.slug, { color: palettes.paper.text }]}>
              {heading.toUpperCase()}
            </Text>
            {react}
          </Card>
        </View>
        {photo ? (
          <View style={[styles.scenePrint, { transform: [{ rotate: '3deg' }] }]}>
            <Polaroid source={photo} width={116} aspect={5 / 4} />
            <Tape width={56} style={styles.printTape} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Narration and staging notes: typed on a plain sheet rather than an index card. */
function Narration({ event, anchor, react }: ItemProps) {
  const { project } = useProject();
  // A human Director's staging note carries their participant id; the AI Director's narration doesn't.
  const narrator = event.participantId && project?.participants.find((p) => p.id === event.participantId)?.name;
  return (
    <Pinned {...anchor} tilt={event.id}>
      <View style={[styles.lifted, paperShadow]}>
        <Paper plain style={styles.sheet}>
          {(narrator || event.directorOnly) && (
            <View style={styles.rowWrap}>
              {narrator ? <Caption style={styles.grow}>Staged by {narrator}</Caption> : null}
              {event.directorOnly ? <Badge label="Director only" /> : null}
            </View>
          )}
          <Prose>{event.text}</Prose>
          {react}
        </Paper>
      </View>
    </Pinned>
  );
}

/** A character's move: their print, the name as a screenplay cue, the performer's words beneath. */
function ActionCard({ event, anchor, react }: ItemProps) {
  const { project, character, charName } = useProject();
  const performer = event.participantId && project?.participants.find((p) => p.id === event.participantId)?.name;
  const c = character(event.actorId);
  const photo = c ? characterImage(c) : undefined;
  return (
    <Card {...anchor} tilt={event.id}>
      <View style={styles.actionRow}>
        {photo ? <Polaroid source={photo} width={64} style={styles.actorPrint} /> : null}
        <View style={styles.actionText}>
          <CardTitle>{charName(event.actorId)}</CardTitle>
          <Body>{event.playerInput ? quoted(event.playerInput) : event.text}</Body>
          {performer ? (
            <Caption tone="tertiary">
              {event.playerInput ? 'Performed' : 'Chosen'} by {performer}
            </Caption>
          ) : null}
        </View>
      </View>
      {react}
    </Card>
  );
}

/** What the dice made of the move: the tier stamped on, the narrated consequence and what it changed. */
function Consequence({ event, anchor, react, resolution: r, titled }: ItemProps & { resolution: Resolution; titled: boolean }) {
  return (
    <Card {...anchor} tilt={event.id}>
      <View style={styles.spread}>
        <View style={styles.grow}>
          <CardTitle>{titled ? r.approachLabel : 'Consequence'}</CardTitle>
        </View>
        <TierBadge tier={r.tier} />
      </View>
      <Prose>{event.text}</Prose>
      {event.reason ? (
        <Caption tone="primary" style={styles.reason}>
          <Caption strong>Why: </Caption>
          {event.reason}
        </Caption>
      ) : null}
      <Disclosure title="How it resolved" summary={`${RISK_LABEL[r.risk]}. Rolled ${r.roll}, total ${r.total} against ${r.dc}.`}>
        <HowItResolved r={r} />
      </Disclosure>
      <StoryEffects event={event} />
      {react}
    </Card>
  );
}

function HowItResolved({ r }: { r: Resolution }) {
  return (
    <View style={styles.tight}>
      <Ledger label={r.roll === 20 ? 'd20 roll (natural 20)' : 'd20 roll'} value={`${r.roll}`} />
      {r.modifiers.map((m, i) => (
        <Ledger key={`${m.label}-${i}`} label={m.label} value={signed(m.value)} />
      ))}
      <Ledger label="Total" value={`${r.total}`} strong />
      <Ledger label={`Difficulty, ${DOMAIN_LABEL[r.domain].toLowerCase()}`} value={`${r.dc}`} />
      <Caption style={styles.oddsLabel}>The odds that applied</Caption>
      <OddsBar odds={r.odds} />
    </View>
  );
}

function Ledger({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.ledger} accessible accessibilityLabel={`${label}: ${value}`}>
      <Caption tone={strong ? 'primary' : 'secondary'} strong={strong} style={styles.grow}>
        {label}
      </Caption>
      <Caption tone="primary" strong={strong} style={styles.number}>
        {value}
      </Caption>
    </View>
  );
}

function StoryEffects({ event }: { event: StoryEvent }) {
  const { colors } = useTheme();
  const { project, role, sim, charName } = useProject();
  if (!project || !event.effects?.length) return null;
  const groups = groupEffects(
    event.effects,
    charName,
    (id) => sim?.setups.find((s) => s.id === id)?.text,
    isBlindViewer(project, role),
  );
  if (!groups.length) return null;
  return (
    <View style={[styles.effects, { borderTopColor: colors.border }]}>
      <Caption strong tone="primary">
        What changed
      </Caption>
      {groups.map(({ group, items }) => (
        <View key={group} style={styles.effect}>
          <Caption strong style={styles.effectLabel}>
            {EFFECT_GROUP_LABEL[group]}
          </Caption>
          <View style={styles.effectItems}>
            {items.map((text, i) => (
              <Caption key={i} tone="primary">
                {text}
              </Caption>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** A ripple through the character web: a smaller card set to the right on a brass pin. */
function Ripple({ event, anchor, react }: ItemProps) {
  return (
    <View style={styles.rippleWrap}>
      <Card {...anchor} pin="brass" tilt={event.id} style={styles.ripple}>
        <Hand color={palettes.paper.textSecondary} style={styles.meanwhile}>
          meanwhile…
        </Hand>
        <Prose>{event.text}</Prose>
        <StoryEffects event={event} />
        {react}
      </Card>
    </View>
  );
}

const CLOSED_AS: Record<HeroGoalSequence['status'], string> = {
  active: 'Goal closed',
  achieved: 'Goal achieved',
  redirected: 'Goal redirected',
  abandoned: 'Goal abandoned',
};

/** Fresh news closes the current goal (PRD §13); the next goal is the sequence opened right after it. */
function FreshNews({ event, anchor, react }: ItemProps) {
  const { sim } = useProject();
  const sequences = sim?.sequences ?? [];
  const index = sequences.findIndex((s) => s.id === event.sequenceId);
  const closed = sequences[index];
  const next = index >= 0 ? sequences[index + 1] : undefined;
  return (
    <Pinned {...anchor} tilt={event.id} style={styles.newsPin}>
      <StickyNote color="yellow" style={styles.news}>
        <CardTitle>Fresh news</CardTitle>
        <Body strong>{event.text}</Body>
        {closed && (
          <Caption tone="primary">
            {CLOSED_AS[closed.status]}: {closed.goal}
          </Caption>
        )}
        {next && (
          <View style={styles.tight}>
            <Caption strong tone="primary">
              New goal
            </Caption>
            <Body>{next.goal}</Body>
          </View>
        )}
        {react}
      </StickyNote>
    </Pinned>
  );
}

/** Small moments on the chain (a scene closing, a Director's choice, a beat turning): a slip with a stamp. */
function Slip({ event, anchor, react, label, meta = false }: ItemProps & { label?: string; meta?: boolean }) {
  return (
    <Card {...anchor} pin={meta ? 'brass' : 'red'} tilt={event.id} style={styles.slip}>
      {label ? <Badge label={label} color={meta ? palettes.paper.accentText : undefined} /> : null}
      <Caption tone="primary">{event.text}</Caption>
      {react}
    </Card>
  );
}

const styles = StyleSheet.create({
  feed: { gap: spacing.xl },
  tight: { gap: spacing.xs },
  grow: { flex: 1 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  spread: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  prose: { fontFamily: fonts.typewriter, fontSize: 15, lineHeight: 23 },
  // Scene
  scene: { gap: spacing.md },
  sceneTape: { marginLeft: spacing.xxl },
  sceneRow: { flexDirection: 'row', alignItems: 'flex-start' },
  slugCard: { gap: spacing.sm, paddingBottom: spacing.sm },
  slug: { fontFamily: fonts.typewriterBold, fontSize: 15, lineHeight: 21, letterSpacing: 0.4 },
  scenePrint: { marginLeft: -spacing.md, marginTop: spacing.lg },
  printTape: { position: 'absolute', top: -7, alignSelf: 'center' },
  // Narration
  lifted: { borderRadius: radii.sm },
  sheet: {
    backgroundColor: palettes.paper.surface,
    padding: spacing.lg,
    paddingLeft: spacing.xl + 2,
    paddingTop: spacing.xl + 2,
    gap: spacing.sm,
  },
  // Action
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  actorPrint: { transform: [{ rotate: '-2deg' }], marginTop: -spacing.xs },
  actionText: { flex: 1, gap: spacing.xs },
  // Consequence
  reason: { fontFamily: fonts.typewriterItalic },
  ledger: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  number: { fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },
  oddsLabel: { marginTop: spacing.xs },
  effects: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  effect: { flexDirection: 'row', gap: spacing.md },
  effectLabel: { width: 104 },
  effectItems: { flex: 1, gap: 2 },
  // Ripple
  rippleWrap: { marginLeft: spacing.xxxl },
  ripple: { padding: spacing.md, paddingLeft: spacing.xl, paddingTop: spacing.xl, gap: spacing.xs },
  meanwhile: { marginTop: -spacing.xs },
  // Fresh news
  newsPin: { marginRight: spacing.lg },
  news: { gap: spacing.sm, paddingLeft: spacing.xl + 2 },
  // Slip
  slip: { marginRight: spacing.xxxl, padding: spacing.md, paddingLeft: spacing.xl, paddingTop: spacing.xl, gap: spacing.xs },
});

/** The performer's words in quotes, unless they already typed their own. */
const quoted = (input: string): string => (/["“”]/.test(input) ? input : `“${input}”`);
