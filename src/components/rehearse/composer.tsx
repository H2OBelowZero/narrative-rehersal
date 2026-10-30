// Freeform action input (PRD §18, §47): performers act as their assigned character; the owner and directors
// may act as anyone in the scene, or switch to narration / staging notes. Lives on the desk below the board
// (the Screen footer): the words are typed onto a strip of paper, the way a line goes into the typewriter.
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import type { Character } from '@shared/types';

import { characterImage } from '@/components/board/materials';
import { Paper, paperShadow, Polaroid } from '@/components/board/paper';
import { followString } from '@/components/string-nav';
import {
  Button,
  Caption,
  Chip,
  Icon,
  IconButton,
  List,
  ListRow,
  pressedStyle,
  SegmentedControl,
  Sheet,
} from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useProject } from '@/lib/session';
import { fonts, palettes, radii, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { GoalSegments } from './scene-cards';

type Mode = 'act' | 'narrate';
const MODES = [
  { value: 'act', label: 'Act' },
  { value: 'narrate', label: 'Narrate' },
] as const;

const ink = palettes.paper;

function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * iOS tab screens extend under the tab bar, so the composer pads itself by the native safe area —
 * except while the keyboard is up (it covers the tab bar). Android's native tabs already inset the screen.
 */
export function AboveTabBar({ children }: { children: ReactNode }) {
  const keyboard = useKeyboardShown();
  if (Platform.OS !== 'ios') return children;
  return (
    <SafeAreaView edges={{ bottom: !keyboard }} style={styles.safeArea}>
      {children}
    </SafeAreaView>
  );
}

export interface TypewriterStripProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Spoken name of the input. */
  label: string;
  /** Spoken name of the send key. */
  sendLabel: string;
  onSend: () => void;
  busy?: boolean;
  maxLength?: number;
  maxHeight?: number;
}

/** A strip of paper on the desk with the line being typed, and a round typewriter key to send it. */
export function TypewriterStrip({
  value,
  onChangeText,
  placeholder,
  label,
  sendLabel,
  onSend,
  busy = false,
  maxLength = 1000,
  maxHeight = 132,
}: TypewriterStripProps) {
  return (
    <View style={[styles.stripShadow, paperShadow]}>
      <Paper style={styles.strip}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!busy}
          multiline
          maxLength={maxLength}
          placeholder={placeholder}
          accessibilityLabel={label}
          placeholderTextColor={ink.textTertiary}
          selectionColor={ink.accentSoft}
          cursorColor={ink.text}
          style={[styles.typed, { color: ink.text, maxHeight }, busy && styles.dim]}
        />
        {busy ? (
          <View style={styles.key}>
            <ActivityIndicator color={ink.text} />
          </View>
        ) : (
          <IconButton
            icon="send"
            size={18}
            color={ink.onAccent}
            accessibilityLabel={sendLabel}
            disabled={!value.trim()}
            onPress={onSend}
            style={[styles.key, styles.keyCap]}
          />
        )}
      </Paper>
    </View>
  );
}

const roleLabel = (c: Character) => c.role[0]!.toUpperCase() + c.role.slice(1);

/**
 * Who I act as: performers only as their own character; the owner and directors as `picked`, else the
 * protagonist (or whoever is present).
 */
export function useActor(picked: string | null) {
  const { project, me, scene, protagonist, character } = useProject();
  const performer = me?.role === 'performer';
  const present = scene?.presentCharacterIds.length ? scene.presentCharacterIds : (project?.model.characters.map((c) => c.id) ?? []);
  const cast = present.map((id) => character(id)).filter((c): c is Character => !!c);
  const fallbackId = cast.find((c) => c.id === protagonist?.id)?.id ?? cast[0]?.id;
  const actingId = performer ? me?.characterId : picked && cast.some((c) => c.id === picked) ? picked : fallbackId;
  return { cast, actingId, performer };
}

export interface ComposerProps {
  /** The character the owner/director chose to act as (lifted so the stage offers moves for the same one). */
  picked: string | null;
  onPick: (characterId: string) => void;
}

export function Composer({ picked, onPick }: ComposerProps) {
  const { colors } = useTheme();
  const { projectId, project, me, can, sim, sequence, charName, call } = useProject();
  const { cast, actingId, performer } = useActor(picked);
  const [mode, setMode] = useState<Mode>('act');
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const [directorOnly, setDirectorOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!project || !me || !sim) return null;

  const directing = can('direct');
  const narrating = directing && mode === 'narrate';
  const pending = narrating ? null : sim.pending;
  const draft = text.trim();

  const send = async () => {
    if (!draft || sending) return;
    setSending(true);
    setError(null);
    try {
      if (narrating) await call('narrate', { text: draft, directorOnly });
      else if (actingId) await call('declareAction', { characterId: actingId, input: draft });
      setText('');
      Keyboard.dismiss();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  let body: ReactNode;
  if (!narrating && !actingId) {
    body = (
      <View style={styles.row}>
        <Caption style={styles.grow}>
          {performer
            ? "You don’t have a character yet. The director assigns roles in Crew."
            : 'There are no characters in this scene yet.'}
        </Caption>
        {performer && <Button title="Open Crew" size="sm" variant="ghost" onPress={() => followString(projectId, 'crew')} />}
      </View>
    );
  } else if (pending) {
    const declarer = project.participants.find((p) => p.id === pending.participantId)?.name ?? 'Someone';
    body = (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <Icon name="dice" size={18} color={colors.accentText} />
        <Caption tone="primary" style={styles.grow}>
          {pending.participantId === me.id ? 'Choose a move on the board, or set it aside.' : `${declarer} is choosing a move…`}
        </Caption>
      </View>
    );
  } else {
    body = (
      <>
        <TypewriterStrip
          value={text}
          onChangeText={setText}
          busy={sending}
          placeholder={narrating ? 'Narrate or stage the scene…' : 'Or say it in your own words…'}
          label={narrating ? 'Narration or staging note' : `What ${charName(actingId)} does`}
          sendLabel={narrating ? 'Send narration' : 'Send action'}
          onSend={() => void send()}
        />
        {sending && !narrating && (
          <Caption tone="accent" accessibilityLiveRegion="polite">
            The Director is considering…
          </Caption>
        )}
        {narrating && (
          <Chip
            label="Director only"
            icon="eye-off"
            selected={directorOnly}
            onPress={() => setDirectorOnly((v) => !v)}
            accessibilityLabel="Director only: hide from performers, writers and observers"
            style={styles.chip}
          />
        )}
        {error && (
          <Caption tone="danger" accessibilityLiveRegion="polite">
            Couldn’t send: {error}
          </Caption>
        )}
      </>
    );
  }

  return (
    <AboveTabBar>
      <View style={styles.composer}>
        {sequence && !narrating ? (
          <View style={styles.row} accessible accessibilityLabel={`Goal: ${sequence.goal}`}>
            <Icon name="target" size={14} color={colors.accentText} />
            <Caption numberOfLines={1} style={styles.grow}>
              {sequence.goal}
            </Caption>
            <GoalSegments progress={sequence.progress} required={sequence.required} style={styles.goalSegments} />
          </View>
        ) : null}
        {(directing || !performer) && (
          <View style={styles.row}>
            <View style={styles.grow}>
              {narrating ? (
                <Caption>Narration and staging notes</Caption>
              ) : actingId && !performer ? (
                <Pressable
                  onPress={() => setPicking(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Acting as ${charName(actingId)}`}
                  accessibilityHint="Choose which character you act as"
                  style={({ pressed }) => [styles.picker, pressedStyle(pressed)]}>
                  <Caption>
                    Acting as{' '}
                    <Caption strong tone="accent">
                      {charName(actingId)}
                    </Caption>
                  </Caption>
                  <Icon name="chevron-right" size={11} color={colors.accentText} style={styles.down} />
                </Pressable>
              ) : actingId ? (
                <Caption>
                  Acting as{' '}
                  <Caption strong tone="primary">
                    {charName(actingId)}
                  </Caption>
                </Caption>
              ) : null}
            </View>
            {directing && (
              <SegmentedControl
                options={MODES}
                value={mode}
                onChange={setMode}
                accessibilityLabel="Composer mode"
                style={styles.modes}
              />
            )}
          </View>
        )}
        {body}
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Act as">
        <Caption>You can act as anyone present in the scene.</Caption>
        <List>
          {cast.map((c) => {
            const photo = characterImage(c);
            return (
              <ListRow
                key={c.id}
                leading={photo ? <Polaroid source={photo} width={44} /> : undefined}
                title={c.name}
                subtitle={roleLabel(c)}
                selected={c.id === actingId}
                onPress={() => {
                  onPick(c.id);
                  setPicking(false);
                }}
              />
            );
          })}
        </List>
      </Sheet>
    </AboveTabBar>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 0 },
  composer: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  goalSegments: { width: 56 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', minHeight: 32 },
  down: { transform: [{ rotate: '90deg' }] },
  modes: { width: 176 },
  stripShadow: { borderRadius: radii.sm },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.xs, paddingLeft: spacing.md },
  typed: {
    // Positioned so the textarea paints above the paper texture on web (the texture is absolutely positioned).
    position: 'relative',
    flex: 1,
    minHeight: TOUCH_TARGET,
    fontFamily: fonts.typewriter,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 11,
    paddingBottom: 11,
    paddingHorizontal: 0,
  },
  dim: { opacity: 0.6 },
  key: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
  /** A typewriter key: an ink cap in a metal ring. */
  keyCap: { backgroundColor: ink.accent, borderWidth: 2, borderColor: '#8C7A58' },
  chip: { alignSelf: 'flex-start' },
});
