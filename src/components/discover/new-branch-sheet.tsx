// Replay & iteration (PRD §44): start a new branch from an existing one.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BranchMode } from '@shared/types';

import { Body, Button, Caption, Chip, List, ListRow, Section, Sheet, showToast, Stepper, TextField } from '@/components/ui';
import { BRANCH_MODE_LABEL } from '@/lib/format';
import { useProject } from '@/lib/session';
import { spacing } from '@/theme';

import { ErrorNote, useMutation } from './mutation';

type Mode = Exclude<BranchMode, 'origin'>;

const MODES: { mode: Mode; line: string }[] = [
  { mode: 'replay', line: 'Same conditions.' },
  { mode: 'variation', line: 'One major decision changes.' },
  { mode: 'escalation', line: 'The same scene, with higher stakes.' },
  { mode: 'character-reinterpretation', line: "One character’s internal priority changes." },
  { mode: 'goal-reinterpretation', line: "The protagonist’s immediate objective changes." },
];

/** Same naming as the server: A, B, C… then numbers. */
const nextName = (count: number) => `Simulation ${count < 26 ? String.fromCharCode(65 + count) : count + 1}`;

/** Mount with a fresh `key` per opening so the form starts clean. */
export function NewBranchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { project, call } = useProject();
  const { busy, run, error } = useMutation();
  const [fromId, setFromId] = useState(project?.activeBranchId ?? '');
  const [mode, setMode] = useState<Mode>('replay');
  const [name, setName] = useState(nextName(project?.branches.length ?? 0));
  const [note, setNote] = useState('');
  const [characterId, setCharacterId] = useState<string>();
  const [priority, setPriority] = useState('');
  const [goal, setGoal] = useState('');
  const [stakeShift, setStakeShift] = useState(1);
  if (!project) return null;

  const source = project.branches.find((b) => b.id === fromId) ?? project.branches[0];
  if (!source) return null;
  // The server starts a variation from the source's live state and every other mode from where the source began.
  const base = mode === 'variation' ? source.state : source.start;
  const baseGoal = base.sequences.find((s) => s.id === base.currentSequenceId)?.goal;

  const missing =
    mode === 'character-reinterpretation'
      ? !characterId
        ? 'Choose whose priority changes.'
        : !priority.trim()
          ? 'Describe the new priority.'
          : null
      : mode === 'goal-reinterpretation' && !goal.trim()
        ? 'Describe the new goal.'
        : null;

  const overrides =
    mode === 'character-reinterpretation'
      ? { characterId, priority: priority.trim() }
      : mode === 'goal-reinterpretation'
        ? { goal: goal.trim() }
        : mode === 'escalation'
          ? { stakeShift }
          : undefined;

  const create = () =>
    run('create', async () => {
      const finalName = name.trim() || nextName(project.branches.length);
      await call('createBranch', { fromBranchId: source.id, mode, name: finalName, note: note.trim(), ...(overrides && { overrides }) });
      showToast(`${finalName} created and now active`, 'success');
      onClose();
    });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="New branch"
      footer={
        <>
          <ErrorNote message={error('create')} />
          {missing && <Caption>{missing}</Caption>}
          <Button
            title={busy ? 'Creating…' : 'Create branch'}
            icon="branch"
            loading={!!busy}
            disabled={!!missing}
            onPress={() => void create()}
            block
          />
        </>
      }>
      <Section title="Start from">
        <View style={styles.chips}>
          {project.branches.map((b) => (
            <Chip key={b.id} label={b.name} selected={b.id === source.id} onPress={() => setFromId(b.id)} />
          ))}
        </View>
      </Section>

      <Section title="Mode">
        <List>
          {MODES.map(({ mode: m, line }) => (
            <ListRow key={m} title={BRANCH_MODE_LABEL[m]} subtitle={line} selected={m === mode} onPress={() => setMode(m)} />
          ))}
        </List>
        <Caption>
          {mode === 'variation'
            ? `Continues from ${source.name}'s latest moment (${source.state.events.length} played).`
            : `Restarts from where ${source.name} began.`}
        </Caption>
      </Section>

      {mode === 'character-reinterpretation' && (
        <Section title="Reinterpretation">
          <Body strong>Whose priority changes?</Body>
          <View style={styles.chips}>
            {project.model.characters.map((c) => (
              <Chip key={c.id} label={c.name} selected={c.id === characterId} onPress={() => setCharacterId(c.id)} />
            ))}
          </View>
          <TextField
            label="New priority"
            placeholder="e.g. protecting family over finding the truth"
            value={priority}
            onChangeText={setPriority}
          />
        </Section>
      )}
      {mode === 'goal-reinterpretation' && (
        <TextField
          label="New goal"
          placeholder="What the protagonist is after now"
          helper={baseGoal ? `Replaces: ${baseGoal}` : undefined}
          value={goal}
          onChangeText={setGoal}
        />
      )}
      {mode === 'escalation' && (
        <View style={styles.tight}>
          <Stepper label="Stake shift" value={stakeShift} onChange={setStakeShift} min={1} max={3} />
          <Caption>How much higher the stakes run. Every failure costs more and the opposition moves sooner.</Caption>
        </View>
      )}

      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
      <TextField
        label="Note"
        placeholder="What are you testing?"
        value={note}
        onChangeText={setNote}
        multiline
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tight: { gap: spacing.xs },
});
