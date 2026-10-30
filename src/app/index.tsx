// Welcome: the desk under the lamp, then the projects pinned to a strip of cork below it.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROLE_LABEL } from '@shared/structure';
import type { ProjectSummary, Role } from '@shared/types';

import { fillImage, materials } from '@/components/board/materials';
import { DeskHero, WIDE } from '@/components/home/desk-hero';
import { ProjectCards } from '@/components/home/project-cards';
import { Button, Caption, List, ListRow, Section, SegmentedControl, Sheet, TextField } from '@/components/ui';
import { call } from '@/lib/api';
import { errorMessage, ROLE_DESCRIPTION } from '@/lib/format';
import { useSession, type Identity } from '@/lib/session';
import { palettes, spacing, world } from '@/theme';

/** Roles open to joiners; the owner is whoever created the project. */
const JOIN_ROLES: Role[] = ['director', 'producer', 'writer', 'performer', 'observer'];
const desk = palettes.desk;

export default function Welcome() {
  const session = useSession();
  const { join } = useLocalSearchParams<{ join?: string }>();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [joining, setJoining] = useState<ProjectSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE;

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await call('listProjects', {}));
      setListError(null);
    } catch (e) {
      setListError(errorMessage(e));
    }
  }, []);

  const { ready, online, serverUrl, identities, remember } = session;
  // On focus (e.g. back from a project) and whenever the server comes online or changes.
  useFocusEffect(
    useCallback(() => {
      if (ready) void loadProjects();
    }, [ready, loadProjects]),
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when it comes online
    if (ready && online) void loadProjects();
  }, [ready, online, serverUrl, loadProjects]);

  // Arriving from a project link without an identity (?join=<id>): offer to join it.
  useEffect(() => {
    if (!join || !projects) return;
    const target = projects.find((p) => p.id === join);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to a deep link once the project list has loaded
    if (target && !identities[target.id]) setJoining(target);
    router.setParams({ join: undefined });
  }, [join, projects, identities]);

  // Navigate once the new identity is in state, so the project layout sees it.
  useEffect(() => {
    if (opening && identities[opening]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot navigation after the identity is persisted
      setOpening(null);
      router.push({ pathname: '/project/[id]/home', params: { id: opening } });
    }
  }, [opening, identities]);

  const enter = (projectId: string, identity: Identity) => {
    remember(projectId, identity);
    setJoining(null);
    setCreating(false);
    setOpening(projectId);
  };

  const openProject = (p: ProjectSummary) =>
    identities[p.id] ? router.push({ pathname: '/project/[id]/home', params: { id: p.id } }) : setJoining(p);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([session.refreshHealth(), loadProjects()]);
    } finally {
      setRefreshing(false);
    }
  };

  // The desk fills most of the first view; the top of the cork strip shows below it so the projects are found.
  const heroHeight = Math.round(wide ? Math.min(height * 0.7, 700) : Math.min(Math.max(height * 0.74, 520), 700));

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.grow}
      contentInsetAdjustmentBehavior="never"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={desk.accentText}
          colors={[desk.accent]}
          progressBackgroundColor={desk.surface}
          progressViewOffset={insets.top}
        />
      }>
      <DeskHero height={heroHeight} wide={wide} />

      <View style={[styles.strip, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <Image source={materials.cork} resizeMode="repeat" style={fillImage} accessible={false} />
        {/* The board's walnut frame, and the lamp's shadow falling under its lip. */}
        <View style={styles.frame}>
          <Image source={materials.walnut} resizeMode="repeat" style={fillImage} accessible={false} />
        </View>
        <View pointerEvents="none" style={styles.frameShadow} />
        <View style={[styles.inner, wide && styles.innerWide]}>
          <Section title="Projects">
            <ProjectCards
              projects={projects}
              error={listError}
              identities={identities}
              online={online}
              wide={wide}
              onOpen={openProject}
              onCreate={() => setCreating(true)}
            />
          </Section>
        </View>
      </View>

      <JoinSheet project={joining} onClose={() => setJoining(null)} onJoined={enter} />
      <NewProjectSheet visible={creating} onClose={() => setCreating(false)} onCreated={enter} />
    </ScrollView>
  );
}

function JoinSheet({
  project,
  onClose,
  onJoined,
}: {
  project: ProjectSummary | null;
  onClose: () => void;
  onJoined: (projectId: string, identity: Identity) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('performer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!project) return;
    if (!name.trim()) return setError('Add the name the room will know you by.');
    setBusy(true);
    setError(null);
    try {
      const { participant, token } = await call('join', { projectId: project.id, name: name.trim(), role });
      onJoined(project.id, { participantId: participant.id, token });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={!!project}
      onClose={onClose}
      title={project ? `Join ${project.title || 'project'}` : 'Join'}
      footer={<Button title="Join project" block size="lg" loading={busy} onPress={submit} />}>
      <TextField
        label="Your name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="done"
        error={error}
      />
      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Your role">
        <Caption strong tone="primary">
          Your role
        </Caption>
        <List>
          {JOIN_ROLES.map((r) => (
            <ListRow
              key={r}
              title={ROLE_LABEL[r]}
              subtitle={ROLE_DESCRIPTION[r]}
              selected={role === r}
              onPress={() => setRole(r)}
            />
          ))}
        </List>
      </View>
    </Sheet>
  );
}

function NewProjectSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (projectId: string, identity: Identity) => void;
}) {
  const [ownerName, setOwnerName] = useState('');
  const [seed, setSeed] = useState<'demo' | 'blank'>('demo');
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'name' | 'title' | 'form'; message: string } | null>(null);

  const submit = async () => {
    if (!ownerName.trim()) return setError({ field: 'name', message: 'Add your name. You will be the Project Owner.' });
    if (seed === 'blank' && !title.trim()) return setError({ field: 'title', message: 'A blank project needs a working title.' });
    setBusy(true);
    setError(null);
    try {
      const { project, participant, token } = await call('createProject', {
        ownerName: ownerName.trim(),
        seed,
        ...(seed === 'blank' && { title: title.trim(), logline: logline.trim() || undefined }),
      });
      onCreated(project.id, { participantId: participant.id, token });
    } catch (e) {
      setError({ field: 'form', message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="New project"
      footer={
        <>
          {error?.field === 'form' && <Caption tone="danger">{error.message}</Caption>}
          <Button title="Create project" block size="lg" loading={busy} onPress={submit} />
        </>
      }>
      <TextField
        label="Your name"
        value={ownerName}
        onChangeText={setOwnerName}
        autoCapitalize="words"
        autoComplete="name"
        helper="You become the Project Owner, the only person who can promote material to canon."
        error={error?.field === 'name' ? error.message : null}
      />
      <View style={styles.group}>
        <SegmentedControl
          accessibilityLabel="Starting point"
          options={[
            { value: 'demo', label: 'Undertow sample' },
            { value: 'blank', label: 'Blank project' },
          ]}
          value={seed}
          onChange={setSeed}
        />
        <Caption>
          {seed === 'demo'
            ? 'Loads the built-in sample story, Undertow, with its cast and opening situation ready to rehearse.'
            : 'Starts empty with a single protagonist to shape in the Story tab.'}
        </Caption>
      </View>
      {seed === 'blank' && (
        <>
          <TextField
            label="Working title"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
            error={error?.field === 'title' ? error.message : null}
          />
          <TextField label="Logline" value={logline} onChangeText={setLogline} multiline helper="Optional. One or two sentences." />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: desk.bg },
  grow: { flexGrow: 1 },
  strip: { flexGrow: 1, paddingTop: spacing.xl + 12, paddingHorizontal: spacing.lg, overflow: 'hidden' },
  frame: { position: 'absolute', top: 0, left: 0, right: 0, height: 12, overflow: 'hidden', backgroundColor: world.frame },
  frameShadow: { position: 'absolute', top: 12, left: 0, right: 0, height: 10, backgroundColor: 'rgba(12, 8, 5, 0.45)' },
  inner: { width: '100%', alignSelf: 'center' },
  innerWide: { maxWidth: 1180, paddingHorizontal: spacing.xl },
  group: { gap: spacing.sm },
});
