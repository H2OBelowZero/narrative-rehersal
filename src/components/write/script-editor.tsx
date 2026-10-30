// The typed page you write on, to the industry standard: US Letter, 12-point Courier, 1.5" left margin and 1" right,
// top and bottom, with each element at its standard column (cue 3.7" from the left edge, dialogue 2.5"–6", transitions
// flush right). Pages break at 54 lines and are numbered top right from page 2. Wide screens show the page at true
// proportions; phones keep the same columns and page breaks at a readable type size.
// Enter starts the element that usually follows, Tab cycles the type, Backspace on an empty line takes it away.
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextStyle,
} from 'react-native';

import { COLUMN, columns, LINES_PER_PAGE, PAGE, paginate, placement, printed, wrappedLines, type Pagination } from '@shared/screenplay-layout';
import type { ScriptElement, ScriptElementType } from '@shared/types';

import { Paper, paperShadow } from '@/components/board/paper';
import { BinderClip } from '@/components/discover/board-bits';
import { Icon } from '@/components/ui';
import { alpha, fonts, palettes, spacing } from '@/theme';

import { cycleType, ELEMENT_LABEL, inferType, newElementId, NEXT, PLACEHOLDER, UPPER } from './format';

/** Everything on the page is ink on paper. */
const ink = palettes.paper;

/** Below this width the page can't be drawn at true proportions with legible 12-point type. */
const TRUE_PAGE_FROM = 600;
/** Never larger than a Letter page at 96 dpi. */
const MAX_PPI = 96;
/** Phone type size, with standard Courier's 6-lines-to-the-inch rhythm kept in proportion. */
const COMPACT_FONT = 13;

interface Geometry {
  font: number;
  line: number;
  /** Page edge to text, in px. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Full page height in px when drawn true to size, else null (phones). */
  page: number | null;
  numberTop: number;
}

function geometry(width: number): Geometry {
  if (width >= TRUE_PAGE_FROM) {
    const ppi = Math.min(width / PAGE.width, MAX_PPI);
    // 12pt = 1/6"; Courier advances 0.6 em, so 10 characters fill an inch exactly.
    return {
      font: ppi / 6,
      line: ppi / 6,
      left: PAGE.left * ppi,
      right: PAGE.right * ppi,
      top: PAGE.top * ppi,
      bottom: PAGE.bottom * ppi,
      page: PAGE.height * ppi,
      numberTop: PAGE.numberTop * ppi,
    };
  }
  return { font: COMPACT_FONT, line: Math.round(COMPACT_FONT * 1.35), left: 30, right: 26, top: 36, bottom: 36, page: null, numberTop: 12 };
}

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
  /** Width the page may take. */
  width: number;
  /** Set by the parent to move the caret (a note or change tapped in the panel). */
  focusRequest?: { id: string; at: number } | null;
}

export function ScriptEditor({ elements, editable, revised, notes, focusedId, onFocusLine, onEdit, width, focusRequest }: ScriptEditorProps) {
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

  const g = geometry(width);
  const pages = paginate(elements);
  const pageWidth = g.page ? (g.page / PAGE.height) * PAGE.width : width;
  // Columns each element really gets: the standard on a true page, as many as fit on a phone.
  const colsFor = (t: ScriptElementType) =>
    g.page ? columns(t) : Math.max(8, Math.floor((placement(t).width * (pageWidth - g.left - g.right)) / (g.font * 0.6)));

  const shape = (type: ScriptElementType, t: string, closing = false) => {
    if (UPPER.has(type)) return t.toUpperCase();
    if (type !== 'parenthetical' || !t.trim()) return t;
    // Parentheticals carry their own parentheses: opened as you type, closed when you move on.
    const open = t.startsWith('(') ? t : `(${t}`;
    return closing && !open.trimEnd().endsWith(')') ? `${open.trimEnd()})` : open;
  };

  const change = (index: number, raw: string) => {
    const el = elements[index]!;
    if (!raw.includes('\n')) {
      onEdit(elements.map((e, i) => (i === index ? { ...e, text: shape(e.type, raw) } : e)), [el.id]);
      return;
    }
    // Enter (or a pasted paragraph): end this line and start the next ones.
    const [first = '', ...more] = raw.split('\n');
    const rest = more.filter((p, i) => p.trim() || i === more.length - 1);
    const type = inferType(el.type, first);
    const current = { ...el, type, text: shape(type, first, true) };
    let prev = type;
    const added = rest.map((text, i) => {
      const t = i === 0 ? NEXT[prev] : inferType('action', text);
      prev = t;
      return { id: newElementId(), type: t, text: shape(t, text) };
    });
    onEdit([...elements.slice(0, index), current, ...added, ...elements.slice(index + 1)], [current.id, ...added.map((a) => a.id)]);
    setFocusNext(added.at(-1)?.id ?? current.id);
  };

  const leave = (index: number) => {
    const el = elements[index];
    if (!el || el.type !== 'parenthetical') return;
    const closed = shape(el.type, el.text, true);
    if (closed !== el.text) onEdit(elements.map((e, i) => (i === index ? { ...e, text: closed } : e)), [el.id]);
  };

  const retype = (index: number, type: ScriptElementType) => {
    const el = elements[index]!;
    if (el.type === type) return;
    onEdit(elements.map((e, i) => (i === index ? { ...e, type, text: shape(type, el.text) } : e)), [el.id]);
  };

  const key = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const el = elements[index]!;
    const k = e.nativeEvent.key;
    if (k === 'Backspace' && el.text === '' && elements.length > 1) {
      e.preventDefault?.();
      // An empty line that isn't what usually follows first turns back into action, as screenwriting software does.
      if (el.type !== 'action' && el.type !== NEXT[elements[index - 1]?.type ?? 'heading']) {
        retype(index, 'action');
        return;
      }
      onEdit(elements.filter((_, i) => i !== index), [], [el.id]);
      setFocusNext((index === 0 ? elements[1] : elements[index - 1])!.id);
    } else if (k === 'Tab') {
      e.preventDefault?.();
      retype(index, cycleType(el.type, (e.nativeEvent as { shiftKey?: boolean }).shiftKey ? -1 : 1));
    }
  };

  const sceneNo = new Map<string, number>();
  for (const el of elements) if (el.type === 'heading') sceneNo.set(el.id, sceneNo.size + 1);
  const type: TextStyle = { fontFamily: fonts.typewriter, fontSize: g.font, lineHeight: g.line, color: ink.text };

  const addLine = () => {
    const last = elements.at(-1);
    const id = newElementId();
    onEdit([...elements, { id, type: last ? NEXT[last.type] : 'heading', text: '' }], [id]);
    setFocusNext(id);
  };

  return (
    <View style={[styles.wrap, { width: pageWidth }]}>
      <View style={[styles.shadow, paperShadow]}>
        <Paper style={{ paddingTop: g.top, paddingLeft: g.left, paddingRight: g.right, paddingBottom: g.bottom }}>
          <View accessibilityLabel="Screenplay page">
            {elements.map((el, i) => {
              const at = pages.placed.get(el.id)!;
              const startsPage = i > 0 && at.page !== pages.placed.get(elements[i - 1]!.id)!.page;
              const focused = focusedId === el.id;
              const noteCount = notes.get(el.id) ?? 0;
              const place = placement(el.type);
              const scene = sceneNo.get(el.id);
              return (
                <Fragment key={el.id}>
                  {startsPage && <PageBreak g={g} pages={pages} ending={at.page - 1} />}
                  <View
                    style={[
                      styles.row,
                      { marginTop: at.blank * g.line, minHeight: g.line },
                      focused && editable && { backgroundColor: alpha(ink.accentText, 0.07) },
                    ]}>
                    {scene !== undefined && (
                      <Text style={[type, styles.margin, { left: -g.left, width: g.left - g.font * 1.6, textAlign: 'right' }]} accessibilityLabel={`Scene ${scene}`}>
                        {scene}
                      </Text>
                    )}
                    <View style={[styles.margin, styles.marks, { right: -g.right, width: g.right, height: g.line }]} pointerEvents="none">
                      {scene !== undefined && g.page ? <Text style={type}>{scene}</Text> : null}
                      {revised.has(el.id) && (
                        <Text style={[type, { fontFamily: fonts.typewriterBold }]} accessibilityLabel="Revised since the last revision">
                          *
                        </Text>
                      )}
                      {noteCount > 0 && <Icon name="bookmark" size={Math.max(11, g.font * 0.8)} color={ink.accentText} />}
                    </View>
                    <View style={{ marginLeft: `${place.left * 100}%`, width: `${place.width * 100}%` }}>
                      <LineInput
                        element={el}
                        textStyle={[type, el.type === 'heading' && { fontFamily: fonts.typewriterBold }, COLUMN[el.type].align === 'right' && { textAlign: 'right' }]}
                        line={g.line}
                        cols={colsFor(el.type)}
                        editable={editable}
                        focused={focused}
                        lonely={elements.length === 1}
                        inputRef={(r) => {
                          if (r) inputs.current.set(el.id, r);
                          else inputs.current.delete(el.id);
                        }}
                        onFocus={() => onFocusLine(el.id)}
                        onBlur={() => leave(i)}
                        onChangeText={(t) => change(i, t)}
                        onKeyPress={(e) => key(i, e)}
                        noteCount={noteCount}
                      />
                    </View>
                  </View>
                </Fragment>
              );
            })}
          </View>
          {/* The rest of the last page: tap it to add a line at the end. */}
          <Pressable
            onPress={editable ? addLine : undefined}
            disabled={!editable}
            accessibilityRole={editable ? 'button' : undefined}
            accessibilityLabel={editable ? 'Add a line at the end' : undefined}
            style={{ minHeight: g.page ? Math.max(g.line * 2, (LINES_PER_PAGE - pages.used.at(-1)!) * g.line) : g.line * 5 }}
          />
        </Paper>
      </View>
      <BinderClip />
    </View>
  );
}

/** The foot of one page and the head of the next: the rest of the page left blank, a gap of cork, the new number. */
function PageBreak({ g, pages, ending }: { g: Geometry; pages: Pagination; ending: number }) {
  if (!g.page) {
    // Phones: a perforation across the sheet with the next page's number, where the printed page would turn.
    return (
      <View style={[styles.perforation, { marginLeft: -g.left, marginRight: -g.right, marginVertical: g.line }]} accessibilityLabel={`Page ${ending + 1}`}>
        <View style={styles.dash} />
        <Text style={styles.compactNumber}>{ending + 1}.</Text>
      </View>
    );
  }
  const unused = Math.max(0, LINES_PER_PAGE - pages.used[ending - 1]!);
  return (
    <View accessibilityLabel={`Page ${ending + 1}`}>
      <View style={{ height: unused * g.line + g.bottom }} />
      <View style={[styles.gap, { marginLeft: -g.left, marginRight: -g.right }]} />
      {/* "2." half an inch down, flush with the right margin. Page 1 carries no number. */}
      <View style={{ height: g.top }}>
        <Text style={[styles.number, { top: g.numberTop, right: 0, fontSize: g.font, lineHeight: g.line }]}>{ending + 1}.</Text>
      </View>
    </View>
  );
}

function LineInput({
  element: el,
  textStyle,
  line,
  cols,
  editable,
  focused,
  lonely,
  inputRef,
  onFocus,
  onBlur,
  onChangeText,
  onKeyPress,
  noteCount,
}: {
  element: ScriptElement;
  textStyle: (TextStyle | false)[];
  line: number;
  cols: number;
  editable: boolean;
  focused: boolean;
  lonely: boolean;
  inputRef: (r: TextInput | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onChangeText: (t: string) => void;
  onKeyPress: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  noteCount: number;
}) {
  // Height comes from the same typewriter wrap the pagination counts (Courier is monospaced, so it is exact). A web
  // textarea can only report growing heights; native inputs measure themselves too, and the taller answer wins.
  const [native, setNative] = useState(0);
  const height = Math.max(wrappedLines(printed(el), cols) * line, Platform.OS === 'web' ? 0 : native);
  const label = `${ELEMENT_LABEL[el.type]}${noteCount ? `, ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}` : ''}`;

  if (!editable) {
    return (
      <Text style={textStyle} accessibilityLabel={`${label}: ${printed(el)}`}>
        {printed(el) || ' '}
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
      autoCapitalize={UPPER.has(el.type) ? 'characters' : el.type === 'parenthetical' ? 'none' : 'sentences'}
      autoCorrect={el.type === 'action' || el.type === 'dialogue'}
      spellCheck={el.type === 'action' || el.type === 'dialogue'}
      placeholder={focused || lonely ? PLACEHOLDER[el.type] : undefined}
      placeholderTextColor={ink.textTertiary}
      selectionColor={ink.accentText}
      cursorColor={ink.accentText}
      accessibilityLabel={label}
      onFocus={onFocus}
      onBlur={onBlur}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      onContentSizeChange={Platform.OS === 'web' ? undefined : (e) => setNative(Math.ceil(e.nativeEvent.contentSize.height))}
      style={[...textStyle, styles.input, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', maxWidth: '100%', paddingTop: spacing.sm },
  shadow: { borderRadius: 2 },
  row: { position: 'relative' },
  margin: { position: 'absolute', top: 0 },
  marks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  input: {
    // Positioned so it paints above the paper texture on web (inputs aren't, by default).
    position: 'relative',
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as object) : null),
  },
  gap: {
    height: spacing.xl,
    backgroundColor: palettes.desk.surface,
    ...Platform.select({
      web: { boxShadow: 'inset 0 4px 6px -2px rgba(0,0,0,0.55), inset 0 -3px 5px -2px rgba(0,0,0,0.45)' } as object,
      default: {},
    }),
  },
  number: { position: 'absolute', fontFamily: fonts.typewriter, color: ink.text },
  perforation: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  dash: { flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: ink.border },
  compactNumber: { fontFamily: fonts.typewriter, fontSize: 12, color: ink.textSecondary },
});
