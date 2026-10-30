// Shared Story Interpretation report (PRD §33–34): anyone reads the latest one; analysts generate it.
import { Stack } from 'expo-router';
import { useState } from 'react';

import { AlignmentGain, Bullets, DivergenceRows, InterpretationMatrix, latestReport } from '@/components/crew/report';
import { CardTitle } from '@/components/rehearse/scene-cards';
import { Body, Button, Caption, Card, EmptyState, Gate, Screen } from '@/components/ui';
import { errorMessage, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';

export default function ReportScreen() {
  const { project, branch, can, call, refresh } = useProject();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!project) return null;

  const report = latestReport(project);
  const answered = new Set(
    project.interpretations.filter((i) => i.branchId === project.activeBranchId).map((i) => i.participantId),
  ).size;

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await call('generateReport', {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Screen onRefresh={refresh}>
      <Stack.Screen options={{ title: 'Interpretation report' }} />
      <Card tilt="report">
        <CardTitle>Shared story interpretation</CardTitle>
        <Body>
          What the crew thought the story was about before and after playing it together: where readings diverged,
          what affected people and what emerged collectively.
        </Body>
        <Caption>
          {report ? `Generated ${timeAgo(report.createdAt)}` : 'No report yet'}
          {branch ? ` · ${branch.name}` : ''}
        </Caption>
        <Gate perm="analyze">
          {/* Analysts see every submission; blind performers only receive their own, so they don't get a count. */}
          <Caption>
            {answered} {answered === 1 ? 'person has' : 'people have'} answered for this simulation
          </Caption>
          <Button
            title={report ? 'Regenerate report' : 'Generate report'}
            icon={report ? 'refresh' : 'graph'}
            loading={generating}
            onPress={() => void generate()}
          />
          {generating && (
            <Caption tone="accent" accessibilityLiveRegion="polite">
              The Director is reading everyone’s answers and reactions…
            </Caption>
          )}
          {error && (
            <Caption tone="danger" accessibilityLiveRegion="polite">
              Couldn’t generate the report: {error}
            </Caption>
          )}
        </Gate>
      </Card>

      {report ? (
        <>
          {report.summary ? (
            <Card tilt="summary">
              <CardTitle>Summary</CardTitle>
              <Body>{report.summary}</Body>
            </Card>
          ) : null}
          <AlignmentGain report={report} />
          <InterpretationMatrix report={report} />
          <DivergenceRows report={report} />
          <Bullets
            title="Moments that affected people"
            items={report.highlights}
            empty="No reactions were captured before this report."
          />
          <Bullets
            title="Discoveries that emerged together"
            items={report.emergent}
            empty="Nothing emerged collectively in this report."
          />
        </>
      ) : (
        <EmptyState
          icon="graph"
          title="No report yet"
          message={
            can('analyze')
              ? 'Once the crew has answered before and after playing, generate the report here.'
              : 'The owner, a director, producer or writer generates it once the crew has answered before and after playing.'
          }
        />
      )}
    </Screen>
  );
}
