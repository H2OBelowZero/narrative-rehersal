// The project board (PRD §14, §46, §54): a title card, then the four areas pinned in nav order and joined by one
// red string. Story state, structural position, the scene in play, the crew, discoveries and the north-star count
// all live on the cards; tapping a card follows the string to that area.
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import type { Project, StoryModel } from '@shared/types';

import { CrewCard, DiscoverCard, RehearseCard, StoryCard } from '@/components/home/area-cards';
import { HeaderWordmark, WIDE } from '@/components/home/desk-hero';
import { followString } from '@/components/string-nav';
import { storyStyles, useMutation, useSheet } from '@/components/story/common';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  CanonBadge,
  Chip,
  EASE_OUT,
  Icon,
  List,
  ListRow,
  PressableScale,
  Screen,
  Sheet,
  showToast,
  TextField,
  Title,
} from '@/components/ui';
import { BRANCH_MODE_LABEL } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, spacing, TOUCH_TARGET, useTheme } from '@/theme';

export default function ProjectBoard() {
  const { project, error, refresh } = useProject();
  const wide = useWindowDimensions().width >= WIDE;
  if (!project) return null; // the project layout only mounts tabs once loaded

  return (
    <Screen onRefresh={refresh} edges={wide ? ['top'] : []} contentStyle={wide ? styles.wide : undefined}>
      <Stack.Screen
        options={{
          title: project.model.title || 'Untitled project',
          // Phones: the wordmark heads the board (and leads back to every project). Wide: the sidebar carries it.
          headerTitle: () => <HeaderWordmark />,
          headerLargeTitleEnabled: false,
          headerShown: !wide,
        }}
      />
      <Card pin="brass" tilt="title">
        <TitleFace project={project} offline={!!error} />
      </Card>
      {wide ? (
        // Two rows, read along the string: Story to Rehearse, down to Crew, back across to Discover.
        <>
          <View style={styles.row}>
            <View style={styles.cell}>
              <StoryCard order={1} />
            </View>
            <View style={styles.cell}>
              <RehearseCard order={2} />
            </View>
          </View>
          <View style={[styles.row, styles.reverse]}>
            <View style={styles.cell}>
              <CrewCard order={3} />
            </View>
            <View style={styles.cell}>
              <DiscoverCard order={4} />
            </View>
          </View>
        </>
      ) : (
        <>
          <StoryCard order={1} />
          <RehearseCard order={2} />
          <CrewCard order={3} />
          <DiscoverCard order={4} />
        </>
      )}
    </Screen>
  );
}

const MEDIUMS = ['Feature film', 'TV pilot', 'Episode', 'Limited series', 'Short film'];
const LENGTHS = ['15 min', '30 min', '60 min', '90 min', '110 min', '120 min'];
const GENRES = ['Drama', 'Thriller', 'Neo-noir', 'Comedy', 'Horror', 'Sci-fi', 'Fantasy', 'Action', 'Romance'];

type DetailField = 'logline' | 'medium' | 'targetDuration' | 'genre';
const DETAIL_FIELDS: DetailField[] = ['logline', 'medium', 'targetDuration', 'genre'];

/**
 * Typed title, logline, what kind of story, which branch is live and whether a session is running. Stamps you can
 * change carry a chevron (and nudge once when the card lands); stamps that only report stay plain ink.
 */
function TitleFace({ project, offline }: { project: Project; offline: boolean }) {
  const { colors } = useTheme(); // paper
  const { branch, can, projectId } = useProject();
  const details = useSheet<true>();
  const branches = useSheet<true>();
  const { model, activeSessionId } = project;
  const editable = can('editModel');
  const openDetails = () => details.open(true);

  const stamp = (value: string, empty: string, hint: string) =>
    editable ? (
      <TapStamp label={value || empty} hint={hint} onPress={openDetails} />
    ) : value ? (
      <Badge label={value} />
    ) : null;

  return (
    <>
      <Title style={styles.title}>{(model.title || 'Untitled project').toUpperCase()}</Title>
      {editable ? (
        <PressableScale
          onPress={openDetails}
          accessibilityRole="button"
          accessibilityLabel={`Logline: ${model.logline || 'none yet'}. Edit`}
          style={styles.loglineTap}>
          <Body tone={model.logline ? 'primary' : 'tertiary'} style={[styles.logline, styles.grow]}>
            {model.logline || 'Add a logline'}
          </Body>
          <Icon name="edit" size={15} color={colors.accentText} style={styles.pencil} />
        </PressableScale>
      ) : model.logline ? (
        <Body style={styles.logline}>{model.logline}</Body>
      ) : (
        <Body tone="tertiary">No logline yet.</Body>
      )}
      <View style={styles.stamps}>
        {stamp(model.medium, 'Set format', 'Change the format')}
        {stamp(model.targetDuration, 'Set length', 'Change the running time')}
        {stamp(model.genre, 'Add genre', 'Change the genre')}
        {branch &&
          (can('direct') ? (
            <TapStamp
              label={`${branch.name}: ${BRANCH_MODE_LABEL[branch.mode]}`}
              hint="Switch branch"
              color={colors.text}
              onPress={() => branches.open(true)}
            />
          ) : (
            <Badge icon="branch" label={`${branch.name}: ${BRANCH_MODE_LABEL[branch.mode]}`} color={colors.text} />
          ))}
        {branch?.status === 'canon' && <CanonBadge status="canon" />}
        {activeSessionId ? (
          <TapStamp label="Session live" hint="Opens Rehearse" icon="arrow-right" color={colors.accentText} onPress={() => followString(projectId, 'rehearse')} />
        ) : can('manageCrew') ? (
          <TapStamp label="No session running" hint="Start one in Crew" icon="arrow-right" onPress={() => followString(projectId, 'crew')} />
        ) : (
          <Badge label="No session running" variant="outline" />
        )}
      </View>
      {offline && (
        <Card tone="sunken" style={styles.offline}>
          <Icon name="offline" size={18} color={colors.textSecondary} />
          <Caption style={styles.grow}>Can’t reach the server. Showing the last known state; pull to retry.</Caption>
        </Card>
      )}
      {details.state && <DetailsSheet key={details.state.key} visible={details.state.visible} onClose={details.close} />}
      {branches.state && <BranchSheet key={branches.state.key} visible={branches.state.visible} onClose={branches.close} />}
    </>
  );
}

/** A stamp you can press: the chevron says so, and drops once shortly after the card lands to catch the eye. */
function TapStamp({
  label,
  hint,
  color,
  icon = 'chevron-down',
  onPress,
}: {
  label: string;
  hint: string;
  color?: string;
  icon?: 'chevron-down' | 'arrow-right';
  onPress: () => void;
}) {
  const { colors } = useTheme(); // paper
  const nudge = useSharedValue(0);
  useEffect(() => {
    const away = icon === 'chevron-down' ? 3 : 0;
    const across = icon === 'arrow-right' ? 3 : 0;
    nudge.set(
      withDelay(
        700,
        withSequence(withTiming(away || across, { duration: 200, easing: EASE_OUT }), withTiming(0, { duration: 320, easing: EASE_OUT })),
      ),
    );
  }, [icon, nudge]);
  const moved = useAnimatedStyle(() =>
    icon === 'chevron-down' ? { transform: [{ translateY: nudge.get() }] } : { transform: [{ translateX: nudge.get() }] },
  );
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      hitSlop={6}
      style={styles.tapStamp}>
      <Badge label={label} color={color} />
      <Animated.View style={moved}>
        <Icon name={icon} size={14} color={colors.accentText} />
      </Animated.View>
    </PressableScale>
  );
}

/** Logline, format, running time and genre, each with the common choices one tap away. */
function DetailsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { project, call } = useProject();
  const [initial] = useState(() => pick(project!.model));
  const [draft, setDraft] = useState(initial);
  const { busy, error, run } = useMutation();
  const set = (key: DetailField) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    // Only what changed, so a collaborator's concurrent edit to another field isn't overwritten.
    const patch = Object.fromEntries(DETAIL_FIELDS.filter((k) => draft[k] !== initial[k]).map((k) => [k, draft[k].trim()]));
    if (Object.keys(patch).length === 0 || (await run('save', () => call('updateModel', { patch })))) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Story details"
      footer={
        <>
          {error && <Caption tone="danger">{error}</Caption>}
          <Button title="Save" block size="lg" loading={!!busy} onPress={save} />
        </>
      }>
      <TextField label="Logline" value={draft.logline} onChangeText={set('logline')} multiline helper="One or two sentences." />
      <Choice label="Format" options={MEDIUMS} value={draft.medium} onChange={set('medium')} />
      <Choice label="Length" options={LENGTHS} value={draft.targetDuration} onChange={set('targetDuration')} />
      <Choice label="Genre" options={GENRES} value={draft.genre} onChange={set('genre')} />
    </Sheet>
  );
}

/** A typed field with the common answers as chips beneath it. */
function Choice({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={storyStyles.group}>
      <TextField label={label} value={value} onChangeText={onChange} placeholder="Type your own or pick one" />
      <View style={storyStyles.chips} accessibilityRole="radiogroup" accessibilityLabel={`${label} choices`}>
        {options.map((o) => (
          <Chip key={o} label={o} selected={value === o} onPress={() => onChange(value === o ? '' : o)} />
        ))}
      </View>
    </View>
  );
}

const pick = (model: StoryModel): Record<DetailField, string> =>
  Object.fromEntries(DETAIL_FIELDS.map((k) => [k, model[k] ?? ''])) as Record<DetailField, string>;

/** Every branch of the story; choose one to rehearse in it. */
function BranchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { project, call, projectId } = useProject();
  const { busy, error, run } = useMutation();
  if (!project) return null;

  const choose = async (id: string, name: string) => {
    if (id === project.activeBranchId) return onClose();
    const ok = await run(id, () => call('switchBranch', { branchId: id }));
    if (ok) {
      showToast(`Now rehearsing in ${name}`, 'success');
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Branches"
      footer={
        <>
          {error && <Caption tone="danger">{error}</Caption>}
          <Button
            title="Compare and manage branches"
            variant="secondary"
            block
            icon="branch"
            onPress={() => {
              onClose();
              followString(projectId, 'discover', { view: 'branches' });
            }}
          />
        </>
      }>
      <List>
        {project.branches.map((b) => (
          <ListRow
            key={b.id}
            title={b.name}
            subtitle={BRANCH_MODE_LABEL[b.mode]}
            selected={b.id === project.activeBranchId}
            trailing={busy === b.id ? <Caption>Switching…</Caption> : b.status === 'canon' ? <CanonBadge status="canon" /> : undefined}
            onPress={() => void choose(b.id, b.name)}
          />
        ))}
      </List>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wide: { maxWidth: 1180, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  reverse: { flexDirection: 'row-reverse' },
  cell: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: 2 },
  logline: { fontFamily: fonts.typewriterItalic },
  loglineTap: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: TOUCH_TARGET },
  pencil: { marginTop: 4 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.sm },
  tapStamp: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
});
