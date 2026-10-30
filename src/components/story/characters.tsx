// Cast wall (PRD §9, §46): a Polaroid of every character pinned to the cork, protagonist first, each with its
// role and canon stamped on a paper tag. A print opens the Character Lab.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CANON_LABEL, emptyCapabilities } from '@shared/structure';
import type { Character, CharacterRole } from '@shared/types';

import { characterImage } from '@/components/board/materials';
import { BlankSlip, Paper, Pinned, Polaroid, tiltFor } from '@/components/board/paper';
import {
  Badge,
  Button,
  Caption,
  CanonBadge,
  Chip,
  EmptyState,
  PressableScale,
  Section,
  Sheet,
  TextField,
} from '@/components/ui';
import { useProject } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

import { CHARACTER_ROLE_LABEL, CHARACTER_ROLES, PrintInitials, storyStyles, useGrid, useMutation, useSheet, useWide } from './common';

export function openCharacter(projectId: string, characterId: string) {
  router.push({ pathname: '/project/[id]/story/character/[cid]', params: { id: projectId, cid: characterId } });
}

const ASPECT = 4 / 5;
/** Height of a Polaroid `width` wide with a one-line caption (components/board/paper.tsx). */
const printHeight = (width: number) => (width - 14) / ASPECT + 37;

export function CharactersView() {
  const { project, projectId, me, can } = useProject();
  const wide = useWide();
  const grid = useGrid(wide ? 176 : 150, spacing.lg);
  const newSheet = useSheet<true>();
  if (!project) return null;

  const { characters, protagonistId } = project.model;
  const ordered = [...characters].sort((a, b) => Number(b.id === protagonistId) - Number(a.id === protagonistId));
  const editable = can('editModel');

  return (
    <>
      <Section title="Cast" note={characters.length > 1 ? 'protagonist first' : undefined}>
        {ordered.length === 0 ? (
          <EmptyState
            icon="person"
            title="No characters yet"
            message="Pin the people of the story here. The protagonist goes up first."
            action={editable ? { label: 'New character', icon: 'plus', onPress: () => newSheet.open(true) } : undefined}
          />
        ) : (
          <View onLayout={grid.onLayout} style={styles.wall}>
            {ordered.map((c) => (
              <CastPrint
                key={c.id}
                c={c}
                width={grid.item}
                protagonist={c.id === protagonistId}
                mine={c.id === me?.characterId}
                onPress={() => openCharacter(projectId, c.id)}
              />
            ))}
            {editable && <BlankPrint width={grid.item} onPress={() => newSheet.open(true)} />}
          </View>
        )}
      </Section>
      {newSheet.state && (
        <NewCharacterSheet
          key={newSheet.state.key}
          visible={newSheet.state.visible}
          onClose={newSheet.close}
          onCreated={(cid) => {
            newSheet.close();
            openCharacter(projectId, cid);
          }}
        />
      )}
    </>
  );
}

function CastPrint({
  c,
  width,
  protagonist,
  mine,
  onPress,
}: {
  c: Character;
  width: number;
  protagonist: boolean;
  mine: boolean;
  onPress: () => void;
}) {
  const photo = characterImage(c);
  const role = CHARACTER_ROLE_LABEL[c.role];
  const spoken = [c.name, role, protagonist && c.role !== 'protagonist' ? 'protagonist' : '', CANON_LABEL[c.status], mine ? 'your role' : '']
    .filter(Boolean)
    .join(', ');
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens the Character Lab"
      style={[styles.print, { width }]}>
      <Pinned at="top" tilt={c.id}>
        <Polaroid source={photo} caption={c.name} width={width} aspect={ASPECT} />
        {!photo && <PrintInitials name={c.name} width={width} aspect={ASPECT} />}
      </Pinned>
      <Paper style={[styles.tag, { transform: [{ rotate: `${tiltFor(`${c.id}:tag`, 1.2).toFixed(2)}deg` }] }]}>
        <CastTag c={c} protagonist={protagonist} mine={mine} />
      </Paper>
    </PressableScale>
  );
}

/** Stamped on the paper tag under a print (drawn on paper, so its colours are ink). */
function CastTag({ c, protagonist, mine }: { c: Character; protagonist: boolean; mine: boolean }) {
  const { colors } = useTheme();
  return (
    <>
      <View style={storyStyles.wrap}>
        <Badge label={CHARACTER_ROLE_LABEL[c.role]} color={protagonist ? colors.accentText : colors.textSecondary} />
        {protagonist && c.role !== 'protagonist' && <Badge label="Protagonist" color={colors.accentText} />}
        <CanonBadge status={c.status} />
        {mine && <Badge label="Your role" color={colors.text} />}
      </View>
      {c.summary ? <Caption numberOfLines={4}>{c.summary}</Caption> : null}
    </>
  );
}

/** A blank card at the end of the wall: where the next character goes. */
function BlankPrint({ width, onPress }: { width: number; onPress: () => void }) {
  return <BlankSlip label="New character" onPress={onPress} style={{ width, height: printHeight(width) }} />;
}

const blankCharacter = (name: string, role: CharacterRole): Character => ({
  id: '',
  name,
  role,
  status: 'proposed',
  summary: '',
  extrinsic: [],
  intrinsic: [],
  adaptive: [],
  goal: '',
  fear: '',
  secret: '',
  wound: '',
  declaredValues: [],
  capabilities: emptyCapabilities(),
  resources: [],
  performerBrief: '',
  voice: '',
});

function NewCharacterSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (characterId: string) => void;
}) {
  const { project, call } = useProject();
  const [name, setName] = useState('');
  const [role, setRole] = useState<CharacterRole>('supporting');
  const { busy, error, run, setError } = useMutation();

  const create = async () => {
    if (!name.trim()) return setError('Give the character a name.');
    const before = new Set(project?.model.characters.map((c) => c.id));
    let createdId: string | undefined;
    await run('create', async () => {
      const next = await call('upsertCharacter', { character: blankCharacter(name.trim(), role) });
      createdId = next.model.characters.find((c) => !before.has(c.id))?.id;
    });
    if (createdId) onCreated(createdId);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="New character"
      footer={
        <>
          {error && <Caption tone="danger">{error}</Caption>}
          <Button title="Create character" block size="lg" loading={!!busy} onPress={create} />
        </>
      }>
      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" autoFocus returnKeyType="done" />
      <View style={storyStyles.group} accessibilityRole="radiogroup" accessibilityLabel="Role">
        <Caption strong tone="primary">
          Role
        </Caption>
        <View style={storyStyles.chips}>
          {CHARACTER_ROLES.map((r) => (
            <Chip key={r} label={CHARACTER_ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
          ))}
        </View>
      </View>
      <Caption>
        Starts as Proposed with baseline capabilities. Traits, goals, world-fit and relationships are shaped in the
        Character Lab.
      </Caption>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wall: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: spacing.lg, rowGap: spacing.xl },
  print: { alignItems: 'center' },
  tag: { alignSelf: 'stretch', marginHorizontal: spacing.sm, marginTop: -2, padding: spacing.sm, gap: spacing.xs },
});
