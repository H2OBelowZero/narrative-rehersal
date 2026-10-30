// The shared rehearsal session (PRD §33), blind mode (§32) and the invite that brings people in.
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/board/paper';
import { CardTitle } from '@/components/rehearse/scene-cards';
import { Body, Button, Caption, Card, confirm, Eyebrow, Mono, Section, SegmentedControl, showToast, Term } from '@/components/ui';
import { errorMessage, timeAgo } from '@/lib/format';
import { useProject, useSession } from '@/lib/session';
import { useNow } from '@/lib/use-now';
import { palettes, spacing } from '@/theme';

const ink = palettes.paper;

const BLIND_EXPLANATION =
  'Performers get only their character’s brief, not the full character design, the theme or other characters’ secrets. This lets ' +
  'the team see what interpretation emerges when nobody is told the answer. Afterwards, compare the written ' +
  'character with the played one and with the crew’s reactions.';

/** "Under a minute", "12 min", "1 h 05 min". */
function duration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'Under a minute';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export function SessionCard() {
  const { project, can, call } = useProject();
  const now = useNow(15_000);
  const [busy, setBusy] = useState<'session' | 'blind' | null>(null);
  if (!project) return null;

  const manage = can('manageCrew');
  const blind = project.settings.blindMode;
  const session = project.sessions.find((s) => s.id === project.activeSessionId);
  const last = session
    ? undefined
    : project.sessions.filter((s) => s.endedAt).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))[0];

  const toggleSession = async () => {
    if (
      session &&
      !(await confirm(
        'End the rehearsal session?',
        'Reactions and discoveries stay with this session. You can start a new one any time.',
        { confirmLabel: 'End session', destructive: true },
      ))
    ) {
      return;
    }
    setBusy('session');
    try {
      if (session) await call('endSession', {});
      else await call('startSession', {});
      showToast(session ? 'Session ended' : 'Session started', 'success');
    } catch {
      // call() has already shown the error.
    } finally {
      setBusy(null);
    }
  };

  const setBlind = async (value: boolean) => {
    setBusy('blind');
    try {
      await call('setBlindMode', { blindMode: value });
    } catch {
      // call() has already shown the error; the switch stays on the server's value.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card tilt="session">
      <View style={styles.spread}>
        <View style={styles.grow}>
          <CardTitle>{session ? `Session running for ${duration(now - Date.parse(session.startedAt)).toLowerCase()}` : 'No session running'}</CardTitle>
        </View>
        <Stamp label={session ? 'Live' : 'Not running'} color={session ? ink.danger : ink.textTertiary} />
      </View>
      {session ? (
        <View style={styles.tight}>
          <Caption>
            Started {timeAgo(session.startedAt, now)} · {session.participantIds.length} taking part
          </Caption>
        </View>
      ) : (
        <Body tone="secondary">
          {last?.endedAt
            ? `The last session ran ${duration(Date.parse(last.endedAt) - Date.parse(last.startedAt)).toLowerCase()} and ended ${timeAgo(last.endedAt, now)}.`
            : 'No session has been run yet.'}
        </Body>
      )}
      {manage && (
        <Button
          title={session ? 'End session' : 'Start session'}
          icon={session ? 'stop' : 'play'}
          variant={session ? 'secondary' : 'primary'}
          loading={busy === 'session'}
          disabled={busy !== null}
          onPress={() => void toggleSession()}
        />
      )}

      {/* Blind mode is a slip clipped to the session card, stamped with its state. */}
      <Card style={styles.blind}>
        <View style={styles.rowWrap}>
          <Body strong>Blind session</Body>
          <Stamp label={blind ? 'Blind' : 'Open'} color={blind ? ink.accentText : ink.textTertiary} />
        </View>
        <View style={styles.terms} accessible accessibilityLabel={BLIND_EXPLANATION}>
          <Term icon="eye-off" text="Performers see only their own brief" spoken="Performers see only their own brief" />
          <Term icon="question" text="Nobody is told the answer" spoken="Nobody is told the answer" />
          <Term icon="graph" text="Afterwards: compare written, played and felt" spoken="Afterwards: compare written, played and felt" />
        </View>
        {manage && (
          <SegmentedControl
            accessibilityLabel="Blind session"
            options={[
              { value: 'open', label: 'Open' },
              { value: 'blind', label: 'Blind' },
            ]}
            value={blind ? 'blind' : 'open'}
            onChange={(v) => {
              if (busy === null) void setBlind(v === 'blind');
            }}
          />
        )}
      </Card>
    </Card>
  );
}

/** Everything someone needs to join from the Welcome screen, shareable in one message. */
export function InviteCard() {
  const { project } = useProject();
  const { serverUrl } = useSession();
  const [sharing, setSharing] = useState(false);
  if (!project) return null;

  const title = project.model.title || 'our project';
  const link = Linking.createURL('/', { queryParams: { join: project.id } });
  const message = [
    `Join "${title}" in Narrative Rehearsal.`,
    `Server: ${serverUrl}`,
    `Project ID: ${project.id}`,
    `Open: ${link}`,
  ].join('\n');
  const deviceOnly = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(serverUrl);
  const web = Platform.OS === 'web';

  const share = async () => {
    setSharing(true);
    try {
      if (web) {
        await navigator.clipboard.writeText(message);
        showToast('Invite copied', 'success');
      } else {
        await Share.share({ message });
      }
    } catch (e) {
      showToast(
        web ? "Couldn’t copy the invite. Select the details above instead." : `Couldn’t share the invite: ${errorMessage(e)}`,
        'error',
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <Section title="Invite">
      <Card fasten="tape" tilt="invite">
        <Body>
          Others join from the Welcome screen: they point the app at this server, then pick “{title}” and choose a
          role.
        </Body>
        <Detail label="Server" value={serverUrl} />
        {deviceOnly && (
          <Caption tone="accent">
            This address only works on this device. Share this computer’s network address instead (set it in
            Settings).
          </Caption>
        )}
        <Detail label="Project ID" value={project.id} />
        <Button
          title={web ? 'Copy invite' : 'Share invite'}
          icon="link"
          variant="secondary"
          loading={sharing}
          onPress={() => void share()}
        />
      </Card>
    </Section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tight}>
      <Eyebrow>{label}</Eyebrow>
      <Mono selectable>{value}</Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tight: { gap: spacing.xs },
  grow: { flex: 1, gap: spacing.xs },
  elapsed: { fontVariant: ['tabular-nums'] },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  blind: { gap: spacing.sm, padding: spacing.md },
  terms: { gap: spacing.xs },
});
