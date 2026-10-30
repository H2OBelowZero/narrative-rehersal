// What a non-director is told before stepping into the scene: the logline, their character, the scene and the
// stakes — nothing structural. Laid out like a call sheet. Also reachable from the stage as a sheet.
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Body, Button, Caption, Heading, Icon, Mono, pressedStyle, Screen, Sheet, Title } from '@/components/ui';
import { useProject } from '@/lib/session';
import { fonts, spacing, TOUCH_TARGET, typography, useTheme } from '@/theme';

import { isBlindViewer } from './effects';
import { rise } from './motion';

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The character this viewer plays, or follows when they have none (writers, observers, producers). */
function useLead() {
  const { me, character, protagonist } = useProject();
  const mine = character(me?.characterId);
  return { lead: mine ?? protagonist, mine: !!mine };
}

export function BriefDetails({ animate = false }: { animate?: boolean }) {
  const { colors } = useTheme();
  const { project, role, me, scene, sequence } = useProject();
  const { lead, mine } = useLead();
  if (!project) return null;

  const { model } = project;
  const blind = isBlindViewer(project, role);
  const uncast = me?.role === 'performer' && !mine;
  const kind = [model.genre, model.medium].filter(Boolean).join(' · ');
  const enter = (i: number) => (animate ? rise(i) : undefined);

  return (
    <View style={styles.sheet}>
      <Animated.View entering={enter(0)} style={styles.head}>
        {kind ? <Caption>{upperFirst(kind)}</Caption> : null}
        <Title>{model.title || 'Untitled project'}</Title>
        <Body style={[styles.logline, !model.logline && { color: colors.textTertiary }]}>
          {model.logline || 'No logline yet.'}
        </Body>
      </Animated.View>

      {blind && (
        <Animated.View entering={enter(1)} style={styles.blind}>
          <Icon name="eye-off" size={16} color={colors.textSecondary} />
          <Caption style={styles.grow}>
            Blind session. You know only what {lead?.name ?? 'your character'} knows.
          </Caption>
        </Animated.View>
      )}

      <Animated.View entering={enter(2)}>
        <Line label={mine ? 'You play' : 'Following'}>
          {uncast ? (
            <Body tone="secondary">You haven’t been cast yet. The director assigns characters in Crew.</Body>
          ) : lead ? (
            <>
              <View style={styles.nameRow}>
                <Heading>{lead.name}</Heading>
                <Caption>{upperFirst(lead.role)}</Caption>
              </View>
              {lead.performerBrief || lead.summary ? <Body>{lead.performerBrief || lead.summary}</Body> : null}
              {lead.goal ? (
                <Caption>
                  <Caption strong tone="primary">
                    Wants{' '}
                  </Caption>
                  {lead.goal}
                </Caption>
              ) : null}
            </>
          ) : (
            <Body tone="tertiary">No characters yet.</Body>
          )}
        </Line>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <Line label="Scene">
          {scene ? (
            <>
              <Mono style={styles.slug}>{scene.heading.toUpperCase()}</Mono>
              {scene.situation ? <Body style={styles.prose}>{scene.situation}</Body> : null}
            </>
          ) : (
            <Body tone="tertiary">No scene is open yet.</Body>
          )}
        </Line>
      </Animated.View>

      <Animated.View entering={enter(4)}>
        <Line label="Stakes" last>
          {sequence?.stake ? <Body strong>{sequence.stake}</Body> : <Body tone="tertiary">Nothing at stake yet.</Body>}
          {sequence?.goal ? (
            <Caption>
              <Caption strong tone="primary">
                Right now{' '}
              </Caption>
              {sequence.goal}
            </Caption>
          ) : null}
        </Line>
      </Animated.View>
    </View>
  );
}

/** One call-sheet line: a label in the margin, the content beside it. */
export function Line({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.line, { borderTopColor: colors.separator }, last && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text accessibilityRole="header" style={[styles.label, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.4}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/** The whole screen a non-director lands on: the brief, and one way in. */
export function BriefingCurtain({ onEnter, edges }: { onEnter: () => void; edges?: 'bottom'[] }) {
  const { sim } = useProject();
  const moments = sim?.events.filter((e) => e.kind === 'action').length ?? 0;
  return (
    <Screen
      edges={edges}
      footer={
        <View style={styles.cta}>
          {moments > 0 && (
            <Caption style={styles.centre}>
              Rehearsal under way, {moments} {moments === 1 ? 'move' : 'moves'} played
            </Caption>
          )}
          <Button
            title={moments > 0 ? 'Join the scene' : 'Step into the scene'}
            icon="arrow-right"
            size="lg"
            block
            onPress={onEnter}
          />
        </View>
      }>
      <BriefDetails animate />
    </Screen>
  );
}

/** On stage: who you are and what's at stake (the scene heading opens the feed below), with the brief one tap away. */
export function BriefBar() {
  const { colors } = useTheme();
  const { sequence } = useProject();
  const { lead, mine } = useLead();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open your brief"
        accessibilityHint={sequence?.stake ? `At stake: ${sequence.stake}` : undefined}
        style={({ pressed }) => [styles.bar, { borderColor: colors.separator }, pressedStyle(pressed)]}>
        <View style={styles.grow}>
          {lead ? (
            <Caption>
              {mine ? 'You play' : 'Following'}{' '}
              <Caption strong tone="primary">
                {lead.name}
              </Caption>
            </Caption>
          ) : null}
          <Body strong numberOfLines={2}>
            {sequence?.stake || 'Nothing at stake yet.'}
          </Body>
        </View>
        <View style={styles.briefLink}>
          <Caption strong tone="accent">
            Brief
          </Caption>
          <Icon name="chevron-right" size={12} color={colors.accentText} />
        </View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Your brief">
        <BriefDetails />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  head: { gap: spacing.sm },
  logline: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 28 },
  blind: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { ...typography.caption, fontFamily: fonts.mono, fontWeight: '700', letterSpacing: 0.8, width: 76, paddingTop: 3 },
  content: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm },
  slug: { fontWeight: '700', letterSpacing: 0.3 },
  prose: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 26 },
  cta: { gap: spacing.sm, paddingVertical: spacing.xs },
  centre: { textAlign: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  briefLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  grow: { flex: 1 },
});
