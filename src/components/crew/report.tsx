// Shared Story Interpretation report (PRD §33–34, §54): the crew interpretation matrix, interpretation divergence
// per element and Crew Alignment Gain: a measure of the room's coordination, never a judgement of a participant.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ROLES } from '@shared/structure';
import type { InterpretationKey, InterpretationReport, Project, Role } from '@shared/types';

import { Paper, StickyNote, tiltFor, Hand, type NoteColor } from '@/components/board/paper';
import { CardTitle } from '@/components/rehearse/scene-cards';
import { Body, Caption, Card, divergenceWords, EmptyState, Meter, RoleBadge, Section, SegmentedControl } from '@/components/ui';
import { useProject } from '@/lib/session';
import { palettes, spacing, useTheme } from '@/theme';

import { PHASES, type Phase } from './interpretation-sheet';

/** Short row labels for the matrix (PRD §34). */
const ELEMENT: Record<InterpretationKey, string> = {
  protagonistGoal: "Protagonist’s goal",
  coreFear: 'Core fear',
  sceneTone: 'Scene tone',
  keyRelationship: 'Most important relationship',
};

/** The newest report for the active simulation. */
export function latestReport(project: Project): InterpretationReport | undefined {
  return project.reports
    .filter((r) => r.branchId === project.activeBranchId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
}

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

export function AlignmentGain({ report }: { report: InterpretationReport }) {
  const pairs = report.rows.flatMap((r) =>
    r.divergenceBefore !== null && r.divergenceAfter !== null ? [[r.divergenceBefore, r.divergenceAfter] as const] : [],
  );
  let headline = 'Not measurable yet';
  let detail = 'Needs answers from both before and after playing on at least one element.';
  if (pairs.length && report.alignmentGain !== null) {
    const before = mean(pairs.map(([b]) => b)).toFixed(2);
    const after = mean(pairs.map(([, a]) => a)).toFixed(2);
    headline =
      before === after
        ? `Divergence held at ${before}`
        : `Divergence ${Number(after) < Number(before) ? 'fell' : 'rose'} from ${before} to ${after}`;
    detail = `Across ${pairs.length} of ${report.rows.length} elements answered both before and after playing.`;
  }
  return (
    <Card tilt="alignment">
      <CardTitle>Crew alignment gain</CardTitle>
      <Body strong>{headline}</Body>
      <Caption>{detail}</Caption>
      <Caption>
        Compares how far apart the crew’s readings were before and after the shared simulation (0 aligned, 1 fully
        divergent). It measures creative coordination in the room, not a psychological score of anyone in it.
      </Caption>
    </Card>
  );
}

/** Each question keeps one note colour across the row, so a reading of the same element is easy to follow. */
const NOTE: Record<InterpretationKey, NoteColor> = {
  protagonistGoal: 'yellow',
  coreFear: 'pink',
  sceneTone: 'blue',
  keyRelationship: 'green',
};

/** The matrix as sticky notes on the board: one row per question, one column per person. */
export function InterpretationMatrix({ report }: { report: InterpretationReport }) {
  const { project } = useProject();
  const [phase, setPhase] = useState<Phase>('after');

  const columns = new Map<string, Role>();
  for (const row of report.rows) for (const a of row.answers) columns.set(a.participantId, a.role);
  const people = [...columns]
    .map(([id, role]) => ({ id, role, name: project?.participants.find((p) => p.id === id)?.name ?? 'Former participant' }))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));

  return (
    <Section title="Crew interpretation matrix" note="one column per person">
      <SegmentedControl options={PHASES} value={phase} onChange={setPhase} accessibilityLabel="Answers from" />
      {people.length === 0 ? (
        <EmptyState title="No answers in this report" message="Answers appear here once the crew has filled in the questionnaire." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.matrix}>
          <View style={styles.grid}>
            <View style={styles.tr}>
              <View style={styles.first} />
              {people.map((p) => (
                <Paper key={p.id} plain style={[styles.column, styles.person]}>
                  <CardTitle lines={1}>{p.name}</CardTitle>
                  <RoleBadge role={p.role} />
                </Paper>
              ))}
            </View>
            {report.rows.map((row) => {
              const divergence = phase === 'before' ? row.divergenceBefore : row.divergenceAfter;
              return (
                <View key={row.key} style={styles.tr}>
                  <Paper style={[styles.first, styles.question]}>
                    <CardTitle>{ELEMENT[row.key]}</CardTitle>
                    <DivergenceBar value={divergence} />
                  </Paper>
                  {people.map((p) => {
                    const answer = row.answers.find((a) => a.participantId === p.id && a.phase === phase)?.answer;
                    return answer ? (
                      <StickyNote
                        key={p.id}
                        color={NOTE[row.key]}
                        style={[styles.column, styles.note, { transform: [{ rotate: `${tiltFor(p.id + row.key, 1.2).toFixed(2)}deg` }] }]}>
                        <Body style={styles.answer}>{answer}</Body>
                      </StickyNote>
                    ) : (
                      <View key={p.id} style={[styles.column, styles.blank]} accessible accessibilityLabel={`${p.name}: no answer`}>
                        <Hand>no answer</Hand>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
      <Caption tone="primary">
        Each column is one person’s reading, labelled by role. Where they differ is interpretation divergence:
        material for the team to talk about, never a mark against anyone.
      </Caption>
    </Section>
  );
}

/** How far apart the readings of one element are, as a pencilled bar and in words. Render on paper. */
function DivergenceBar({ value }: { value: number | null }) {
  const { colors } = useTheme();
  const words = divergenceWords(value);
  return (
    <View style={styles.meter} accessible accessibilityLabel={`Divergence: ${words}`}>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        {value !== null && (
          <View style={[styles.fill, { backgroundColor: colors.textSecondary, width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
        )}
      </View>
      <Caption>{words}</Caption>
    </View>
  );
}

export function DivergenceRows({ report }: { report: InterpretationReport }) {
  return (
    <Section title="Interpretation divergence" note="before and after">
      <Card tilt="divergence">
        {report.rows.map((row, i) => (
          <View key={row.key} style={styles.divergence}>
            {i > 0 && <View style={[styles.hairline, { backgroundColor: palettes.paper.separator }]} />}
            <Body strong>{ELEMENT[row.key]}</Body>
            <Meter kind="divergence" value={row.divergenceBefore} label="Before" />
            <Meter kind="divergence" value={row.divergenceAfter} label="After" />
            {row.note ? <Caption>{row.note}</Caption> : null}
          </View>
        ))}
      </Card>
    </Section>
  );
}

export function Bullets({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Section title={title}>
      <Card tilt={title}>
        {items.length ? (
          items.map((item, i) => (
            <View key={i} style={styles.bullet}>
              <Body tone="tertiary">•</Body>
              <Body style={styles.grow}>{item}</Body>
            </View>
          ))
        ) : (
          <Caption>{empty}</Caption>
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  matrix: { paddingVertical: spacing.sm, paddingRight: spacing.lg },
  grid: { gap: spacing.md },
  tr: { flexDirection: 'row', gap: spacing.md },
  first: { width: 150 },
  column: { width: 168 },
  person: { padding: spacing.sm, gap: spacing.xs },
  question: { padding: spacing.md, gap: spacing.sm },
  note: { minHeight: 132, padding: spacing.md },
  blank: { minHeight: 132, alignItems: 'center', justifyContent: 'center' },
  answer: { fontSize: 15, lineHeight: 21 },
  meter: { gap: spacing.xs },
  track: { height: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fill: { height: '100%' },
  divergence: { gap: spacing.sm },
  hairline: { height: StyleSheet.hairlineWidth, marginBottom: spacing.xs },
  bullet: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});
