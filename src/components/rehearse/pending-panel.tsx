// The next move (PRD §18, §22, §47–48): the Director's offered moves, or its read of a declared action, laid out as
// index cards under a strip of tape. Each is framed by what's at risk, never as a correct answer. Brass pins: they
// are options, not yet part of the story's string. Directors also see difficulty, modifiers and the theme.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { DOMAIN_LABEL, RISK_LABEL } from '@shared/structure';
import type { Approach, PendingAction, Risk } from '@shared/types';

import { Paper, paperShadow, Pinned, StickyNote, TapeLabel } from '@/components/board/paper';
import { Badge, Body, Button, Caption, Card, EASE_OUT, OddsBar, PressableScale, RiskBadge } from '@/components/ui';
import { useProject } from '@/lib/session';
import { alpha, fonts, palettes, radii, spacing, useTheme } from '@/theme';

import { Disclosure } from './disclosure';
import { firstName, signed } from './effects';
import { rise } from './motion';
import { CardTitle } from './scene-cards';

const RISK_ORDER: Record<Risk, number> = { low: 0, medium: 1, high: 2, extreme: 3 };
const LETTERS = 'ABCD';

export interface PendingPanelProps {
  pending: PendingAction;
  onChoose: (approach: Approach) => void;
  /** The approach whose roll is in flight; every choice is locked meanwhile. */
  chosenId: string | null;
  /** Why the last choice failed, if it did. */
  error: string | null;
  /** Lay the choices out in a row (wide boards). */
  row?: boolean;
}

export function PendingPanel({ pending, onChoose, chosenId, error, row = false }: PendingPanelProps) {
  const { project, me, can, call, charName } = useProject();
  const [cancelling, setCancelling] = useState(false);
  if (!project) return null;

  const director = can('direct');
  const mine = pending.participantId === me?.id;
  const canChoose = mine || director;
  const declarer = project.participants.find((p) => p.id === pending.participantId)?.name ?? 'Someone';
  const name = firstName(charName(pending.characterId));
  const { interpretation: read } = pending;
  const approaches = [...pending.approaches].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  const status = !canChoose
    ? `${declarer} is choosing a move…`
    : !mine
      ? `${declarer} is up. As director you can choose for them, or set it aside.`
      : null;
  const prompt = !pending.proposed || read.reminder || status || director;

  const cancel = async () => {
    setCancelling(true);
    try {
      await call('cancelAction', {});
    } catch {
      // call() has already shown the error.
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Animated.View entering={rise()}>
        <TapeLabel style={styles.tape}>{pending.proposed ? `What does ${name} do?` : 'How far will you push it?'}</TapeLabel>
      </Animated.View>

      {prompt ? (
        <Card pin="brass" tilt={pending.id} style={styles.prompt}>
          {!pending.proposed && (
            <Body style={styles.said}>
              <Body strong>{name}: </Body>“{pending.input}”
            </Body>
          )}
          {read.reminder ? <Body tone="secondary">{read.reminder}</Body> : null}
          {status ? <Caption tone="primary">{status}</Caption> : null}
          {director && <DirectorsRead pending={pending} />}
        </Card>
      ) : null}

      <View style={[styles.choices, row && styles.choicesRow]}>
        {approaches.map((a, i) => (
          <ChoiceCard
            key={a.id}
            approach={a}
            index={i}
            director={director}
            row={row}
            state={chosenId === null ? 'open' : chosenId === a.id ? 'chosen' : 'passed'}
            onPress={canChoose && chosenId === null ? () => onChoose(a) : undefined}
          />
        ))}
      </View>

      {error ? (
        <StickyNote color="pink" style={styles.error}>
          <Caption tone="primary" accessibilityLiveRegion="polite">
            Couldn’t resolve that move: {error}
          </Caption>
        </StickyNote>
      ) : null}
      {canChoose && (
        <Button
          title={pending.proposed ? 'Write my own instead' : 'Set this aside'}
          icon={pending.proposed ? 'edit' : 'close'}
          variant="secondary"
          size="sm"
          loading={cancelling}
          disabled={chosenId !== null}
          onPress={() => void cancel()}
          style={styles.centre}
        />
      )}
    </View>
  );
}

/** Structural read for directors: tucked away so the choices stay the focus. */
function DirectorsRead({ pending }: { pending: PendingAction }) {
  const { interpretation: read } = pending;
  return (
    <Disclosure title="The Director’s read" summary={read.themeRelevance ?? read.intent}>
      <Field label="Intent" text={read.intent} />
      <Field label="Obstacle" text={read.obstacle} />
      <Field label="Stakes" text={read.stakes} />
      {read.themeRelevance ? <Field label="Theme" text={read.themeRelevance} /> : null}
    </Disclosure>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <Caption tone="primary">
      <Caption strong>{label}: </Caption>
      {text}
    </Caption>
  );
}

function ChoiceCard({
  approach: a,
  index,
  director,
  row,
  state,
  onPress,
}: {
  approach: Approach;
  index: number;
  director: boolean;
  row: boolean;
  state: 'open' | 'chosen' | 'passed';
  onPress?: () => void;
}) {
  const letter = LETTERS[index] ?? `${index + 1}`;
  const chosen = state === 'chosen';
  return (
    <Animated.View entering={rise(index + 1)} style={[row && styles.choiceCell, state === 'passed' && styles.passed]}>
      <Pinned pin="brass" tilt={a.id} at={row ? 'top' : 'left'}>
        <View style={[styles.lifted, paperShadow]}>
          <PressableScale
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole="button"
            accessibilityState={{ disabled: !onPress, selected: chosen }}
            accessibilityLabel={`Choice ${letter}: ${a.label}${a.isPlayerOwn ? ', your own words' : ''}. ${RISK_LABEL[a.risk]}. At stake: ${a.consequencePreview}`}
            android_ripple={{ color: alpha(palettes.paper.text, 0.08) }}>
            <Paper style={[styles.choice, row && styles.choiceTopPin, chosen && styles.chosen]}>
              <ChoiceBody approach={a} letter={letter} director={director} />
            </Paper>
          </PressableScale>
        </View>
      </Pinned>
    </Animated.View>
  );
}

/** The card's face, typed on paper (reads the paper palette). */
function ChoiceBody({ approach: a, letter, director }: { approach: Approach; letter: string; director: boolean }) {
  const { colors } = useTheme();
  return (
    <>
      <CardTitle>{`${letter}. ${a.label}`}</CardTitle>
      {a.isPlayerOwn && <Badge label="Your words" color={colors.accentText} />}
      {a.description && !a.isPlayerOwn ? <Body tone="secondary">{a.description}</Body> : null}
      <Caption tone="primary">
        <Caption strong>At stake: </Caption>
        {a.consequencePreview}
      </Caption>
      <View style={styles.rowWrap}>
        <RiskBadge risk={a.risk} />
        {director && a.themePull ? <Badge label={`Leans ${a.themePull}`} variant="outline" /> : null}
      </View>
      {director ? (
        <>
          <OddsBar odds={a.odds} />
          <Caption tone="tertiary">
            Difficulty {a.dc}, {DOMAIN_LABEL[a.domain].toLowerCase()}
          </Caption>
          {a.modifiers.length > 0 && (
            <Caption tone="tertiary">{a.modifiers.map((m) => `${m.label} ${signed(m.value)}`).join(', ')}</Caption>
          )}
        </>
      ) : (
        <>
          <OddsBar odds={a.odds} legend={false} />
          <Caption>{Math.round((a.odds.critical + a.odds.success) * 100)}% chance it works outright</Caption>
        </>
      )}
    </>
  );
}

/** The next card on the board, still blank: one clear way to ask for the choices. */
export function YourMove({ characterId }: { characterId: string }) {
  const { call, charName } = useProject();
  const [asking, setAsking] = useState(false);
  const name = firstName(charName(characterId));

  const ask = async () => {
    setAsking(true);
    try {
      await call('proposeChoices', { characterId });
    } catch {
      setAsking(false); // call() has already shown the error
    }
  };

  if (asking) return <ChoicesLoading name={name} />;
  return (
    <Animated.View entering={rise()}>
      <Card tone="accent" tilt="your-move" style={styles.yourMove}>
        <CardTitle>{`Your move, ${name}`}</CardTitle>
        <Body tone="secondary">Choose from moves shaped by what’s at stake, or say it in your own words below.</Body>
        <Button title={`Show ${name}’s choices`} icon="dice" onPress={() => void ask()} />
      </Card>
    </Animated.View>
  );
}

/** Blank index cards while the Director lays the choices out: the same shape as what's coming. */
function ChoicesLoading({ name }: { name: string }) {
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.set(withRepeat(withTiming(0.5, { duration: 700, easing: EASE_OUT }), -1, true));
  }, [glow]);
  const pulse = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const ink = palettes.paper;
  const bar = (width: `${number}%`) => <View style={[styles.bar, { width, backgroundColor: alpha(ink.text, 0.1) }]} />;
  return (
    <View style={styles.panel} accessible accessibilityLabel={`Setting out ${name}’s choices`} accessibilityLiveRegion="polite">
      <TapeLabel note="the Director is setting them out…" style={styles.tape}>{`What does ${name} do?`}</TapeLabel>
      <Animated.View style={[styles.choices, pulse]}>
        {[0, 1, 2].map((i) => (
          <Pinned key={i} pin="brass" tilt={`loading-${i}`}>
            <View style={[styles.lifted, paperShadow]}>
              <Paper style={styles.choice}>
                {bar(i === 1 ? '55%' : '70%')}
                {bar('90%')}
                {bar('60%')}
              </Paper>
            </View>
          </Pinned>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.lg },
  tape: { marginLeft: spacing.xs },
  prompt: { gap: spacing.sm },
  said: { fontFamily: fonts.typewriterItalic },
  choices: { gap: spacing.lg },
  choicesRow: { flexDirection: 'row', alignItems: 'flex-start' },
  choiceCell: { flex: 1 },
  lifted: { borderRadius: radii.sm },
  choice: { padding: spacing.lg, paddingLeft: spacing.xl + 2, paddingTop: spacing.xl + 2, gap: spacing.sm },
  choiceTopPin: { paddingLeft: spacing.lg },
  chosen: { borderWidth: 2, borderColor: palettes.desk.accent },
  passed: { opacity: 0.4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  error: { maxWidth: 420 },
  centre: { alignSelf: 'center' },
  yourMove: { gap: spacing.sm },
  bar: { height: 10, borderRadius: 5 },
});
