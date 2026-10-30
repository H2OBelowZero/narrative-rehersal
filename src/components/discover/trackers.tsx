// Setup / payoff engine (PRD §29) and theme alignment (PRD §30) for the active branch, as index cards: each setup
// is a card, and a paid-off setup is tied by string to the card that pays it off.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Setup, SimState, ThemeStance } from '@shared/types';

import { Hand } from '@/components/board/paper';
import { Badge, Body, Caption, Card, EmptyState, Eyebrow, List, ListRow, Section } from '@/components/ui';
import { fonts, palettes, spacing, useTheme, type Palette } from '@/theme';

import { Ledger } from './board-bits';
import type { Evidence } from './evidence';

type ShowEvidence = (evidence: Evidence) => void;

const SETUP_GROUPS: { status: Setup['status']; title: string; note?: string }[] = [
  { status: 'payoff-candidate', title: 'Payoff candidates', note: 'The Director decides whether to reveal these.' },
  { status: 'open', title: 'Open setups' },
  { status: 'paid-off', title: 'Paid off' },
  { status: 'dropped', title: 'Dropped' },
];

const SETUP_STATUS: Record<Setup['status'], string> = {
  open: 'Open',
  'payoff-candidate': 'Payoff candidate',
  'paid-off': 'Paid off',
  dropped: 'Dropped',
};

const setupColor = (colors: Palette, status: Setup['status']) =>
  ({
    open: colors.textSecondary,
    'payoff-candidate': colors.accentText,
    'paid-off': colors.canon.canon,
    dropped: colors.textTertiary,
  })[status];

const times = (n: number) => (n === 1 ? 'once' : `${n} times`);

export function SetupPayoffTracker({ sim, onEvidence }: { sim: SimState; onEvidence: ShowEvidence }) {
  const count = (status: Setup['status']) => sim.setups.filter((s) => s.status === status).length;
  const number = (s: Setup) => sim.setups.indexOf(s) + 1;

  return (
    <Section title="Setup / payoff" note="planted, then paid">
      <Card tilt={false}>
        <Ledger
          rows={[
            { label: 'Open', value: count('open') },
            { label: 'Payoff candidates', value: count('payoff-candidate') },
            { label: 'Paid off', value: count('paid-off') },
          ]}
        />
      </Card>
      {sim.setups.length === 0 ? (
        <EmptyState
          title="No setups yet"
          message="Unexplained details, promises and objects introduced in play appear here."
        />
      ) : (
        SETUP_GROUPS.map((group) => {
          const setups = sim.setups.filter((s) => s.status === group.status);
          if (!setups.length) return null;
          return (
            <View key={group.status} style={styles.group}>
              <View>
                <Hand size="label">
                  {group.title} ({setups.length})
                </Hand>
                {group.note ? <Hand>{group.note}</Hand> : null}
              </View>
              {setups.map((s) => (
                <SetupCard key={s.id} setup={s} n={number(s)} sim={sim} onEvidence={onEvidence} />
              ))}
            </View>
          );
        })
      )}
    </Section>
  );
}

function SetupCard({ setup: s, n, sim, onEvidence }: { setup: Setup; n: number; sim: SimState; onEvidence: ShowEvidence }) {
  const { colors } = useTheme();
  const paid = s.status === 'paid-off';
  const payoff = s.payoffText ?? sim.events.find((e) => e.id === s.payoffEventId)?.text;
  const reinforced = s.reinforcementEventIds.length
    ? `Reinforced ${times(s.reinforcementEventIds.length)}`
    : 'Not yet reinforced';
  const show = () =>
    onEvidence({
      title: `Setup #${n}`,
      eventIds: [s.createdEventId, ...s.reinforcementEventIds, ...(s.payoffEventId ? [s.payoffEventId] : [])],
      events: sim.events,
    });
  const thread = `payoff-${s.id}`;

  return (
    <View style={styles.setup}>
      <Card
        thread={paid ? thread : undefined}
        order={0}
        tilt={s.id}
        onPress={show}
        accessibilityLabel={`Setup ${n}, ${SETUP_STATUS[s.status]}: ${s.text}. ${reinforced}. Shows where it was set up, reinforced and paid off.`}>
        <View style={styles.spread}>
          <Caption strong tone="primary">
            Setup #{n}
          </Caption>
          <Badge label={SETUP_STATUS[s.status]} color={setupColor(colors, s.status)} strike={s.status === 'dropped'} />
        </View>
        <Body>{s.text}</Body>
        {s.status === 'payoff-candidate' && <Caption>Accumulated relevance: a potential payoff opportunity.</Caption>}
        <Caption>{reinforced}</Caption>
      </Card>
      {paid && (
        <View style={styles.payoff}>
          <Card
            thread={thread}
            order={1}
            pin="brass"
            tilt={`${s.id}-payoff`}
            onPress={show}
            accessibilityLabel={`Payoff of setup ${n}: ${payoff ?? 'paid off in play'}`}>
            <Eyebrow>Payoff</Eyebrow>
            <Body>{payoff ?? 'Paid off in play.'}</Body>
          </Card>
        </View>
      )}
    </View>
  );
}

export const STANCE_LABEL: Record<ThemeStance, string> = {
  reinforce: 'Reinforcement',
  contradict: 'Contradiction',
  develop: 'Development',
  tension: 'Unresolved tension',
};
const STANCES = Object.keys(STANCE_LABEL) as ThemeStance[];

/** Distinct, non-judging inks: a contradiction is information, not an error. Always written next to its word. */
const stanceInk = (stance: ThemeStance) => {
  const c = palettes.paper;
  return { reinforce: c.canon.canon, contradict: c.role.owner, develop: c.role.producer, tension: c.accentText }[stance];
};

const LATEST = 6;

export function ThemeAlignment({ sim, theme, onEvidence }: { sim: SimState; theme: string; onEvidence: ShowEvidence }) {
  const [all, setAll] = useState(false);
  const signals = [...sim.themeSignals].reverse();
  const shown = all ? signals : signals.slice(0, LATEST);
  const eventText = (id: string) => sim.events.find((e) => e.id === id)?.text;

  return (
    <Section
      title="Theme alignment"
      action={signals.length > LATEST ? { label: all ? 'Show latest' : `Show all ${signals.length}`, onPress: () => setAll(!all) } : undefined}>
      <Card tilt={false}>
        {theme ? (
          <View style={styles.tight}>
            <Eyebrow>Theme</Eyebrow>
            <Body style={styles.theme}>{theme}</Body>
          </View>
        ) : null}
        <Ledger rows={STANCES.map((stance) => ({ label: STANCE_LABEL[stance], value: sim.themeSignals.filter((t) => t.stance === stance).length }))} />
      </Card>
      {signals.length === 0 ? (
        <EmptyState title="No theme signals yet" message="Choices that touch the theme are tracked as play continues." />
      ) : (
        <List>
          {shown.map((t) => (
            <ListRow
              key={t.id}
              leading={<View style={[styles.ink, { backgroundColor: stanceInk(t.stance) }]} />}
              title={t.text}
              subtitle={[STANCE_LABEL[t.stance], eventText(t.eventId)].filter(Boolean).join(': ')}
              subtitleLines={3}
              onPress={() => onEvidence({ title: STANCE_LABEL[t.stance], eventIds: [t.eventId], events: sim.events })}
              accessibilityHint="Shows the moment behind this signal"
            />
          ))}
        </List>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md, paddingTop: spacing.xs },
  setup: { gap: spacing.lg },
  payoff: { paddingLeft: spacing.xxl },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tight: { gap: spacing.xs },
  theme: { fontFamily: fonts.typewriterItalic },
  ink: { width: 10, height: 10, borderRadius: 1 },
});
