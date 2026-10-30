// Settings: a few sheets of paper taped down on the desk. The server address is typed in and tested before it
// is kept; the seats on this device can be forgotten; the Director's engine is stamped on the last sheet.
import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Body, Button, Caption, Card, confirm, Mono, Screen, Section, showToast, TextField } from '@/components/ui';
import { defaultServerUrl, health, normalizeServerUrl } from '@/lib/api';
import { useSession } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

export default function Settings() {
  const { colors } = useTheme(); // the desk: Badge carries it onto the paper
  const session = useSession();
  const automatic = defaultServerUrl();
  const usingAutomatic = session.serverUrl === automatic;
  const [draft, setDraft] = useState(usingAutomatic ? '' : session.serverUrl);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joined = Object.keys(session.identities).length;

  const resetToAutomatic = async () => {
    await session.setServerUrl(null);
    setDraft('');
    setError(null);
    showToast('Using the automatic server address.', 'success');
  };

  const save = async () => {
    if (!draft.trim()) return resetToAutomatic();
    const url = normalizeServerUrl(draft);
    setTesting(true);
    setError(null);
    const ok = await health(url);
    setTesting(false);
    if (!ok) return setError(`No rehearsal server answered at ${url}. Check the address and that the server is running.`);
    await session.setServerUrl(url);
    setDraft(url);
    showToast('Connected. Server address saved.', 'success');
  };

  const forgetAll = async () => {
    const yes = await confirm(
      'Forget all identities?',
      'Your seats live only on this device. Forgetting them is permanent: you can join again as someone new, but you can’t reclaim these seats, including a Project Owner seat and its canon authority. Your contributions stay on the server.',
      { confirmLabel: 'Forget', destructive: true },
    );
    if (!yes) return;
    session.clearIdentities();
    showToast('Identities forgotten.');
  };

  const status = session.online ? 'Connected' : session.checking ? 'Connecting…' : 'Unreachable';
  const director = session.director;
  return (
    <Screen plain keyboard edges={['bottom']} contentStyle={styles.desk}>
      <Section title="Rehearsal server">
        <Card fasten="tape" tilt={false}>
          <View style={styles.status} accessible accessibilityLabel={`${status}, ${session.serverUrl}`}>
            <Badge
              icon={session.online ? 'server' : 'offline'}
              label={status}
              color={session.online ? colors.tier.success : colors.textSecondary}
            />
            <Mono style={styles.url} numberOfLines={1}>
              {session.serverUrl}
            </Mono>
          </View>
          <TextField
            label="Server address"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            placeholder={automatic}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={save}
            helper={`Leave empty to use the automatic address (${automatic}).`}
            error={error}
          />
          <View style={styles.actions}>
            <Button title="Test and save" icon="refresh" loading={testing} onPress={save} />
            {!usingAutomatic && <Button title="Use automatic" variant="secondary" onPress={resetToAutomatic} />}
          </View>
        </Card>
      </Section>

      <Section title="Seats on this device">
        <Card fasten="tape" tilt={false}>
          <Body>
            {joined === 0
              ? "You haven’t joined any projects on this device."
              : `You hold a seat in ${joined} ${joined === 1 ? 'project' : 'projects'} on this device.`}
          </Body>
          <Caption>An identity links this device to your seat in a project. Forgetting it doesn’t remove you from the project.</Caption>
          <Button
            title="Forget all identities"
            variant="destructive"
            disabled={joined === 0}
            style={styles.start}
            onPress={forgetAll}
          />
        </Card>
      </Section>

      <Section title="About">
        <Card fasten="tape" tilt={false}>
          <View style={styles.status}>
            <Badge
              label={director?.engine === 'claude' ? 'Director: Claude' : director ? 'Director: offline' : 'Director: unknown'}
              color={director?.engine === 'claude' ? colors.accentText : colors.textSecondary}
            />
            {director?.engine === 'claude' && director.model ? <Mono style={styles.url}>{director.model}</Mono> : null}
          </View>
          <Caption>
            {director
              ? 'The Director runs on the rehearsal server, never on this device. To use Claude, set ANTHROPIC_API_KEY in server/.env and restart the server. Without a key the server uses its built-in offline Director.'
              : 'The Director’s engine shows here once the server is reachable.'}
          </Caption>
          <Caption tone="tertiary">The Story Desk {Constants.expoConfig?.version ?? ''}</Caption>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desk: { maxWidth: 640 },
  status: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  url: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  start: { alignSelf: 'flex-start' },
});
