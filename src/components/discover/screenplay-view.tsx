// Screenplay Room (PRD §41): the latest draft's title page at full size, the compiler beside it, earlier drafts under it.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ScreenplayDraft } from '@shared/types';

import { sceneImage } from '@/components/board/materials';
import { Paper, paperShadow, Polaroid, tiltFor } from '@/components/board/paper';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  List,
  ListRow,
  PressableScale,
  Section,
  Sheet,
  Title,
} from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { spacing } from '@/theme';

import { BinderClip, SIDE, useBoard } from './board-bits';
import { ErrorNote, useMutation } from './mutation';

/** Width of one draft stack when drafts sit in rows on a wide board. */
const STACK_WIDE = 264;

export function ScreenplayView() {
  const { project, projectId, sim, sequence, can, call } = useProject();
  const { busy, run, error } = useMutation();
  const { wide } = useBoard();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  if (!project || !sim) return null;

  const open = (draftId: string) =>
    router.push({ pathname: '/project/[id]/discover/screenplay/[draftId]', params: { id: projectId, draftId } });

  const compile = (sceneIds?: string[]) =>
    run(sceneIds ? 'scenes' : 'sequence', async () => {
      const before = new Set(project.screenplays.map((d) => d.id));
      const next = await call('compileScreenplay', sceneIds ? { sceneIds } : {});
      setPicking(false);
      setPicked([]);
      const draft = next.screenplays.find((d) => !before.has(d.id));
      if (draft) open(draft.id);
    });

  const drafts = [...project.screenplays].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const branchName = (id: string) => project.branches.find((b) => b.id === id)?.name ?? 'Unknown branch';
  const moments = (sceneId: string) => sim.events.filter((e) => e.sceneId === sceneId).length;

  const compiler = can('analyze') ? (
    <Card tilt={false}>
      <Heading>Screenplay compiler</Heading>
      <Body>
        Turns what was played into screenplay pages, marking where every line came from: performed, reconstructed or
        generated.
      </Body>
      {sequence ? <Caption>Current goal: {sequence.goal}</Caption> : null}
      <View style={styles.tight}>
        <Button
          title={busy === 'sequence' ? 'Compiling…' : 'Compile current sequence'}
          icon="script"
          loading={busy === 'sequence'}
          disabled={!!busy}
          onPress={() => void compile()}
          block
        />
        <Button
          title="Choose scenes…"
          icon="film"
          variant="secondary"
          disabled={!!busy || sim.scenes.length === 0}
          onPress={() => setPicking(true)}
          block
        />
        <ErrorNote message={error('sequence')} />
      </View>
    </Card>
  ) : null;

  const [latest, ...earlier] = drafts;
  const final = latest ? (
    <FinalDraft draft={latest} wide={wide} project={project.model.title} branch={branchName(latest.branchId)} onOpen={() => open(latest.id)} />
  ) : (
    <EmptyState
      icon="script"
      title="No drafts yet"
      message="The screenplay is written after the experience, not before. Compile once a sequence has been played."
    />
  );

  const shelf = earlier.length ? (
    <Section title="Earlier drafts" note={`${earlier.length} ${earlier.length === 1 ? 'version' : 'versions'}, newest first`}>
      <View style={[styles.stacks, wide && styles.stacksWide]}>
        {earlier.map((d) => (
          <DraftStack
            key={d.id}
            draft={d}
            branch={branchName(d.branchId)}
            onPress={() => open(d.id)}
            style={wide ? { width: STACK_WIDE } : undefined}
          />
        ))}
      </View>
    </Section>
  ) : null;

  const picker = (
    <Sheet
      visible={picking}
      onClose={() => setPicking(false)}
      title="Choose scenes"
      footer={
        <>
          <ErrorNote message={error('scenes')} />
          <Button
            title={picked.length ? `Compile ${picked.length} ${picked.length === 1 ? 'scene' : 'scenes'}` : 'Select scenes to compile'}
            icon="script"
            loading={busy === 'scenes'}
            disabled={!picked.length || !!busy}
            onPress={() => void compile(sim.scenes.filter((s) => picked.includes(s.id)).map((s) => s.id))}
            block
          />
        </>
      }>
      <Caption>Scenes compile in story order. Only scenes with played moments produce pages.</Caption>
      <List>
        {sim.scenes.map((s) => (
          <ListRow
            key={s.id}
            title={s.heading}
            subtitle={[`${moments(s.id)} ${moments(s.id) === 1 ? 'moment' : 'moments'}`, s.situation].filter(Boolean).join(' · ')}
            trailing={s.status === 'open' ? <Badge label="Playing" /> : undefined}
            selected={picked.includes(s.id)}
            onPress={() => setPicked((ids) => (ids.includes(s.id) ? ids.filter((id) => id !== s.id) : [...ids, s.id]))}
          />
        ))}
      </List>
    </Sheet>
  );

  if (!wide) {
    return (
      <>
        {final}
        {compiler}
        {shelf}
        {picker}
      </>
    );
  }
  return (
    <>
      <View style={styles.wideRow}>
        <View style={styles.main}>{final}</View>
        {compiler ? <View style={{ width: SIDE }}>{compiler}</View> : null}
      </View>
      {shelf}
      {picker}
    </>
  );
}

/** The newest draft, full size: a screenplay title page with a still from its first scene, clipped over its pages. */
function FinalDraft({
  draft: d,
  wide,
  project,
  branch,
  onOpen,
}: {
  draft: ScreenplayDraft;
  wide: boolean;
  project: string;
  branch: string;
  onOpen: () => void;
}) {
  const heading = d.elements.find((e) => e.type === 'heading')?.text;
  const still = heading ? sceneImage({ heading }) : undefined;
  // "EXT. CONTAINER YARD - NIGHT" → "Container yard", written on the print.
  const place = heading
    ?.replace(/^(INT\.?\/EXT\.?|INT\.|EXT\.)\s*/i, '')
    .replace(/\s+[-–—]\s+.*$/, '')
    .toLowerCase();
  const scope = project && d.title.startsWith(`${project}: `) ? d.title.slice(project.length + 2) : null;
  return (
    <View style={[styles.final, wide && styles.finalWide]}>
      <Sheets draft={d} />
      <Paper style={[styles.front, styles.finalPage, wide && styles.fill, paperShadow]}>
        {still ? (
          <Polaroid source={still} caption={place && place[0]!.toUpperCase() + place.slice(1)} width={176} aspect={4 / 3} style={styles.still} />
        ) : null}
        <View style={styles.titleBlock}>
          <Title style={styles.finalTitle}>{project || d.title}</Title>
          {scope ? <Body style={styles.centre}>{scope}</Body> : null}
          <Body tone="secondary" style={styles.centre}>
            Version {d.version} · the latest draft
          </Body>
        </View>
        <View style={styles.finalFoot}>
          <View style={styles.finalMeta}>
            <Caption numberOfLines={1}>{branch}</Caption>
            <Caption>Compiled {timeAgo(d.createdAt)}</Caption>
            <Caption>
              {d.elements.length}{'\u00A0'}{d.elements.length === 1 ? 'element' : 'elements'}
            </Caption>
          </View>
          <Button title="Read the draft" icon="script" variant="secondary" onPress={onOpen} />
        </View>
      </Paper>
      <BinderClip />
    </View>
  );
}

/** Title page plus roughly how many typed pages the draft runs to: a stack of two or three sheets. */
const sheets = (d: ScreenplayDraft) => Math.min(3, 1 + Math.max(1, Math.ceil(d.elements.length / 14)));

/** The typed pages behind a title page, squared off a little askew. */
function Sheets({ draft: d }: { draft: ScreenplayDraft }) {
  return Array.from({ length: sheets(d) - 1 }, (_, i) => (
    <View
      key={i}
      style={[
        styles.under,
        paperShadow,
        {
          transform: [
            { translateX: (i + 1) * 5 },
            { translateY: (i + 1) * 5 },
            { rotate: `${tiltFor(`${d.id}-${i}`, 1.8).toFixed(2)}deg` },
          ],
        },
      ]}>
      <Paper style={styles.fill}>{null}</Paper>
    </View>
  ));
}

/** An earlier draft: its title page on top of its pages, a binder clip at the head. */
function DraftStack({
  draft: d,
  branch,
  onPress,
  style,
}: {
  draft: ScreenplayDraft;
  branch: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const elements = `${d.elements.length} ${d.elements.length === 1 ? 'element' : 'elements'}`;
  return (
    <View style={[styles.stack, style]}>
      <Sheets draft={d} />
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${d.title}, version ${d.version}. ${branch}, compiled ${timeAgo(d.createdAt)}, ${elements}`}
        style={[styles.front, paperShadow]}>
        <Paper style={styles.titlePage}>
          <View style={styles.titleBlock}>
            <Heading style={styles.title} numberOfLines={3}>
              {d.title}
            </Heading>
            <Body tone="secondary" style={styles.centre}>
              Version {d.version}
            </Body>
          </View>
          <View style={styles.foot}>
            <View style={styles.grow}>
              <Caption numberOfLines={1}>{branch}</Caption>
              <Caption>Compiled {timeAgo(d.createdAt)}</Caption>
            </View>
            <Caption style={styles.right}>{elements}</Caption>
          </View>
        </Paper>
      </PressableScale>
      <BinderClip />
    </View>
  );
}

const styles = StyleSheet.create({
  tight: { gap: spacing.sm },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  main: { flex: 1, minWidth: 0 },
  stacks: { gap: spacing.xxl + spacing.xs, paddingTop: spacing.sm },
  stacksWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xxl, rowGap: spacing.xxl + spacing.md },
  stack: { marginRight: spacing.sm },
  under: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 2 },
  fill: { flex: 1 },
  front: { borderRadius: 2 },
  titlePage: { minHeight: 196, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl + spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between', gap: spacing.lg },
  titleBlock: { gap: spacing.xs, alignItems: 'center' },
  title: { textAlign: 'center', textTransform: 'uppercase', textDecorationLine: 'underline' },
  centre: { textAlign: 'center' },
  foot: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  grow: { flex: 1 },
  right: { textAlign: 'right' },
  final: { marginRight: spacing.sm, marginBottom: spacing.sm },
  // A letter-size page on wide boards; the phone page grows with its content.
  finalWide: { width: 460, maxWidth: '100%', aspectRatio: 8.5 / 11, alignSelf: 'center' },
  finalFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  finalMeta: { flexGrow: 1, flexBasis: 220 },
  finalPage: { minHeight: 440, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl + spacing.lg, paddingBottom: spacing.lg, gap: spacing.xl, justifyContent: 'space-between' },
  still: { alignSelf: 'center', transform: [{ rotate: '-1.5deg' }] },
  finalTitle: { fontSize: 28, lineHeight: 34, textAlign: 'center', textTransform: 'uppercase', textDecorationLine: 'underline' },
});
