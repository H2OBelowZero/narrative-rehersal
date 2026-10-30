// Character Lab (PRD §9–11, §26, §31): a large print and a typed dossier on top, the three trait dimensions as
// index cards, the World-Fit journey strung card to card, and what play has shown below.
// Empathy stays observational and divergence stays neutral: no scores, no verdicts.
import { StyleSheet, View } from 'react-native';

import { DOMAIN_LABEL, DOMAINS, EMPATHY_SIGNALS } from '@shared/structure';
import type { Character, CharacterState, EmpathySignal, Relationship, Trait } from '@shared/types';

import { characterImage } from '@/components/board/materials';
import { Pinned, Polaroid } from '@/components/board/paper';
import { followString } from '@/components/string-nav';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  CanonBadge,
  Chip,
  Eyebrow,
  Gate,
  Heading,
  List,
  ListRow,
  Meter,
  ProgressBar,
  Section,
  Title,
} from '@/components/ui';
import { DISCOVERY_KIND_LABEL, DISCOVERY_STATUS_LABEL } from '@/lib/format';
import { useProject } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

import {
  CapabilitiesSheet,
  CharacterSheet,
  CharacterStatusSheet,
  RelationshipSheet,
  TRAIT_GROUPS,
  TraitSheet,
  WORLD_FIT_STEPS,
  WorldFitSheet,
  type TraitGroup,
} from './character-sheets';
import {
  Bullets,
  CHARACTER_ROLE_LABEL,
  PrintInitials,
  Prose,
  Row,
  storyStyles,
  Thumb,
  useEmptyText,
  useSheet,
  useWide,
} from './common';

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function CharacterLab({ character: c }: { character: Character }) {
  const { project, sim, me, can } = useProject();
  const wide = useWide();
  const editSheet = useSheet<true>();
  const statusSheet = useSheet<true>();
  const traitSheet = useSheet<{ group: TraitGroup; trait?: Trait }>();
  const worldFitSheet = useSheet<true>();
  const capabilitySheet = useSheet<true>();
  const relationshipSheet = useSheet<{ relationship?: Relationship; direction: 'out' | 'in' }>();
  if (!project) return null;

  const lockedForMe = c.status === 'locked' && !can('promoteCanon');
  const editable = can('editModel') && !lockedForMe;
  const isProtagonist = c.id === project.model.protagonistId;
  const state = sim?.characters[c.id];
  const sheetProps = (s: { visible: boolean }, close: () => void) => ({ character: c, visible: s.visible, onClose: close });

  const traits = (
    <Section title="Traits" note="three dimensions">
      <View style={wide ? storyStyles.columns : styles.stack}>
        {TRAIT_GROUPS.map((g) => (
          <View key={g.key} style={wide && storyStyles.column}>
            <TraitCard
              title={g.title}
              meaning={g.meaning}
              traits={c[g.key]}
              onAdd={editable ? () => traitSheet.open({ group: g.key }) : undefined}
              onOpen={editable ? (trait) => traitSheet.open({ group: g.key, trait }) : undefined}
            />
          </View>
        ))}
      </View>
    </Section>
  );
  const valuesAndResources = (
    <Section title="Values & resources">
      <Card tilt={`${c.id}:values`}>
        <ChipList label="Declared values" items={c.declaredValues} />
        <ChipList label="Starting resources" items={c.resources} />
      </Card>
    </Section>
  );
  const capabilities = <Capabilities c={c} onEdit={editable ? () => capabilitySheet.open(true) : undefined} />;
  const worldFit = (
    <WorldFitJourney c={c} isProtagonist={isProtagonist} onEdit={editable ? () => worldFitSheet.open(true) : undefined} />
  );
  const performance = (
    <Section title="Performance">
      <Card tilt={`${c.id}:performance`}>
        <Prose label="Performer brief" value={c.performerBrief} />
        <Caption>What a performer sees about this character in a blind session.</Caption>
        <Prose label="Voice notes" value={c.voice} />
      </Card>
    </Section>
  );
  const relationships = (
    <Relationships
      c={c}
      onAdd={can('editModel') ? () => relationshipSheet.open({ direction: 'out' }) : undefined}
      onOpen={can('editModel') ? (relationship, direction) => relationshipSheet.open({ relationship, direction }) : undefined}
    />
  );
  const inPlay = (
    <InPlay state={state} mine={me?.characterId === c.id} showEmpathy={can('analyze') && (isProtagonist || !!state?.empathy.length)} />
  );
  // Divergence analysis is for the creative team, not for performers mid-discovery (PRD §31–32).
  const divergence = (
    <Gate perm="analyze">
      <DeclaredVsObserved c={c} state={state} />
    </Gate>
  );

  return (
    <>
      <Header
        c={c}
        wide={wide}
        isProtagonist={isProtagonist}
        lockedForMe={lockedForMe && can('editModel')}
        onEdit={editable ? () => editSheet.open(true) : undefined}
        onStatus={editable ? () => statusSheet.open(true) : undefined}
      />

      {traits}

      {wide ? (
        <View style={storyStyles.columns}>
          <View style={storyStyles.column}>
            {worldFit}
            {performance}
          </View>
          <View style={storyStyles.column}>
            {relationships}
            {valuesAndResources}
            {capabilities}
          </View>
        </View>
      ) : (
        <>
          {valuesAndResources}
          {capabilities}
          {worldFit}
          {performance}
          {relationships}
        </>
      )}

      {wide ? (
        <View style={storyStyles.columns}>
          <View style={storyStyles.column}>{inPlay}</View>
          <View style={storyStyles.column}>{divergence}</View>
        </View>
      ) : (
        <>
          {inPlay}
          {divergence}
        </>
      )}

      {editSheet.state && <CharacterSheet key={editSheet.state.key} {...sheetProps(editSheet.state, editSheet.close)} />}
      {statusSheet.state && (
        <CharacterStatusSheet key={statusSheet.state.key} {...sheetProps(statusSheet.state, statusSheet.close)} />
      )}
      {worldFitSheet.state && (
        <WorldFitSheet key={worldFitSheet.state.key} {...sheetProps(worldFitSheet.state, worldFitSheet.close)} />
      )}
      {capabilitySheet.state && (
        <CapabilitiesSheet key={capabilitySheet.state.key} {...sheetProps(capabilitySheet.state, capabilitySheet.close)} />
      )}
      {traitSheet.state && (
        <TraitSheet
          key={traitSheet.state.key}
          {...sheetProps(traitSheet.state, traitSheet.close)}
          {...traitSheet.state.value}
        />
      )}
      {relationshipSheet.state && (
        <RelationshipSheet
          key={relationshipSheet.state.key}
          {...sheetProps(relationshipSheet.state, relationshipSheet.close)}
          {...relationshipSheet.state.value}
        />
      )}
    </>
  );
}

// ───────── The print and the dossier ─────────

function Header({
  c,
  wide,
  isProtagonist,
  lockedForMe,
  onEdit,
  onStatus,
}: {
  c: Character;
  wide: boolean;
  isProtagonist: boolean;
  lockedForMe: boolean;
  onEdit?: () => void;
  onStatus?: () => void;
}) {
  const photo = characterImage(c);
  const width = wide ? 280 : 232;
  return (
    <View style={wide ? styles.heroWide : styles.hero}>
      <Pinned at="top" tilt={c.id} style={!wide && styles.heroPrint}>
        <Polaroid source={photo} caption={c.name} width={width} />
        {!photo && <PrintInitials name={c.name} width={width} />}
      </Pinned>
      <View style={wide && storyStyles.column}>
        <Card tilt={false} fasten="tape">
          <Dossier c={c} wide={wide} isProtagonist={isProtagonist} lockedForMe={lockedForMe} onEdit={onEdit} onStatus={onStatus} />
        </Card>
      </View>
    </View>
  );
}

/** The typed file on a character (drawn on paper, so its colours are ink). */
function Dossier({
  c,
  wide,
  isProtagonist,
  lockedForMe,
  onEdit,
  onStatus,
}: {
  c: Character;
  wide: boolean;
  isProtagonist: boolean;
  lockedForMe: boolean;
  onEdit?: () => void;
  onStatus?: () => void;
}) {
  const { me } = useProject();
  const { colors } = useTheme();
  return (
    <>
      <View style={storyStyles.tight}>
        <Title style={styles.name}>{c.name}</Title>
        <View style={storyStyles.wrap}>
          <Badge label={CHARACTER_ROLE_LABEL[c.role]} color={isProtagonist ? colors.accentText : undefined} />
          {isProtagonist && c.role !== 'protagonist' && <Badge label="Protagonist" color={colors.accentText} />}
          <CanonBadge status={c.status} />
          {me?.characterId === c.id && <Badge label="Your role" color={colors.text} />}
        </View>
      </View>
      <Prose label="Summary" value={c.summary} />
      <View style={[styles.facts, wide && styles.factsWide]}>
        {(['goal', 'fear', 'secret', 'wound'] as const).map((key) => (
          <View key={key} style={wide && styles.fact}>
            <Prose label={key[0]!.toUpperCase() + key.slice(1)} value={c[key]} />
          </View>
        ))}
      </View>
      {lockedForMe && <Caption>Locked: only the Project Owner can change this character.</Caption>}
      {(onEdit || onStatus) && (
        <View style={storyStyles.actions}>
          {onEdit && <Button title="Edit character" icon="edit" variant="secondary" size="sm" onPress={onEdit} />}
          {onStatus && <Button title="Change status" variant="secondary" size="sm" onPress={onStatus} />}
        </View>
      )}
    </>
  );
}

// ───────── Traits: three index cards ─────────

function TraitCard({
  title,
  meaning,
  traits,
  onAdd,
  onOpen,
}: {
  title: string;
  meaning: string;
  traits: Trait[];
  onAdd?: () => void;
  onOpen?: (trait: Trait) => void;
}) {
  const { colors } = useTheme();
  const emptyText = useEmptyText();
  return (
    <Card tilt={title}>
      <View style={storyStyles.row}>
        <View style={storyStyles.grow}>
          <Heading style={styles.slate}>{title}</Heading>
          <Caption>{meaning}</Caption>
        </View>
        {onAdd && (
          <Button title="Add" icon="plus" variant="ghost" size="sm" onPress={onAdd} accessibilityLabel={`Add ${title.toLowerCase()} trait`} />
        )}
      </View>
      {traits.length === 0 ? (
        <Caption tone="tertiary">{emptyText('No traits yet.')}</Caption>
      ) : (
        <List>
          {traits.map((t) => (
            <Row
              key={t.id}
              style={styles.flushRow}
              onPress={onOpen && (() => onOpen(t))}
              accessibilityLabel={`${t.label}${t.note ? `, ${t.note}` : ''}`}>
              <Body strong tone={t.status === 'rejected' ? 'secondary' : 'primary'}>
                {t.label}
              </Body>
              {t.note ? <Caption>{t.note}</Caption> : null}
              <View style={storyStyles.wrap}>
                <CanonBadge status={t.status} />
                {t.source === 'emergent' && <Badge icon="rehearse" label="Emerged in play" color={colors.canon.emergent} />}
              </View>
            </Row>
          ))}
        </List>
      )}
    </Card>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }) {
  const emptyText = useEmptyText();
  return (
    <View style={storyStyles.group}>
      <Eyebrow>{label}</Eyebrow>
      {items.length ? (
        <View style={storyStyles.wrap}>
          {items.map((item, i) => (
            <Chip key={`${i}:${item}`} label={item} />
          ))}
        </View>
      ) : (
        <Caption tone="tertiary">{emptyText('None declared.')}</Caption>
      )}
    </View>
  );
}

function Capabilities({ c, onEdit }: { c: Character; onEdit?: () => void }) {
  const { project } = useProject();
  const hidden = project?.redacted && DOMAINS.every((d) => !c.capabilities[d]);
  return (
    <Section title="Capabilities" action={onEdit && { label: 'Edit', onPress: onEdit }}>
      <Card tilt={`${c.id}:capabilities`}>
        <Caption>Baseline for chance resolution (0–5), before situation modifiers.</Caption>
        {hidden ? (
          <Body tone="tertiary" style={storyStyles.italic}>
            Not in your brief
          </Body>
        ) : (
          <CapabilityRows c={c} />
        )}
      </Card>
    </Section>
  );
}

/** Drawn on paper, so the bars take the paper's ink. */
function CapabilityRows({ c }: { c: Character }) {
  const { colors } = useTheme();
  return DOMAINS.map((d) => (
    <View key={d} style={storyStyles.row}>
      <Body style={styles.domain}>{DOMAIN_LABEL[d]}</Body>
      <ProgressBar
        value={c.capabilities[d]}
        max={5}
        label={`${DOMAIN_LABEL[d]} ${c.capabilities[d]} of 5`}
        color={colors.textSecondary}
        style={storyStyles.grow}
      />
      <Body strong style={styles.value}>
        {c.capabilities[d]}
      </Body>
    </View>
  ));
}

// ───────── World-fit: a journey strung card to card (PRD §10) ─────────

function WorldFitJourney({ c, isProtagonist, onEdit }: { c: Character; isProtagonist: boolean; onEdit?: () => void }) {
  const emptyText = useEmptyText();
  // Core to the protagonist (PRD §10); optional for everyone else.
  if (!c.worldFit && !isProtagonist && !onEdit) return null;

  return (
    <Section title="World-fit" note="the journey" action={c.worldFit && onEdit ? { label: 'Edit', onPress: onEdit } : undefined}>
      {!c.worldFit ? (
        <Card tone="sunken">
          <Caption>
            {isProtagonist
              ? emptyText(`What does the new world demand of ${c.name}, and what does adapting cost?`)
              : 'Optional for supporting characters. Useful when their change matters to the story.'}
          </Caption>
          {onEdit && <Button title="Map world-fit" icon="plus" variant="secondary" size="sm" onPress={onEdit} />}
        </Card>
      ) : (
        WORLD_FIT_STEPS.map((s, i) => {
          const end = i === 0 || i === WORLD_FIT_STEPS.length - 1;
          const value = c.worldFit?.[s.key]?.trim();
          return (
            <Card key={s.key} thread="world-fit" order={i} pin={end ? 'brass' : 'red'} tilt={`${c.id}:${s.key}`} style={styles.step}>
              <Caption strong tone={end ? 'accent' : 'secondary'} style={styles.slate}>
                {i + 1}. {s.label}
              </Caption>
              <Caption tone="tertiary">{s.question}</Caption>
              {value ? (
                <Body>{value}</Body>
              ) : (
                <Body tone="tertiary" style={storyStyles.italic}>
                  {emptyText()}
                </Body>
              )}
            </Card>
          );
        })
      )}
    </Section>
  );
}

// ───────── Relationships (PRD §11) ─────────

type Pair = { authored?: Relationship; live?: Relationship };

/** Authored baseline paired with its evolving copy in the active simulation (matched by id, then by direction). */
function relationshipPairs(characterId: string, authored: Relationship[], live: Relationship[]): Pair[] {
  const touches = (r: Relationship) => r.from === characterId || r.to === characterId;
  const pairs: Pair[] = authored.filter(touches).map((a) => ({
    authored: a,
    live: live.find((r) => r.id === a.id) ?? live.find((r) => r.from === a.from && r.to === a.to),
  }));
  const matched = new Set(pairs.map((p) => p.live?.id));
  for (const r of live) if (touches(r) && !matched.has(r.id)) pairs.push({ live: r });
  return pairs;
}

function Relationships({
  c,
  onAdd,
  onOpen,
}: {
  c: Character;
  onAdd?: () => void;
  onOpen?: (relationship: Relationship, direction: 'out' | 'in') => void;
}) {
  const { project, sim } = useProject();
  if (!project) return null;
  const pairs = relationshipPairs(c.id, project.model.relationships, sim?.relationships ?? []);
  const outgoing = pairs.filter((p) => (p.authored ?? p.live)!.from === c.id);
  const incoming = pairs.filter((p) => (p.authored ?? p.live)!.to === c.id);

  const group = (title: string, list: Pair[], direction: 'out' | 'in') => (
    <Card tilt={`${c.id}:${direction}`}>
      <Heading style={styles.slate}>{title}</Heading>
      {list.length === 0 ? (
        <Caption tone="tertiary">None.</Caption>
      ) : (
        <List>
          {list.map((p) => (
            <RelationshipRow
              key={(p.authored ?? p.live)!.id}
              pair={p}
              direction={direction}
              onPress={p.authored && onOpen ? () => onOpen(p.authored!, direction) : undefined}
            />
          ))}
        </List>
      )}
    </Card>
  );

  return (
    <Section title="Relationships" action={onAdd && { label: 'Add', onPress: onAdd }}>
      {group(`How ${c.name} feels`, outgoing, 'out')}
      {group(`How others feel about ${c.name}`, incoming, 'in')}
    </Section>
  );
}

function RelationshipRow({ pair, direction, onPress }: { pair: Pair; direction: 'out' | 'in'; onPress?: () => void }) {
  const { charName, character } = useProject();
  const { authored, live } = pair;
  const current = (live ?? authored)!;
  // The card heading gives the direction; the row names the other character.
  const otherId = direction === 'out' ? current.to : current.from;
  const who = charName(otherId);
  const label = current.label && current.label !== '—' ? current.label : authored?.label;

  const changes: string[] = [];
  if (authored && live && live.trust !== authored.trust) changes.push(`Trust ${signed(authored.trust)} → ${signed(live.trust)} in play`);
  if (authored && live && live.tension !== authored.tension) changes.push(`Tension ${authored.tension} → ${live.tension} in play`);

  return (
    <Row
      style={styles.flushRow}
      onPress={onPress}
      accessibilityLabel={`${who}${label ? `, ${label}` : ''}, trust ${signed(current.trust)}, tension ${current.tension} of 5`}>
      <View style={storyStyles.rowTop}>
        <Thumb character={character(otherId) ?? { name: who }} size={40} />
        <View style={[storyStyles.grow, storyStyles.tight]}>
          <View style={storyStyles.row}>
            <Body strong style={storyStyles.grow}>
              {who}
              {label ? <Body tone="secondary"> · {label}</Body> : null}
            </Body>
            <Caption>Tension {current.tension}/5</Caption>
          </View>
          <Meter kind="trust" value={current.trust} label="Trust" />
        </View>
      </View>
      {changes.map((line) => (
        <Caption key={line} tone="accent">
          {line}
        </Caption>
      ))}
      {!live && <Caption tone="tertiary">Not in the active simulation: added after it began.</Caption>}
      {!authored && <Caption tone="tertiary">Emerged in play; not part of the authored baseline.</Caption>}
      {current.notes ? <Caption>{current.notes}</Caption> : null}
    </Row>
  );
}

// ───────── What play has shown (PRD §28, §31) ─────────

const IN_PLAY: { key: 'knowledge' | 'conditions' | 'resources' | 'reputation' | 'promises' | 'betrayals'; label: string }[] = [
  { key: 'knowledge', label: 'Knows' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'resources', label: 'Resources' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'promises', label: 'Promises' },
  { key: 'betrayals', label: 'Betrayals' },
];

const SIGNALS = Object.keys(EMPATHY_SIGNALS) as EmpathySignal[];

/** What persists from play for this character (PRD §28), from the active simulation. */
function InPlay({ state, mine, showEmpathy }: { state: CharacterState | undefined; mine: boolean; showEmpathy: boolean }) {
  const { project } = useProject();
  const emptyText = useEmptyText();
  // Redacted views empty other characters' knowledge and conditions; everything else here is real.
  const hidden = (key: string) => !!project?.redacted && !mine && (key === 'knowledge' || key === 'conditions');
  if (!state) {
    return (
      <Section title="In play">
        <Card tone="sunken">
          <Caption>{emptyText('Not part of the active simulation yet.')}</Caption>
        </Card>
      </Section>
    );
  }

  const observed = SIGNALS.filter((s) => state.empathy.some((e) => e.signal === s));
  const missing = SIGNALS.filter((s) => !observed.includes(s));

  return (
    <Section title="In play" note="what persists">
      <Card tilt={`${state.characterId}:play`}>
        {IN_PLAY.map(({ key, label }) => (
          <View key={key} style={storyStyles.tight}>
            <Eyebrow>{label}</Eyebrow>
            {state[key].length ? (
              <Bullets items={state[key]} />
            ) : (
              <Caption tone="tertiary">{hidden(key) ? 'Not in your brief' : 'None yet.'}</Caption>
            )}
          </View>
        ))}
        <View style={storyStyles.tight}>
          <Eyebrow>Observed behaviour</Eyebrow>
          {state.behaviors.length ? (
            <Bullets items={state.behaviors.map((b) => `${b.trait}: ${b.text}`)} />
          ) : (
            <Caption tone="tertiary">None yet.</Caption>
          )}
        </View>
      </Card>
      {showEmpathy && (
        <Card tilt={`${state.characterId}:empathy`}>
          <Eyebrow>Empathy signals</Eyebrow>
          <Body>
            <Body strong>Observed: </Body>
            {observed.length ? observed.map((s) => EMPATHY_SIGNALS[s].toLowerCase()).join(', ') : 'nothing yet'}
          </Body>
          {state.empathy.length > 0 && <Bullets items={state.empathy.map((e) => `${EMPATHY_SIGNALS[e.signal]}: ${e.text}`)} />}
          <Body>
            <Body strong>No evidence yet: </Body>
            {missing.length ? missing.map((s) => EMPATHY_SIGNALS[s].toLowerCase()).join(', ') : 'none'}
          </Body>
          <Caption>Observations from play, not a measure. Missing evidence is an opening, not a flaw.</Caption>
        </Card>
      )}
    </Section>
  );
}

/** PRD §31: declared intent beside observed behaviour, in neutral language. */
function DeclaredVsObserved({ c, state }: { c: Character; state: CharacterState | undefined }) {
  const { project, projectId } = useProject();
  const discoveries = project?.discoveries.filter((d) => d.characterId === c.id) ?? [];
  const behaviours = [...new Set(state?.behaviors.map((b) => b.trait) ?? [])];
  const openDiscover = () => followString(projectId, 'discover');

  return (
    <Section title="Declared vs observed">
      <Card tilt={`${c.id}:declared`}>
        <ChipList label="Declared" items={c.declaredValues} />
        <View style={storyStyles.group}>
          <Eyebrow>Observed in play</Eyebrow>
          {behaviours.length ? (
            <View style={storyStyles.wrap}>
              {behaviours.map((b) => (
                <Chip key={b} label={b} />
              ))}
            </View>
          ) : (
            <Caption tone="tertiary">No behaviour observed yet.</Caption>
          )}
        </View>
        <Caption>
          Where these differ there is a divergence to explore. It may be a character revelation, a performance choice or
          temporary story-state behaviour. Only the Project Owner promotes it to canon.
        </Caption>
      </Card>
      {discoveries.length > 0 && (
        <List>
          {discoveries.map((d) => (
            <ListRow
              key={d.id}
              title={d.title}
              subtitle={[
                `${DISCOVERY_KIND_LABEL[d.kind]} · ${DISCOVERY_STATUS_LABEL[d.status]}`,
                d.declared && d.observed ? `Declared: ${d.declared} · Observed: ${d.observed}` : undefined,
              ]
                .filter(Boolean)
                .join('\n')}
              subtitleLines={3}
              onPress={openDiscover}
              accessibilityHint="Follows the string to Discover"
            />
          ))}
        </List>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  hero: { gap: spacing.xl },
  heroWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  heroPrint: { alignSelf: 'center' },
  name: { textTransform: 'uppercase', letterSpacing: 1 },
  slate: { textTransform: 'uppercase', letterSpacing: 0.6 },
  facts: { gap: spacing.md },
  factsWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xl, rowGap: spacing.md },
  fact: { flexBasis: '45%', flexGrow: 1 },
  flushRow: { paddingHorizontal: 0 },
  domain: { width: 104 },
  value: { minWidth: 16, textAlign: 'right', fontVariant: ['tabular-nums'] },
  step: { gap: spacing.xs },
});
