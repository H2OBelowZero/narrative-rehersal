// One script on the desk: the typed page to write on, and beside it (in a sheet on phones) its revisions, the changes
// made since the last one and by whom, and the notes left on its lines.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { printed } from '@shared/screenplay-layout';
import type { Script, ScriptElementType } from '@shared/types';

import { BlindLock, useBlindSession } from '@/components/discover/blind-lock';
import { BOARD_MAX, SIDE, useBoard } from '@/components/discover/board-bits';
import { clockTime, ELEMENT_ORDER, latestRevision, pageCount, pendingChanges, revisionColor, UPPER } from '@/components/write/format';
import { ScriptEditor } from '@/components/write/script-editor';
import { ScriptToolbar } from '@/components/write/script-toolbar';
import { ScriptPanel, type PanelTab } from '@/components/write/script-panel';
import { useScriptDraft, type SaveState } from '@/components/write/use-script-draft';
import { Button, Caption, Card, EmptyState, IconButton, Screen, Sheet } from '@/components/ui';
import { useFocusPrefs } from '@/lib/focus-prefs';
import { useProject } from '@/lib/session';
import { fonts, palettes, spacing } from '@/theme';

export default function ScriptScreen() {
  const { scriptId } = useLocalSearchParams<{ scriptId: string }>();
  const { project, projectId } = useProject();
  const blind = useBlindSession();
  if (!project) return null;
  const script = project.scripts.find((s) => s.id === scriptId);
  // Keyed so another script never inherits this one's unsaved working copy.
  if (script && !blind) return <ScriptDesk key={script.id} script={script} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Script', headerLargeTitleEnabled: false }} />
      {blind ? (
        <BlindLock />
      ) : (
        <EmptyState
          icon="script"
          title="Script not found"
          message="It may have been deleted, or it belongs to another project."
          action={{ label: 'All scripts', onPress: () => router.dismissTo({ pathname: '/project/[id]/write', params: { id: projectId } }) }}
        />
      )}
    </Screen>
  );
}

function ScriptDesk({ script }: { script: Script }) {
  const { can } = useProject();
  const { wide, inner } = useBoard();
  const draft = useScriptDraft(script);
  const editable = can('editModel');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>('revisions');
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; at: number } | null>(null);
  const { panelCollapsed, navCollapsed, setFocusPrefs } = useFocusPrefs();
  const { width: windowWidth } = useWindowDimensions();
  // The page is laid out from the width it really gets, so its columns wrap exactly where the pagination counts.
  const [measured, setMeasured] = useState(0);
  const side = wide && !panelCollapsed;

  const revised = new Set(pendingChanges(script).map((c) => c.elementId));
  const notes = new Map<string, number>();
  for (const c of script.comments) if (!c.resolved && c.elementId) notes.set(c.elementId, (notes.get(c.elementId) ?? 0) + 1);
  const focused = draft.elements.find((e) => e.id === focusedId) ?? null;
  const pageWidth = measured || (side ? inner - SIDE - spacing.xl : inner);
  const togglePanel = () => setFocusPrefs({ panelCollapsed: !panelCollapsed });

  const retype = (type: ScriptElementType) => {
    if (!focused) return;
    const text = UPPER.has(type) ? focused.text.toUpperCase() : type === 'parenthetical' ? printed({ type, text: focused.text }) : focused.text;
    draft.edit(draft.elements.map((e) => (e.id === focused.id ? { ...e, type, text } : e)), [focused.id]);
    setFocusRequest({ id: focused.id, at: Date.now() }); // web blurs the line when a chip is clicked
  };

  const openPanel = (t: PanelTab) => {
    setTab(t);
    if (!wide) setPanelOpen(true);
  };

  const noteOnLine = () => {
    if (!focused) return;
    setAnchorId(focused.id);
    openPanel('notes');
  };

  const jump = (id: string) => {
    setPanelOpen(false);
    setFocusedId(id);
    setFocusRequest({ id, at: Date.now() });
  };

  const panel = (
    <ScriptPanel
      script={script}
      tab={tab}
      onTab={setTab}
      anchorId={anchorId}
      onClearAnchor={() => setAnchorId(null)}
      onJump={jump}
      saved={draft.state === 'saved'}
    />
  );

  // Keyboard shortcuts on the web: Alt+1–7 sets the line's type, Alt+N notes it, Alt+P shows or hides the panel.
  const shortcuts = useRef({ retype, noteOnLine, togglePanel, wide });
  useEffect(() => {
    shortcuts.current = { retype, noteOnLine, togglePanel, wide };
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const s = shortcuts.current;
      const digit = /^Digit([1-7])$/.exec(e.code);
      if (digit) s.retype(ELEMENT_ORDER[Number(digit[1]) - 1]!);
      else if (e.code === 'KeyN') s.noteOnLine();
      else if (e.code === 'KeyP' && s.wide) s.togglePanel();
      else return;
      e.preventDefault();
    };
    // Capture phase: react-native-web's TextInput stops keydown from bubbling out of the line being typed.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const page = (
    <ScriptEditor
      elements={draft.elements}
      editable={editable}
      revised={revised}
      notes={notes}
      focusedId={focusedId}
      onFocusLine={setFocusedId}
      onEdit={draft.edit}
      width={pageWidth}
      focusRequest={focusRequest}
    />
  );

  return (
    <Screen
      keyboard
      contentStyle={wide ? styles.wideBoard : undefined}
      header={
        editable ? (
          <ScriptToolbar
            type={focused?.type ?? null}
            onType={retype}
            onNote={noteOnLine}
            wide={wide}
            labels={windowWidth - (navCollapsed ? 72 : 232) >= 1040}
            panel={wide ? { collapsed: panelCollapsed, onToggle: togglePanel } : undefined}
          />
        ) : undefined
      }>
      <Stack.Screen
        options={{
          title: draft.title || 'Untitled',
          headerLargeTitleEnabled: false,
          headerRight: () => (
            <View style={styles.headerRight}>
              <SaveStatus state={draft.state} at={script.updatedAt} onRetry={draft.retry} />
              {!wide && (
                <IconButton icon="history" accessibilityLabel="Revisions, changes and notes" onPress={() => openPanel(tab)} />
              )}
            </View>
          ),
        }}
      />
      <TitleCard script={script} title={draft.title} onTitle={draft.setTitle} editable={editable} elements={draft.elements.length} onPanel={openPanel} wide={wide} />
      <View style={styles.wideRow}>
        <View style={styles.pageColumn} onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
          {page}
        </View>
        {side && (
          <View style={[styles.side, { width: SIDE }]}>
            <Card tilt={false}>{panel}</Card>
          </View>
        )}
      </View>
      {!wide && (
        <Sheet visible={panelOpen} onClose={() => setPanelOpen(false)} title={draft.title || 'Script'}>
          {panel}
        </Sheet>
      )}
    </Screen>
  );
}

/** The title page slip: working title, the colour the pages are on, and what is waiting to be revised. */
function TitleCard({
  script,
  title,
  onTitle,
  editable,
  elements,
  onPanel,
  wide,
}: {
  script: Script;
  title: string;
  onTitle: (t: string) => void;
  editable: boolean;
  elements: number;
  onPanel: (t: PanelTab) => void;
  wide: boolean;
}) {
  const colors = palettes.paper; // read here, outside the card's surface
  const { project } = useProject();
  const rev = latestRevision(script);
  const color = revisionColor(rev?.number ?? 1);
  const pending = pendingChanges(script).length;
  const notes = script.comments.filter((c) => !c.resolved).length;
  const by = project?.participants.find((p) => p.id === script.updatedBy)?.name;
  const pages = pageCount(script.elements);

  return (
    <Card pin="brass" tilt="script-title">
      {editable ? (
        <TextInput
          value={title}
          onChangeText={onTitle}
          accessibilityLabel="Script title"
          placeholder="Untitled"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accentText}
          style={[styles.title, { color: colors.text, borderBottomColor: colors.border }]}
        />
      ) : (
        <Caption tone="primary" style={[styles.title, { color: colors.text }]}>
          {title}
        </Caption>
      )}
      <Caption>
        {color.name} pages, revision {rev?.number ?? 1} · ~{pages} {pages === 1 ? 'page' : 'pages'}, {elements} lines
        {by ? ` · last typed by ${by}` : ''}
      </Caption>
      {pending > 0 && (
        <Card tone="sunken">
          <Caption tone="primary">
            {pending} {pending === 1 ? 'change' : 'changes'} since the {color.name} pages, not yet filed in a revision. They carry an asterisk in
            the margin.
          </Caption>
        </Card>
      )}
      {!wide && (
        <View style={styles.actions}>
          <Button title="Revisions" icon="history" variant="secondary" size="sm" onPress={() => onPanel('revisions')} />
          <Button title={pending ? `Changes ${pending}` : 'Changes'} icon="edit" variant="secondary" size="sm" onPress={() => onPanel('changes')} />
          <Button title={notes ? `Notes ${notes}` : 'Notes'} icon="bookmark" variant="secondary" size="sm" onPress={() => onPanel('notes')} />
        </View>
      )}
      {!editable && <Caption tone="tertiary">You can read this script and leave notes. Writers, producers, directors and the owner type on it.</Caption>}
    </Card>
  );
}

function SaveStatus({ state, at, onRetry }: { state: SaveState; at: string; onRetry: () => void }) {
  if (state === 'failed') return <Button title="Not saved · Retry" variant="ghost" size="sm" icon="refresh" onPress={onRetry} />;
  const label = state === 'saving' ? 'Saving…' : state === 'unsaved' ? 'Editing' : `Saved ${clockTime(at)}`;
  return (
    <Caption tone="secondary" style={styles.status} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      {label}
    </Caption>
  );
}

const desk = palettes.desk;
const styles = StyleSheet.create({
  wideBoard: { maxWidth: BOARD_MAX },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  pageColumn: { flex: 1, minWidth: 0 },
  side: { gap: spacing.xl, ...(Platform.OS === 'web' ? ({ position: 'sticky', top: spacing.lg } as object) : null) },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  status: { color: desk.textSecondary, fontStyle: 'italic', marginRight: spacing.xs },
  // Positioned so it paints above the card's paper texture on web (inputs aren't, by default).
  title: {
    position: 'relative',
    fontFamily: fonts.typewriterBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1.5,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
