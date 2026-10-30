// Crew Room (PRD §5–6, §32–34, §53–54): session, people, shared interpretation and reactions.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/board/paper';
import { InterpretationSheet, myInterpretation } from '@/components/crew/interpretation-sheet';
import { Participants } from '@/components/crew/participants';
import { ReactionSummary } from '@/components/crew/reaction-summary';
import { latestReport } from '@/components/crew/report';
import { InviteCard, SessionCard } from '@/components/crew/session';
import { CardTitle } from '@/components/rehearse/scene-cards';
import { Caption, Card, Screen, Section } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { palettes, spacing } from '@/theme';

const ink = palettes.paper;

export default function CrewScreen() {
  const { project, projectId, me, refresh } = useProject();
  const [answering, setAnswering] = useState(false);
  if (!project) return null;

  const before = myInterpretation(project, me?.id, 'before');
  const after = myInterpretation(project, me?.id, 'after');
  const report = latestReport(project);
  const answered = (done: boolean) => ({ label: done ? 'Answered' : 'Not yet', color: done ? ink.accentText : ink.textTertiary });

  return (
    <Screen onRefresh={refresh}>
      <SessionCard />
      <Participants />
      <Section title="Shared story interpretation" note="no right answers">
        <View style={styles.pair}>
          <View style={styles.cell}>
            <Card
              tilt="my-reading"
              onPress={() => setAnswering(true)}
              accessibilityLabel={`Your interpretation. Before playing: ${before ? 'answered' : 'not yet'}. After playing: ${after ? 'answered' : 'not yet'}.`}
              style={styles.card}>
              <CardTitle>Your interpretation</CardTitle>
              <View style={styles.stamps}>
                <View style={styles.stamped}>
                  <Caption>Before playing</Caption>
                  <Stamp {...answered(!!before)} />
                </View>
                <View style={styles.stamped}>
                  <Caption>After playing</Caption>
                  <Stamp {...answered(!!after)} />
                </View>
              </View>
            </Card>
          </View>
          <View style={styles.cell}>
            <Card
              tilt="crew-report"
              pin="brass"
              onPress={() => router.push({ pathname: '/project/[id]/crew/report', params: { id: projectId } })}
              accessibilityLabel={`Crew interpretation report. ${report ? `Updated ${timeAgo(report.createdAt)}` : 'Not generated yet'}.`}
              style={styles.card}>
              <CardTitle>Crew interpretation report</CardTitle>
              <Caption tone="primary">The matrix of everyone’s readings, before and after playing.</Caption>
              <Caption>{report ? `Updated ${timeAgo(report.createdAt)}` : 'Not generated yet'}</Caption>
            </Card>
          </View>
        </View>
      </Section>
      <ReactionSummary />
      <InviteCard />
      <InterpretationSheet key={project.activeBranchId} visible={answering} onClose={() => setAnswering(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  cell: { flexGrow: 1, flexBasis: 300 },
  card: { gap: spacing.sm, paddingTop: spacing.xl, minHeight: 124 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  stamped: { gap: spacing.xs, alignItems: 'flex-start' },
});
