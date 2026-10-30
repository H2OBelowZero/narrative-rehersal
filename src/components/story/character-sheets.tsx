// Character Lab edit sheets. Each saves through useProject().call and merges onto the latest
// known character, so fields edited elsewhere in the meantime are not overwritten.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DOMAIN_LABEL, DOMAINS } from '@shared/structure';
import type { CanonStatus, Character, Relationship, Trait, WorldFit } from '@shared/types';

import { Button, Caption, Card, Chip, confirm, Sheet, Stepper, TextField } from '@/components/ui';
import { useProject } from '@/lib/session';

import {
  CHARACTER_ROLE_LABEL,
  CHARACTER_ROLES,
  StatusPicker,
  storyStyles as styles,
  useMutation,
} from './common';

export type TraitGroup = 'extrinsic' | 'intrinsic' | 'adaptive';

export const TRAIT_GROUPS: { key: TraitGroup; title: string; meaning: string }[] = [
  { key: 'extrinsic', title: 'Extrinsic', meaning: 'What they possess' },
  { key: 'intrinsic', title: 'Intrinsic', meaning: 'What exists internally' },
  { key: 'adaptive', title: 'Adaptive', meaning: 'What the new world forces' },
];

/** PRD §10, in journey order. */
export const WORLD_FIT_STEPS: { key: keyof WorldFit; label: string; question: string }[] = [
  { key: 'startingState', label: 'Starting state', question: 'Who are they before the story?' },
  { key: 'worldRequirements', label: 'World requirements', question: 'What qualities does this environment demand?' },
  { key: 'existingStrengths', label: 'Existing strengths', question: 'What already allows them to function?' },
  { key: 'traitGaps', label: 'Trait gaps', question: 'What do they lack?' },
  { key: 'falseStrengths', label: 'False strengths', question: 'What strength becomes a liability?' },
  { key: 'requiredAdaptation', label: 'Required adaptation', question: 'What must they learn?' },
  { key: 'resistance', label: 'Resistance', question: 'What do they refuse to become?' },
  { key: 'cost', label: 'Cost', question: 'What does adaptation take away?' },
  { key: 'finalState', label: 'Final state', question: 'Who do they become?' },
];

interface SheetProps {
  character: Character;
  visible: boolean;
  onClose: () => void;
}

/** Latest known version of the character, falling back to the one the sheet opened with. */
function useLatest(c: Character): () => Character {
  const { character } = useProject();
  return () => character(c.id) ?? c;
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

function SaveFooter({ busy, error, onSave, title = 'Save' }: { busy: boolean; error: string | null; onSave: () => void; title?: string }) {
  return (
    <>
      {error && <Caption tone="danger">{error}</Caption>}
      <Button title={title} block size="lg" loading={busy} onPress={onSave} />
    </>
  );
}

// ───────── Authored fields ─────────

const TEXT_FIELDS = [
  { key: 'summary', label: 'Summary', multiline: true },
  { key: 'goal', label: 'Goal', multiline: false },
  { key: 'fear', label: 'Fear', multiline: false },
  { key: 'secret', label: 'Secret', multiline: true },
  { key: 'wound', label: 'Wound', multiline: true },
  { key: 'performerBrief', label: 'Performer brief', multiline: true },
  { key: 'voice', label: 'Voice notes', multiline: true },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]['key'];

export function CharacterSheet({ character: c, visible, onClose }: SheetProps) {
  const { project, projectId, call } = useProject();
  const latest = useLatest(c);
  const [name, setName] = useState(c.name);
  const [role, setRole] = useState(c.role);
  const [text, setText] = useState(() => Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, c[f.key] ?? ''])) as Record<TextKey, string>);
  const [values, setValues] = useState(c.declaredValues.join(', '));
  const [resources, setResources] = useState(c.resources.join(', '));
  const { busy, error, run, setError } = useMutation();
  const isProtagonist = c.id === project?.model.protagonistId;

  const save = async () => {
    if (!name.trim()) return setError('The character needs a name.');
    const character = {
      ...latest(),
      ...text,
      name: name.trim(),
      role,
      declaredValues: splitList(values),
      resources: splitList(resources),
    };
    if (await run('save', () => call('upsertCharacter', { character }))) onClose();
  };

  const remove = async () => {
    const sure = await confirm(`Delete ${c.name}?`, 'Their relationships are removed too. This cannot be undone.', {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!sure || !(await run('delete', () => call('deleteCharacter', { characterId: c.id })))) return;
    onClose();
    // Back to the cast; a screen opened directly (deep link) has nothing under it, so replace it instead.
    if (router.canDismiss()) router.dismiss();
    else router.replace({ pathname: '/project/[id]/story', params: { id: projectId, view: 'characters' } });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Edit ${c.name}`}
      footer={
        <>
          <SaveFooter busy={busy === 'save'} error={error} onSave={save} />
          {!isProtagonist && (
            <Button
              title="Delete character"
              icon="trash"
              variant="ghost"
              block
              loading={busy === 'delete'}
              disabled={!!busy}
              onPress={remove}
            />
          )}
        </>
      }>
      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Role">
        <Caption strong tone="primary">
          Role
        </Caption>
        <View style={styles.chips}>
          {CHARACTER_ROLES.map((r) => (
            <Chip key={r} label={CHARACTER_ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
          ))}
        </View>
      </View>
      {TEXT_FIELDS.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          value={text[f.key]}
          onChangeText={(v) => setText((t) => ({ ...t, [f.key]: v }))}
          multiline={f.multiline}
          helper={f.key === 'performerBrief' ? 'The only authored information a performer sees in a blind session.' : undefined}
        />
      ))}
      <TextField
        label="Declared values"
        value={values}
        onChangeText={setValues}
        helper="Comma-separated. Compared with behaviour observed in play."
      />
      <TextField label="Starting resources" value={resources} onChangeText={setResources} helper="Comma-separated." />
    </Sheet>
  );
}

export function CharacterStatusSheet({ character: c, visible, onClose }: SheetProps) {
  const { call } = useProject();
  const [status, setStatus] = useState<CanonStatus>(c.status);
  const { busy, error, run } = useMutation();

  const save = async () => {
    if (status === c.status) return onClose();
    if (await run('save', () => call('setCanonStatus', { target: { kind: 'character', id: c.id }, status }))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`${c.name} · status`}
      footer={<SaveFooter busy={!!busy} error={error} onSave={save} />}>
      <StatusPicker value={status} current={c.status} onChange={setStatus} />
    </Sheet>
  );
}

// ───────── Traits ─────────

export function TraitSheet({
  character: c,
  group,
  trait,
  visible,
  onClose,
}: SheetProps & { group: TraitGroup; trait?: Trait }) {
  const { call, can } = useProject();
  const latest = useLatest(c);
  const [label, setLabel] = useState(trait?.label ?? '');
  const [note, setNote] = useState(trait?.note ?? '');
  const [status, setStatus] = useState<CanonStatus>(trait?.status ?? 'proposed');
  const { busy, error, run, setError } = useMutation();
  const locked = trait?.status === 'locked' && !can('promoteCanon');
  const groupTitle = TRAIT_GROUPS.find((g) => g.key === group)!.title;

  const withTraits = (traits: Trait[]) => call('upsertCharacter', { character: { ...latest(), [group]: traits } });

  const save = async () => {
    const trimmed = label.trim();
    if (!trimmed) return setError('Name the trait first.');
    const ok = await run('save', async () => {
      const current = latest()[group];
      if (!trait) {
        await withTraits([...current, { id: '', label: trimmed, note: note.trim() || undefined, status, source: 'authored' }]);
        return;
      }
      if (trimmed !== trait.label || note.trim() !== (trait.note ?? '')) {
        await withTraits(current.map((t) => (t.id === trait.id ? { ...t, label: trimmed, note: note.trim() || undefined } : t)));
      }
      if (status !== trait.status) {
        await call('setCanonStatus', { target: { kind: 'trait', characterId: c.id, id: trait.id }, status });
      }
    });
    if (ok) onClose();
  };

  const remove = async () => {
    if (!trait) return;
    const sure = await confirm(`Remove “${trait.label}”?`, 'Marking it Rejected keeps it in the character’s history instead.', {
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (sure && (await run('delete', () => withTraits(latest()[group].filter((t) => t.id !== trait.id))))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={trait ? `${groupTitle} trait` : `New ${groupTitle.toLowerCase()} trait`}
      footer={
        locked ? undefined : (
          <>
            <SaveFooter busy={busy === 'save'} error={error} onSave={save} />
            {trait && (
              <Button
                title="Remove trait"
                icon="trash"
                variant="ghost"
                block
                loading={busy === 'delete'}
                disabled={!!busy}
                onPress={remove}
              />
            )}
          </>
        )
      }>
      {locked && (
        <Card tone="sunken">
          <Caption>Locked — this must remain true. Only the Project Owner can change it.</Caption>
        </Card>
      )}
      {trait?.source === 'emergent' && <Caption>Emerged in simulation rather than authored.</Caption>}
      <TextField label="Trait" value={label} onChangeText={setLabel} editable={!locked} />
      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        multiline
        editable={!locked}
        helper="Why the trait exists, and what environment created it."
      />
      <StatusPicker value={status} current={trait?.status} onChange={setStatus} disabled={locked} />
    </Sheet>
  );
}

// ───────── World-fit & capabilities ─────────

const emptyWorldFit = (): WorldFit =>
  Object.fromEntries(WORLD_FIT_STEPS.map((s) => [s.key, ''])) as unknown as WorldFit;

export function WorldFitSheet({ character: c, visible, onClose }: SheetProps) {
  const { call } = useProject();
  const latest = useLatest(c);
  const [draft, setDraft] = useState<WorldFit>(() => ({ ...emptyWorldFit(), ...c.worldFit }));
  const { busy, error, run } = useMutation();

  const save = async () => {
    if (await run('save', () => call('upsertCharacter', { character: { ...latest(), worldFit: draft } }))) onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="World-fit" footer={<SaveFooter busy={!!busy} error={error} onSave={save} />}>
      <Caption>What the new world requires of {c.name}, and what adapting costs.</Caption>
      {WORLD_FIT_STEPS.map((s) => (
        <TextField
          key={s.key}
          label={s.label}
          helper={s.question}
          value={draft[s.key]}
          onChangeText={(v) => setDraft((d) => ({ ...d, [s.key]: v }))}
          multiline
        />
      ))}
    </Sheet>
  );
}

export function CapabilitiesSheet({ character: c, visible, onClose }: SheetProps) {
  const { call } = useProject();
  const latest = useLatest(c);
  const [draft, setDraft] = useState(c.capabilities);
  const { busy, error, run } = useMutation();

  const save = async () => {
    if (await run('save', () => call('upsertCharacter', { character: { ...latest(), capabilities: draft } }))) onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Capabilities" footer={<SaveFooter busy={!!busy} error={error} onSave={save} />}>
      <Caption>0–5 in each domain — the baseline for chance resolution, before situation modifiers.</Caption>
      {DOMAINS.map((d) => (
        <Stepper
          key={d}
          label={DOMAIN_LABEL[d]}
          value={draft[d]}
          onChange={(v) => setDraft((prev) => ({ ...prev, [d]: v }))}
        />
      ))}
    </Sheet>
  );
}

// ───────── Relationships ─────────

export function RelationshipSheet({
  character: c,
  relationship,
  direction: initialDirection,
  visible,
  onClose,
}: SheetProps & { relationship?: Relationship; direction: 'out' | 'in' }) {
  const { project, call } = useProject();
  const others = project?.model.characters.filter((o) => o.id !== c.id) ?? [];
  const [direction, setDirection] = useState(initialDirection);
  const [otherId, setOtherId] = useState(
    relationship ? (relationship.from === c.id ? relationship.to : relationship.from) : others[0]?.id,
  );
  const [label, setLabel] = useState(relationship?.label ?? '');
  const [trust, setTrust] = useState(relationship?.trust ?? 0);
  const [tension, setTension] = useState(relationship?.tension ?? 0);
  const [notes, setNotes] = useState(relationship?.notes ?? '');
  const { busy, error, run, setError } = useMutation();
  const otherName = others.find((o) => o.id === otherId)?.name ?? 'them';

  const save = async () => {
    if (!otherId) return setError('Choose the other character.');
    const [from, to] = direction === 'out' ? [c.id, otherId] : [otherId, c.id];
    const next: Relationship = { id: relationship?.id ?? '', from, to, label: label.trim(), trust, tension, notes: notes.trim() };
    if (await run('save', () => call('upsertRelationship', { relationship: next }))) onClose();
  };

  const remove = async () => {
    if (!relationship) return;
    const sure = await confirm('Delete this relationship?', 'Only the authored baseline is removed; what happened in play stays.', {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (sure && (await run('delete', () => call('deleteRelationship', { relationshipId: relationship.id })))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={relationship ? 'Relationship' : 'New relationship'}
      footer={
        <>
          <SaveFooter busy={busy === 'save'} error={error} onSave={save} />
          {relationship && (
            <Button
              title="Delete relationship"
              icon="trash"
              variant="ghost"
              block
              loading={busy === 'delete'}
              disabled={!!busy}
              onPress={remove}
            />
          )}
        </>
      }>
      <Caption>Relationships are directed: how one character feels toward another. The simulation evolves its own copy.</Caption>
      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Other character">
        <Caption strong tone="primary">
          With
        </Caption>
        <View style={styles.chips}>
          {others.map((o) => (
            <Chip key={o.id} label={o.name} selected={otherId === o.id} onPress={() => setOtherId(o.id)} />
          ))}
        </View>
      </View>
      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Direction">
        <Caption strong tone="primary">
          Direction
        </Caption>
        <View style={styles.chips}>
          <Chip label={`${c.name} → ${otherName}`} selected={direction === 'out'} onPress={() => setDirection('out')} />
          <Chip label={`${otherName} → ${c.name}`} selected={direction === 'in'} onPress={() => setDirection('in')} />
        </View>
      </View>
      <TextField label="Label" value={label} onChangeText={setLabel} helper="Sister, former partner, informant…" />
      <Stepper label="Trust (−5 to 5)" value={trust} onChange={setTrust} min={-5} max={5} />
      <Stepper label="Tension (0 to 5)" value={tension} onChange={setTension} min={0} max={5} />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
    </Sheet>
  );
}
