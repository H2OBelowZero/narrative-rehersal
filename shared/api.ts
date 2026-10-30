// Typed RPC contract. Transport:
//   POST /api/<op>   body: JSON args   →   { ok: true, result } | { ok: false, error: string }
//   WS   /ws?projectId=<id>            →   server pushes { type: 'changed', projectId, version } after every mutation;
//                                          clients refetch getProject with their participantId (views are per-viewer).
// Every op acting as a participant takes `participantId` + `token` (the secret minted by createProject/join and
// returned only to that participant); the server verifies the pair, then permission-checks with `can()`.
// Mutating ops return the actor's (possibly redacted) Project view.
import type {
  BranchMode,
  CanonStatus,
  Character,
  CanonItem,
  ID,
  InterpretationKey,
  NodeRef,
  Participant,
  Project,
  ProjectSummary,
  ReactionKind,
  Relationship,
  Role,
  StoryModel,
} from './types.ts';
import type { ScriptPatch } from './script.ts';

type P = { projectId: ID; participantId: ID; token: string };

export interface Ops {
  // ── Projects & crew ──
  listProjects: { args: Record<string, never>; result: ProjectSummary[] };
  /** seed 'demo' loads the built-in sample story; 'blank' starts empty with one protagonist stub. */
  createProject: {
    args: { ownerName: string; seed: 'demo' | 'blank'; title?: string; logline?: string };
    result: { project: Project; participant: Participant; token: string };
  };
  getProject: { args: P; result: Project };
  join: {
    args: { projectId: ID; name: string; role: Role };
    result: { project: Project; participant: Participant; token: string };
  };
  assignCharacter: { args: P & { targetParticipantId: ID; characterId: ID | null }; result: Project };
  setBlindMode: { args: P & { blindMode: boolean }; result: Project };
  startSession: { args: P; result: Project };
  endSession: { args: P; result: Project };
  directorStatus: { args: Record<string, never>; result: { engine: 'claude' | 'offline'; model: string | null } };

  // ── Story Model (Story Bible / Character Lab) ──
  updateModel: {
    args: P & { patch: Partial<Omit<StoryModel, 'characters' | 'relationships' | 'canon'>> };
    result: Project;
  };
  /** Creates when `character.id` is empty or unknown. */
  upsertCharacter: { args: P & { character: Character }; result: Project };
  deleteCharacter: { args: P & { characterId: ID }; result: Project };
  upsertRelationship: { args: P & { relationship: Relationship }; result: Project };
  deleteRelationship: { args: P & { relationshipId: ID }; result: Project };
  upsertCanonItem: { args: P & { item: CanonItem }; result: Project };
  deleteCanonItem: { args: P & { itemId: ID }; result: Project };
  /**
   * Canon authority. Moving anything to 'canon' or 'locked' requires promoteCanon (owner);
   * other statuses require editModel.
   */
  setCanonStatus: {
    args: P & {
      target:
        | { kind: 'canon'; id: ID }
        | { kind: 'character'; id: ID }
        | { kind: 'trait'; characterId: ID; id: ID };
      status: CanonStatus;
    };
    result: Project;
  };

  // ── Simulation Room ──
  /** Director interprets freeform intent and exposes approaches with odds; sets sim.pending. */
  declareAction: { args: P & { characterId: ID; input: string }; result: Project };
  /** Director offers three moves drawn from the goal, stakes and theme — nothing declared yet; sets sim.pending. */
  proposeChoices: { args: P & { characterId: ID }; result: Project };
  /** Rolls the chosen approach, narrates, applies effects + propagation; clears pending. */
  resolveAction: { args: P & { approachId: ID }; result: Project };
  cancelAction: { args: P; result: Project };
  /** Records why the chooser picked a resolved move (the chooser, or anyone who can direct). */
  explainChoice: { args: P & { eventId: ID; reason: string }; result: Project };
  /** Human Director narration / staging note (direct). */
  narrate: { args: P & { text: string; directorOnly?: boolean }; result: Project };
  openScene: { args: P & { heading: string; situation: string; presentCharacterIds: ID[] }; result: Project };
  /** Close the current HGS with fresh news and open the next goal (direct). */
  openSequence: {
    args: P & { freshNews: string; goal: string; stake: string; obstacle: string; closeAs?: 'achieved' | 'redirected' | 'abandoned' };
    result: Project;
  };
  /** Advance to the next STC beat; refused unless requirements are met or `force` is set. */
  advanceBeat: { args: P & { force?: boolean }; result: Project };
  generateOpportunities: { args: P; result: Project };
  selectOpportunity: { args: P & { opportunityId: ID }; result: Project };
  graphImpact: {
    args: P & { node: NodeRef; depth?: number };
    result: { nodes: (NodeRef & { label: string })[]; edges: { from: ID; to: ID; rel: string; label?: string }[] };
  };

  // ── Crew Room ──
  react: { args: P & { eventId: ID; kind: ReactionKind; note?: string }; result: Project };
  submitInterpretation: {
    args: P & { phase: 'before' | 'after'; answers: Record<InterpretationKey, string> };
    result: Project;
  };
  generateReport: { args: P; result: Project };

  // ── Discovery Room ──
  analyzeDiscoveries: { args: P; result: Project };
  /** 'promoted' requires promoteCanon; it also promotes linked emergent traits/canon items. */
  decideDiscovery: {
    args: P & { discoveryId: ID; decision: 'considering' | 'promoted' | 'rejected'; resolution?: string };
    result: Project;
  };

  // ── Branches (Replay & Iteration) ──
  createBranch: {
    args: P & {
      fromBranchId: ID;
      mode: Exclude<BranchMode, 'origin'>;
      name: string;
      note: string;
      overrides?: { characterId?: ID; priority?: string; goal?: string; stakeShift?: number };
    };
    result: Project;
  };
  switchBranch: { args: P & { branchId: ID }; result: Project };
  /** Owner only: marks the branch canon (others become 'exploring'); nothing is deleted. */
  promoteBranch: { args: P & { branchId: ID }; result: Project };

  // ── Screenplay Room ──
  compileScreenplay: { args: P & { sequenceId?: ID; sceneIds?: ID[] }; result: Project };

  // ── Write Room ── (editing needs editModel; notes need react)
  /** Starts a script, blank or typed up from a compiled draft. */
  createScript: { args: P & { title: string; fromDraftId?: ID }; result: Project };
  /** Merges a patch (see shared/script.ts) and logs each line's change against the author. */
  saveScript: { args: P & { scriptId: ID; title?: string; patch: ScriptPatch }; result: Project };
  deleteScript: { args: P & { scriptId: ID }; result: Project };
  /** Snapshots the script; pending changes are filed under the new revision. */
  saveRevision: { args: P & { scriptId: ID; name: string; note?: string }; result: Project };
  /** Puts a revision's pages back as the working copy (logged as changes, nothing is lost). */
  restoreRevision: { args: P & { scriptId: ID; number: number }; result: Project };
  addScriptComment: { args: P & { scriptId: ID; elementId?: ID; text: string }; result: Project };
  resolveScriptComment: { args: P & { scriptId: ID; commentId: ID; resolved: boolean }; result: Project };
}

export type OpName = keyof Ops;
export type OpArgs<K extends OpName> = Ops[K]['args'];
export type OpResult<K extends OpName> = Ops[K]['result'];
export type ApiResponse<T> = { ok: true; result: T } | { ok: false; error: string };
export type ServerPush = { type: 'changed'; projectId: ID; version: number };

export const DEFAULT_PORT = 8787;
