// Screenplay Room draft (PRD §41–43): industry format typed on a clipped page, every line stamped in the margin with
// where it came from. The system never disguises invention as discovery.
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Switch, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import type { ActionProvenance, DialogueProvenance, ScreenplayDraft, ScreenplayElement } from '@shared/types';

import { Paper, paperShadow, Stamp } from '@/components/board/paper';
import { Body, Button, Caption, Card, Eyebrow, Heading, Screen, showToast } from '@/components/ui';
import { errorMessage, timeAgo } from '@/lib/format';
import { useProject } from '@/lib/session';
import { alpha, fonts, palettes, spacing, typography, type Palette } from '@/theme';

import { BinderClip, BOARD_MAX, SIDE, useBoard } from './board-bits';
import { useEvidence } from './evidence';
import { fountainFilename, toFountain } from './fountain';

type Provenance = DialogueProvenance | ActionProvenance;

const PROVENANCE: Record<Provenance, { label: string; describe: string; color: (c: Palette) => string }> = {
  performed: { label: 'Performed', describe: 'Meaning or wording came directly from a performer.', color: (c) => c.accentText },
  reconstructed: {
    label: 'Reconstructed',
    describe: "Rewritten as screenplay dialogue, keeping the performer’s intent and voice.",
    color: (c) => c.role.producer,
  },
  generated: { label: 'Generated', describe: 'Written by the compiler because connective dialogue was needed.', color: (c) => c.textTertiary },
  observed: { label: 'Observed', describe: 'Happened in the simulation.', color: (c) => c.canon.canon },
  directed: { label: 'Directed', describe: "The Director’s staging or environment.", color: (c) => c.role.director },
  connective: { label: 'Connective', describe: 'Added by the compiler to bridge a gap.', color: (c) => c.textTertiary },
};
const DIALOGUE: DialogueProvenance[] = ['performed', 'reconstructed', 'generated'];
const ACTION: ActionProvenance[] = ['observed', 'directed', 'connective'];

/** Everything on the page is ink on paper, whatever surface asks. */
const ink = palettes.paper;
const inkOf = (p: Provenance) => PROVENANCE[p].color(ink);

/** Horizontal page margin; the provenance rule sits inside it. */
const PAGE_X = 22;
/** Right margin that holds the provenance stamps once the page is wide enough to spare it. */
const STAMP_MARGIN = 128;
const MARGIN_FROM = 560;
/** A US Letter page's proportions at a comfortable reading size: 60 typed characters a line plus the stamp margin. */
const PAGE_MAX = 780;

export function ScreenplayPage({ draft }: { draft: ScreenplayDraft }) {
  const { project, projectId, can, call } = useProject();
  const { wide, inner } = useBoard();
  const [provenance, setProvenance] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [typing, setTyping] = useState(false);
  const typedUp = project?.scripts.find((s) => s.fromDraftId === draft.id);

  const rewrite = async () => {
    const openScript = (scriptId: string) =>
      router.navigate({ pathname: '/project/[id]/write/[scriptId]', params: { id: projectId, scriptId } });
    if (typedUp) return openScript(typedUp.id);
    setTyping(true);
    try {
      const next = await call('createScript', { title: draft.title, fromDraftId: draft.id });
      const made = next.scripts.find((s) => s.fromDraftId === draft.id);
      if (made) openScript(made.id);
    } catch {
      // Toasted.
    } finally {
      setTyping(false);
    }
  };
  const evidence = useEvidence();
  const branch = project?.branches.find((b) => b.id === draft.branchId);
  const events = branch?.state.events ?? [];
  const pageWidth = Math.min(wide ? inner - SIDE - spacing.xl : inner, PAGE_MAX);

  const exportDraft = async () => {
    setExporting(true);
    try {
      const outcome = await shareText(fountainFilename(draft), toFountain(draft, { provenance }));
      if (outcome !== 'shared') showToast(outcome === 'downloaded' ? 'Fountain file downloaded' : 'Fountain copied to the clipboard', 'success');
    } catch (e) {
      showToast(`Couldn’t export: ${errorMessage(e)}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const info = (
    <Card tilt={false}>
      <View style={styles.tight}>
        <Heading>{draft.title}</Heading>
        <Caption>{[branch?.name, `version ${draft.version}`, `compiled ${timeAgo(draft.createdAt)}`].filter(Boolean).join(', ')}</Caption>
      </View>
      <ProvenanceSwitch value={provenance} onChange={setProvenance} />
      <View style={styles.tight}>
        <Button
          title="Export as Fountain"
          icon="send"
          variant="secondary"
          loading={exporting}
          onPress={() => void exportDraft()}
          block
        />
        <Caption>
          {provenance ? 'Provenance is included as [[notes]].' : 'Clean pages. Turn on provenance to include it as [[notes]].'}
        </Caption>
      </View>
      <Caption>Tap any line to see the rehearsal moments behind it.</Caption>
      {can('editModel') && (
        <View style={styles.tight}>
          <Button
            title={typedUp ? 'Open in the Write room' : 'Rewrite in the Write room'}
            icon="edit"
            variant="secondary"
            loading={typing}
            onPress={() => void rewrite()}
            block
          />
          <Caption>{typedUp ? 'Typed up as a script already.' : 'Types this draft up as a script with revisions and notes. This draft stays as compiled.'}</Caption>
        </View>
      )}
    </Card>
  );

  const page = (
    <Page
      elements={draft.elements}
      provenance={provenance}
      margin={provenance && pageWidth >= MARGIN_FROM}
      onElement={(el) =>
        evidence.show({
          title: el.provenance ? `${PROVENANCE[el.provenance].label} · source` : 'Source',
          eventIds: el.sourceEventIds,
          events,
        })
      }
    />
  );

  return (
    <Screen contentStyle={wide ? styles.wideBoard : undefined}>
      <Stack.Screen options={{ title: `Version ${draft.version}`, headerLargeTitleEnabled: false }} />
      {wide ? (
        <View style={styles.wideRow}>
          <View style={styles.pageColumn}>{page}</View>
          <View style={[styles.side, { width: SIDE }]}>
            {info}
            {provenance && <Key draft={draft} />}
          </View>
        </View>
      ) : (
        <>
          {info}
          {page}
          {provenance && <Key draft={draft} />}
        </>
      )}
      {evidence.sheet}
    </Screen>
  );
}

function ProvenanceSwitch({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Body strong style={styles.grow} importantForAccessibility="no">
        Show provenance
      </Body>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel="Show provenance"
        trackColor={{ true: ink.accent, false: ink.surfaceAlt }}
        thumbColor={Platform.OS === 'ios' ? undefined : ink.surface}
        ios_backgroundColor={ink.surfaceAlt}
      />
    </View>
  );
}

/** The key to the margin stamps: each stamp as it appears on the page, how often, and what it promises. */
function Key({ draft }: { draft: ScreenplayDraft }) {
  const count = (p: Provenance) => draft.elements.filter((e) => e.provenance === p).length;
  const row = (p: Provenance) => (
    <View key={p} style={styles.keyRow} accessible accessibilityLabel={`${PROVENANCE[p].label}: ${count(p)}. ${PROVENANCE[p].describe}`}>
      <View style={styles.keyHead}>
        <Stamp label={PROVENANCE[p].label} color={inkOf(p)} />
        <Body strong style={styles.count}>
          {count(p)}
        </Body>
      </View>
      <Caption>{PROVENANCE[p].describe}</Caption>
    </View>
  );
  return (
    <Card tilt={false}>
      <Heading>Provenance</Heading>
      <Eyebrow>Dialogue</Eyebrow>
      {DIALOGUE.map(row)}
      <Eyebrow>Action</Eyebrow>
      {ACTION.map(row)}
    </Card>
  );
}

const TEXT: Record<ScreenplayElement['type'], TextStyle> = {
  heading: { fontFamily: fonts.typewriterBold, textTransform: 'uppercase' },
  action: {},
  character: { textAlign: 'center', textTransform: 'uppercase' },
  parenthetical: {},
  dialogue: {},
  transition: { textAlign: 'right', textTransform: 'uppercase' },
};
/** Space above each element, as on a typed page. */
const GAP: Record<ScreenplayElement['type'], number> = {
  heading: spacing.xl,
  action: spacing.md,
  character: spacing.lg,
  parenthetical: 0,
  dialogue: 0,
  transition: spacing.lg,
};
/** Proportional indents keep dialogue readable at phone width and still look like a page on tablets. */
const INDENT: Partial<Record<ScreenplayElement['type'], ViewStyle>> = {
  parenthetical: { marginLeft: '18%', marginRight: '14%' },
  dialogue: { marginLeft: '10%', marginRight: '8%' },
};

function Page({
  elements,
  provenance,
  margin,
  onElement,
}: {
  elements: ScreenplayElement[];
  provenance: boolean;
  /** Stamps sit in a right margin (wide pages); otherwise under their line. */
  margin: boolean;
  onElement: (el: ScreenplayElement) => void;
}) {
  if (!elements.length) {
    return (
      <Card tone="sunken">
        <Caption>This draft has no pages.</Caption>
      </Card>
    );
  }
  return (
    <View style={styles.pageWrap}>
      <View style={[styles.pageShadow, paperShadow]}>
        <Paper style={styles.page}>
          <View accessibilityLabel="Screenplay page">
            {elements.map((el, i) => {
              const p = provenance && el.provenance ? el.provenance : undefined;
              const color = p && inkOf(p);
              const text = el.type === 'parenthetical' && !el.text.trim().startsWith('(') ? `(${el.text.trim()})` : el.text;
              const traced = el.sourceEventIds.length > 0;
              const stamp = p && color ? <Stamp label={PROVENANCE[p].label} color={color} style={margin ? styles.stampMargin : styles.stampUnder} /> : null;
              return (
                <Pressable
                  key={el.id}
                  onPress={() => onElement(el)}
                  disabled={!traced}
                  accessibilityRole={traced ? 'button' : 'text'}
                  accessibilityLabel={p ? `${PROVENANCE[p].label}: ${text}` : text}
                  accessibilityHint={traced ? 'Shows the rehearsal moments behind this line' : undefined}
                  style={({ pressed }) => [
                    styles.element,
                    { marginTop: i === 0 ? 0 : GAP[el.type] },
                    pressed && { backgroundColor: alpha(ink.accentText, 0.1) },
                  ]}>
                  {color && <View style={[styles.rule, { backgroundColor: color }]} />}
                  <View style={styles.line}>
                    <View style={[styles.grow, INDENT[el.type]]}>
                      <Text style={[typography.mono, { color: ink.text }, TEXT[el.type]]}>{text}</Text>
                      {!margin && stamp}
                    </View>
                    {margin && <View style={styles.margin}>{stamp}</View>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Paper>
      </View>
      <BinderClip />
    </View>
  );
}

/** Native share sheet on iOS/Android; a file download on web, falling back to the clipboard. */
async function shareText(filename: string, text: string): Promise<'shared' | 'downloaded' | 'copied'> {
  if (Platform.OS !== 'web') {
    await Share.share({ title: filename, message: text });
    return 'shared';
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
}

const styles = StyleSheet.create({
  wideBoard: { maxWidth: BOARD_MAX },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  pageColumn: { flex: 1, minWidth: 0, maxWidth: PAGE_MAX },
  side: { gap: spacing.xl },
  tight: { gap: spacing.xs },
  grow: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  keyRow: { gap: spacing.xs },
  keyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  count: { fontVariant: ['tabular-nums'] },
  pageWrap: { paddingTop: spacing.sm },
  pageShadow: { borderRadius: 2 },
  page: { paddingVertical: spacing.xxl + spacing.sm },
  element: { paddingHorizontal: PAGE_X, paddingVertical: 1 },
  rule: { position: 'absolute', left: 9, top: 3, bottom: 3, width: 2, borderRadius: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start' },
  margin: { width: STAMP_MARGIN, alignItems: 'flex-end', paddingLeft: spacing.md },
  stampMargin: { alignSelf: 'flex-end', marginTop: 1 },
  stampUnder: { alignSelf: 'flex-end', marginTop: spacing.xs },
});
