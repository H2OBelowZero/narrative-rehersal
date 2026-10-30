// Structure Board (PRD §12–15, §24–25, §35, §37): the beat board off the planning wall. Each act is a strip of
// tape, its beats are typed index cards joined left to right by one string, and the hero goal sequences run
// along a film strip. A beat opens into its detail: a sheet on phones, the panel beside the board on wide
// screens. The meta layer: Owner, Director and Producer only.
import { useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { beatDef, HGS_GUIDE, STC_BEATS, type StcBeatDef } from '@shared/structure';
import type { BeatState, HeroGoalSequence, Opportunity, Scene, SimState, StcBeatKey } from '@shared/types';

import { fillImage, sceneImage } from '@/components/board/materials';
import { Paper, StickyNote, Tape, tiltFor, type NoteColor } from '@/components/board/paper';
import { StringBoard } from '@/components/board/string-board';
import {
  Badge,
  Body,
  Button,
  Caption,
  beatIcon,
  Card,
  Chip,
  confirm,
  EmptyState,
  Gate,
  Heading,
  Icon,
  IconButton,
  InkMark,
  Mono,
  pressedStyle,
  ProgressBar,
  Section,
  Sheet,
  TextField,
} from '@/components/ui';
import { useProject } from '@/lib/session';
import { fonts, palettes, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { Bullets, KeyValue, storyStyles, useGrid, useMutation, useSheet, useWide } from './common';

const ACT = ['', 'I', 'II', 'III'] as const;
const ACTS = [1, 2, 3] as const;
const ACT_NOTE: Record<1 | 2 | 3, string> = { 1: 'Setup', 2: 'Confrontation', 3: 'Resolution' };

/** Beat cards: a fixed width in the scrolling rows, at least this wide when a whole act fits across the board. */
const CARD_WIDTH = 168;
const CARD_MIN_WIDE = 150;
const CARD_GAP = spacing.md;
const LONGEST_ACT = Math.max(...([1, 2, 3] as const).map((act) => STC_BEATS.filter((b) => b.act === act).length));

const desk = palettes.desk;

export interface BoardSelection {
  /** The beat whose detail is open (null: none). */
  selected: StcBeatKey | null;
  onSelect: (key: StcBeatKey | null) => void;
}

export const beatTitle = (key: StcBeatKey) => `Beat ${STC_BEATS.findIndex((b) => b.key === key) + 1} · ${beatDef(key).name}`;

export function StructureView(props: BoardSelection) {
  return (
    <Gate
      perm="seeMeta"
      fallback={
        <EmptyState
          icon="structure"
          title="Structure stays backstage"
          message="Beats, goal sequences and the Director’s options are kept out of the way during performance, so the scene can be played as it comes. The Project Owner, Director and Producer follow them here."
        />
      }>
      <StructureBoard {...props} />
    </Gate>
  );
}

function StructureBoard({ selected, onSelect }: BoardSelection) {
  const { sim } = useProject();
  const wide = useWide();
  if (!sim) return <EmptyState icon="structure" title="No simulation yet" />;
  const active = STC_BEATS[sim.beatIndex]!.key;

  return (
    <>
      <BeatBoard sim={sim} selected={selected} onSelect={onSelect} wide={wide} />
      <Sequences sim={sim} wide={wide} />
      {wide ? (
        <View style={storyStyles.columns}>
          <View style={storyStyles.column}>
            <Scenes sim={sim} />
          </View>
          <View style={storyStyles.column}>
            <Administration sim={sim} onOpenBeat={() => onSelect(active)} />
          </View>
        </View>
      ) : (
        <>
          <Scenes sim={sim} />
          <Administration sim={sim} onOpenBeat={() => onSelect(active)} />
          <BeatSheet selected={selected} onSelect={onSelect} />
        </>
      )}
    </>
  );
}

// ───────── What happened where ─────────

/** Scenes that played during each beat, in order of first appearance (events carry beatKey and sceneId). */
function scenesByBeat(sim: SimState): Map<StcBeatKey, Scene[]> {
  const scenes = new Map(sim.scenes.map((s) => [s.id, s]));
  const out = new Map<StcBeatKey, Scene[]>();
  for (const e of sim.events) {
    const scene = e.sceneId ? scenes.get(e.sceneId) : undefined;
    if (!scene) continue;
    const list = out.get(e.beatKey) ?? [];
    if (!list.includes(scene)) out.set(e.beatKey, [...list, scene]);
  }
  return out;
}

const photosOf = (scenes: Scene[]): ImageSourcePropType[] =>
  scenes.flatMap((s) => {
    const source = sceneImage(s);
    return source ? [source] : [];
  });

/** Beats left by advancing in play (a beat-advance event carries the beat it advanced into). */
const advancedInto = (sim: SimState) => new Set(sim.events.filter((e) => e.kind === 'beat-advance').map((e) => e.beatKey));

interface BeatFacts {
  def: StcBeatDef;
  index: number;
  state: BeatState;
  met: Set<string>;
  metCount: number;
  /** Satisfied before play began (the story opened later): its requirements were never tracked. */
  backstory: boolean;
  /** Advanced in play before all of its requirements were met. */
  early: boolean;
  scenes: Scene[];
}

function beatFacts(sim: SimState, index: number, scenes: Map<StcBeatKey, Scene[]>, advanced: Set<StcBeatKey>): BeatFacts {
  const def = STC_BEATS[index]!;
  const state = sim.beats[index]!;
  const met = new Set(state.conditionsMet.map((c) => c.requirementId));
  const metCount = def.requirements.filter((r) => met.has(r.id)).length;
  const next = STC_BEATS[index + 1]?.key;
  const left = !!next && advanced.has(next);
  return {
    def,
    index,
    state,
    met,
    metCount,
    backstory: state.status === 'satisfied' && !left,
    early: left && state.status === 'satisfied' && metCount < def.requirements.length,
    scenes: scenes.get(def.key) ?? [],
  };
}

// ───────── The beat board (PRD §12, §24–25) ─────────

function BeatBoard({ sim, selected, onSelect, wide }: BoardSelection & { sim: SimState; wide: boolean }) {
  // Each act is one strung row, never wrapped: laid across the board when the longest act fits, else scrolling.
  const [boardWidth, setBoardWidth] = useState(0);
  const across = Math.floor((boardWidth - CARD_GAP * (LONGEST_ACT - 1)) / LONGEST_ACT);
  const fits = wide && across >= CARD_MIN_WIDE;
  const scenes = scenesByBeat(sim);
  const advanced = advancedInto(sim);
  const target = sim.opportunities[0]?.beatKey;

  return (
    <View onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)} style={styles.acts}>
      {ACTS.map((act) => {
        const beats = STC_BEATS.map((def, i) => ({ def, i })).filter(({ def }) => def.act === act);
        const cards = beats.map(({ def, i }) => (
          <BeatCard
            key={def.key}
            thread={`act-${act}`}
            facts={beatFacts(sim, i, scenes, advanced)}
            active={i === sim.beatIndex}
            selected={selected === def.key}
            options={target === def.key ? sim.opportunities.length : 0}
            width={fits ? across : CARD_WIDTH}
            compact={fits}
            onPress={() => onSelect(def.key)}
          />
        ));
        return (
          <Section key={act} title={`ACT ${act}`} note={ACT_NOTE[act]}>
            {fits ? (
              <StringBoard style={styles.row}>{cards}</StringBoard>
            ) : (
              <ActRow focus={beats.findIndex(({ i }) => i === sim.beatIndex)}>{cards}</ActRow>
            )}
          </Section>
        );
      })}
    </View>
  );
}

/** One act too long for the board: a row running off the edge of the board, strung in its own board so the string scrolls with it. */
function ActRow({ children, focus }: { children: ReactNode; focus: number }) {
  const ref = useRef<ScrollView>(null);
  const placed = useRef(false);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.bleedContent}
      onContentSizeChange={() => {
        // Open on the active beat, with the one before it peeking in from the left.
        if (placed.current || focus <= 0) return;
        placed.current = true;
        ref.current?.scrollTo({ x: focus * (CARD_WIDTH + CARD_GAP) - spacing.xxxl, animated: false });
      }}>
      <StringBoard style={styles.row}>{children}</StringBoard>
    </ScrollView>
  );
}

function BeatCard({
  thread,
  facts,
  active,
  selected,
  options,
  width,
  compact,
  onPress,
}: {
  thread: string;
  facts: BeatFacts;
  active: boolean;
  selected: boolean;
  /** Director's options generated for this beat. */
  options: number;
  width: number;
  compact: boolean;
  onPress: () => void;
}) {
  const { def, index, state, metCount, backstory } = facts;
  const total = def.requirements.length;
  const spoken = [
    `Beat ${index + 1}, ${def.name}`,
    active ? 'active' : state.status === 'satisfied' ? 'satisfied' : 'upcoming',
    backstory ? 'before play began' : `${metCount} of ${total} requirements met`,
    options ? `${options} options from the Director` : '',
  ].filter(Boolean);
  return (
    <Card
      thread={thread}
      order={index}
      at="top"
      tilt={def.key}
      tone={active ? 'accent' : 'default'}
      onPress={onPress}
      accessibilityLabel={`${spoken.join(', ')}. ${selected ? 'Open' : 'Opens its detail'}.`}
      style={[styles.beatCard, { width }, compact && styles.beatCardCompact, selected && !active && styles.beatSelected]}>
      <BeatFace facts={facts} active={active} options={options} />
    </Card>
  );
}

/** The typed face of a beat card (rendered on paper, so its colours are ink). */
function BeatFace({ facts, active, options }: { facts: BeatFacts; active: boolean; options: number }) {
  const { colors } = useTheme();
  const { def, index, state, metCount, backstory, scenes } = facts;
  const photo = photosOf(scenes).at(-1);
  const total = def.requirements.length;
  return (
    <>
      <View style={storyStyles.row}>
        <InkMark name={beatIcon(def.key)} size={28} />
        <Caption strong tone="primary" numberOfLines={2} style={[styles.beatTitle, storyStyles.grow]}>
          {index + 1}. {def.name.toUpperCase()}
        </Caption>
      </View>
      <Caption numberOfLines={3} style={styles.beatPurpose}>
        {def.purpose}
      </Caption>
      <Caption tone="tertiary" numberOfLines={1} style={[styles.tabular, styles.beatAt]}>
        at {def.at}
        {options ? ` · ${options} options` : ''}
      </Caption>
      <Photo
        source={photo}
        caption={scenes.at(-1)?.heading ?? (state.status === 'pending' ? 'Not played yet' : 'No scene played')}
      />
      <View style={styles.beatFoot}>
        {active ? (
          <Badge label="Active" color={colors.accentText} />
        ) : state.status === 'satisfied' ? (
          <Badge label="Satisfied" color={colors.tier.success} />
        ) : (
          <View />
        )}
        {!backstory && (
          <View style={styles.metCount}>
            <Icon name="check" size={11} color={metCount === total ? colors.tier.success : colors.textTertiary} />
            <Caption tone={metCount === total ? 'primary' : 'tertiary'} style={styles.tabular}>
              {metCount}/{total}
            </Caption>
          </View>
        )}
      </View>
    </>
  );
}

/** A print pasted onto a card, or its quiet empty frame (typed with the scene heading when there is no photo). */
function Photo({ source, caption, aspect = 4 / 3 }: { source?: ImageSourcePropType; caption: string; aspect?: number }) {
  if (source) {
    return (
      <View style={[styles.photo, { aspectRatio: aspect }]}>
        <Image source={source} style={fillImage} resizeMode="cover" accessible={false} />
      </View>
    );
  }
  // No still yet: an unexposed print, not an empty web box.
  return (
    <View style={[styles.photo, styles.photoEmpty, { aspectRatio: aspect }]}>
      <Caption numberOfLines={3} style={[styles.center, styles.photoEmptyText]}>
        {caption}
      </Caption>
    </View>
  );
}

// ───────── A beat, opened ─────────

/** Phones: the beat's detail slides up as a sheet of paper. */
function BeatSheet({ selected, onSelect }: BoardSelection) {
  // Keep the last beat on the page while the sheet slides away.
  const [shown, setShown] = useState(selected);
  if (selected && selected !== shown) setShown(selected);
  return (
    <Sheet visible={!!selected} onClose={() => onSelect(null)} title={shown ? beatTitle(shown) : ''}>
      {shown && <BeatDetail beatKey={shown} onFollow={onSelect} />}
    </Sheet>
  );
}

/** Wide screens: the beat's detail on a sheet of paper beside the board. */
export function BeatPanel({ beatKey, onSelect }: { beatKey: StcBeatKey; onSelect: (key: StcBeatKey | null) => void }) {
  return (
    <Animated.View entering={FadeInRight.duration(220)} style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.panelTitle}>
          {beatTitle(beatKey).toUpperCase()}
        </Text>
        <IconButton icon="close" color={desk.textSecondary} accessibilityLabel="Close beat detail" onPress={() => onSelect(null)} />
      </View>
      <ScrollView contentContainerStyle={styles.panelBody}>
        <Paper style={styles.panelPaper}>
          <BeatDetail beatKey={beatKey} onFollow={onSelect} />
        </Paper>
      </ScrollView>
    </Animated.View>
  );
}

/** Everything about one beat (drawn on paper): its scenes, purpose, requirements, advance and the Director's options. */
function BeatDetail({ beatKey, onFollow }: { beatKey: StcBeatKey; onFollow: (key: StcBeatKey) => void }) {
  const { colors } = useTheme();
  const { sim } = useProject();
  if (!sim) return null;

  const index = STC_BEATS.findIndex((b) => b.key === beatKey);
  const facts = beatFacts(sim, index, scenesByBeat(sim), advancedInto(sim));
  const { def, state, met, metCount, backstory, early, scenes } = facts;
  const photos = photosOf(scenes);
  const active = index === sim.beatIndex;
  const guided = active || sim.opportunities[0]?.beatKey === beatKey;

  return (
    <View style={styles.detail}>
      <Photo source={photos.at(-1)} aspect={16 / 10} caption={state.status === 'pending' ? 'Not played yet' : 'No scene photographed'} />
      {photos.length > 1 && (
        <View style={styles.thumbs}>
          {photos.slice(0, -1).map((p, i) => (
            <View key={i} style={styles.thumb}>
              <Image source={p} style={fillImage} resizeMode="cover" accessible={false} />
            </View>
          ))}
        </View>
      )}

      <View style={storyStyles.row}>
        <InkMark name={beatIcon(def.key)} size={36} />
        <Caption style={[storyStyles.grow, styles.tabular]}>
          Act {ACT[def.act]} · at {def.at}
        </Caption>
        {active ? (
          <Badge label="Active" color={colors.accentText} />
        ) : state.status === 'satisfied' ? (
          <Badge label="Satisfied" color={colors.tier.success} />
        ) : (
          <Badge label="Upcoming" color={colors.textTertiary} />
        )}
      </View>
      <Body>{def.purpose}</Body>

      <Section title={backstory ? 'Dramatic requirements' : `Dramatic requirements · ${metCount} of ${def.requirements.length} met`}>
        {def.requirements.map((r) => {
          const done = met.has(r.id);
          return (
            <View key={r.id} style={storyStyles.rowTop} accessible accessibilityLabel={`${done ? 'Met' : 'Not yet met'}: ${r.text}`}>
              <View style={[styles.box, { borderColor: done ? colors.tier.success : colors.textTertiary }]}>
                {done && <Icon name="check" size={13} color={colors.tier.success} />}
              </View>
              <Body style={storyStyles.grow} tone={done ? 'secondary' : 'primary'}>
                {r.text}
              </Body>
            </View>
          );
        })}
        {backstory ? (
          <Caption>Satisfied before play began, so its requirements were not tracked.</Caption>
        ) : early ? (
          <Caption>Advanced before all of its requirements were met.</Caption>
        ) : (
          <Caption>Advances when these happen in play, never on a timer.</Caption>
        )}
      </Section>

      {active && <Advance facts={facts} sim={sim} onFollow={onFollow} />}

      {scenes.length > 0 && (
        <Section>
          {scenes.map((s) => (
            <View key={s.id} style={storyStyles.tight}>
              <Caption>
                Played here: <Caption tone="primary" strong>{s.heading}</Caption>
              </Caption>
              {s.shift ? <Caption>Shift: {s.shift}</Caption> : s.situation ? <Caption numberOfLines={3}>{s.situation}</Caption> : null}
            </View>
          ))}
        </Section>
      )}

      {guided && <BeatGuidance sim={sim} />}
    </View>
  );
}

function Advance({ facts, sim, onFollow }: { facts: BeatFacts; sim: SimState; onFollow: (key: StcBeatKey) => void }) {
  const { call } = useProject();
  const { busy, run } = useMutation();
  const { def, state, met } = facts;
  const next = STC_BEATS[sim.beatIndex + 1];
  const unmet = def.requirements.filter((r) => !met.has(r.id));
  const chosen = sim.opportunities.find((o) => o.id === state.chosenOpportunityId);

  const advance = async () => {
    if (!next) return;
    let ok = false;
    if (unmet.length === 0) {
      ok = await run('advance', () => call('advanceBeat', {}));
    } else {
      const sure = await confirm(
        `Force advance to ${next.name}?`,
        `${def.name} still needs:\n${unmet.map((r) => `• ${r.text}`).join('\n')}\n\nThe beat will be recorded as advanced before its requirements were met.`,
        { confirmLabel: 'Force advance', destructive: true },
      );
      if (sure) ok = await run('advance', () => call('advanceBeat', { force: true }));
    }
    // Follow the string on to the beat the story just entered.
    if (ok) onFollow(next.key);
  };

  if (!chosen && !next) return null;
  return (
    <View style={storyStyles.group}>
      {chosen && <Caption tone="primary">Chosen direction: {chosen.title}</Caption>}
      {next ? (
        <Gate perm="direct">
          <Button
            title={unmet.length === 0 ? `Advance to ${next.name}` : 'Force advance'}
            icon={unmet.length === 0 ? 'arrow-right' : undefined}
            variant={unmet.length === 0 ? 'primary' : 'secondary'}
            loading={busy === 'advance'}
            onPress={advance}
          />
        </Gate>
      ) : null}
    </View>
  );
}

// ───────── Beat guidance (PRD §15, §36–37) ─────────

function BeatGuidance({ sim }: { sim: SimState }) {
  const { call, can } = useProject();
  const { busy, run } = useMutation();
  const target = sim.opportunities[0]?.beatKey;
  const current = STC_BEATS[sim.beatIndex]!;
  const chosenId = (o: Opportunity) => sim.beats.find((b) => b.key === o.beatKey)?.chosenOpportunityId;

  return (
    <Section title="Beat guidance">
      <Caption>
        The Director curates viable dramatic versions of the current or upcoming beat. It proposes, you choose: nothing is
        decided until you select one, and performers only ever meet the result.
      </Caption>
      {sim.directive ? (
        <Card tone="accent">
          <Caption strong tone="accent">
            Active directive
          </Caption>
          <Body>{sim.directive}</Body>
          <Caption>Steering the Director’s next situations.</Caption>
        </Card>
      ) : null}
      {can('direct') && (
        <Button
          title={sim.opportunities.length ? 'Generate new opportunities' : 'Generate opportunities'}
          icon="discover"
          variant="secondary"
          loading={busy === 'generate'}
          disabled={!!busy}
          onPress={() => void run('generate', () => call('generateOpportunities', {}))}
        />
      )}
      {busy === 'generate' && <Caption>Weighing character arc, theme, open setups, tone and what the crew has discovered…</Caption>}
      {target ? (
        <>
          <Caption strong>
            For {beatDef(target).name}
            {target !== current.key ? ' · upcoming' : ''}
          </Caption>
          {sim.opportunities.map((o) => (
            <OpportunityCard
              key={o.id}
              opportunity={o}
              chosen={chosenId(o) === o.id}
              onSelect={can('direct') ? () => void run(o.id, () => call('selectOpportunity', { opportunityId: o.id })) : undefined}
              busy={busy === o.id}
              disabled={!!busy}
            />
          ))}
        </>
      ) : (
        <Caption tone="tertiary">No opportunities generated for this beat yet.</Caption>
      )}
    </Section>
  );
}

function OpportunityCard({
  opportunity: o,
  chosen,
  onSelect,
  busy,
  disabled,
}: {
  opportunity: Opportunity;
  chosen: boolean;
  onSelect?: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const facets: [string, string][] = [
    ['Character effect', o.characterEffect],
    ['Theme effect', o.themeEffect],
    ['Relationship effect', o.relationshipEffect],
    ['Setup created', o.setupCreated],
    ['Potential payoff', o.potentialPayoff],
    ['Risk', o.risk],
  ];
  return (
    <Card tone={chosen ? 'accent' : 'default'} style={chosen && { borderColor: colors.accentText, borderWidth: 1.5 }}>
      <View style={storyStyles.wrap}>
        <Badge label={o.label} color={colors.text} />
        <Badge label={o.kind} />
        {chosen && <Badge icon="check" label="Selected" color={colors.accentText} />}
      </View>
      <View style={storyStyles.tight}>
        <Heading>{o.title}</Heading>
        <Body>{o.description}</Body>
      </View>
      <View style={storyStyles.group}>
        {facets
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <KeyValue key={label} label={label}>
              {value}
            </KeyValue>
          ))}
        {o.futureBranches.length > 0 && (
          <KeyValue label="Future branches">
            <Bullets items={o.futureBranches} />
          </KeyValue>
        )}
      </View>
      {onSelect && !chosen && (
        <Button title={`Select ${o.label}`} variant="secondary" size="sm" loading={busy} disabled={disabled} onPress={onSelect} />
      )}
    </Card>
  );
}

// ───────── Hero goal sequences: the film strip (PRD §13) ─────────

const HGS_STATUS: Record<HeroGoalSequence['status'], string> = {
  active: 'In pursuit',
  achieved: 'Achieved',
  redirected: 'Redirected',
  abandoned: 'Abandoned',
};

const FRAME_CELL = 132;

function Sequences({ sim, wide }: { sim: SimState; wide: boolean }) {
  const sheet = useSheet<true>();
  const [picked, setPicked] = useState<string | null>(null);
  const ordered = [...sim.sequences].sort((a, b) => a.number - b.number);
  const shown =
    ordered.find((s) => s.id === picked) ?? ordered.find((s) => s.id === sim.currentSequenceId) ?? ordered.at(-1);
  const perAct = ACTS.map((act) => sim.sequences.filter((s) => beatDef(s.beatKey).act === act).length);
  const photos = new Map(
    ordered.map((s) => [s.id, photosOf(sim.scenes.filter((scene) => scene.sequenceId === s.id)).at(-1)] as const),
  );

  return (
    <Section title="Hero goal sequences">
      {ordered.length > 0 && (
        <Filmstrip
          sequences={ordered}
          photos={photos}
          current={sim.currentSequenceId}
          selected={shown?.id}
          onSelect={setPicked}
          bleed={!wide}
        />
      )}
      <View style={wide ? storyStyles.columns : styles.stack}>
        <View style={wide ? storyStyles.column : styles.stack}>
          {shown && <SequenceCard sequence={shown} current={shown.id === sim.currentSequenceId} />}
        </View>
        <View style={wide ? storyStyles.column : styles.stack}>
          <Card tone="sunken">
            <Body style={styles.tabular}>
              Act I {perAct[0]} · Act II {perAct[1]} · Act III {perAct[2]}. {sim.sequences.length} of {HGS_GUIDE.total[0]}–
              {HGS_GUIDE.total[1]} sequences.
            </Body>
            <Caption>
              Act I ~{HGS_GUIDE.act1} · Act II ~{HGS_GUIDE.act2} · Act III {HGS_GUIDE.act3[0]}–{HGS_GUIDE.act3[1]}: a diagnostic,
              not a law.
            </Caption>
          </Card>
          <Gate perm="direct">
            <Button title="Open next sequence" icon="plus" variant="secondary" onPress={() => sheet.open(true)} />
          </Gate>
        </View>
      </View>
      {sheet.state && <SequenceSheet key={sheet.state.key} visible={sheet.state.visible} onClose={sheet.close} />}
    </Section>
  );
}

/** A strip of film taped to the board: one frame per sequence, the one in pursuit lit in brass. */
function Filmstrip({
  sequences,
  photos,
  current,
  selected,
  onSelect,
  bleed,
}: {
  sequences: HeroGoalSequence[];
  photos: Map<string, ImageSourcePropType | undefined>;
  current: string;
  selected?: string;
  onSelect: (id: string) => void;
  bleed: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const placed = useRef(false);
  const focus = sequences.findIndex((s) => s.id === current);
  return (
    <View style={bleed && styles.bleed}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.film}
        contentContainerStyle={styles.filmContent}
        onContentSizeChange={() => {
          if (placed.current || focus <= 0) return;
          placed.current = true;
          ref.current?.scrollTo({ x: focus * FRAME_CELL - spacing.xxxl, animated: false });
        }}>
        {sequences.map((s) => (
          <Frame
            key={s.id}
            sequence={s}
            photo={photos.get(s.id)}
            current={s.id === current}
            selected={s.id === selected}
            onPress={() => onSelect(s.id)}
          />
        ))}
      </ScrollView>
      <Tape width={58} style={[styles.filmTape, { left: bleed ? spacing.sm : -spacing.sm, transform: [{ rotate: '-8deg' }] }]} />
    </View>
  );
}

const SPROCKETS = Array.from({ length: 8 }, (_, i) => i);

function Sprockets() {
  return (
    <View style={styles.sprockets}>
      {SPROCKETS.map((i) => (
        <View key={i} style={styles.sprocket} />
      ))}
    </View>
  );
}

function Frame({
  sequence: s,
  photo,
  current,
  selected,
  onPress,
}: {
  sequence: HeroGoalSequence;
  photo?: ImageSourcePropType;
  current: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Hero goal sequence ${s.number}, ${HGS_STATUS[s.status]}${current ? ', current' : ''}: ${s.goal}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.cell, pressedStyle(pressed)]}>
      <Sprockets />
      <View style={[styles.frame, selected && styles.frameSelected, current && styles.frameCurrent]}>
        {photo ? (
          <Image source={photo} style={fillImage} resizeMode="cover" accessible={false} />
        ) : (
          <Text maxFontSizeMultiplier={1} style={[styles.frameNumber, current && styles.lit]}>
            {s.number}
          </Text>
        )}
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.frameLabel, (current || selected) && styles.frameLabelOn, current && styles.lit]}>
        HGS {s.number} · {beatDef(s.beatKey).name}
      </Text>
      <Sprockets />
    </Pressable>
  );
}

function SequenceCard({ sequence: s, current }: { sequence: HeroGoalSequence; current: boolean }) {
  const { colors } = useTheme();
  return (
    <Card tone={current ? 'accent' : 'default'} tilt={false}>
      <View style={storyStyles.row}>
        <Caption strong tone={current ? 'accent' : 'secondary'} style={[storyStyles.grow, styles.slate]}>
          HGS {s.number} · {beatDef(s.beatKey).name}
        </Caption>
        <Badge label={HGS_STATUS[s.status]} color={s.status === 'active' ? colors.accentText : undefined} />
      </View>
      <Body strong>{s.goal}</Body>
      {s.stake ? <Caption>Stake: {s.stake}</Caption> : null}
      {s.obstacle ? <Caption>Obstacle: {s.obstacle}</Caption> : null}
      <View style={storyStyles.row}>
        <ProgressBar value={s.progress} max={s.required} label="Goal progress" style={storyStyles.grow} />
        <Caption style={styles.tabular}>
          {Math.min(s.progress, s.required)} of {s.required}
        </Caption>
      </View>
      {s.freshNews ? <Caption tone="primary">Fresh news: {s.freshNews}</Caption> : null}
    </Card>
  );
}

const CLOSE_AS = [
  { value: undefined, label: 'Automatic' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'redirected', label: 'Redirected' },
  { value: 'abandoned', label: 'Abandoned' },
] as const;

type CloseAs = (typeof CLOSE_AS)[number]['value'];

function SequenceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { call, sequence } = useProject();
  const [freshNews, setFreshNews] = useState('');
  const [goal, setGoal] = useState('');
  const [stake, setStake] = useState('');
  const [obstacle, setObstacle] = useState('');
  const [closeAs, setCloseAs] = useState<CloseAs>(undefined);
  const { busy, error, run, setError } = useMutation();

  const submit = async () => {
    if (!freshNews.trim()) return setError('Fresh news is what closes the current goal. Describe it.');
    if (!goal.trim()) return setError('Give the next sequence a visible, short-term goal.');
    const args = { freshNews: freshNews.trim(), goal: goal.trim(), stake: stake.trim(), obstacle: obstacle.trim(), closeAs };
    if (await run('open', () => call('openSequence', args))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Open next sequence"
      footer={
        <>
          {error && <Caption tone="danger">{error}</Caption>}
          <Button title="Open sequence" block size="lg" loading={!!busy} onPress={submit} />
        </>
      }>
      {sequence && (
        <Card tone="sunken">
          <Caption>
            Closes HGS {sequence.number}: {sequence.goal} ({Math.min(sequence.progress, sequence.required)} of{' '}
            {sequence.required})
          </Caption>
        </Card>
      )}
      <TextField
        label="Fresh news"
        value={freshNews}
        onChangeText={setFreshNews}
        multiline
        helper="The news that changes the immediate objective."
      />
      <View style={storyStyles.group} accessibilityRole="radiogroup" accessibilityLabel="Close the current sequence as">
        <Caption strong tone="primary">
          Close current sequence as
        </Caption>
        <View style={storyStyles.chips}>
          {CLOSE_AS.map((o) => (
            <Chip key={o.label} label={o.label} selected={closeAs === o.value} onPress={() => setCloseAs(o.value)} />
          ))}
        </View>
        {closeAs === undefined && <Caption>Achieved if its progress reached the goal, otherwise redirected.</Caption>}
      </View>
      <TextField label="Next goal" value={goal} onChangeText={setGoal} helper="Physical, visible and short-term." />
      <TextField label="Stake" value={stake} onChangeText={setStake} />
      <TextField label="Obstacle" value={obstacle} onChangeText={setObstacle} />
    </Sheet>
  );
}

// ───────── Scenes in the current sequence ─────────

function Scenes({ sim }: { sim: SimState }) {
  const sheet = useSheet<true>();
  const scenes = sim.scenes.filter((s) => s.sequenceId === sim.currentSequenceId || s.id === sim.currentSceneId);

  return (
    <Section title="Scenes" note="in this sequence">
      {scenes.length === 0 ? (
        <Card tone="sunken">
          <Caption>No scenes in this sequence yet.</Caption>
        </Card>
      ) : (
        scenes.map((s, i) => <SceneCard key={s.id} scene={s} order={i} current={s.id === sim.currentSceneId} />)
      )}
      <Gate perm="direct">
        <Button title="Open scene" icon="plus" variant="secondary" onPress={() => sheet.open(true)} />
      </Gate>
      {sheet.state && <SceneSheet key={sheet.state.key} visible={sheet.state.visible} onClose={sheet.close} />}
    </Section>
  );
}

function SceneCard({ scene: s, order, current }: { scene: Scene; order: number; current: boolean }) {
  const photo = sceneImage(s);
  return (
    <Card thread="scenes" order={order} tone={current ? 'accent' : 'default'} tilt={s.id}>
      <View style={storyStyles.rowTop}>
        {photo && (
          <View style={styles.scenePhoto}>
            <Image source={photo} style={fillImage} resizeMode="cover" accessible={false} />
          </View>
        )}
        <View style={[storyStyles.grow, storyStyles.tight]}>
          <Mono>{s.heading}</Mono>
          <Badge label={s.status === 'open' ? 'Open' : 'Closed'} />
        </View>
      </View>
      {s.situation ? <Caption>{s.situation}</Caption> : null}
      {s.shift ? <Caption tone="primary">Shift: {s.shift}</Caption> : null}
    </Card>
  );
}

function SceneSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { project, scene, call } = useProject();
  const [heading, setHeading] = useState('');
  const [situation, setSituation] = useState('');
  const [present, setPresent] = useState<string[]>(scene?.presentCharacterIds ?? []);
  const { busy, error, run, setError } = useMutation();

  const toggle = (id: string) => setPresent((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    if (!heading.trim()) return setError('A scene heading is required, e.g. INT. HARBOR OFFICE - NIGHT.');
    const args = { heading: heading.trim(), situation: situation.trim(), presentCharacterIds: present };
    if (await run('open', () => call('openScene', args))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Open scene"
      footer={
        <>
          {error && <Caption tone="danger">{error}</Caption>}
          <Button title="Open scene" block size="lg" loading={!!busy} onPress={submit} />
        </>
      }>
      {scene?.status === 'open' && (
        <Caption>Opening a scene closes “{scene.heading}”; its last resolution becomes that scene’s shift.</Caption>
      )}
      <TextField
        label="Heading"
        value={heading}
        onChangeText={setHeading}
        autoCapitalize="characters"
        placeholder="INT. HARBOR OFFICE - NIGHT"
      />
      <TextField label="Situation" value={situation} onChangeText={setSituation} multiline helper="What the room walks into." />
      <View style={storyStyles.group}>
        <Caption strong tone="primary">
          Present
        </Caption>
        <View style={storyStyles.chips}>
          {project?.model.characters.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={present.includes(c.id)}
              onPress={() => toggle(c.id)}
              accessibilityLabel={`${c.name}, ${present.includes(c.id) ? 'present' : 'not present'}`}
            />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

// ───────── Administrative view (PRD §14, §35) ─────────

function Administration({ sim, onOpenBeat }: { sim: SimState; onOpenBeat: () => void }) {
  const { project, sequence, protagonist } = useProject();
  const notes = useGrid(150, spacing.md);
  if (!project) return null;

  const def = STC_BEATS[sim.beatIndex]!;
  const next = STC_BEATS[sim.beatIndex + 1];
  const openSetups = sim.setups.filter((s) => s.status === 'open');
  const unknowns = project.model.canon.filter((i) => i.status === 'unknown');
  const payoffs = sim.setups.filter((s) => s.status === 'payoff-candidate');
  const fit = protagonist?.worldFit;
  const arc = fit?.requiredAdaptation.trim() || fit?.traitGaps.trim();
  const theme = project.model.thematicConflict || project.model.theme;
  const unresolved: { id: string; text: string; label: string; color: NoteColor }[] = [
    ...openSetups.map((s) => ({
      id: s.id,
      text: s.text,
      label: `Open setup${s.reinforcementEventIds.length ? ` · reinforced ${s.reinforcementEventIds.length}×` : ''}`,
      color: 'yellow' as const,
    })),
    ...unknowns.map((i) => ({ id: i.id, text: i.text, label: 'Intentionally unresolved', color: 'blue' as const })),
  ];

  return (
    <>
      <Section title="Structural administration">
        <Card tilt={false}>
          <Heading style={styles.slate}>{next ? `${next.name} approaching` : 'Final beat'}</Heading>
          <View style={storyStyles.group}>
            <KeyValue label="Current beat">{`${def.name} (Act ${ACT[def.act]})`}</KeyValue>
            <KeyValue label="HGS">
              <Body style={styles.tabular}>
                {sequence?.number ?? 0} of {HGS_GUIDE.total[0]}–{HGS_GUIDE.total[1]}
              </Body>
            </KeyValue>
            <KeyValue label="Current goal">{sequence?.goal || 'No active goal'}</KeyValue>
            <KeyValue label="Required dramatic movement">{def.purpose}</KeyValue>
            {sim.directive ? <KeyValue label="Active directive">{sim.directive}</KeyValue> : null}
            <KeyValue label="Known unresolved elements">{`${unresolved.length}`}</KeyValue>
            <KeyValue label="Pending payoffs">{`${payoffs.length}`}</KeyValue>
            <KeyValue label="Character arc pressure">
              {arc ? (
                <View style={storyStyles.tight}>
                  <Body>{arc}</Body>
                  {fit?.resistance.trim() ? <Caption>Resisting: {fit.resistance}</Caption> : null}
                </View>
              ) : (
                <Body tone="tertiary">No world-fit mapped for {protagonist?.name ?? 'the protagonist'} yet</Body>
              )}
            </KeyValue>
            <KeyValue label="Theme pressure">
              {theme ? <Body>{theme}</Body> : <Body tone="tertiary">No thematic conflict written yet</Body>}
            </KeyValue>
          </View>
          <Button title={`Open ${def.name}`} icon="arrow-right" variant="secondary" size="sm" onPress={onOpenBeat} />
        </Card>
      </Section>

      {unresolved.length > 0 && (
        <Section title="Unresolved" note="still open">
          <View onLayout={notes.onLayout} style={styles.notes}>
            {unresolved.map((n) => (
              <Note key={n.id} id={n.id} color={n.color} text={n.text} label={n.label} width={notes.item} />
            ))}
          </View>
        </Section>
      )}

      {payoffs.length > 0 && (
        <Section title="Pending payoffs">
          <View onLayout={notes.onLayout} style={styles.notes}>
            {payoffs.map((s) => (
              <Note
                key={s.id}
                id={s.id}
                color="green"
                text={s.text}
                label={`Accumulated relevance · reinforced ${s.reinforcementEventIds.length}×`}
                width={notes.item}
              />
            ))}
          </View>
        </Section>
      )}
    </>
  );
}

/** A sticky note on the planning board: an open thread the story still owes. */
function Note({ id, color, text, label, width }: { id: string; color: NoteColor; text: string; label: string; width: number }) {
  return (
    <StickyNote color={color} style={[styles.note, { width, transform: [{ rotate: `${tiltFor(id, 1.6).toFixed(2)}deg` }] }]}>
      <Body style={styles.noteText}>{text}</Body>
      <Caption>{label}</Caption>
    </StickyNote>
  );
}

const styles = StyleSheet.create({
  acts: { gap: spacing.xl },
  stack: { gap: spacing.md },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  slate: { textTransform: 'uppercase', letterSpacing: 0.6 },
  // Rows of beat cards
  bleed: { marginHorizontal: -spacing.lg },
  bleedContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: CARD_GAP },
  beatCard: { gap: spacing.sm },
  beatCardCompact: { padding: spacing.md, paddingTop: spacing.xl },
  beatSelected: { borderWidth: 2, borderColor: palettes.paper.text },
  beatTitle: { fontSize: 13, lineHeight: 17, height: 34, letterSpacing: 0.5 },
  // At least three lines so short definitions keep the row even; longer ones grow rather than being cut mid-phrase.
  beatAt: { fontFamily: fonts.typewriterItalic },
  beatPurpose: { fontSize: 12, lineHeight: 16, minHeight: 48 },
  beatFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, minHeight: 22 },
  metCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  photo: { width: '100%', backgroundColor: '#1A1714', overflow: 'hidden', borderRadius: 1 },
  photoEmpty: {
    backgroundColor: '#2A2521',
    borderWidth: 3,
    borderColor: '#F1ECE1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  photoEmptyText: { color: '#D4CBBA' },
  // Detail
  detail: { gap: spacing.lg },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: -spacing.sm },
  thumb: { width: 64, height: 44, backgroundColor: '#1A1714', overflow: 'hidden', borderRadius: 1 },
  box: { width: 18, height: 18, marginTop: 2, borderWidth: 1.5, borderRadius: 1, alignItems: 'center', justifyContent: 'center' },
  panel: {
    width: 380,
    backgroundColor: desk.bg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: desk.border,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    minHeight: TOUCH_TARGET + spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: desk.border,
  },
  panelTitle: { flex: 1, fontFamily: fonts.typewriterBold, fontSize: 14, letterSpacing: 1.6, color: desk.text },
  panelBody: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  panelPaper: { padding: spacing.lg },
  // Film strip
  film: { backgroundColor: '#0D0A08' },
  filmContent: { paddingHorizontal: spacing.lg },
  filmTape: { position: 'absolute', top: -9 },
  cell: { width: FRAME_CELL, alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.xs },
  sprockets: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 4 },
  sprocket: { width: 9, height: 7, borderRadius: 1.5, backgroundColor: '#5E4A34' },
  frame: {
    width: FRAME_CELL - 20,
    height: 76,
    backgroundColor: '#211B16',
    borderWidth: 2,
    borderColor: '#211B16',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameSelected: { borderColor: desk.textSecondary },
  frameCurrent: { borderColor: desk.accent },
  frameNumber: { fontFamily: fonts.typewriterBold, fontSize: 30, color: desk.textTertiary },
  lit: { color: desk.accentText },
  frameLabel: { fontFamily: fonts.typewriter, fontSize: 11, lineHeight: 14, color: desk.textTertiary, maxWidth: FRAME_CELL - 16 },
  frameLabelOn: { color: desk.text },
  // Scenes & notes
  scenePhoto: { width: 88, height: 64, backgroundColor: '#1A1714', overflow: 'hidden', borderRadius: 1 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  note: { gap: spacing.sm, padding: spacing.md, paddingTop: spacing.lg },
  noteText: { fontSize: 14, lineHeight: 20 },
});
