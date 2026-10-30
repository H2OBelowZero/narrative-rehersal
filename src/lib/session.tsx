// App-wide session (server, identities, Director status) and the per-project data provider.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { OpArgs, OpName, OpResult } from '@shared/api';
import { can as canRole, STC_BEATS, type Permission, type StcBeatDef } from '@shared/structure';
import type {
  BeatState,
  Branch,
  Character,
  HeroGoalSequence,
  Participant,
  Project,
  Role,
  Scene,
  SimState,
} from '@shared/types';

import { showToast } from '@/components/ui/toast';

import { call, health, loadServerUrl, saveServerUrl, subscribe } from './api';
import { errorMessage } from './format';

// ───────────────────────── Session ─────────────────────────

const IDENTITIES_KEY = 'nr.identities';

export interface DirectorStatus {
  engine: 'claude' | 'offline';
  model: string | null;
}

/** A seat in a project: the public participant id plus the secret token only this device holds. */
export interface Identity {
  participantId: string;
  token: string;
}

export interface SessionValue {
  /** False until the saved server URL and identities are loaded. */
  ready: boolean;
  serverUrl: string;
  /** Saves an override (null restores the automatic address) and re-checks health. */
  setServerUrl: (url: string | null) => Promise<void>;
  /** projectId → seat for projects this device has joined. */
  identities: Record<string, Identity>;
  remember: (projectId: string, identity: Identity) => void;
  forget: (projectId: string) => void;
  clearIdentities: () => void;
  /** Director engine reported by the server; null when unknown/offline. */
  director: DirectorStatus | null;
  online: boolean;
  /** A health check is in flight. */
  checking: boolean;
  /** Re-checks /health and the Director engine; resolves to `online`. */
  refreshHealth: () => Promise<boolean>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setUrl] = useState('');
  const [identities, setIdentities] = useState<Record<string, Identity>>({});
  const [director, setDirector] = useState<DirectorStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  const refreshHealth = useCallback(async () => {
    setChecking(true);
    try {
      const ok = await health();
      setOnline(ok);
      setDirector(ok ? await call('directorStatus', {}).catch(() => null) : null);
      return ok;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setUrl(await loadServerUrl());
        const saved = await AsyncStorage.getItem(IDENTITIES_KEY);
        // Seats saved before tokens existed (plain id strings) can no longer authenticate — drop them.
        const parsed = saved ? (JSON.parse(saved) as Record<string, unknown>) : {};
        setIdentities(
          Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, Identity] => typeof entry[1] === 'object' && !!(entry[1] as Identity)?.token,
            ),
          ),
        );
      } catch {
        // Corrupt or unavailable storage: start fresh rather than block the app.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- health check against the server (external system)
    void refreshHealth();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshHealth();
    });
    return () => sub.remove();
  }, [ready, serverUrl, refreshHealth]);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(IDENTITIES_KEY, JSON.stringify(identities)).catch(() => {});
  }, [ready, identities]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      serverUrl,
      setServerUrl: async (url) => {
        setUrl(await saveServerUrl(url));
        await refreshHealth(); // even when the address is unchanged, the user expects a fresh check
      },
      identities,
      remember: (projectId, identity) => setIdentities((ids) => ({ ...ids, [projectId]: identity })),
      forget: (projectId) =>
        setIdentities(({ [projectId]: _dropped, ...rest }) => rest),
      clearIdentities: () => setIdentities({}),
      director,
      online,
      checking,
      refreshHealth,
    }),
    [ready, serverUrl, identities, director, online, checking, refreshHealth],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}

// ───────────────────────── Project ─────────────────────────

type Actor = { projectId: string; participantId: string; token: string };

/** Ops that act on a project as a participant (projectId, participantId and token are filled in for you). */
export type ProjectOpName = {
  [K in OpName]: OpArgs<K> extends Actor ? K : never;
}[OpName];
export type ProjectOpArgs<K extends ProjectOpName> = Omit<OpArgs<K>, keyof Actor>;

export interface ProjectValue {
  projectId: string;
  project: Project | null;
  /** True until the first load settles. */
  loading: boolean;
  /** Last load error (the last known project stays visible). */
  error: string | null;
  me: Participant | null;
  role: Role | undefined;
  can: (perm: Permission) => boolean;
  branch: Branch | null;
  /** Active branch's live simulation state. */
  sim: SimState | null;
  beat: { def: StcBeatDef; state: BeatState } | null;
  sequence: HeroGoalSequence | null;
  scene: Scene | null;
  protagonist: Character | null;
  character: (id: string | undefined) => Character | undefined;
  charName: (id: string | undefined) => string;
  /**
   * Runs an op as me. A returned Project replaces state. Errors are toasted AND rethrown —
   * callers only need try/catch to keep a form open or undo optimistic UI.
   */
  call: <K extends ProjectOpName>(op: K, args: ProjectOpArgs<K>) => Promise<OpResult<K>>;
  /** Refetches now; failures are toasted, never thrown. */
  refresh: () => Promise<void>;
  /** The op currently in flight, if any. */
  busyOp: OpName | null;
}

const ProjectContext = createContext<ProjectValue | null>(null);

const isProject = (value: unknown): value is Project =>
  typeof value === 'object' && value !== null && 'model' in value && 'version' in value;

/** Background refetch cadence: presence (lastSeenAt) and a safety net for missed pushes. */
const POLL_MS = 60_000;

export function ProjectProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { identities, serverUrl } = useSession();
  const identity = identities[projectId];
  const participantId = identity?.participantId;
  const token = identity?.token;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOp, setBusyOp] = useState<OpName | null>(null);
  const version = useRef(-1);

  const accept = useCallback((next: Project) => {
    if (next.version < version.current) return; // a slower, older response
    version.current = next.version;
    setProject(next);
  }, []);

  const load = useCallback(async (): Promise<string | null> => {
    try {
      if (!participantId || !token) throw new Error('Join this project before taking part.');
      accept(await call('getProject', { projectId, participantId, token }));
      setError(null);
      return null;
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      return message;
    } finally {
      setLoading(false);
    }
  }, [projectId, participantId, token, accept]);

  // Initial load, then refetch on push, reconnect, foreground and a slow poll.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch alongside the WebSocket subscription
    void load();
    const unsubscribe = subscribe(projectId, (pushed) => {
      if (pushed === undefined || pushed > version.current) void load();
    });
    const poll = setInterval(() => void load(), POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      unsubscribe();
      clearInterval(poll);
      appState.remove();
    };
  }, [projectId, serverUrl, load]);

  const refresh = useCallback(async () => {
    const failure = await load();
    if (failure) showToast(failure, 'error');
  }, [load]);

  const callOp = useCallback(
    async <K extends ProjectOpName>(op: K, args: ProjectOpArgs<K>): Promise<OpResult<K>> => {
      setBusyOp(op);
      try {
        if (!participantId || !token) throw new Error('Join this project before taking part.');
        const result = await call(op, { ...args, projectId, participantId, token } as unknown as OpArgs<K>);
        if (isProject(result)) accept(result);
        return result;
      } catch (e) {
        showToast(errorMessage(e), 'error');
        throw e;
      } finally {
        setBusyOp((current) => (current === op ? null : current));
      }
    },
    [projectId, participantId, token, accept],
  );

  const value = useMemo<ProjectValue>(() => {
    const me = project?.participants.find((p) => p.id === participantId) ?? null;
    const branch = project?.branches.find((b) => b.id === project.activeBranchId) ?? null;
    const sim = branch?.state ?? null;
    const characters = project?.model.characters ?? [];
    const character = (id: string | undefined) => (id ? characters.find((c) => c.id === id) : undefined);
    return {
      projectId,
      project,
      loading,
      error,
      me,
      role: me?.role,
      can: (perm) => canRole(me?.role, perm),
      branch,
      sim,
      beat: sim ? { def: STC_BEATS[sim.beatIndex]!, state: sim.beats[sim.beatIndex]! } : null,
      sequence: sim?.sequences.find((s) => s.id === sim.currentSequenceId) ?? null,
      scene: sim?.scenes.find((s) => s.id === sim.currentSceneId) ?? null,
      protagonist: (project && character(project.model.protagonistId)) ?? null,
      character,
      charName: (id) => character(id)?.name ?? 'Unknown character',
      call: callOp,
      refresh,
      busyOp,
    };
  }, [projectId, project, loading, error, participantId, callOp, refresh, busyOp]);

  return <ProjectContext value={value}>{children}</ProjectContext>;
}

export function useProject(): ProjectValue {
  const value = use(ProjectContext);
  if (!value) throw new Error('useProject must be used inside <ProjectProvider>.');
  return value;
}
