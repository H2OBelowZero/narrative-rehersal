// Offline AI Director (PRD §15–37, §40–50): deterministic heuristics over the story state, no network.
// director.ts routes every call here when Claude is not configured, and whenever a Claude call fails.
// It only ever builds on what the story already holds — authored goals, fears, secrets, resources,
// relationships, setups — so what it "reveals" is discovery of existing material, never invention.
import { DOMAIN_LABEL, EMPATHY_SIGNALS, INTERPRETATION_QUESTIONS, REACTIONS, STC_BEATS, TIER_LABEL } from '../../shared/structure.ts';
import type {
  ActionInterpretation,
  Approach,
  Character,
  Domain,
  Effect,
  EmpathySignal,
  ID,
  Interpretation,
  InterpretationKey,
  Modifier,
  Opportunity,
  PendingAction,
  Reaction,
  ReactionKind,
  Resolution,
  Risk,
  Scene,
  ScreenplayElement,
  Setup,
  SimState,
  StcBeatKey,
  StoryEvent,
  StoryModel,
  ThemeStance,
  Tier,
} from '../../shared/types.ts';
import type { ApproachDraft } from './engine.ts';
import type { DirectorContext, DiscoveryDraft, OutcomeNarration, ReportDraft } from './director.ts';

type Ctx = DirectorContext;
type Element = Omit<ScreenplayElement, 'id'>;

// ───────── Text helpers ─────────

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const upperFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Capitalised and terminally punctuated. */
const sentence = (s: string): string => {
  const t = s.trim();
  return t && upperFirst(/[.!?…"”]$/.test(t) ? t : `${t}.`);
};
/** Whole-word, case-insensitive match that also works for non-ASCII names (\b is ASCII-only). */
const wordRe = (word: string, flags = 'i'): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(word)}(?![\\p{L}\\p{N}_])`, `${flags}u`);
const wordAt = (text: string, word: string): number => (word ? text.search(wordRe(word)) : -1);
const signed = (n: number): string => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const pick = <T>(options: T[], seed: number): T => options[seed % options.length];
const listJoin = (items: string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
/** Entries sorted by count, most frequent first (ties keep first-seen order). */
const countBy = <T>(items: T[], key: (t: T) => string): [string, number][] => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
};
function maxBy<T>(items: T[], score: (t: T) => number): T | undefined {
  let best: T | undefined;
  let top = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > top) [best, top] = [item, s];
  }
  return best;
}
const STOP = new Set(
  'that this with from have what they them their there about into will would could should been were when where which your just then than some more very only over under after before because while'.split(' '),
);
const significantWords = (s: string): string[] =>
  s.toLowerCase().match(/[\p{L}']{4,}/gu)?.filter((w) => !STOP.has(w)) ?? [];

// ───────── Story-state helpers (also used by director.ts) ─────────

export const charOf = (ctx: Ctx, id: ID | undefined): Character | undefined =>
  id ? ctx.project.model.characters.find((c) => c.id === id) : undefined;
export const nameOf = (c: Character | undefined): string => c?.name.trim().split(/\s+/)[0] || 'Someone';
export const currentSequence = (sim: SimState) =>
  sim.sequences.find((s) => s.id === sim.currentSequenceId) ?? sim.sequences.at(-1);
export const currentScene = (sim: SimState): Scene | undefined =>
  sim.scenes.find((s) => s.id === sim.currentSceneId) ?? sim.scenes.at(-1);
export const currentBeat = (sim: SimState) => STC_BEATS[Math.min(Math.max(sim.beatIndex, 0), STC_BEATS.length - 1)];
export const openSetups = (sim: SimState): Setup[] =>
  sim.setups.filter((s) => s.status === 'open' || s.status === 'payoff-candidate');
const relOf = (sim: SimState, from: ID, to: ID) => sim.relationships.find((r) => r.from === from && r.to === to);

/** HGS progress once this outcome lands, mirroring engine.progressFor (the engine applies it; the Director only judges). */
export function expectedProgress(sim: SimState, tier: Tier, approach: Approach): { progress: number; required: number } {
  const seq = currentSequence(sim);
  const gain: Record<Tier, number> = {
    critical: approach.progressOnSuccess + 1,
    success: approach.progressOnSuccess,
    complication: 1,
    failure: 0,
  };
  return { progress: (seq?.progress ?? 0) + gain[tier], required: seq?.required ?? 3 };
}

/** Trait vocabulary for observed behaviour — compared against declared values in discovery analysis (PRD §31). */
export const DOMAIN_TRAIT: Record<Domain, string> = {
  intimidate: 'aggression under pressure',
  deceive: 'deception',
  empathize: 'compassion in action',
  persuade: 'appeals to reason',
  investigate: 'relentless curiosity',
  physical: 'physical risk-taking',
  stealth: 'evasion',
  craft: 'resourcefulness',
};

/** The observed-behaviour record for an attempt: what the character chose, and how it landed. */
export function behaviorEffect(ctx: Ctx, characterId: ID, approach: Approach, tier: Tier): Effect {
  const trait = DOMAIN_TRAIT[approach.domain];
  const text = `${nameOf(charOf(ctx, characterId))} chose to ${lowerFirst(approach.label)} (${TIER_LABEL[tier].toLowerCase()})`;
  return { type: 'behavior', label: `Behaviour: ${trait}`, characterId, trait, text };
}

const placeOf = (scene: Scene | undefined): string => {
  const where = scene?.heading
    .replace(/^(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|I\/E)\.?\s*/i, '')
    .split(/\s+[–—-]\s+/)[0]
    .trim();
  return where ? `the ${where.toLowerCase()}` : 'here';
};

/** An authored phrase for use mid-sentence: no final stop, lower-cased unless it opens with a name. */
function phrase(ctx: Ctx, s: string): string {
  const t = s.trim().replace(/[.!?…]+$/, '');
  const first = t.split(/\s+/)[0] ?? '';
  const isName = ctx.project.model.characters.some((c) => c.name.split(/\s+/).includes(first));
  return isName || /^[A-Z]{2}/.test(first) ? t : lowerFirst(t);
}

function gerund(verb: string): string {
  const w = verb.toLowerCase();
  if (/ie$/.test(w)) return `${w.slice(0, -2)}ying`;
  if (/[^aeiou]e$/.test(w) && w !== 'be') return `${w.slice(0, -1)}ing`;
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w)) return `${w}${w.at(-1)}ing`;
  return `${w}ing`;
}
/** "Find out who gave Mara the photograph" → "finding out who gave Mara the photograph"; null when the goal is not a verb phrase. */
function goalInProgress(ctx: Ctx, goal: string): string | null {
  const [first, ...rest] = phrase(ctx, goal).replace(/^to\s+/i, '').split(' ');
  return first && /^[a-z]+$/.test(first) && !/^(?:the|a|an|his|her|their|my|our|no|some)$/.test(first) ? [gerund(first), ...rest].join(' ') : null;
}
/** Authored obstacles often address the performer ("Mara does not trust you"); prose names the actor instead. */
const aboutActor = (ctx: Ctx, s: string, A: string): string =>
  phrase(ctx, s).replace(/\byourself\b/gi, A).replace(/\byour\b/gi, `${A}'s`).replace(/\byou\b/gi, A);

function mostRelevant(ctx: Ctx, actorId: ID, pool: ID[]): Character | undefined {
  const seq = currentSequence(ctx.sim);
  const pressure = `${seq?.goal ?? ''} ${seq?.stake ?? ''} ${seq?.obstacle ?? ''}`;
  const candidates = pool.filter((id) => id !== actorId).map((id) => charOf(ctx, id)).filter((c): c is Character => !!c);
  return maxBy(
    candidates,
    (c) => (wordAt(pressure, nameOf(c)) >= 0 ? 3 : 0) + (c.role === 'antagonist' ? 2 : 0) + (relOf(ctx.sim, c.id, actorId)?.tension ?? 0),
  );
}
const presentIds = (ctx: Ctx): ID[] => currentScene(ctx.sim)?.presentCharacterIds ?? [];

/** The opposition to `actorId`: the antagonist, else whoever holds the most tension toward them. */
function opposition(ctx: Ctx, actorId: ID, excludeId?: ID): Character | undefined {
  const others = ctx.project.model.characters.filter((c) => c.id !== actorId && c.id !== excludeId);
  return others.find((c) => c.role === 'antagonist') ?? maxBy(others, (c) => relOf(ctx.sim, c.id, actorId)?.tension ?? 0);
}

/** Whom `fromId` runs to: the person they trust most (other than the actor), else the opposition (PRD §21, §27). */
function confidant(ctx: Ctx, fromId: ID, actorId: ID): Character | undefined {
  const trusted = ctx.sim.relationships
    .filter((r) => r.from === fromId && r.to !== actorId && r.to !== fromId && r.trust > 0)
    .sort((a, b) => b.trust - a.trust)[0];
  return charOf(ctx, trusted?.to) ?? opposition(ctx, actorId, fromId);
}

const EVIDENCE = /\b(?:evidence|photo\w*|file|files|ledger\w*)\b/i;
/** Something the character holds (or, with knowledge, knows) that works as evidence. */
function evidenceOf(ctx: Ctx, characterId: ID, withKnowledge: boolean): string | undefined {
  const st = ctx.sim.characters[characterId];
  const items = st ? [...st.resources, ...(withKnowledge ? st.knowledge : [])] : (charOf(ctx, characterId)?.resources ?? []);
  return items.find((i) => EVIDENCE.test(i));
}

function namedCharacter(ctx: Ctx, text: string, excludeId: ID | undefined): Character | undefined {
  let best: Character | undefined;
  let at = Infinity;
  for (const c of ctx.project.model.characters) {
    if (c.id === excludeId) continue;
    for (const n of [c.name, nameOf(c)]) {
      const i = wordAt(text, n);
      if (i >= 0 && i < at) [best, at] = [c, i];
    }
  }
  return best;
}

// ───────── Language: verbs, pronouns, speech ─────────

/** Earliest verb in the input decides the domain (PRD §19). */
const DOMAIN_VERBS: [Domain, RegExp][] = [
  ['intimidate', /\b(?:threat\w*|accus\w*|demand\w*|confront\w*|intimidat\w*|blackmail\w*|menac\w*|interrogat\w*|glare\w*)/i],
  ['deceive', /\b(?:lie|lies|lied|lying|bluff\w*|pretend\w*|trick\w*|fake\w*|feign\w*|deceiv\w*|mislead\w*|impersonat\w*|disguis\w*)\b/i],
  ['persuade', /\b(?:convinc\w*|persuad\w*|ask|asks|asked|asking|plead\w*|beg|begs|begged|begging|argu\w*|negotiat\w*|bargain\w*|urg(?:e|es|ed|ing)\b|appeal\w*|offer\w*|promis\w*|reason with)/i],
  ['investigate', /\b(?:search\w*|examin\w*|stud(?:y|ies|ied|ying)\b|inspect\w*|investigat\w*|look(?:s|ed|ing)? (?:for|into|through|at)\b|check\w*|analy[sz]\w*|scan\w*|read(?:s|ing)?\b|research\w*|trac(?:e|es|ed|ing)\b)/i],
  ['stealth', /\b(?:sneak\w*|snuck|hid(?:e|es|ing|den)?\b|follow\w*|tail(?:s|ed|ing)?\b|creep\w*|crept|slip\w*|eavesdrop\w*|lurk\w*|steal\w*|stole\w*|pickpocket\w*)/i],
  ['physical', /\b(?:hit|hits|hitting|grab\w*|run|runs|ran|running|break\w*|broke|chas\w*|punch\w*|fight\w*|fought|push\w*|shov\w*|climb\w*|jump\w*|tackl\w*|kick\w*|flee\w*|fled|attack\w*|lift\w*|throw\w*|threw|restrain\w*|escap\w*|strik\w*|struck|kill\w*|shoot\w*|stab\w*)/i],
  ['craft', /\b(?:fix\w*|forg(?:e|es|ed|ing)\b|hack\w*|pick\w*(?: \w+)? locks?\b|repair\w*|rig(?:s|ged|ging)?\b|disabl\w*|decod\w*|decrypt\w*|build\w*|built|sabotag\w*|jam(?:s|med|ming)?\b|bypass\w*)/i],
  ['empathize', /\b(?:comfort\w*|listen\w*|apologi[sz]\w*|consol\w*|reassur\w*|hug(?:s|ged|ging)?\b|sympathi[sz]\w*|confid(?:e|es|ed|ing)\b|thank\w*|forgiv\w*|forgave|open(?:s|ed)? up)/i],
];
function detectDomain(text: string): Domain | undefined {
  let best: Domain | undefined;
  let at = Infinity;
  for (const [domain, re] of DOMAIN_VERBS) {
    const m = re.exec(text);
    if (m && m.index < at) [best, at] = [domain, m.index];
  }
  return best;
}

const TRIVIAL =
  /\b(?:look(?:s|ed|ing)? around|sit(?:s|ting)?\b|sat\b|wait\w*|say(?:s)? hello|hello|hi\b|greet\w*|nod\w*|smil\w*|shrug\w*|stand(?:s|ing)?\b|stood|breath\w*|paus\w*|pour\w*|enter\w*|walk(?:s|ed|ing)? (?:in|over|around)|introduc\w*)/i;
const SPEECH =
  /\b(?:say|says|said|tell|tells|told|ask\w*|accus\w*|threat\w*|convinc\w*|persuad\w*|demand\w*|plead\w*|beg(?:s|ged|ging)?|apologi[sz]\w*|lie to|bluff\w*|promis\w*|warn\w*|confess\w*|admit\w*|explain\w*|insist\w*|reassur\w*|comfort\w*|argu\w*|whisper\w*|shout\w*|talk\w*|speak\w*)\b/i;
const LETHAL = /\b(?:kill\w*|shoot\w*|shot|stab\w*|strangl\w*|gun|knife|blade)\b/i;
const VIOLENT = /\b(?:hit|hits|hitting|punch\w*|kick\w*|attack\w*|tackl\w*|fight\w*|fought|strik\w*|struck|shov\w*|slam\w*|chok\w*)\b/i;
const HESITATION =
  /\b(?:hesitat\w*|refus\w*|doubt\w*|wonder\w*|reconsider\w*|question\w*|hold(?:s|ing)? back|not sure|second thoughts|should (?:i|we)|why should|wait\w*|paus\w*|walk(?:s|ing)? away)\b/i;
const REFLECTION = /\b(?:remember\w*|admit\w*|confess\w*|realiz\w*|realis\w*|forgiv\w*|alone|truth|griev\w*|grief|mourn\w*)\b/i;
const TIME_PRESSURE = /\b(?:leav\w*|escap\w*|before|runs? out|deadline)\b/i;

interface Pronouns { subj: string; obj: string; poss: string; refl: string; plural: boolean }
function pronounsOf(c: Character | undefined): Pronouns {
  const t = `${c?.summary ?? ''} ${c?.performerBrief ?? ''}`;
  const she = t.match(/\b(?:she|her|hers|herself)\b/gi)?.length ?? 0;
  const he = t.match(/\b(?:he|him|his|himself)\b/gi)?.length ?? 0;
  if (she > he) return { subj: 'she', obj: 'her', poss: 'her', refl: 'herself', plural: false };
  if (he > she) return { subj: 'he', obj: 'him', poss: 'his', refl: 'himself', plural: false };
  return { subj: 'they', obj: 'them', poss: 'their', refl: 'themselves', plural: true };
}

const COMMON_VERBS = new Set(
  'walk turn leave look say tell take give put open close move step lean wait sit stand smile nod shrug keep try go come head reach hand pull slide drop pocket watch stare point slam laugh whisper mutter get make let show hold stop start call pick wipe lock unlock knock light'.split(' '),
);
const MODAL = /^(?:can|could|will|would|shall|should|may|might|must|did|had|was|were|cannot|can't|won't|didn't|wouldn't|couldn't)$/i;
const IRREGULAR: Record<string, string> = { am: 'is', are: 'is', be: 'is', have: 'has', do: 'does', go: 'goes', "don't": "doesn't" };
const isAdverb = (w: string): boolean =>
  /^(?:also|just|still|then|never|always|now|again|finally|only)$/i.test(w) || (/ly$/i.test(w) && !/(?:ply|rely|fly|ally)$/i.test(w));
const isVerbish = (w: string): boolean => COMMON_VERBS.has(w.toLowerCase()) || DOMAIN_VERBS.some(([, re]) => re.test(w));
function conjugate(w: string): string {
  const lw = w.toLowerCase();
  if (IRREGULAR[lw]) return IRREGULAR[lw];
  if (MODAL.test(lw) || (/ed$/.test(lw) && !/eed$/.test(lw))) return w;
  if (/(?:s|sh|ch|x|z|o)$/.test(lw)) return `${w}es`;
  if (/[^aeiou]y$/.test(lw)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

/** "I grab the file and run" → "Ines grabs the file and runs." Quoted speech is left untouched. */
export function toThirdPerson(input: string, c: Character | undefined): string {
  const name = nameOf(c);
  const p = pronounsOf(c);
  const text = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bI'm\b/g, 'I am')
    .replace(/\bI've\b/g, 'I have')
    .replace(/\bI'll\b/g, 'I will')
    .replace(/\bI'd\b/g, 'I would');
  if (!/\bI\b/.test(text)) {
    if (/^["“]/.test(text)) return `${name} says, ${text}`;
    if (wordAt(text, name) === 0) return sentence(text);
    const [first, ...rest] = text.split(' ');
    return sentence(isVerbish(first) ? `${name} ${conjugate(first.toLowerCase())} ${rest.join(' ')}` : `${name}: ${text}`);
  }
  let named = false;
  let owed: 'singular' | 'plural' | null = null; // the next verb still needs agreement with its subject
  let singularClause = true;
  let armed = false; // just saw "and"/"then" after a converted clause
  const convert = (segment: string): string =>
    segment
      .split(' ')
      .map((tok) => {
        const [, pre = '', word = '', post = ''] = /^([^\w']*)([\w'-]*)(.*)$/s.exec(tok) ?? [];
        const lw = word.toLowerCase();
        const keepCase = (s: string) => (/^[A-Z]/.test(word) ? upperFirst(s) : s);
        let rep = word;
        if (word === 'I') {
          rep = named ? p.subj : name;
          owed = named && p.plural ? 'plural' : 'singular';
          singularClause = owed === 'singular';
          named = true;
        } else if (owed && word) {
          if (!isAdverb(lw)) {
            if (owed === 'singular') rep = conjugate(word);
            owed = null;
          }
        } else if (armed && word && isVerbish(lw)) {
          if (singularClause) rep = conjugate(word);
          armed = false;
        } else if (lw === 'me') rep = keepCase(p.obj);
        else if (lw === 'my') rep = keepCase(p.poss);
        else if (lw === 'myself') rep = keepCase(p.refl);
        else if (lw === 'mine') rep = keepCase(p.plural ? 'theirs' : p.subj === 'she' ? 'hers' : 'his');
        if (word) armed = named && (lw === 'and' || lw === 'then');
        return pre + rep + post;
      })
      .join(' ');
  return sentence(
    text
      .split(/(["“][^"“”]*["”])/)
      .map((seg, i) => (i % 2 ? seg : convert(seg)))
      .join(''),
  );
}

const QUOTED = /["“]([^"“”]+)["”]/g;
function splitSpeech(input: string): { lines: string[]; rest: string } {
  const lines = [...input.matchAll(QUOTED)].map((m) => m[1].trim()).filter(Boolean);
  const rest = input.replace(QUOTED, ' ').replace(/\s+/g, ' ').replace(/[\s,:;—-]+$/, '').trim();
  return { lines, rest };
}
const BARE_SPEECH =
  /^(?:I\s+)?(?:say|says|said|ask|asks|tell|tells|reply|replies|answer|answers|whisper|whispers|shout|shouts|mutter|mutters)(?:\s+(?:to\s+)?\w+)?$/i;

/** The speaker addresses the target: third-person references to them become "you"/"your". */
function toSecondPerson(s: string, target: Character | undefined): string {
  let out = s;
  if (target) {
    const n = nameOf(target);
    out = out.replace(wordRe(`${n}'s`, 'gi'), 'your').replace(wordRe(n, 'gi'), 'you');
  }
  return out
    .replace(
      /\b(?:him|her|them)(?=\s*(?:$|[,.;!?]|\s(?:the|a|an|to|about|for|with|from|of|in|on|at|and|or|but|so|that|what|who|where|why|how|if|unless|until|before|because|when|while|into|up|down|out|off|over|alone|everything|anything|nothing|something|again|now|back)\b))/gi,
      'you',
    )
    .replace(/\b(?:his|her|their)\b/gi, 'your')
    .replace(/\b(?:him|them)\b/gi, 'you')
    .replace(/\b(?:himself|herself|themselves)\b/gi, 'yourself');
}

const GENERIC_LINE: Record<Domain, string> = {
  persuade: 'Hear me out.',
  deceive: 'You can trust me.',
  intimidate: "Don't lie to me.",
  empathize: "I'm here. Talk to me.",
  investigate: 'What is this?',
  stealth: 'Keep your voice down.',
  physical: 'Move.',
  craft: 'Give me a minute.',
};

/** Screenplay dialogue rebuilt from a performer's described intent ("I ask Mara who gave her the photograph"). */
function reconstructLine(input: string, target: Character | undefined, domain: Domain | undefined): string {
  const s = input.trim().replace(/^I\s+/i, '').replace(/[.!?]+$/, '');
  const who = `(?:${target ? `${escapeRe(nameOf(target))}|` : ''}him|her|them)`;
  const you = (x: string) => toSecondPerson(x, target);
  // "she gives me the key" → "give me the key"
  const imperative = (clause: string) => {
    const [verb = '', ...rest] = you(clause).replace(/^(?:she|he|they|you)\s+/i, '').split(' ');
    return [verb.replace(/ies$/, 'y').replace(/(s|sh|ch|x|z|o)es$/, '$1').replace(/([^s])s$/, '$1'), ...rest].join(' ');
  };
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    [
      /^(?:say|says)\s+(hello|hi|goodbye|good night|good morning|thanks|thank you|sorry)(?:\s+to\s+(\S+))?$/i,
      (m) => `${upperFirst(m[1].toLowerCase())}${m[2] && /^[A-Z]/.test(m[2]) ? `, ${m[2]}` : ''}`,
    ],
    [new RegExp(`^(?:tell|tells|told)\\s+${who}\\s+(?:that\\s+)?(.+)$`, 'i'), (m) => you(m[1])],
    [/^(?:say|says|said)\s+(?:that\s+)?(.+)$/i, (m) => you(m[1])],
    [new RegExp(`^threat\\w*\\s+(?:${who}\\s+)?to\\s+(.+?)\\s+unless\\s+(.+)$`, 'i'), (m) => `${upperFirst(imperative(m[2]))}, or I'll ${you(m[1])}`],
    [new RegExp(`^ask\\w*\\s+(?:${who}\\s+)?(who|what|where|when|why|how)\\s+(.+)$`, 'i'), (m) => `${upperFirst(m[1].toLowerCase())} ${you(m[2])}?`],
    [new RegExp(`^ask\\w*\\s+(?:${who}\\s+)?about\\s+(.+)$`, 'i'), (m) => `Tell me about ${you(m[1])}`],
    [new RegExp(`^ask\\w*\\s+(?:${who}\\s+)?for\\s+(.+)$`, 'i'), (m) => `I need ${you(m[1])}`],
    [new RegExp(`^(?:ask|convinc|persuad|urg|plead|beg)\\w*\\s+(?:with\\s+)?(?:${who}\\s+)?to\\s+(.+)$`, 'i'), (m) => `I need you to ${you(m[1])}`],
    [new RegExp(`^(?:convinc|persuad)\\w*\\s+(?:${who}\\s+)?that\\s+(.+)$`, 'i'), (m) => you(m[1])],
    [new RegExp(`^accus\\w*\\s+(?:${who}\\s+)?of\\s+(.+)$`, 'i'), (m) => `You've been ${you(m[1])}`],
    [new RegExp(`^threat\\w*\\s+(?:${who}\\s+)?to\\s+(.+)$`, 'i'), (m) => `Keep this up and I'll ${you(m[1])}`],
    [new RegExp(`^threat\\w*\\s+(?:${who}\\s+)?with\\s+(.+)$`, 'i'), (m) => `Don't make me use ${you(m[1])}`],
    [/^demand\w*\s+(?:that\s+)?(.+)$/i, (m) => `${upperFirst(you(m[1]))}. Now`],
    [/^apologi[sz]\w*(?:\s+to\s+\S+)?(?:\s+for\s+(.+))?$/i, (m) => (m[1] ? `I'm sorry for ${you(m[1])}` : "I'm sorry")],
    [/^(?:lie|lies|bluff\w*)(?:\s+to\s+\S+)?\s+(?:about|that)\s+(.+)$/i, (m) => you(m[1])],
  ];
  for (const [re, line] of rules) {
    const m = re.exec(s);
    if (m) return sentence(line(m));
  }
  return GENERIC_LINE[domain ?? 'persuade'];
}

// ───────── Theme ─────────

/** What each kind of action leans toward, in thematic vocabulary (PRD §30). */
const THEME_WORDS: Record<Domain, string[]> = {
  intimidate: ['control', 'power', 'revenge', 'force', 'fear', 'violence'],
  deceive: ['control', 'deception', 'lie', 'secret', 'betrayal', 'revenge'],
  empathize: ['trust', 'compassion', 'forgiveness', 'mercy', 'love', 'kindness', 'connection'],
  persuade: ['trust', 'truth', 'justice', 'reason', 'cooperation'],
  investigate: ['truth', 'justice', 'knowledge', 'obsession'],
  physical: ['violence', 'force', 'revenge', 'power', 'control', 'survival'],
  stealth: ['secret', 'survival', 'freedom', 'fear', 'control'],
  craft: ['control', 'independence', 'ingenuity', 'survival'],
};
const poles = (conflict: string): string[] =>
  conflict.split(/\s+(?:vs\.?|versus|against|or)\s+|\s*\/\s*/i).map((s) => s.trim()).filter(Boolean);

/** How an action of this domain bears on the story's thematic model, if at all. */
function themeLink(model: StoryModel, domain: Domain): { pole: string; other?: string; stance: ThemeStance } | null {
  const statement = model.theme.toLowerCase();
  for (const word of THEME_WORDS[domain]) {
    const re = new RegExp(`\\b${word}`, 'i');
    for (const conflict of [model.thematicConflict, model.philosophicalConflict]) {
      const sides = poles(conflict);
      const i = sides.findIndex((s) => re.test(s));
      if (i < 0) continue;
      const other = sides.length === 2 ? sides[1 - i] : undefined;
      const stance: ThemeStance = re.test(statement)
        ? 'reinforce'
        : other && new RegExp(`\\b${escapeRe(other.toLowerCase())}`).test(statement)
          ? 'develop'
          : 'tension';
      return { pole: sides[i], other, stance };
    }
    if (re.test(statement)) return { pole: word, stance: 'reinforce' };
  }
  return null;
}

// ───────── Effects ─────────

function effectsFor(ctx: Ctx) {
  const n = (id: ID) => nameOf(charOf(ctx, id));
  return {
    trust: (from: ID, to: ID, delta: number): Effect => ({ type: 'trust', label: `${n(from)}'s trust in ${n(to)} ${signed(delta)}`, from, to, delta }),
    tension: (a: ID, b: ID, delta: number): Effect => ({ type: 'tension', label: `Tension ${n(a)} and ${n(b)} ${signed(delta)}`, a, b, delta }),
    knowledge: (characterId: ID, fact: string): Effect => ({ type: 'knowledge', label: `${n(characterId)} learns: ${clip(fact, 90)}`, characterId, fact }),
    condition: (characterId: ID, condition: string): Effect => ({ type: 'condition', label: `${n(characterId)} is ${condition}`, characterId, condition }),
    gains: (characterId: ID, item: string): Effect => ({ type: 'resource', label: `${n(characterId)} now has ${item}`, characterId, add: item }),
    loses: (characterId: ID, item: string): Effect => ({ type: 'resource', label: `${n(characterId)} loses ${item}`, characterId, remove: item }),
    promise: (from: ID, to: ID, text: string): Effect => ({ type: 'promise', label: `Obligation: ${text}`, from, to, text }),
    setup: (text: string): Effect => ({ type: 'setup', label: `Future setup: ${text}`, text }),
    reinforce: (s: Setup): Effect => ({ type: 'reinforce', label: `Setup reinforced: ${clip(s.text, 70)}`, setupId: s.id }),
    payoff: (s: Setup, text: string): Effect => ({ type: 'payoff', label: `Payoff: ${clip(s.text, 70)}`, setupId: s.id, text }),
    theme: (stance: ThemeStance, text: string): Effect => ({ type: 'theme', label: `Theme: ${text}`, stance, text }),
    empathy: (characterId: ID, signal: EmpathySignal, text: string): Effect => ({
      type: 'empathy',
      label: `Empathy signal observed: ${EMPATHY_SIGNALS[signal].toLowerCase()}`,
      characterId,
      signal,
      text,
    }),
  };
}

/** An open setup this moment touches, by shared names or significant words. */
function relatedSetup(sim: SimState, text: string): Setup | undefined {
  const words = new Set(significantWords(text));
  return openSetups(sim).find((s) => significantWords(s.text).some((w) => words.has(w)));
}

/** What `c` can reveal, in reveal order; `found` = discovered by searching rather than told. */
function factsAbout(ctx: Ctx, c: Character, found: boolean): { fact: string; secret: boolean }[] {
  const N = nameOf(c);
  return [
    ...(found ? c.resources.map((r) => ({ fact: `${N} has ${phrase(ctx, r)}`, secret: false })) : []),
    ...(c.goal ? [{ fact: `${N} is trying to ${lowerFirst(phrase(ctx, c.goal).replace(/^to\s+/i, ''))}`, secret: false }] : []),
    ...(c.fear && !found ? [{ fact: `${N} is afraid of ${lowerFirst(phrase(ctx, c.fear))}`, secret: false }] : []),
    // A secret opening with a bare pronoun ("He ordered…") gets the name back so it reads out of context.
    ...(c.secret ? [{ fact: phrase(ctx, c.secret).replace(/^(he|she|they)\b/i, N), secret: true }] : []),
  ];
}

// ───────── Structure: which beat requirements an event satisfies (all 15 beats) ─────────

interface BeatSignal {
  actorId: ID;
  target?: Character;
  domain: Domain;
  risk?: Risk;
  tier?: Tier; // undefined = no roll
  input: string;
  effects: Effect[];
  propagated: boolean;
}

function beatRequirementsFor(ctx: Ctx, o: BeatSignal): string[] {
  const { model } = ctx.project;
  const actor = charOf(ctx, o.actorId);
  const isProtagonist = o.actorId === model.protagonistId;
  const setback = o.tier === 'complication' || o.tier === 'failure';
  const win = o.tier === 'success' || o.tier === 'critical';
  const bold = o.risk === 'high' || o.risk === 'extreme';
  const inputWords = new Set(significantWords(o.input));
  const mentions = (s: string) => significantWords(s).some((w) => inputWords.has(w));
  const pastTraits = countBy(ctx.sim.characters[o.actorId]?.behaviors ?? [], (b) => b.trait);
  const newApproach = win && pastTraits.reduce((n, [, k]) => n + k, 0) >= 2 && pastTraits[0][0] !== DOMAIN_TRAIT[o.domain];
  const has = (pred: (e: Effect) => boolean) => o.effects.some(pred);
  const fracture = has(
    (e) => e.type === 'trust' && e.delta < 0 && [e.from, e.to].some((id) => id !== o.actorId && charOf(ctx, id)?.role !== 'antagonist'),
  );
  const loss = has((e) => (e.type === 'resource' && !!e.remove) || (e.type === 'condition' && !e.clear));

  const checks: Record<StcBeatKey, [string, boolean][]> = {
    'opening-image': [['world-shown', isProtagonist], ['flaw-visible', setback || o.domain === 'intimidate' || o.domain === 'deceive']],
    'theme-stated': [['theme-voiced', has((e) => e.type === 'theme') || mentions(`${model.thematicConflict} ${model.philosophicalConflict}`)]],
    'set-up': [
      ['relationships-established', has((e) => e.type === 'trust' || e.type === 'tension' || e.type === 'promise' || e.type === 'betrayal')],
      ['stakes-established', setback || (!!o.tier && bold)],
    ],
    catalyst: [['disruption', setback || o.tier === 'critical']],
    debate: [
      ['resistance', o.domain === 'empathize' || o.domain === 'persuade' || HESITATION.test(o.input)],
      ['cost-weighed', setback || (!!o.tier && bold)],
    ],
    'break-into-two': [['active-choice', isProtagonist && !!o.tier && o.risk !== 'low']],
    'b-story': [['b-relationship', has((e) => (e.type === 'trust' && e.delta > 0) || e.type === 'promise')]],
    'fun-and-games': [['premise-explored', win], ['opposition-rising', setback]],
    midpoint: [
      ['reversal', o.tier === 'critical' || (o.tier === 'failure' && bold)],
      ['stakes-raised', (setback && o.risk !== 'low') || o.propagated],
    ],
    'bad-guys-close-in': [
      ['pressure-mounts', setback && (o.propagated || o.target?.role === 'antagonist')],
      ['team-fractures', fracture],
    ],
    'all-is-lost': [
      ['strategy-collapse', o.tier === 'failure' && o.risk !== 'low'],
      ['loss', o.tier === 'failure' && (bold || loss)],
    ],
    'dark-night-of-the-soul': [
      ['reckoning', o.domain === 'empathize' || REFLECTION.test(o.input) || mentions(`${actor?.fear ?? ''} ${actor?.wound ?? ''}`)],
    ],
    'break-into-three': [['synthesis', newApproach || o.tier === 'critical']],
    finale: [
      ['new-approach-applied', newApproach],
      ['antagonist-confronted', !!o.tier && o.target?.role === 'antagonist'],
      ['setups-paid', has((e) => e.type === 'payoff')],
    ],
    'final-image': [['change-shown', isProtagonist && win]],
  };
  return checks[currentBeat(ctx.sim).key].filter(([, ok]) => ok).map(([id]) => id);
}

// ───────── interpretAction ─────────

const SOCIAL = new Set<Domain>(['persuade', 'deceive', 'intimidate', 'empathize']);
const LEVERAGE = new Set<Domain>(['persuade', 'deceive', 'intimidate', 'investigate']);

const INTENT: Record<Domain, (T: string | null) => string> = {
  persuade: (T) => (T ? `win ${T}'s cooperation` : 'make the case for what is needed'),
  deceive: (T) => (T ? `get past ${T} with a lie` : 'hide the truth'),
  intimidate: (T) => (T ? `force the truth from ${T} through confrontation` : 'force the situation'),
  investigate: (T) => (T ? `read what ${T} is hiding` : 'uncover what is hidden here'),
  stealth: (T) => (T ? `move unseen by ${T}` : 'get in and out unseen'),
  physical: (T) => (T ? `overpower ${T}` : 'force a way through'),
  craft: () => 'make the tools at hand do the work',
  empathize: (T) => (T ? `reach ${T} through understanding` : 'steady the moment'),
};

const RISK_SHAPE: Record<Risk, string> = {
  low: 'Slow progress',
  medium: 'Moderate progress',
  high: 'Fast progress, major future consequence',
  extreme: 'Everything moves at once',
};
const EXPOSURE: Record<Domain, (T: string) => string> = {
  persuade: (T) => `${T} can simply say no, and the moment passes`,
  deceive: (T) => `if ${T} sees through it, trust breaks`,
  intimidate: (T) => `${T} will not forget being cornered`,
  empathize: (T) => `${T} may open up, or read it as weakness`,
  investigate: () => 'the longer it takes, the likelier someone notices',
  stealth: () => 'if you are seen, your presence becomes the story',
  physical: () => 'it is loud, visible and hard to undo',
  craft: () => 'tampering takes time and leaves traces',
};
const previewFor = (domain: Domain, risk: Risk, T: string | null): string => `${RISK_SHAPE[risk]}; ${EXPOSURE[domain](T ?? 'they')}.`;

type AltDraft = Omit<ApproachDraft, 'targetId' | 'circumstances' | 'isPlayerOwn'>;
/** PRD §22 / §47 shapes: Ask directly / Bluff / Threaten, or their no-target equivalents. */
function alternativePool(T: string | null, leverage: boolean): AltDraft[] {
  const alt = (domain: Domain, risk: Risk, label: string, description: string): AltDraft => ({
    domain,
    risk,
    label,
    description,
    consequencePreview: previewFor(domain, risk, T),
  });
  if (!T) {
    return [
      alt('investigate', 'low', 'Look carefully', 'Take the time to study what is here.'),
      alt('stealth', 'medium', 'Search quietly', 'Move through it out of sight.'),
      alt('craft', 'medium', 'Work around the obstacle', 'Use tools or know-how to get past it.'),
      alt('physical', 'high', 'Force it', 'Break through and take what is there.'),
    ];
  }
  return [
    alt('persuade', 'low', `Ask ${T} directly`, `Ask plainly and let ${T} decide.`),
    alt('empathize', 'low', `Listen to ${T} first`, `Give ${T} room to talk and hear what is underneath.`),
    alt('deceive', 'medium', `Bluff ${T}`, 'Pretend to know more than you do.'),
    alt('stealth', 'medium', `Go around ${T}`, `Get what you need without ${T} knowing.`),
    alt('intimidate', 'high', leverage ? `Threaten to expose ${T}` : `Threaten ${T}`, `Put ${T} under real pressure${leverage ? ' with what you hold' : ''}.`),
    alt('physical', 'high', `Physically stop ${T}`, `Take it from ${T} by force.`),
  ];
}

function ownRisk(input: string, domain: Domain): Risk {
  if (LETHAL.test(input)) return 'extreme';
  if (domain === 'intimidate' || VIOLENT.test(input)) return 'high';
  if (domain === 'deceive' || domain === 'stealth' || domain === 'craft' || domain === 'physical') return 'medium';
  return 'low';
}

const ownLabel = (input: string): string => {
  const t = input.trim();
  const quoted = /^["“]([^"”]+)["”]/.exec(t)?.[1];
  return clip(quoted ? `Say “${quoted.trim()}”` : upperFirst(t.replace(/^I\s+/i, '').replace(/[.!?]+$/, '')), 60);
};

/** What any attempt by the actor against `target` right now is up against: shared by declared and offered moves. */
function situation(ctx: Ctx, characterId: ID, target: Character | undefined) {
  const { sim } = ctx;
  const A = nameOf(charOf(ctx, characterId));
  const T = target ? nameOf(target) : null;
  const seq = currentSequence(sim);
  const rel = target ? relOf(sim, target.id, characterId) : undefined;
  const unstable = (rel?.trust ?? 0) <= -2;
  const timePressure = TIME_PRESSURE.test(seq?.stake ?? '');
  const leverage = !!evidenceOf(ctx, characterId, true);
  const pull = (d: Domain) => themeLink(ctx.project.model, d)?.pole;
  return {
    A,
    T,
    rel,
    unstable,
    leverage,
    pull,
    circumstances: (d: Domain, tid: ID | undefined): Modifier[] => [
      ...(leverage && LEVERAGE.has(d) ? [{ label: 'Evidence in hand', value: 1 }] : []),
      ...(timePressure ? [{ label: 'Time pressure', value: -1 }] : []),
      ...(tid && unstable ? [{ label: 'Already unstable', value: -1 }] : []),
    ],
    frame: {
      targetId: target?.id,
      obstacle: seq?.obstacle || (T && (rel?.trust ?? 0) < 0 ? `${T} does not trust ${A}` : 'Nothing here gives way easily'),
      stakes: seq?.stake || 'What happens next depends on it',
      reminder:
        [seq?.goal && `Goal: ${sentence(seq.goal)}`, seq?.stake && `At stake: ${sentence(seq.stake)}`, timePressure && 'Time is short.']
          .filter(Boolean)
          .join(' ') || 'Keep the goal in sight.',
    },
  };
}

export function interpretAction(
  ctx: Ctx,
  characterId: ID,
  input: string,
): { interpretation: ActionInterpretation; approaches: ApproachDraft[] } {
  const explicit = detectDomain(input);
  const named = namedCharacter(ctx, input, characterId);
  const target = named ?? mostRelevant(ctx, characterId, presentIds(ctx));
  const { A, T, rel, unstable, leverage, pull, circumstances, frame } = situation(ctx, characterId, target);
  const domain: Domain = explicit ?? ((named || SPEECH.test(input)) && target ? 'persuade' : 'investigate');
  // A named character who distrusts or resents the actor turns even a trivial gesture into a contest.
  const resisted = !!named && (unstable || (rel?.tension ?? 0) >= 3);
  const needsRoll = !(TRIVIAL.test(input) && !explicit && !resisted);
  const link = themeLink(ctx.project.model, domain);

  const interpretation: ActionInterpretation = {
    ...frame,
    intent: needsRoll ? INTENT[domain](T) : 'take in the moment',
    domain,
    needsRoll,
    themeRelevance:
      link && needsRoll ? `${link.other ? `${link.pole} vs ${link.other}` : 'Theme'}: ${A} leans toward ${link.pole}.` : undefined,
  };
  if (!needsRoll) return { interpretation, approaches: [] };

  const risk = ownRisk(input, domain);
  const own: ApproachDraft = {
    label: ownLabel(input),
    description: `${A}'s own move, as performed: "${clip(input.trim(), 160)}"`,
    domain,
    risk,
    targetId: target?.id,
    circumstances: circumstances(domain, target?.id),
    consequencePreview: previewFor(domain, risk, T),
    isPlayerOwn: true,
    themePull: pull(domain),
  };
  const pool = alternativePool(T, leverage);
  const alternatives = (['low', 'medium', 'high'] as const)
    .filter((r) => r !== risk)
    .flatMap((r) => {
      const alt = pool.find((a) => a.risk === r && a.domain !== domain) ?? pool.find((a) => a.risk === r);
      return alt
        ? [{ ...alt, targetId: target?.id, circumstances: circumstances(alt.domain, target?.id), isPlayerOwn: false, themePull: pull(alt.domain) }]
        : [];
    });
  return { interpretation, approaches: [own, ...alternatives] };
}

/**
 * Moves the Director offers before anything is declared: one per risk level, each preferring a different side of
 * the thematic conflict, so choosing between them is choosing what the story is about.
 */
export function proposeChoices(ctx: Ctx, characterId: ID): { interpretation: ActionInterpretation; approaches: ApproachDraft[] } {
  const target = mostRelevant(ctx, characterId, presentIds(ctx));
  const { T, leverage, pull, circumstances, frame } = situation(ctx, characterId, target);
  const goal = currentSequence(ctx.sim)?.goal;
  const pool = alternativePool(T, leverage);
  const picked: AltDraft[] = [];
  for (const risk of ['low', 'medium', 'high'] as const) {
    const pulled = new Set(picked.map((a) => pull(a.domain)));
    const options = pool.filter((a) => a.risk === risk);
    const fresh = options.find((a) => pull(a.domain) && !pulled.has(pull(a.domain)));
    const alt = fresh ?? options.find((a) => !picked.some((p) => p.domain === a.domain)) ?? options[0];
    if (alt) picked.push(alt);
  }
  const conflict = ctx.project.model.thematicConflict || ctx.project.model.philosophicalConflict;
  return {
    interpretation: {
      ...frame,
      intent: goal ? lowerFirst(goal.replace(/[.!]+$/, '')) : INTENT[picked[0]?.domain ?? 'investigate'](T),
      domain: picked[0]?.domain ?? 'investigate',
      needsRoll: true,
      themeRelevance: conflict ? `Each move leans a different way on ${conflict}.` : undefined,
    },
    approaches: picked.map((a) => ({
      ...a,
      targetId: target?.id,
      circumstances: circumstances(a.domain, target?.id),
      isPlayerOwn: false,
      themePull: pull(a.domain),
    })),
  };
}

// ───────── narrateNoRoll ─────────

export function narrateNoRoll(ctx: Ctx, pending: PendingAction): { narration: string; effects: Effect[]; beatRequirementsMet: string[] } {
  // The performed action is already on record; the Director only adds the world's (brief) response.
  const A = nameOf(charOf(ctx, pending.characterId));
  const watcher = mostRelevant(ctx, pending.characterId, presentIds(ctx));
  const W = watcher && nameOf(watcher);
  const narration = pick(
    [
      W ? `${W} watches ${A}, and says nothing.` : `For a moment, nothing in ${placeOf(currentScene(ctx.sim))} moves.`,
      `Nothing in ${placeOf(currentScene(ctx.sim))} feels settled.`,
      W ? `${W} does not look away.` : 'The moment passes.',
    ],
    ctx.sim.events.length,
  );
  return {
    narration,
    effects: [],
    beatRequirementsMet: beatRequirementsFor(ctx, {
      actorId: pending.characterId,
      target: charOf(ctx, pending.interpretation.targetId),
      domain: pending.interpretation.domain,
      input: pending.input,
      effects: [],
      propagated: false,
    }),
  };
}

// ───────── narrateOutcome ─────────

const TRUST_ON_SUCCESS: Partial<Record<Domain, number>> = { intimidate: -1, deceive: -1, persuade: 1, empathize: 1 };
const GERUND: Record<Domain, string> = {
  investigate: 'searching',
  stealth: 'sneaking around',
  physical: 'forcing a way through',
  craft: 'tampering',
  persuade: 'asking questions',
  deceive: 'lying',
  intimidate: 'making threats',
  empathize: 'asking questions',
};
const COMPLICATION_SETUP: Record<Domain, (A: string, W: string) => string> = {
  intimidate: (A, W) => `${W} may seek protection elsewhere`,
  deceive: (A, W) => `${W} is starting to doubt ${A}'s story`,
  persuade: (A, W) => `${W} knows ${A} is investigating`,
  empathize: (A, W) => `${W} opened up, and will expect ${A} to keep the confidence`,
  investigate: (A, W) => `${A}'s search left traces ${W} will find`,
  stealth: (A, W) => `${W} caught a glimpse of ${A} and will ask who it was`,
  physical: (A, W) => `The damage ${A} caused will have to be explained to ${W}`,
  craft: (A, W) => `${W} can trace the tampering back to ${A}`,
};

function freshNewsFrom(ctx: Ctx, actorId: ID, source: Character | undefined, fact: string): NonNullable<OutcomeNarration['freshNews']> {
  const A = nameOf(charOf(ctx, actorId));
  // Follow whoever the revelation names; otherwise the opposition.
  const named = ctx.project.model.characters.find((c) => c.id !== actorId && c.id !== source?.id && wordAt(fact, nameOf(c)) >= 0);
  const X = named ?? opposition(ctx, actorId, source?.id);
  const Xn = X && nameOf(X);
  if (source) {
    const S = nameOf(source);
    return {
      text: `${A} learns what ${S} was holding back: ${fact}.`,
      goal: Xn ? `Confront ${Xn} with what ${S} revealed` : `Follow what ${S} revealed to its source`,
      stake: `If ${A} moves carelessly, ${S} pays the price for talking`,
      obstacle: named ? `${Xn} kept this from ${A} for a reason` : Xn ? `${Xn} is already watching ${S}` : `${S} regrets saying anything`,
    };
  }
  return {
    text: `${A} finds it: ${fact}.`,
    goal: Xn ? `Get to ${Xn} before ${Xn} realises what ${A} found` : `Use what ${A} found before it is missed`,
    stake: `If ${A} is too slow, the proof is gone`,
    obstacle: Xn ? `${Xn} is expecting trouble` : 'Someone will notice it is missing',
  };
}

export function narrateOutcome(ctx: Ctx, pending: PendingAction, approach: Approach, resolution: Resolution): OutcomeNarration {
  const { model } = ctx.project;
  const { sim } = ctx;
  const f = effectsFor(ctx);
  const actorId = pending.characterId;
  const A = nameOf(charOf(ctx, actorId));
  const { tier } = resolution;
  const { domain } = approach;
  const win = tier === 'critical' || tier === 'success';
  const bold = approach.risk === 'high' || approach.risk === 'extreme';
  const seq = currentSequence(sim);
  const goal = seq?.goal || 'the goal';
  const obstacle = seq?.obstacle || 'the obstacle';
  const seed = sim.events.length;
  const place = placeOf(currentScene(sim));

  const targetId = approach.targetId ?? pending.interpretation.targetId;
  const target = targetId === actorId ? undefined : charOf(ctx, targetId);
  const source = target && SOCIAL.has(domain) ? target : undefined; // who yields (or withholds) information
  const S = nameOf(source);
  const witness = target ?? mostRelevant(ctx, actorId, presentIds(ctx));
  const W = witness && nameOf(witness);

  // What the actor can learn — authored material about the source (or the opposition, when searching).
  const { progress, required } = expectedProgress(sim, tier, approach);
  // Only the protagonist's outcomes move the Hero Goal Sequence (PRD §13).
  const hero = actorId === ctx.project.model.protagonistId;
  const achieving = hero && !!seq && seq.status === 'active' && win && progress >= required;
  const known = new Set(sim.characters[actorId]?.knowledge ?? []);
  const subject = source ?? opposition(ctx, actorId);
  const facts = subject ? factsAbout(ctx, subject, !source).filter((x) => !known.has(x.fact)) : [];
  const secret = tier === 'critical' || achieving ? facts.find((x) => x.secret) : undefined;
  const gain =
    facts.find((x) => !x.secret)?.fact ??
    (source ? (source.secret ? `${S} is holding something back` : `${S} has nothing more to give`) : 'a lead toward the goal');

  const effects: Effect[] = [];
  const propagation: OutcomeNarration['propagation'] = [];
  const lines: string[] = approach.isPlayerOwn ? [] : [`${A} chooses to ${lowerFirst(approach.label)}.`];

  if (win) {
    effects.push(f.knowledge(actorId, upperFirst(gain)));
    if (source) {
      const delta = TRUST_ON_SUCCESS[domain];
      if (delta) effects.push(f.trust(source.id, actorId, delta));
      if (domain === 'intimidate') effects.push(f.tension(actorId, source.id, 1));
      lines.push(
        tier === 'critical'
          ? `It works better than ${A} dared hope. ${S} gives it up: ${gain}.`
          : pick([`${S} holds out for a long moment, then gives ground: ${gain}.`, `Something in ${S} gives way. ${A} comes away with it: ${gain}.`], seed),
      );
      if (delta) lines.push(delta < 0 ? `It works, but something closes behind ${S}'s eyes.` : 'Something between them eases.');
    } else {
      lines.push(tier === 'critical' ? `It pays off at once. ${A} finds exactly what the moment needed: ${gain}.` : `It works. ${A} comes away with something concrete: ${gain}.`);
    }
    if (secret) {
      effects.push(f.knowledge(actorId, upperFirst(secret.fact)));
      lines.push(`And more than ${A} bargained for: ${secret.fact}.`);
    } else if (tier === 'critical' && source && (domain === 'persuade' || domain === 'empathize')) {
      effects.push(f.promise(source.id, actorId, `${S} will help ${A} again when asked`));
      lines.push(`${S} offers more: help, the next time ${A} asks.`);
    } else if (tier === 'critical') {
      effects.push(f.setup(`What ${A} noticed in ${place} will matter later`));
      lines.push(`${A} also notices something in ${place} that will matter later.`);
    }
    if (hero) lines.push(`Closer to the goal: ${sentence(goal)}`);
  } else if (tier === 'complication') {
    effects.push(f.knowledge(actorId, upperFirst(gain)));
    const held = evidenceOf(ctx, actorId, false);
    const exposed = held ? `${A} has ${phrase(ctx, held)}` : `${A} is after ${phrase(ctx, goal)}`;
    if (witness) {
      effects.push(f.knowledge(witness.id, upperFirst(exposed)), f.trust(witness.id, actorId, domain === 'intimidate' || domain === 'deceive' ? -2 : -1));
    }
    effects.push(f.setup(COMPLICATION_SETUP[domain](A, W ?? 'someone')));
    lines.push(
      source
        ? `${S} gives up part of it (${gain}), but not for free. Now ${S} knows ${exposed}.`
        : `It half-works: ${gain}. But ${W ? `${W} sees enough to know ${exposed}` : `it leaves traces in ${place}`}.`,
      `The obstacle hardens: ${sentence(obstacle)}`,
    );
  } else {
    // Failure escalates (PRD §20–21): refusal plus an alert through the character web.
    const trustHit = domain === 'intimidate' || domain === 'deceive' ? -2 : -1;
    if (witness) effects.push(f.trust(witness.id, actorId, trustHit), f.tension(actorId, witness.id, 1), f.knowledge(witness.id, `${A} is after ${phrase(ctx, goal)}`));
    const hurt = domain === 'physical' ? 'hurt' : domain === 'stealth' || bold ? 'exposed' : undefined;
    if (hurt) effects.push(f.condition(actorId, hurt));
    const alerted = witness ? confidant(ctx, witness.id, actorId) : opposition(ctx, actorId);
    lines.push(source ? `${S} refuses, flatly, and the room turns against ${A}.` : `It goes wrong${hurt ? `, and ${A} comes out of it ${hurt}` : ''}.`);
    if (alerted) {
      const C = nameOf(alerted);
      propagation.push({
        text: W
          ? `${W} goes straight to ${C}: ${A} is after ${phrase(ctx, goal)}. ${C} changes strategy.`
          : `Word of ${A} ${GERUND[domain]} in ${place} reaches ${C}. ${C} changes strategy.`,
        effects: [f.knowledge(alerted.id, `${A} is after ${phrase(ctx, goal)}`), f.trust(alerted.id, actorId, -1), f.setup(`${C} is moving against ${A}`)],
        visibleTo: witness ? [witness.id, alerted.id] : [alerted.id],
      });
      lines.push(W ? `Before ${A} can recover, ${W} is already on the way to ${C}.` : `The noise carries. ${C} will hear of it.`);
    } else {
      effects.push(f.setup(`${W ?? 'Someone'} will make ${A} pay for this`));
    }
    lines.push(`The obstacle stands taller now: ${sentence(obstacle)}`);
  }

  effects.push(behaviorEffect(ctx, actorId, approach, tier));
  const link = themeLink(model, domain);
  if (link) {
    effects.push(f.theme(link.stance, link.other ? `${A} chooses ${link.pole} over ${link.other}` : `${A}'s ${DOMAIN_LABEL[domain].toLowerCase()} leans on ${link.pole}`));
  }

  // Empathy signals — observations only (PRD §11).
  const attempts = sim.events.filter((e) => e.kind === 'resolution' && e.actorId === actorId && e.sequenceId === seq?.id).length;
  if (bold) effects.push(win ? f.empathy(actorId, 'courage', `${A} takes a real risk for the goal`) : f.empathy(actorId, 'danger', `${A} is now exposed to real danger`));
  if (win && (charOf(ctx, actorId)?.capabilities[domain] ?? 0) >= 4) effects.push(f.empathy(actorId, 'skill', `${A}'s ${DOMAIN_LABEL[domain].toLowerCase()} carries the moment`));
  if (domain === 'empathize') effects.push(f.empathy(actorId, 'kindness', `${A} reaches out to ${S === 'Someone' ? 'others' : S} with care`));
  if (tier === 'failure' && (domain === 'persuade' || domain === 'empathize')) effects.push(f.empathy(actorId, 'unfair-injury', `${A} tried in good faith and was punished for it`));
  if (attempts >= 2) effects.push(f.empathy(actorId, 'obsession', `${A} keeps pushing at the same goal: ${phrase(ctx, goal)}`));

  const setup = relatedSetup(sim, `${pending.input} ${target?.name ?? ''}`);
  if (setup) effects.push(win && setup.status === 'payoff-candidate' ? f.payoff(setup, `${A}'s move brings it to a head: ${setup.text}`) : f.reinforce(setup));

  const freshNews = achieving || (secret && win) ? freshNewsFrom(ctx, actorId, source, secret?.fact ?? gain) : undefined;
  return {
    narration: lines.join(' '),
    effects,
    propagation,
    beatRequirementsMet: beatRequirementsFor(ctx, {
      actorId,
      target,
      domain,
      risk: approach.risk,
      tier,
      input: pending.input,
      effects: [...effects, ...propagation.flatMap((p) => p.effects)],
      propagated: propagation.length > 0,
    }),
    freshNews,
  };
}

// ───────── generateOpportunities (PRD §15, §37) ─────────

/** kind, title, description, character, theme, relationship, setup created, potential payoff ('@' = pays the ripest open setup), risk, branch A, branch B */
type Card = [string, string, string, string, string, string, string, string, string, string, string];

const CARDS: Record<StcBeatKey, Card[]> = {
  'opening-image': [
    ['Routine', '{P} at work, flaw showing', "An ordinary moment in {P}'s world shows how {P} copes, and what that coping costs.", 'Establishes the baseline {P} must change from.', 'Shows the world before {tc} is questioned.', '{P} and {Y} at their most familiar.', "A habit of {P}'s the ending can mirror.", 'The Final Image reverses this habit.', 'Static if nothing is quietly at stake.', 'Hold on the flaw', 'Undercut the routine with a small wrongness'],
    ['Portent', 'A small wrongness', "Something tied to {X} is slightly off in {P}'s world, and only {P} notices, or fails to.", 'Reveals what {P} pays attention to.', 'Plants the pressure of {tc} early.', '{X} is present only as a shadow.', 'The wrongness itself, unexplained.', 'The Catalyst reveals what it meant.', 'Too obvious and it telegraphs the Catalyst.', '{P} investigates', '{P} ignores it'],
    ['Mirror', 'What is missing', '{P} with {Y}: what is missing between them is visible to everyone except {P}.', "Exposes the need beneath {P}'s want.", 'Frames {tc} as a personal lack.', 'Establishes the bond the story will test.', 'The unspoken gap between {P} and {Y}.', 'Closed or confirmed in the Final Image.', 'Reads as exposition if played too knowingly.', '{Y} names the gap', 'The gap stays unspoken'],
  ],
  'theme-stated': [
    ['Voiced', '{Y} asks the question', '{Y} puts the thematic question to {P} directly ("{theme}", in their own words), and {P} brushes it off.', "{P}'s dismissal shows how far there is to travel.", 'States {tc} plainly.', '{Y} becomes the voice of the theme.', 'The question {P} could not answer.', "Answered by {P}'s actions in the Finale.", 'On the nose if the line is too neat.', '{P} argues back', '{P} goes quiet'],
    ['Embodied', '{X} lives the answer', '{X} shows, without saying it, the answer to {tc} that {P} rejects.', 'Defines {P} against {X}.', 'The theme is shown, not said.', 'Sharpens the opposition between {P} and {X}.', "{X}'s way as a possible future for {P}.", "{P} either becomes or refuses {X}'s way.", 'Subtle; the crew may miss it.', '{P} sees the resemblance', '{P} misses it entirely'],
    ['Overheard', 'Said in passing', 'A minor figure says the thematic truth in passing; {P} treats it as a throwaway.', "{P}'s blind spot is established.", 'Hides the theme in plain sight.', 'Little immediate effect.', 'The line itself, to be echoed.', 'Echoed back when {P} finally understands.', 'Easily forgotten unless echoed.', 'Echo it at the Midpoint', 'Echo it at the Dark Night'],
  ],
  'set-up': [
    ['Stakes', 'What could be lost', 'Make it concrete what {P} stands to lose: {stake}.', "Gives {P}'s choices weight.", 'Ties {tc} to something tangible.', 'Whoever holds the stake gains leverage over {P}.', 'The stake as a visible object or person.', 'Threatened at All Is Lost.', 'Heavy-handed if spelled out.', "Put the stake in {X}'s reach", 'Let {Y} hold the stake'],
    ['Fault line', '{P} and {Y} under light pressure', 'A small disagreement between {P} and {Y} shows where their relationship will crack.', 'Shows how {P} handles friction.', 'Previews {tc} at small scale.', 'Marks the fault line between {P} and {Y}.', 'The unresolved disagreement.', 'Breaks open when the Bad Guys Close In.', 'Low drama if nothing is at stake.', 'Resolve it early', 'Let it fester'],
    ['Flaw', 'Fear at the wheel', "{P}'s fear ({fear}) quietly steers a small decision.", 'Makes the flaw visible in behaviour.', 'Links the flaw to {tc}.', 'Someone notices and says nothing.', 'The pattern of the fear.', 'Confronted in the Dark Night of the Soul.', 'Too subtle to register.', '{Y} notices', '{X} notices'],
  ],
  catalyst: [
    ['Intrusion', '{X} makes a move', "{X} acts, and the consequences land on {P}'s doorstep.", 'Forces {P} out of routine.', 'Pushes {tc} into the open.', 'Makes {X} personal for {P}.', "{X}'s next move.", 'Answered in the Finale confrontation.', 'Makes {X} too visible too early.', '{P} reacts at once', '{P} tries to ignore it'],
    ['Discovery', 'Something surfaces', '{P} finds something that changes the picture: {setup}.', "Hooks {P}'s curiosity or conscience.", 'Frames {tc} as a question to investigate.', 'Whoever else knows becomes important.', 'What the discovery points to.', '@Pays off an early setup', 'Coincidence if not properly seeded.', 'Share it with {Y}', 'Keep it secret'],
    ['Loss', 'Something taken', 'Something {P} relied on is taken, and the stake turns real: {stake}.', "Strips {P}'s comfort.", 'Makes the cost of {tc} tangible.', 'Blame falls somewhere, perhaps wrongly.', 'The thing lost.', 'Recovered, or mourned, by the end.', 'Can feel arbitrary.', 'Blame {X}', 'Blame {Y}'],
  ],
  debate: [
    ['Refusal', '{P} says no', '{P} refuses the course of action, and the reasons are good ones.', "Shows {P}'s resistance to change.", 'Argues against the theme to test it.', '{Y} is disappointed in {P}.', 'The refusal itself.', 'Reversed at Break into Two.', 'Stalls momentum if it runs long.', 'Circumstances force the choice', '{P} changes their own mind'],
    ['Counsel', '{Y} makes the case', '{Y} argues for going ahead; {P} argues back, and both are right.', "Shows {P} weighing others' needs.", 'Both sides of {tc} get a voice.', 'Deepens or strains {P} and {Y}.', "{Y}'s stake in the outcome.", "{Y}'s advice proves right or wrong later.", 'Talky; keep it physical.', '{P} follows {Y}', '{P} defies {Y}'],
    ['Price', 'The cost made concrete', 'The price of acting becomes concrete: {stake}.', "Makes {P}'s eventual choice costly.", 'Shows what {tc} will cost.', 'Someone close pays part of the price.', 'The price as a debt.', 'Collected at All Is Lost.', 'Can feel like a lecture.', 'Pay part of it now', 'Defer it'],
  ],
  'break-into-two': [
    ['Commitment', '{P} commits', '{P} chooses to {goal} and pays an immediate price for it.', 'The first active, costly choice.', 'Commits {P} to one side of {tc}.', 'Someone is left behind.', 'The price paid.', 'Justified or regretted at the Finale.', 'Soft if the price is not real.', 'Go alone', 'Bring {Y}'],
    ['Burned bridge', 'No way back', '{P} does something that makes turning back impossible.', "Removes {P}'s escape route.", 'Forces {tc} into action.', 'Burns a relationship to cross.', 'The bridge that burned.', 'Rebuilt or mourned in Act Three.', 'Can make {P} hard to root for.', 'Burn it with {X}', 'Burn it with {Y}'],
    ['Unlikely pact', 'A deal with the other side', "{P} strikes a deal with someone in {X}'s orbit to get in.", 'Shows how far {P} will go.', 'Compromises {P} on {tc}.', 'Creates a dangerous obligation.', 'The terms of the deal.', 'The deal is called in at the worst moment.', 'Plausibility: why would they agree?', 'Honour the deal', 'Break it'],
  ],
  'b-story': [
    ['Deepening', '{Y} and {P} share something true', 'In a quiet moment {Y} and {P} share something true; the theme lives in this relationship.', 'Softens {P}; shows who {P} could become.', 'Carries {tc} into a relationship.', 'Deepens {P} and {Y}.', 'A confidence to be tested.', 'The confidence matters at Break into Three.', 'Sentimental if unearned.', 'Keep it private', 'Let {X} find out'],
    ['New bond', 'Someone unexpected', 'Someone unexpected offers {P} a different way to see {tc}.', 'Opens a path {P} had not considered.', 'Introduces an answer to {tc}.', 'A new relationship with its own pull.', 'Who this person really is.', 'They return with the missing piece.', 'Another character to service.', 'Trust them', 'Suspect them'],
    ['Mirror mentor', 'The other side of the theme', '{Y} shows {P} what the other side of {tc} looks like in practice.', "Challenges {P}'s certainty.", 'Develops the theme through example.', '{Y} gains influence over {P}.', "{Y}'s own history.", "{Y}'s history resurfaces: {Ysecret}.", 'Mentor cliché if played straight.', '{P} learns', '{P} resists'],
  ],
  'fun-and-games': [
    ['Premise in play', 'The promise of the premise', '{P} tries to {goal} in the way only this story allows.', 'Shows {P} testing the new world.', 'Shows {tc} as lived experience.', 'Tests alliances under easy pressure.', 'A trick or rule of this world.', 'The rule is turned against {P} later.', 'Episodic if nothing escalates.', 'It works too well', 'It half-works'],
    ['Skill on display', 'A round won', "{P}'s strongest capability wins a round, and draws the wrong kind of attention.", 'Earns empathy through skill.', 'Success tempts {P} toward one side of {tc}.', '{X} takes notice.', 'The attention drawn.', '{X} exploits the pattern.', 'Makes things too easy.', 'Press the advantage', 'Lie low'],
    ['Opposition rising', '{X} pushes back', "{X} notices {P}'s progress and pushes back harder.", 'Forces {P} to adapt.', 'Escalates {tc}.', 'Pressure lands on {Y}.', "{X}'s counter-move.", 'Peaks at the Midpoint.', 'Repetitive if each round feels the same.', 'Retreat', 'Escalate'],
  ],
  midpoint: [
    ['Revelation', '{Y} is secretly connected', 'A revelation: {Y} is secretly part of the problem: {Ysecret}.', "Shatters {P}'s understanding.", 'Turns {tc} inward.', 'Trust between {P} and {Y} is broken or tested.', 'What {Y} does now that it is known.', '@Recontextualises earlier scenes', 'A twist for its own sake if unseeded.', 'Forgive {Y}', 'Cut {Y} off'],
    ['False victory', 'A win that costs', '{P} apparently succeeds ({goal}), but the win creates a larger threat from {X}.', 'Gives {P} confidence that will be punished.', 'Victory tests {tc}.', '{X} escalates.', 'The larger threat.', 'Arrives when the Bad Guys Close In.', 'The audience may see the trap coming.', 'Celebrate', 'Suspect the win'],
    ['Reversal of objective', 'The wrong objective', '{P} discovers they have been pursuing the wrong objective all along.', "Rewrites {P}'s want.", 'Reframes {tc}.', 'Allies must choose whether to follow the new aim.', 'The true objective.', 'Achieved, or not, in the Finale.', 'Invalidates earlier progress if clumsy.', 'Pursue the new objective', 'Cling to the old one'],
  ],
  'bad-guys-close-in': [
    ['Pressure', '{X} closes the net', '{X} regroups and closes the net around {P}.', "Strips {P}'s options.", 'Pushes {P} toward the worst side of {tc}.', '{X} gains leverage over someone {P} loves.', "{X}'s trap.", 'Springs at All Is Lost.', 'Villain-monologue risk.', 'Run', 'Fight'],
    ['Fracture', 'The alliance cracks', "{Y} doubts {P}'s methods; the alliance cracks.", 'Isolates {P}.', "Shows the cost of {P}'s side of {tc}.", 'Breaks {P} and {Y} apart.', "{Y}'s doubt.", 'Repaired at Break into Three.', 'Melodrama if the doubt is unmotivated.', '{Y} leaves', '{Y} stays, resentful'],
    ['Exposure', "{P}'s secret surfaces", "{P}'s own secret starts to surface: {Psecret}.", 'Forces {P} to face themself.', 'Turns {tc} against {P}.', 'Everyone re-evaluates {P}.', 'Who knows, and what they will do.', '@Pays off the pressure on {P}', 'Too many revelations at once.', 'Confess first', 'Cover it up'],
  ],
  'all-is-lost': [
    ['Collapse', 'The plan fails', 'The plan built on the goal ({goal}) collapses, publicly and completely.', "Breaks {P}'s current strategy.", "Shows the dead end of {P}'s approach to {tc}.", 'Allies scatter.', 'What survives the collapse.', 'Seeds the new plan.', 'Can feel engineered.', 'Blame self', 'Blame others'],
    ['Loss', '{Y} is lost', '{Y} is lost to {P}: gone, turned or hurt.', "Removes {P}'s support.", 'The price of {tc} is paid in full.', 'The central bond breaks.', 'What {Y} left behind.', "{Y}'s legacy drives the Finale.", 'Give {Y} agency, not just a fate.', '{Y} chose to go', '{Y} was taken'],
    ['Whiff of death', 'Something ends for good', 'Something ends for good: {setup}.', 'Confronts {P} with finality.', 'Makes {tc} mortal.', 'Everyone feels the weight.', 'The ending itself.', '@Pays off an old setup', 'Heavy if the tone is light.', 'Mourn', 'Rage'],
  ],
  'dark-night-of-the-soul': [
    ['Reckoning', 'The old wound', '{P} faces the wound that shaped them: {wound}.', 'The internal truth surfaces.', "{P}'s understanding of {tc} turns.", 'Someone sees {P} at their lowest.', 'The admission.', 'Turns into resolve at Break into Three.', 'Wallowing if it runs long.', 'Alone', 'With {Y}'],
    ['Confession', '{P} tells the truth', '{P} admits the truth to {Y}: {Psecret}.', 'Vulnerability earns empathy.', 'Truth becomes the answer to {tc}.', 'Repairs or ends {P} and {Y}.', 'What {Y} does with it.', '{Y} returns with it in Act Three.', 'Sentimentality.', '{Y} forgives', '{Y} does not'],
    ['Solitude', 'Face the fear', 'Alone, {P} confronts the fear: {fear}.', 'Strips {P} to the core.', 'Asks the thematic question one last time.', 'The absence of others is felt.', 'The choice made alone.', 'Acted on in the Finale.', 'A static scene.', 'Choose to go on', 'Nearly give up'],
  ],
  'break-into-three': [
    ['Synthesis', 'A and B combine', 'What {P} learned with {Y} becomes the new plan against {X}.', '{P} acts from the adapted self.', 'Resolves {tc} into a new approach.', 'The B-story relationship becomes the key.', 'The new plan.', 'Executed in the Finale.', 'Convenient if the lesson is too neat.', 'Recruit {Y}', 'Go alone'],
    ['New information', 'A late fact reframes everything', 'A late fact reframes everything: {setup}.', 'Gives {P} the missing piece.', 'Clarifies {tc}.', 'Whoever provided it gains standing.', 'The fact itself.', '@Pays off an old setup', 'Deus ex machina if unseeded.', 'Use it openly', 'Use it secretly'],
    ['Return', '{Y} comes back', '{Y} returns with the missing piece, and a condition.', 'Shows {P} has earned help.', 'Community as the answer to {tc}.', 'Repairs {P} and {Y}.', "{Y}'s condition.", 'The condition is tested in the Finale.', 'Undercuts the loss if too easy.', 'Accept the condition', 'Refuse it'],
  ],
  finale: [
    ['Confrontation', '{P} faces {X}', '{P} confronts {X} directly, acting from the adapted self.', 'Proves the change.', 'Answers {tc} in action.', 'Settles {P} and {X}.', 'The outcome of the confrontation.', 'Mirrored in the Final Image.', 'A generic showdown if not specific.', 'Mercy', 'Justice'],
    ['Payoff', 'The long setup pays off', "The story's longest-running setup pays off: {setup}.", 'Rewards attention.', 'Lands the theme through consequence.', 'Everyone connected is changed.', 'Nothing new: resolve.', '@Pays off an old setup', 'Mechanical if forced.', 'Triumphant', 'Bittersweet'],
    ['Sacrifice', '{P} gives something up', '{P} gives up the immediate goal ({goal}) to protect what matters.', 'Completes the arc through cost.', 'Resolves {tc} through sacrifice.', "Proves {P}'s loyalty.", 'The sacrifice itself.', 'Honoured in the Final Image.', 'Martyrdom cliché.', 'The sacrifice holds', 'Reversed at the last moment'],
  ],
  'final-image': [
    ['Mirror', 'The opening, reversed', 'The Opening Image returns, reversed: {P} does the same thing differently.', 'Shows the change.', 'The theme answered visually.', 'The key relationship in its new shape.', 'None.', 'Closes the opening setup.', 'Too neat.', 'Hopeful', 'Ambiguous'],
    ['New normal', 'Life after', "{P}'s world after the change, with {Y}.", 'Shows the cost and the gain.', 'Lives the answer to {tc}.', 'Settled.', 'None.', 'Resolves remaining threads.', 'Anticlimax.', 'Warm', 'Melancholy'],
    ['Open door', 'An unresolved thread', 'One thread stays open: {setup}.', 'Suggests {P} will keep changing.', 'Leaves {tc} breathing.', 'A bond left open.', 'The open thread.', 'Leaves room for what comes next.', 'Frustrating if the story needed closure.', 'Sequel hook', 'Quiet question'],
  ],
};

export function generateOpportunities(ctx: Ctx, beatKey: StcBeatKey): Omit<Opportunity, 'id'>[] {
  const { model } = ctx.project;
  const { sim } = ctx;
  const P = charOf(ctx, model.protagonistId);
  const others = model.characters.filter((c) => c.id !== P?.id);
  const X = others.find((c) => c.role === 'antagonist') ?? maxBy(others, (c) => relOf(sim, c.id, model.protagonistId)?.tension ?? 0);
  const Y = maxBy(
    others.filter((c) => c !== X),
    (c) => (relOf(sim, model.protagonistId, c.id)?.trust ?? 0) + (c.role === 'ally' ? 1 : 0),
  );
  // The ripest open setup: payoff candidates first, then the most reinforced.
  const setup = openSetups(sim).sort(
    (a, b) => Number(b.status === 'payoff-candidate') - Number(a.status === 'payoff-candidate') || b.reinforcementEventIds.length - a.reinforcementEventIds.length,
  )[0];
  const seq = currentSequence(sim);
  const vars: Record<string, string> = {
    P: nameOf(P),
    X: X ? nameOf(X) : 'the opposition',
    Y: Y ? nameOf(Y) : 'an ally',
    goal: phrase(ctx, seq?.goal || P?.goal || 'reach the goal'),
    stake: phrase(ctx, seq?.stake || 'everything could be lost'),
    fear: phrase(ctx, P?.fear || 'the thing they fear most'),
    wound: phrase(ctx, P?.wound || 'an old wound'),
    Psecret: phrase(ctx, P?.secret || 'something long hidden'),
    Ysecret: phrase(ctx, Y?.secret || 'something they never said'),
    tc: model.thematicConflict || model.philosophicalConflict || 'the theme',
    theme: phrase(ctx, model.theme || model.thematicConflict || 'the thematic question'),
    setup: setup ? phrase(ctx, setup.text) : 'an unresolved thread from earlier',
  };
  const fill = (t: string) => sentence(t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? k));
  const bare = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? k);
  return CARDS[beatKey].map(([kind, title, description, character, theme, relationship, created, payoff, risk, a, b], i) => {
    const pays = payoff.startsWith('@') && !!setup;
    return {
      beatKey,
      label: 'ABC'[i],
      kind,
      title: bare(title),
      description: fill(description),
      characterEffect: fill(character),
      themeEffect: fill(theme),
      relationshipEffect: fill(relationship),
      setupCreated: fill(created),
      potentialPayoff: pays ? `Pays off: ${sentence(setup.text)}` : fill(payoff.replace(/^@/, '')),
      payoffSetupIds: pays ? [setup.id] : [],
      risk: fill(risk),
      futureBranches: [bare(a), bare(b)],
    };
  });
}

// ───────── analyzeDiscoveries (PRD §11, §29–31) ─────────

/** Declared-value vocabulary → the behaviours that would express or contradict it. */
const VALUE_TRAITS: { words: RegExp; expects: string[]; opposes: string[] }[] = [
  { words: /compassion|kind|empath|care|caring|mercy|gentle/i, expects: ['compassion in action'], opposes: ['aggression under pressure', 'physical risk-taking'] },
  { words: /honest|truth|integrity|sincer/i, expects: ['appeals to reason', 'relentless curiosity'], opposes: ['deception'] },
  { words: /loyal|family|trust|friend/i, expects: ['compassion in action', 'appeals to reason'], opposes: ['deception', 'aggression under pressure'] },
  { words: /justice|fair|law|order/i, expects: ['relentless curiosity', 'appeals to reason'], opposes: ['deception', 'aggression under pressure'] },
  { words: /peace|patien|calm|restraint|caution|prudence/i, expects: ['appeals to reason', 'evasion'], opposes: ['aggression under pressure', 'physical risk-taking'] },
  { words: /courage|brave|bold/i, expects: ['physical risk-taking', 'aggression under pressure'], opposes: ['evasion'] },
  { words: /self-preservation|survival|caution/i, expects: ['evasion'], opposes: ['physical risk-taking'] },
];
const DIVERGENCE_OPTIONS = ['Character revelation', 'Performance deviation', 'Temporary story-state behaviour'];
/** Signals whose absence is worth naming (PRD §11: "little demonstrated vulnerability or attachment"). */
const TELLING_ABSENCES: EmpathySignal[] = ['kindness', 'being-loved', 'unfair-injury', 'humour'];
const STANCE_READING: Record<ThemeStance, [string, string]> = {
  reinforce: ['reinforcing', 'Play is confirming the thematic statement; a coming situation could test it from the other side.'],
  contradict: ['contradicting', 'Play argues against the stated theme. Either the theme needs revising or the story needs a cost it has not yet shown.'],
  develop: ['developing', 'Play is adding nuance the thematic statement does not yet capture.'],
  tension: ['holding in tension', 'The thematic question is live and unresolved: strong material for the Midpoint or All Is Lost.'],
};

const eventsTouching = (sim: SimState, a: ID, b: ID): ID[] =>
  sim.events
    .filter((e) =>
      e.effects?.some(
        (x) =>
          (x.type === 'trust' && ((x.from === a && x.to === b) || (x.from === b && x.to === a))) ||
          (x.type === 'tension' && ((x.a === a && x.b === b) || (x.a === b && x.b === a))),
      ),
    )
    .map((e) => e.id)
    .slice(-10);

export function analyzeDiscoveries(ctx: Ctx): DiscoveryDraft[] {
  const { project, sim } = ctx;
  const { model } = project;
  const taken = new Set(project.discoveries.filter((d) => d.branchId === project.activeBranchId).map((d) => d.title));
  const out: DiscoveryDraft[] = [];
  const add = (d: DiscoveryDraft) => {
    if (taken.has(d.title)) return;
    taken.add(d.title);
    out.push(d);
  };

  for (const c of model.characters) {
    const st = sim.characters[c.id];
    if (!st) continue;
    const N = nameOf(c);
    const traits = countBy(st.behaviors, (b) => b.trait);
    const count = (t: string) => traits.find(([k]) => k === t)?.[1] ?? 0;
    const reported = new Set<string>();

    for (const value of c.declaredValues) {
      const map = VALUE_TRAITS.find((v) => v.words.test(value));
      const top = map && maxBy(map.opposes, count);
      if (!map || !top || reported.has(top) || count(top) < 2) continue;
      if (count(top) <= map.expects.reduce((n, t) => n + count(t), 0)) continue;
      reported.add(top);
      add({
        kind: 'divergence',
        title: `Character divergence for ${N}: ${upperFirst(value)} vs ${upperFirst(top)}`,
        observation: `${c.name} was written as valuing ${value.toLowerCase()}, but under pressure in play ${N} repeatedly chose ${top}.`,
        declared: upperFirst(value),
        observed: upperFirst(top),
        interpretation: `${upperFirst(value)} may be conditional rather than foundational.`,
        directorQuestion: 'Does this behaviour become a character revelation, a performance deviation, or temporary story-state behaviour?',
        options: DIVERGENCE_OPTIONS,
        evidenceEventIds: st.behaviors.filter((b) => b.trait === top).map((b) => b.eventId),
        characterId: c.id,
      });
    }

    const [trait, times] = traits[0] ?? ['', 0];
    const authored = [...c.intrinsic, ...c.extrinsic, ...c.adaptive].some((t) => t.label.toLowerCase().includes(trait));
    if (trait && times >= 3 && !reported.has(trait) && !authored) {
      add({
        kind: 'character',
        title: `Emerging trait for ${N}: ${trait}`,
        observation: `Across play ${N} keeps reaching for ${trait}; it is not part of the authored character.`,
        observed: upperFirst(trait),
        interpretation: `${upperFirst(trait)} may be part of who ${N} is under pressure.`,
        directorQuestion: 'Is this who the character is, or who this performance made them?',
        options: ['Character revelation', 'Performance deviation', 'Temporary story-state behaviour'],
        evidenceEventIds: st.behaviors.filter((b) => b.trait === trait).map((b) => b.eventId),
        characterId: c.id,
      });
    }

    if (st.empathy.length) {
      const seen = [...new Set(st.empathy.map((e) => e.signal))];
      const missing = TELLING_ABSENCES.filter((s) => !seen.includes(s));
      const label = (s: EmpathySignal) => EMPATHY_SIGNALS[s].toLowerCase();
      add({
        kind: 'empathy',
        title: `Empathy signals for ${N}: ${seen.map(label).join(', ')}`,
        observation: [
          `Observed: ${N} demonstrates ${listJoin(seen.map(label))}.`,
          missing.length ? `Missing evidence: little demonstrated ${listJoin(missing.map(label))}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        directorQuestion: missing.length ? `Should a coming situation give ${N} room to show ${label(missing[0])}?` : undefined,
        options: ['Note for the writer', 'Build a situation to test it', 'Leave it'],
        evidenceEventIds: st.empathy.map((e) => e.eventId),
        characterId: c.id,
      });
    }

    // Secrets that play has put into someone else's hands.
    if (c.secret) {
      const secret = phrase(ctx, c.secret).replace(/^(he|she|they)\b/i, '').toLowerCase();
      const holds = (fact: string) => fact.toLowerCase().includes(secret);
      for (const [id, other] of Object.entries(sim.characters)) {
        if (id === c.id || !other.knowledge.some(holds)) continue;
        const knower = nameOf(charOf(ctx, id));
        add({
          kind: 'story',
          title: `Secret out: ${knower} knows ${N}'s secret`,
          observation: `In play, ${knower} learned what ${N} has been hiding: ${c.secret}`,
          interpretation: `Every scene between ${knower} and ${N} now plays differently.`,
          directorQuestion: 'Does the story keep this reveal, or replay the moment without it?',
          options: ['Keep it in the story', 'Replay without the reveal', 'Leave it'],
          evidenceEventIds: sim.events
            .filter((e) => e.effects?.some((x) => x.type === 'knowledge' && x.characterId === id && holds(x.fact)))
            .map((e) => e.id),
          characterId: c.id,
        });
      }
    }
  }

  if (sim.themeSignals.length >= 2) {
    const [stance] = countBy(sim.themeSignals, (s) => s.stance)[0] as [ThemeStance, number];
    const [verb, reading] = STANCE_READING[stance];
    const latest = sim.themeSignals.at(-1)!;
    add({
      kind: 'theme',
      title: `Theme: play is ${verb} ${model.thematicConflict || 'the theme'}`,
      observation: `Most thematic moments in play are ${verb} "${model.theme}". Most recent: ${sentence(latest.text)}`,
      interpretation: reading,
      directorQuestion: 'Should the next situation push the theme from the other side?',
      options: ['Keep pushing this way', 'Test the opposite', 'Revise the thematic statement'],
      evidenceEventIds: sim.themeSignals.filter((s) => s.stance === stance).map((s) => s.eventId),
    });
  }

  for (const r of sim.relationships) {
    const base = model.relationships.find((b) => b.from === r.from && b.to === r.to);
    const dTrust = r.trust - (base?.trust ?? 0);
    const dTension = r.tension - (base?.tension ?? 0);
    if (Math.abs(dTrust) < 2 && Math.abs(dTension) < 2) continue;
    const F = nameOf(charOf(ctx, r.from));
    const T = nameOf(charOf(ctx, r.to));
    const what =
      Math.abs(dTrust) >= 2 ? (dTrust < 0 ? 'trust is breaking down' : 'trust is growing') : dTension > 0 ? 'tension is rising' : 'tension is easing';
    add({
      kind: 'relationship',
      title: `${F} → ${T}: ${what}`,
      observation: `Authored ${base ? `as "${base.label}" with trust ${base.trust} and tension ${base.tension}` : 'with no relationship'}; after play, ${F}'s trust in ${T} is ${r.trust} and tension is ${r.tension}.`,
      interpretation: `The relationship play produced differs from the one on the page.`,
      directorQuestion: 'Is this the relationship the story is really about?',
      options: ['Adopt as the new baseline', 'Keep it to this branch', 'Leave it'],
      evidenceEventIds: eventsTouching(sim, r.from, r.to),
      characterId: r.from,
    });
  }

  const seqNo = currentSequence(sim)?.number ?? 1;
  for (const s of sim.setups.filter((x) => x.status === 'payoff-candidate')) {
    add({
      kind: 'setup-payoff',
      title: `Payoff opportunity: ${clip(s.text, 70)}`,
      observation: `This unresolved element has accumulated relevance. Potential payoff opportunity detected during Sequence ${seqNo}.`,
      directorQuestion: 'Reveal its significance now, or let it keep building?',
      options: ['Pay it off next', 'Keep building', 'Let it drop'],
      evidenceEventIds: [s.createdEventId, ...s.reinforcementEventIds],
    });
  }
  return out;
}

// ───────── writeReport (PRD §33–34) ─────────

const normalise = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

function divergenceNote(key: InterpretationKey, interpretations: Interpretation[]): string {
  const question = INTERPRETATION_QUESTIONS[key];
  const readings = (phase: 'before' | 'after') => [
    ...new Map(
      interpretations
        .filter((i) => i.phase === phase && i.answers[key]?.trim())
        .map((i) => [normalise(i.answers[key]), i.answers[key].trim()] as const),
    ).values(),
  ];
  const before = readings('before');
  const after = readings('after');
  const [now, when] = after.length ? [after, 'after play'] : [before, 'before play'];
  const answered = interpretations.filter((i) => i.phase === (after.length ? 'after' : 'before') && i.answers[key]?.trim()).length;
  if (!now.length) return `No answers yet to "${question}"`;
  if (answered < 2) return `One perspective recorded ${when}: "${clip(now[0], 80)}".`;
  const shift = before.length && after.length ? ` Before play there were ${before.length} distinct readings; after, ${after.length}.` : '';
  if (now.length === 1) return `The crew converged ${when} on "${clip(now[0], 80)}".${shift}`;
  return `Interpretation divergence ${when}: ${now.slice(0, 4).map((a) => `"${clip(a, 60)}"`).join(', ')}. Each is a live reading of the material, worth discussing together.${shift}`;
}

export function writeReport(ctx: Ctx, interpretations: Interpretation[], reactions: Reaction[]): ReportDraft {
  const { project, sim } = ctx;
  const phaseCount = (phase: 'before' | 'after') => interpretations.filter((i) => i.phase === phase).length;
  const people = new Set(interpretations.map((i) => i.participantId)).size;
  const moments = countBy(reactions, (r) => r.eventId);
  const highlights = moments.slice(0, 5).flatMap(([eventId]) => {
    const e = sim.events.find((x) => x.id === eventId);
    if (!e) return [];
    const kinds = countBy(reactions.filter((r) => r.eventId === eventId), (r) => r.kind)
      .map(([k, n]) => `${REACTIONS[k as ReactionKind].label.toLowerCase()} ×${n}`)
      .join(', ');
    return [`"${clip(e.text, 120)}" (${kinds})`];
  });
  const keys = Object.keys(INTERPRETATION_QUESTIONS) as InterpretationKey[];
  return {
    summary:
      `${people} crew ${people === 1 ? 'member' : 'members'} shared interpretations of "${project.model.title}" ` +
      `(${phaseCount('before')} before play, ${phaseCount('after')} after). ` +
      (reactions.length ? `${reactions.length} reactions marked ${moments.length} moments of the simulation.` : 'No reactions were captured during play.'),
    highlights,
    emergent: project.discoveries.filter((d) => d.branchId === project.activeBranchId && d.status !== 'rejected').map((d) => d.title),
    notes: Object.fromEntries(keys.map((k) => [k, divergenceNote(k, interpretations)])) as Record<InterpretationKey, string>,
  };
}

// ───────── compileScreenplay (PRD §41–43) ─────────

const GENERATED_LINE: Record<Tier | 'none', string> = {
  critical: "That's more than I came for.",
  success: "That's what I needed.",
  complication: "That's not how this was supposed to go.",
  failure: "This isn't over.",
  none: "We don't have long.",
};

/** A performer's input: their action as an observed line, their quoted words as performed dialogue,
 *  or — when they described speech without quoting it — a reconstructed line flagged as such. */
function performed(ctx: Ctx, e: StoryEvent): Element[] {
  const actor = charOf(ctx, e.actorId);
  const input = e.playerInput ?? e.text;
  const src = [e.id];
  const { lines, rest } = splitSpeech(input);
  const out: Element[] = [];
  if (rest && !BARE_SPEECH.test(rest)) out.push({ type: 'action', text: toThirdPerson(rest, actor), provenance: 'observed', sourceEventIds: src });
  if (!actor) return out;
  const spoken: Element[] = lines.length
    ? lines.map((l) => ({ type: 'dialogue', text: sentence(l), provenance: 'performed', speakerId: actor.id, sourceEventIds: src }))
    : SPEECH.test(input)
      ? [{ type: 'dialogue', text: reconstructLine(input, namedCharacter(ctx, input, actor.id), detectDomain(input)), provenance: 'reconstructed', speakerId: actor.id, sourceEventIds: src }]
      : [];
  if (spoken.length) out.push({ type: 'character', text: nameOf(actor).toUpperCase(), speakerId: actor.id, sourceEventIds: src }, ...spoken);
  return out;
}

export function compileScreenplay(ctx: Ctx, events: StoryEvent[], scenes: Scene[]): Element[] {
  const out: Element[] = [];
  let prev: { scene: Scene; lastEventId: ID } | undefined;
  for (const scene of scenes) {
    const evs = events.filter((e) => e.sceneId === scene.id && !e.directorOnly);
    if (!evs.length) continue;
    const first = evs.find((e) => e.kind === 'scene-open') ?? evs[0];
    const last = evs.at(-1)!;
    if (prev) out.push({ type: 'transition', text: 'CUT TO:', sourceEventIds: [prev.lastEventId] });
    out.push({ type: 'heading', text: scene.heading.toUpperCase(), sourceEventIds: [first.id] });
    if (prev && prev.scene.sequenceId !== scene.sequenceId) {
      out.push({ type: 'action', text: 'Later.', provenance: 'connective', sourceEventIds: [first.id] });
    }
    const start = out.length;
    let speakerId: ID | undefined;
    let lastTier: Tier | undefined;
    let played = false;
    evs.forEach((e, i) => {
      const src = [e.id];
      switch (e.kind) {
        case 'narration':
          // Narration of a performed moment is observed; anything else is the Director's staging.
          out.push({ type: 'action', text: e.text, provenance: evs[i - 1]?.kind === 'action' ? 'observed' : 'directed', sourceEventIds: src });
          break;
        case 'directive':
          out.push({ type: 'action', text: e.text, provenance: 'directed', sourceEventIds: src });
          break;
        case 'resolution':
        case 'propagation':
        case 'fresh-news':
          out.push({ type: 'action', text: e.text, provenance: 'observed', sourceEventIds: src });
          lastTier = e.resolution?.tier ?? lastTier;
          played = true;
          break;
        case 'action':
          out.push(...performed(ctx, e));
          speakerId = e.actorId ?? speakerId;
          played = true;
          break;
        default:
          break; // scene-open is the heading; scene-close, notes and beat advances are meta
      }
    });
    const speaker = charOf(ctx, speakerId) ?? charOf(ctx, scene.presentCharacterIds[0]);
    if (played && speaker && !out.slice(start).some((el) => el.type === 'dialogue')) {
      out.push(
        { type: 'character', text: nameOf(speaker).toUpperCase(), speakerId: speaker.id, sourceEventIds: [last.id] },
        { type: 'dialogue', text: GENERATED_LINE[lastTier ?? 'none'], provenance: 'generated', speakerId: speaker.id, sourceEventIds: [last.id] },
      );
    }
    prev = { scene, lastEventId: last.id };
  }
  return out;
}
