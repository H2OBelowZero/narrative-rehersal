// The typed page you write on: one Courier line per screenplay element, laid out to the industry format. Enter starts
// the element that usually follows, Tab (or the type strip) changes it, Backspace on an empty line takes it away.
// Scene numbers sit in the left margin; revised lines carry the revision asterisk in the right one.
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import type { ScriptElement, ScriptElementType } from '@shared/types';

import { Paper, paperShadow } from '@/components/board/paper';
import { BinderClip } from '@/components/discover/board-bits';
import { Chip, Icon, haptics } from '@/components/ui';
import { alpha, fonts, palettes, spacing, typography } from '@/theme';

import {
  cycleType,
  ELEMENT_LABEL,
  ELEMENT_ORDER,
  GAP,
  INDENT,
  inferType,
  newElementId,
  NEXT,
  PLACEHOLDER,
  TEXT,
  UPPER,
} from './format';

/** Everything on the page is ink on paper. */
const ink = palettes.paper;

export interface ScriptEditorProps {
  elements: ScriptElement[];
  editable: boolean;
  /** Lines changed since the last revision: they carry the asterisk. */
  revised: Set<string>;
  /** Open notes per line. */
  notes: Map<string, number>;
  focusedId: string | null;
  onFocusLine: (id: string) => void;
  onEdit: (next: ScriptElement[], touched: string[], removed?: string[]) => void;
  /** Wide pages get real margins. */
  roomy: boolean;
  /** Set by the parent to move the caret (a note or change tapped in the panel). */
  focusRequest?: { id: string; at: number } | null;
}

export function ScriptEditor({ elements, editable, revised, notes, focusedId, onFocusLine, onEdit, roomy, focusRequest }: ScriptEditorProps) {
  const inputs = useRef(new Map<string, TextInput>());
  // A blank script opens with the caret on its first scene heading.
  const [focusNext, setFocusNext] = useState<string | null>(() =>
    editable && elements.length === 1 && !elements[0]!.text ? elements[0]!.id : null,
  );

  useEffect(() => {
    if (!focusNext) return;
    inputs.current.get(focusNext)?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot caret move once the new line is mounted
    setFocusNext(null);
  }, [focusNext, elements]);

  useEffect(() => {
    if (focusRequest) inputs.current.get(focusRequest.id)?.focus();
  }, [focusRequest]);

  const change = (index: number, raw: string) => {
    const el = elements[index]!;
    const upper = (type: ScriptElementType, t: string) => (UPPER.has(type) ? t.toUpperCase() : t);
    if (!raw.includes('\n')) {
      onEdit(elements.map((e, i) => (i === index ? { ...e, text: upper(e.type, raw) } : e)), [el.id]);
      return;
    }
    // Enter (or a pasted paragraph): end this line and start the next ones.
    const [first = '', ...more] = raw.split('\n');
    const rest = more.filter((p, i) => p.trim() || i === more.length - 1);
    const type = inferType(el.type, first);
    const current = { ...el, type, text: upper(type, first) };
    let prev = type;
    const added = rest.map((text, i) => {
      const t = i === 0 ? NEXT[prev] : inferType('action', text);
      prev = t;
      return { id: newElementId(), type: t, text: upper(t, text) };
    });
    const next = [...elements.slice(0, index), current, ...added, ...elements.slice(index + 1)];
    onEdit(next, [current.id, ...added.map((a) => a.id)]);
    setFocusNext(added.at(-1)?.id ?? current.id);
  };

  const key = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const el = elements[index]!;
    const k = e.nativeEvent.key;
    if (k === 'Backspace' && el.text === '' && elements.length > 1) {
      e.preventDefault?.();
      // An empty line that isn't action first turns back into action, as screenwriting software does.
      if (el.type !== 'action' && el.type !== NEXT[elements[index - 1]?.type ?? 'heading']) {
        retype(index, 'action');
        return;
      }
      onEdit(elements.filter((_, i) => i !== index), [], [el.id]);
      setFocusNext(elements[Math.max(0, index - 1)]!.id === el.id ? elements[1]!.id : elements[Math.max(0, index - 1)]!.id);
    } else if (k === 'Tab') {
      e.preventDefault?.();
      retype(index, cycleType(el.type, (e.nativeEvent as { shiftKey?: boolean }).shiftKey ? -1 : 1));
    }
  };

  const retype = (index: number, type: ScriptElementType) => {
    const el = elements[index]!;
    if (el.type === type) return;
    const text = UPPER.has(type) ? el.text.toUpperCase() : el.text;
    onEdit(elements.map((e, i) => (i === index ? { ...e, type, text } : e)), [el.id]);
  };

  const sceneNo = new Map<string, number>();
  for (const el of elements) if (el.type === 'heading') sceneNo.set(el.id, sceneNo.size + 1);
  const pad = roomy ? 56 : 30;

  return (
    <View style={styles.wrap}>
      <View style={[styles.shadow, paperShadow]}>
        <Paper style={styles.page}>
          <View accessibilityLabel="Screenplay page">
            {elements.map((el, i) => {
              const focused = focusedId === el.id;
              const noteCount = notes.get(el.id) ?? 0;
              return (
                <View
                  key={el.id}
                  style={[
                    styles.line,
                    { marginTop: i === 0 ? 0 : GAP[el.type], paddingHorizontal: pad },
                    focused && editable && styles.focused,
                  ]}>
                  {el.type === 'heading' && (
                    <Text style={[styles.margin, styles.sceneNo, { left: 0, width: pad - 6 }]} accessibilityLabel={`Scene ${sceneNo.get(el.id)}`}>
                      {sceneNo.get(el.id)}
                    </Text>
                  )}
                  <View style={[styles.margin, styles.marks, { right: 0, width: pad - 4 }]} pointerEvents="none">
                    {revised.has(el.id) && (
                      <Text style={styles.asterisk} accessibilityLabel="Revised since the last revision">
                        *
                      </Text>
                    )}
                    {noteCount > 0 && <Icon name="bookmark" size={12} color={ink.accentText} />}
                  </View>
                  <View style={INDENT[el.type]}>
                    <LineInput
                      element={el}
                      editable={editable}
                      focused={focused}
                      lonely={elements.length === 1}
                      inputRef={(r) => {
                        if (r) inputs.current.set(el.id, r);
                        else inputs.current.delete(el.id);
                      }}
                      onFocus={() => onFocusLine(el.id)}
                      onChangeText={(t) => change(i, t)}
                      onKeyPress={(e) => key(i, e)}
                      noteCount={noteCount}
                    />
                  </View>
                </View>
              );
            })}
          </View>
          {editable && (
            <Pressable
              onPress={() => {
                const last = elements.at(-1);
                const id = newElementId();
                onEdit([...elements, { id, type: last ? NEXT[last.type] : 'heading', text: '' }], [id]);
                setFocusNext(id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Add a line at the end"
              style={[styles.tail, { marginHorizontal: pad }]}
            />
          )}
        </Paper>
      </View>
      <BinderClip />
    </View>
  );
}

function LineInput({
  element: el,
  editable,
  focused,
  lonely,
  inputRef,
  onFocus,
  onChangeText,
  onKeyPress,
  noteCount,
}: {
  element: ScriptElement;
  editable: boolean;
  focused: boolean;
  lonely: boolean;
  inputRef: (r: TextInput | null) => void;
  onFocus: () => void;
  onChangeText: (t: string) => void;
  onKeyPress: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  noteCount: number;
}) {
  const [height, setHeight] = useState(typography.mono.lineHeight);
  const text = el.type === 'parenthetical' && el.text && !el.text.startsWith('(') ? `(${el.text})` : el.text;
  const style = [typography.mono, styles.input, TEXT[el.type], { color: ink.text, height: Math.max(height, typography.mono.lineHeight) }];
  const label = `${ELEMENT_LABEL[el.type]}${noteCount ? `, ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}` : ''}`;

  if (!editable) {
    return (
      <Text style={[typography.mono, TEXT[el.type], { color: ink.text }]} accessibilityLabel={`${label}: ${text}`}>
        {text || ' '}
      </Text>
    );
  }
  return (
    <TextInput
      ref={inputRef}
      value={el.text}
      multiline
      scrollEnabled={false}
      submitBehavior="newline"
      autoCapitalize={UPPER.has(el.type) ? 'characters' : 'sentences'}
      autoCorrect={el.type === 'action' || el.type === 'dialogue'}
      spellCheck={el.type === 'action' || el.type === 'dialogue'}
      placeholder={focused || lonely ? PLACEHOLDER[el.type] : undefined}
      placeholderTextColor={ink.textTertiary}
      selectionColor={ink.accentText}
      cursorColor={ink.accentText}
      accessibilityLabel={label}
      onFocus={onFocus}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      onContentSizeChange={(e) => setHeight(Math.ceil(e.nativeEvent.contentSize.height))}
      style={style}
    />
  );
}

/** The element-type strip over the keyboard: what the current line is, and a tap to make it something else. */
export function TypeStrip({
  type,
  onType,
  onNote,
}: {
  type: ScriptElementType | null;
  onType: (t: ScriptElementType) => void;
  onNote: () => void;
}) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityRole="toolbar"
      accessibilityLabel="Line type">
      {ELEMENT_ORDER.map((t) => (
        <Chip
          key={t}
          label={ELEMENT_LABEL[t]}
          selected={type === t}
          disabled={!type}
          onPress={() => {
            haptics.selection();
            onType(t);
          }}
        />
      ))}
      <Chip label="Note on line" icon="bookmark" disabled={!type} onPress={onNote} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.sm },
  shadow: { borderRadius: 2 },
  page: { paddingVertical: spacing.xxl + spacing.sm },
  line: { paddingVertical: 1 },
  focused: { backgroundColor: alpha(ink.accentText, 0.07) },
  margin: { position: 'absolute', top: 1 },
  sceneNo: { ...typography.mono, fontFamily: fonts.typewriterBold, color: ink.text, textAlign: 'right' },
  marks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, height: typography.mono.lineHeight },
  asterisk: { ...typography.mono, fontFamily: fonts.typewriterBold, color: ink.text },
  input: {
    position: 'relative',
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as object) : null),
  },
  tail: { minHeight: 88, marginTop: spacing.md },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' },
});
