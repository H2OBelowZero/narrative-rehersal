// Who is in the room (PRD §5–6): each person is an ID card pinned to the board, with their initials, their role
// stamped on and a print of the character they play. The owner and directors tap a card to cast it.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ROLES } from '@shared/structure';
import type { Participant } from '@shared/types';

import { characterImage } from '@/components/board/materials';
import { Hand, Polaroid } from '@/components/board/paper';
import { CardTitle } from '@/components/rehearse/scene-cards';
import { Caption, Card, List, ListRow, RoleBadge, Section, Sheet, showToast } from '@/components/ui';
import { errorMessage, isActive, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { useProject } from '@/lib/session';
import { fonts, palettes, spacing } from '@/theme';

const ink = palettes.paper;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export function Participants() {
  const { project, me, can, character } = useProject();
  const [casting, setCasting] = useState<Participant | null>(null);
  const now = useNow();
  if (!project) return null;

  const manage = can('manageCrew');
  const crew = [...project.participants].sort(
    (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name),
  );

  return (
    <Section title="Crew" note={`${crew.length} in the room`}>
      <View style={styles.grid}>
        {crew.map((p) => {
          const c = p.characterId ? character(p.characterId) : undefined;
          const name = p.id === me?.id ? `${p.name} (you)` : p.name;
          const plays = c ? `Plays ${c.name}` : 'No character yet';
          const presence = isActive(p, now) ? 'Active now' : `Seen ${timeAgo(p.lastSeenAt, now)}`;
          return (
            <View key={p.id} style={styles.cell}>
              <Card
                tilt={p.id}
                onPress={manage ? () => setCasting(p) : undefined}
                accessibilityLabel={`${name}, ${p.role}. ${plays}. ${presence}.${manage ? ' Assign the character they perform.' : ''}`}
                style={styles.id}>
                <View style={styles.row}>
                  <View style={[styles.mug, { borderColor: ink.border, backgroundColor: ink.surfaceAlt }]}>
                    <Text maxFontSizeMultiplier={1} style={[styles.initials, { color: ink.role[p.role] }]}>
                      {initialsOf(p.name)}
                    </Text>
                  </View>
                  <View style={styles.grow}>
                    <CardTitle lines={2}>{name}</CardTitle>
                    <RoleBadge role={p.role} />
                    <Caption tone="primary">{plays}</Caption>
                    <Caption>{presence}</Caption>
                  </View>
                  {c ? <Polaroid source={characterImage(c)} caption={c.name.split(/\s+/)[0]} width={72} style={styles.print} /> : null}
                </View>
              </Card>
            </View>
          );
        })}
      </View>
      {manage && <Hand>Tap someone to assign the character they perform.</Hand>}
      <CastingSheet participant={casting} onClose={() => setCasting(null)} />
    </Section>
  );
}

function CastingSheet({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  const { project, call } = useProject();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!project) return null;

  const NONE = '';
  const close = () => {
    setError(null);
    onClose();
  };

  const assign = async (characterId: string | null) => {
    if (!participant || saving !== null) return;
    setSaving(characterId ?? NONE);
    setError(null);
    try {
      await call('assignCharacter', { targetParticipantId: participant.id, characterId });
      const who = characterId ? project.model.characters.find((c) => c.id === characterId)?.name : null;
      showToast(who ? `${participant.name} now plays ${who}` : `${participant.name} has no character`, 'success');
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  const spinner = <ActivityIndicator color={ink.accentText} />;
  const alsoPlayedBy = (characterId: string) =>
    project.participants
      .filter((p) => p.characterId === characterId && p.id !== participant?.id)
      .map((p) => p.name)
      .join(', ');

  return (
    <Sheet visible={participant !== null} onClose={close} title={participant ? `Cast ${participant.name}` : 'Cast'}>
      <Caption>
        {participant?.role === 'performer'
          ? 'Performers act only as their assigned character.'
          : 'The owner and directors can already act as anyone in the scene; assigning a character records who they play.'}
      </Caption>
      {error && (
        <Caption tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Caption>
      )}
      <List>
        {project.model.characters.map((c) => {
          const others = alsoPlayedBy(c.id);
          return (
            <ListRow
              key={c.id}
              leading={<Polaroid source={characterImage(c)} width={44} />}
              title={c.name}
              subtitle={others ? `Also played by ${others}` : undefined}
              selected={participant?.characterId === c.id}
              trailing={saving === c.id ? spinner : undefined}
              onPress={() => void assign(c.id)}
            />
          );
        })}
        <ListRow
          title="No character"
          selected={!participant?.characterId}
          trailing={saving === NONE ? spinner : undefined}
          onPress={() => void assign(null)}
        />
      </List>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  cell: { flexGrow: 1, flexBasis: 300 },
  id: { paddingTop: spacing.xl, minHeight: 132 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  /** The ID photo slot, with initials typed in where the photograph would be. */
  mug: { width: 56, height: 68, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.typewriterBold, fontSize: 22, lineHeight: 26 },
  print: { transform: [{ rotate: '3deg' }], marginTop: -spacing.xs },
});
