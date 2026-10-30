// Story Bible (PRD §8, §46): the story's typed title page, its theme, and the canon pinned up as index cards under
// tape labels, each stamped with its status. Canon has no sequence, so no string joins these cards.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CANON_LABEL, CANON_STATUSES } from '@shared/structure';
import type { CanonItem, CanonKind, CanonStatus, StoryModel } from '@shared/types';

import { BlankSlip, Hand, StickyNote } from '@/components/board/paper';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  CanonBadge,
  Chip,
  confirm,
  Section,
  Sheet,
  TextField,
  Title,
} from '@/components/ui';
import { useProject } from '@/lib/session';
import { palettes, spacing, useTheme } from '@/theme';

import {
  CanonLegend,
  KeyValue,
  Prose,
  StatusPicker,
  storyStyles,
  useEmptyText,
  useGrid,
  useMutation,
  useSheet,
  useWide,
} from './common';

type ModelField =
  | 'title'
  | 'logline'
  | 'premise'
  | 'genre'
  | 'medium'
  | 'tone'
  | 'audience'
  | 'targetDuration'
  | 'theme'
  | 'thematicConflict'
  | 'philosophicalConflict';

const FIELDS: { key: ModelField; label: string; multiline?: boolean; helper?: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'logline', label: 'Logline', multiline: true },
  { key: 'premise', label: 'Premise', multiline: true },
  { key: 'genre', label: 'Genre' },
  { key: 'medium', label: 'Medium', helper: 'Feature, episode, limited series…' },
  { key: 'tone', label: 'Tone' },
  { key: 'audience', label: 'Audience' },
  { key: 'targetDuration', label: 'Target duration' },
  {
    key: 'theme',
    label: 'Theme statement',
    multiline: true,
    helper: 'e.g. “Revenge destroys the identity of the person pursuing it.”',
  },
  { key: 'thematicConflict', label: 'Thematic conflict', helper: 'e.g. justice vs revenge' },
  { key: 'philosophicalConflict', label: 'Philosophical conflict', multiline: true },
];

const FACTS: ModelField[] = ['genre', 'medium', 'tone', 'audience', 'targetDuration'];
const labelOf = (key: ModelField) => FIELDS.find((f) => f.key === key)!.label;

const CANON_KINDS: { kind: CanonKind; title: string; label: string }[] = [
  { kind: 'world-rule', title: 'World rules', label: 'World rule' },
  { kind: 'constraint', title: 'Constraints', label: 'Constraint' },
  { kind: 'fact', title: 'Facts', label: 'Fact' },
  { kind: 'question', title: 'Open questions', label: 'Open question' },
  { kind: 'inspiration', title: 'Inspirations', label: 'Inspiration' },
];

const byStatus = (a: CanonItem, b: CanonItem) => CANON_STATUSES.indexOf(a.status) - CANON_STATUSES.indexOf(b.status);

type CanonTarget = { item?: CanonItem; kind: CanonKind };

export function BibleView() {
  const { project, can } = useProject();
  const wide = useWide();
  const grid = useGrid(wide ? 210 : 150, spacing.md);
  const bibleSheet = useSheet<true>();
  const canonSheet = useSheet<CanonTarget>();
  if (!project) return null;

  const { model } = project;
  const editable = can('editModel');

  const titlePage = <TitlePage model={model} onEdit={editable ? () => bibleSheet.open(true) : undefined} />;
  const theme = (
    <Section title="Theme">
      <Card pin="brass" tilt="bible:theme">
        <Prose label="Theme statement" value={model.theme} />
        <Prose label="Thematic conflict" value={model.thematicConflict} />
        <Prose label="Philosophical conflict" value={model.philosophicalConflict} />
      </Card>
    </Section>
  );

  const legend = (
    <Section title="Canon status" note="what each stamp means">
      <Card tilt="bible:legend">
        <CanonLegend />
      </Card>
    </Section>
  );

  return (
    <>
      {wide ? (
        <View style={storyStyles.columns}>
          <View style={[storyStyles.column, styles.pageColumn]}>{titlePage}</View>
          <View style={storyStyles.column}>
            {theme}
            {legend}
          </View>
        </View>
      ) : (
        <>
          {titlePage}
          {theme}
        </>
      )}

      <View onLayout={grid.onLayout} style={styles.groups}>
        {CANON_KINDS.map(({ kind, title, label }) => (
          <CanonGroup
            key={kind}
            title={title}
            label={label}
            width={grid.item}
            items={model.canon.filter((i) => i.kind === kind).sort(byStatus)}
            onAdd={editable ? () => canonSheet.open({ kind }) : undefined}
            onOpen={editable ? (item) => canonSheet.open({ item, kind }) : undefined}
          />
        ))}
      </View>

      {!wide && legend}

      {bibleSheet.state && (
        <BibleSheet key={bibleSheet.state.key} visible={bibleSheet.state.visible} onClose={bibleSheet.close} />
      )}
      {canonSheet.state && (
        <CanonSheet
          key={canonSheet.state.key}
          {...canonSheet.state.value}
          visible={canonSheet.state.visible}
          onClose={canonSheet.close}
        />
      )}
    </>
  );
}

/** A screenplay's title page, taped square to the board: title and logline centred, the particulars typed below. */
function TitlePage({ model, onEdit }: { model: StoryModel; onEdit?: () => void }) {
  return (
    <Card fasten="tape" tilt={false} style={styles.titlePage}>
      <TitlePageFace model={model} />
      {onEdit && <Button title="Edit title page" icon="edit" variant="secondary" size="sm" onPress={onEdit} />}
    </Card>
  );
}

/** Drawn on paper, so its colours are ink. */
function TitlePageFace({ model }: { model: StoryModel }) {
  const { colors } = useTheme();
  const emptyText = useEmptyText();
  const logline = model.logline?.trim();
  return (
    <>
      <View style={styles.titleBlock}>
        <Title style={styles.title}>{(model.title || 'Untitled project').toUpperCase()}</Title>
        <View style={[styles.rule, { backgroundColor: colors.text }]} />
        <Body tone={logline ? 'primary' : 'tertiary'} style={[styles.center, storyStyles.italic]}>
          {logline || emptyText('No logline yet')}
        </Body>
      </View>
      <Prose label="Premise" value={model.premise} />
      <View style={[styles.particulars, { borderTopColor: colors.separator }]}>
        {FACTS.map((key) => (
          <KeyValue key={key} label={labelOf(key)}>
            {model[key] ? (
              <Body>{model[key]}</Body>
            ) : (
              <Body tone="tertiary" style={storyStyles.italic}>
                {emptyText()}
              </Body>
            )}
          </KeyValue>
        ))}
      </View>
    </>
  );
}

function CanonGroup({
  title,
  label,
  width,
  items,
  onAdd,
  onOpen,
}: {
  title: string;
  label: string;
  width: number;
  items: CanonItem[];
  onAdd?: () => void;
  onOpen?: (item: CanonItem) => void;
}) {
  const emptyText = useEmptyText();
  return (
    <Section title={title}>
      <View style={styles.cards}>
        {items.map((item) => (
          <Card
            key={item.id}
            at="top"
            pin={item.status === 'locked' ? 'brass' : 'red'}
            tilt={item.id}
            onPress={onOpen && (() => onOpen(item))}
            accessibilityLabel={`${item.text}. ${CANON_LABEL[item.status]}${item.source === 'simulation' ? ', from simulation' : ''}. Opens the item`}
            style={[styles.canonCard, { width }]}>
            <CanonFace item={item} />
          </Card>
        ))}
        {onAdd ? (
          <BlankCard label={`New ${label.toLowerCase()}`} width={width} onPress={onAdd} />
        ) : items.length === 0 ? (
          <StickyNote style={{ width }}>
            <Hand color={palettes.paper.text}>{emptyText('Nothing pinned here yet.')}</Hand>
          </StickyNote>
        ) : null}
      </View>
    </Section>
  );
}

/** The typed face of a canon card, stamped with its status (drawn on paper, so its colours are ink). */
function CanonFace({ item }: { item: CanonItem }) {
  const { colors } = useTheme();
  const rejected = item.status === 'rejected';
  return (
    <>
      <Body tone={rejected ? 'secondary' : 'primary'} style={rejected && styles.struck}>
        {item.text}
      </Body>
      <View style={storyStyles.wrap}>
        <CanonBadge status={item.status} />
        {item.source === 'simulation' && <Badge icon="rehearse" label="From simulation" color={colors.canon.emergent} />}
      </View>
    </>
  );
}

/** A blank card at the end of a group: where the next item goes. */
function BlankCard({ label, width, onPress }: { label: string; width: number; onPress: () => void }) {
  return <BlankSlip label={label} onPress={onPress} style={{ width }} />;
}

function BibleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { project, call } = useProject();
  const [initial] = useState(() => pickFields(project!.model));
  const [draft, setDraft] = useState(initial);
  const { busy, error, run } = useMutation();

  const save = async () => {
    // Only what changed, so a collaborator's concurrent edit to another field isn't overwritten.
    const patch = Object.fromEntries(FIELDS.filter((f) => draft[f.key] !== initial[f.key]).map((f) => [f.key, draft[f.key]]));
    if (Object.keys(patch).length === 0 || (await run('save', () => call('updateModel', { patch })))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Edit story bible"
      footer={
        <>
          {error && <Caption tone="danger">{error}</Caption>}
          <Button title="Save" block size="lg" loading={!!busy} onPress={save} />
        </>
      }>
      {FIELDS.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          helper={f.helper}
          value={draft[f.key]}
          onChangeText={(value) => setDraft((d) => ({ ...d, [f.key]: value }))}
          multiline={f.multiline}
          autoCapitalize={f.key === 'title' ? 'words' : 'sentences'}
        />
      ))}
    </Sheet>
  );
}

const pickFields = (model: StoryModel): Record<ModelField, string> =>
  Object.fromEntries(FIELDS.map((f) => [f.key, model[f.key] ?? ''])) as Record<ModelField, string>;

function CanonSheet({ item, kind: initialKind, visible, onClose }: CanonTarget & { visible: boolean; onClose: () => void }) {
  const { call, can } = useProject();
  const [kind, setKind] = useState(item?.kind ?? initialKind);
  const [text, setText] = useState(item?.text ?? '');
  const [status, setStatus] = useState<CanonStatus>(item?.status ?? 'proposed');
  const { busy, error, run, setError } = useMutation();
  const locked = item?.status === 'locked' && !can('promoteCanon');

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) return setError('Write the item first.');
    const ok = await run('save', async () => {
      if (!item) {
        await call('upsertCanonItem', {
          item: { id: '', kind, text: trimmed, status, source: 'authored', updatedAt: '' },
        });
        return;
      }
      if (kind !== item.kind || trimmed !== item.text) {
        await call('upsertCanonItem', { item: { ...item, kind, text: trimmed } });
      }
      if (status !== item.status) await call('setCanonStatus', { target: { kind: 'canon', id: item.id }, status });
    });
    if (ok) onClose();
  };

  const remove = async () => {
    if (!item) return;
    const sure = await confirm('Delete this item?', `${item.text}\n\nMarking it Rejected keeps it in the project’s history instead.`, {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (sure && (await run('delete', () => call('deleteCanonItem', { itemId: item.id })))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={item ? 'Canon item' : 'New canon item'}
      footer={
        locked ? undefined : (
          <>
            {error && <Caption tone="danger">{error}</Caption>}
            <Button title="Save" block size="lg" loading={busy === 'save'} disabled={!!busy} onPress={save} />
            {item && (
              <Button
                title="Delete item"
                variant="ghost"
                block
                icon="trash"
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
          <Caption>Locked: this must remain true. Only the Project Owner can change it.</Caption>
        </Card>
      )}
      {item?.source === 'simulation' && (
        <Caption>Emerged in simulation{item.discoveryId ? ', linked to a discovery' : ''}.</Caption>
      )}
      <View style={storyStyles.group} accessibilityRole="radiogroup" accessibilityLabel="Kind">
        <Caption strong tone="primary">
          Kind
        </Caption>
        <View style={storyStyles.chips}>
          {CANON_KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} disabled={locked} onPress={() => setKind(k.kind)} />
          ))}
        </View>
      </View>
      <TextField label="Text" value={text} onChangeText={setText} multiline editable={!locked} />
      <StatusPicker value={status} current={item?.status} onChange={setStatus} disabled={locked} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pageColumn: { flex: 3 },
  titlePage: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xl, gap: spacing.lg },
  titleBlock: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  title: { textAlign: 'center', letterSpacing: 2 },
  rule: { width: 56, height: 1.5, opacity: 0.6 },
  center: { textAlign: 'center' },
  particulars: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.xs },
  groups: { gap: spacing.xl },
  cards: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: spacing.md, rowGap: spacing.xl },
  canonCard: { padding: spacing.md, paddingTop: spacing.xl, gap: spacing.sm },
  struck: { textDecorationLine: 'line-through' },
});
