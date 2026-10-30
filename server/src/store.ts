// In-memory project store persisted to server/data/db.json.
// Mutations are transactional: `mutate` applies the change to a clone and commits only if it doesn't throw.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ID, Project } from '../../shared/types.ts';
import { nowIso } from './engine.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');
const SAVE_DELAY_MS = 250;

const projects = new Map<ID, Project>();
// A corrupt db.json throws here on purpose: refusing to start beats silently overwriting the data.
// Projects saved before the Write Room existed have no scripts list.
if (existsSync(DB_FILE)) for (const p of JSON.parse(readFileSync(DB_FILE, 'utf8')) as Project[]) projects.set(p.id, { ...p, scripts: p.scripts ?? [] });

let notify: (projectId: ID, version: number) => void = () => {};
/** Registers the single change listener (the WebSocket broadcaster). */
export function onChange(listener: (projectId: ID, version: number) => void): void {
  notify = listener;
}

let saveTimer: NodeJS.Timeout | undefined;
let dirty = false; // unsaved changes exist — cleared only by a successful write

function save(): void {
  saveTimer = undefined;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify([...projects.values()]));
    renameSync(tmp, DB_FILE);
    dirty = false;
  } catch (err) {
    // State is still in memory; retry shortly so a transient failure doesn't lose the last changes.
    console.error('Failed to save db.json', err);
    saveTimer = setTimeout(save, SAVE_DELAY_MS * 8);
  }
}

function scheduleSave(): void {
  dirty = true;
  saveTimer ??= setTimeout(save, SAVE_DELAY_MS);
}

/** Writes any pending change now (shutdown). */
export function flush(): void {
  clearTimeout(saveTimer);
  if (dirty) save();
}

export function has(projectId: ID): boolean {
  return projects.has(projectId);
}

export function get(projectId: ID): Project {
  const project = projects.get(projectId);
  if (!project) throw new Error('Project not found');
  return project;
}

export function list(): Project[] {
  return [...projects.values()];
}

export function create(project: Project): Project {
  projects.set(project.id, project);
  scheduleSave();
  return project;
}

/**
 * Synchronously applies `fn` to the latest state, bumps the version and broadcasts.
 * Never await inside `fn`: do slow work (Director calls) first, then re-validate against fresh state here.
 */
export function mutate(projectId: ID, fn: (p: Project) => void): Project {
  const draft = structuredClone(get(projectId));
  fn(draft);
  draft.version++;
  draft.updatedAt = nowIso();
  projects.set(projectId, draft);
  scheduleSave();
  notify(projectId, draft.version);
  return draft;
}

/** Presence only (lastSeenAt): saved, but no version bump or broadcast. */
export function touch(projectId: ID, participantId: ID): void {
  const participant = get(projectId).participants.find((p) => p.id === participantId);
  if (!participant) return;
  participant.lastSeenAt = nowIso();
  scheduleSave();
}
