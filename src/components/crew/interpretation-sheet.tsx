// My reading of the story, before and after the shared simulation (PRD §33–34). Free text, no right answers.
import { useState } from 'react';

import { INTERPRETATION_QUESTIONS } from '@shared/structure';
import type { Interpretation, InterpretationKey, Project } from '@shared/types';

import { Button, Caption, SegmentedControl, Sheet, showToast, TextField } from '@/components/ui';
import { errorMessage, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';

export type Phase = Interpretation['phase'];

export const PHASES = [
  { value: 'before', label: 'Before playing' },
  { value: 'after', label: 'After playing' },
] as const;

export const INTERPRETATION_KEYS = Object.keys(INTERPRETATION_QUESTIONS) as InterpretationKey[];

type Answers = Record<InterpretationKey, string>;

/** My submission for a phase in the active simulation. */
export function myInterpretation(project: Project, participantId: string | undefined, phase: Phase) {
  return project.interpretations.find(
    (i) => i.participantId === participantId && i.branchId === project.activeBranchId && i.phase === phase,
  );
}

const answersOf = (i: Interpretation | undefined): Answers =>
  Object.fromEntries(INTERPRETATION_KEYS.map((k) => [k, i?.answers[k] ?? ''])) as Answers;

export interface InterpretationSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Mount with key={activeBranchId}: drafts start from my saved answers and survive closing the sheet. */
export function InterpretationSheet({ visible, onClose }: InterpretationSheetProps) {
  const { project, me, call } = useProject();
  const [phase, setPhase] = useState<Phase>(() =>
    project && myInterpretation(project, me?.id, 'before') ? 'after' : 'before',
  );
  const [drafts, setDrafts] = useState<Record<Phase, Answers>>(() => ({
    before: answersOf(project ? myInterpretation(project, me?.id, 'before') : undefined),
    after: answersOf(project ? myInterpretation(project, me?.id, 'after') : undefined),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!project) return null;

  const saved = myInterpretation(project, me?.id, phase);
  const answers = drafts[phase];
  const empty = INTERPRETATION_KEYS.every((k) => !answers[k].trim());

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await call('submitInterpretation', { phase, answers });
      showToast(phase === 'before' ? 'Before-play answers saved' : 'After-play answers saved', 'success');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Your interpretation"
      footer={
        <>
          {error && (
            <Caption tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Caption>
          )}
          <Button
            title={saved ? 'Update answers' : 'Submit answers'}
            block
            loading={saving}
            disabled={empty}
            onPress={() => void submit()}
          />
        </>
      }>
      <SegmentedControl
        options={PHASES}
        value={phase}
        onChange={(p) => {
          setError(null);
          setPhase(p);
        }}
        accessibilityLabel="When you’re answering"
      />
      <Caption>
        {phase === 'before'
          ? 'Answer before the shared simulation, from what you know now.'
          : 'Answer after playing, from what you experienced.'}{' '}
        There are no right answers. The crew compares readings to see where interpretations diverge, never to grade
        anyone.
      </Caption>
      <Caption tone={saved ? 'accent' : 'tertiary'}>
        {saved ? `Submitted ${timeAgo(saved.at)}. Submitting again replaces these answers.` : 'Not submitted yet.'}
      </Caption>
      {INTERPRETATION_KEYS.map((k, i) => (
        <TextField
          key={k}
          label={`${i + 1}. ${INTERPRETATION_QUESTIONS[k]}`}
          value={answers[k]}
          onChangeText={(v) => setDrafts((d) => ({ ...d, [phase]: { ...d[phase], [k]: v } }))}
          placeholder="In your own words"
          multiline
          maxLength={400}
        />
      ))}
    </Sheet>
  );
}
