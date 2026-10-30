// Starting content for new projects: the "Undertow" demo (PRD §27, §31, §47, §49) and a blank story.
import { emptyCapabilities } from '../../shared/structure.ts';
import type { CanonItem, CanonKind, CanonStatus, Character, ID, Relationship, StoryModel, Trait } from '../../shared/types.ts';
import { newId, nowIso, type Opening } from './engine.ts';

export interface Seed {
  model: StoryModel;
  opening: Opening;
}

const trait = (label: string, status: CanonStatus, note?: string): Trait => ({
  id: newId('tr'),
  label,
  note,
  status,
  source: 'authored',
});

const canon = (kind: CanonKind, text: string, status: CanonStatus): CanonItem => ({
  id: newId('cn'),
  kind,
  text,
  status,
  source: 'authored',
  updatedAt: nowIso(),
});

const rel = (from: ID, to: ID, label: string, trust: number, tension: number, notes: string): Relationship => ({
  id: newId('rl'),
  from,
  to,
  label,
  trust,
  tension,
  notes,
});

const INES = 'ch_ines';
const MARA = 'ch_mara';
const BRAND = 'ch_brand';
const JONAH = 'ch_jonah';
const PRIYA = 'ch_priya';

export function demoProject(): Seed {
  const ines: Character = {
    id: INES,
    name: 'Ines Calder',
    image: 'ines',
    role: 'protagonist',
    status: 'locked',
    summary:
      'Disgraced harbor investigator, suspended after the Pier 9 inquiry. Relentless, isolated, and sure she is the only one who will ever make Teodor Brand answer for it.',
    extrinsic: [
      trait('Twelve years as a harbor authority investigator', 'locked'),
      trait('Knows every blind spot in the container yard', 'canon'),
      trait('Suspended — no badge, no legal authority', 'locked', 'Anything she finds is inadmissible unless someone else brings it in.'),
      trait('Owes money to a dockside lender', 'proposed', 'Would give Brand leverage over her.'),
    ],
    intrinsic: [
      trait('Compassion for the people the harbor grinds down', 'canon', 'Declared value — watch whether play supports it.'),
      trait('Fierce loyalty to her brother', 'locked'),
      trait('Needs to be the one in control of the outcome', 'proposed'),
      trait('Preaches trust, trusts no one', 'unknown', 'Open question: contradiction or hypocrisy?'),
    ],
    adaptive: [
      trait('Letting someone else hold the evidence', 'proposed'),
      trait('Asking for help before it is too late', 'unknown'),
      trait('Becomes a vigilante who kills Brand', 'rejected', 'Tested in an early outline and discarded: it ends the theme instead of testing it.'),
    ],
    goal: 'Prove Teodor Brand buried the truth about Pier 9 and make him answer for it.',
    fear: 'Being powerless again while someone she loves goes under.',
    secret: 'The misconduct charge was true: she hit the Pier 9 witness during the interview.',
    wound: 'Her father, a crane operator, died in a yard "accident" when she was fourteen. Nobody was ever held responsible.',
    declaredValues: ['compassion', 'loyalty'],
    capabilities: { intimidate: 4, investigate: 4, physical: 3, stealth: 3, persuade: 2, deceive: 2, craft: 2, empathize: 2 },
    resources: ['Pocket recorder', 'Old harbor keycard (probably deactivated)', "Her father's accident file"],
    worldFit: {
      startingState: 'A suspended investigator who gets answers through pressure and certainty, running on grievance and alone by choice.',
      worldRequirements: 'The harbor runs on favours and silence. The truth only surfaces when frightened people choose to trust someone.',
      existingStrengths: 'Reads lies, knows the docks, relentless, physically capable, unafraid of Brand.',
      traitGaps: 'Cannot ask for help. Cannot let anyone else control how the story ends.',
      falseStrengths: 'Intimidation gets fast answers — and burns every witness it touches.',
      requiredAdaptation: 'Earn trust instead of extracting it; let justice belong to more than one person.',
      resistance: 'She refuses to become someone who waits, depends on others, or lets Brand walk away from the kill.',
      cost: 'The revenge that has become her identity, and the story about her father she built it on.',
      finalState: 'An investigator who can put the evidence in someone else’s hands and walk away.',
    },
    performerBrief:
      'You are Ines Calder. Six months ago you were the best investigator the harbor authority had; now you are suspended and everyone on the docks knows why. ' +
      'You believe Teodor Brand covered up the Pier 9 drownings. Tonight a dockworker named Mara Voss has a photograph that could prove it — and you need to know who gave it to her. ' +
      'You know this yard better than anyone. Your younger brother Jonah is the only person you still fully trust.',
    voice: 'Clipped and dry. Asks questions like accusations. Goes quiet instead of shouting — the quiet is the warning.',
  };

  const mara: Character = {
    id: MARA,
    name: 'Mara Voss',
    image: 'mara',
    role: 'supporting',
    status: 'canon',
    summary: 'Night-shift dockworker holding the only photograph of Pier 9. Wants out of the harbor alive — and paid.',
    extrinsic: [
      trait('Night-shift lasher at the container yard', 'canon'),
      trait('Holds the only photograph of the Pier 9 container', 'locked'),
    ],
    intrinsic: [
      trait('Distrusts investigators', 'canon', 'Her brother talked to one once. Nothing happened except that he lost his job.'),
      trait('Keeps her promises, even the dangerous ones', 'proposed'),
    ],
    adaptive: [trait('Choosing a side instead of running', 'unknown')],
    goal: 'Get herself and the photograph out of the harbor before anyone connects her to it.',
    fear: 'Being the next body in the water.',
    secret: 'Jonah Calder gave her the photograph and paid her to bring it to Ines. He made her swear never to say his name.',
    wound: 'Her brother was blacklisted from the docks after he talked to an inspector who then did nothing.',
    declaredValues: ['self-preservation', 'loyalty to the crew'],
    capabilities: { physical: 2, persuade: 2, deceive: 3, intimidate: 1, investigate: 1, stealth: 3, craft: 3, empathize: 3 },
    resources: ['The photograph (in an envelope inside her jacket)', 'A bus ticket out of the city'],
    performerBrief:
      'You are Mara Voss, a night-shift dockworker. You are holding a photograph of the Pier 9 container, and you have agreed to meet the suspended investigator Ines Calder in the container yard. ' +
      'Her brother Jonah gave you the photograph and paid you to deliver it — you swore never to say his name. You do not trust investigators. You want to leave the city tonight.',
    voice: 'Short sentences, dock slang. Deflects with jokes. Never answers the question she was asked.',
  };

  const brand: Character = {
    id: BRAND,
    name: 'Teodor Brand',
    image: 'teodor',
    role: 'antagonist',
    status: 'canon',
    summary: 'Harbor authority commissioner who rebuilt the port and controls who works on it. Charming in public, patient in private.',
    extrinsic: [
      trait('Commissioner of the harbor authority', 'locked'),
      trait('Controls the night manifests and the yard crews', 'canon'),
    ],
    intrinsic: [
      trait('Believes order is worth any single life', 'canon'),
      trait('Genuinely loves the harbor', 'proposed'),
    ],
    adaptive: [trait('Learns to fear someone he cannot buy', 'unknown')],
    goal: 'Keep the Pier 9 inquiry closed until the port expansion vote.',
    fear: 'Losing control of the harbor he rebuilt.',
    secret: 'He ordered the Pier 9 container moved in a storm to hide its cargo. Three men drowned when it shifted.',
    wound: 'Grew up on these docks and watched the old bosses break his father.',
    declaredValues: ['order', 'the harbor'],
    capabilities: { physical: 1, persuade: 4, deceive: 4, intimidate: 4, investigate: 2, stealth: 1, craft: 2, empathize: 2 },
    resources: ['Harbor authority security', 'The night manifests', 'Friends on the city council'],
    performerBrief:
      'You are Teodor Brand, commissioner of the harbor authority. You rebuilt this port and you decide who works on it. ' +
      'The Pier 9 inquiry is closed and it must stay closed until the expansion vote. Ines Calder is a problem you intend to manage quietly.',
    voice: 'Warm, unhurried, first names. Never threatens directly — describes what might happen.',
  };

  const jonah: Character = {
    id: JONAH,
    name: 'Jonah Calder',
    image: 'jonah',
    role: 'wildcard',
    status: 'proposed',
    summary: "Ines's younger brother. Easy charm, bad debts, and a night job he doesn't talk about.",
    extrinsic: [trait('Works nights for a crew that answers to Brand', 'proposed')],
    intrinsic: [
      trait("Hungry for his sister's respect", 'canon'),
      trait('Hides risk behind a joke', 'proposed'),
    ],
    adaptive: [trait('Telling Ines the truth', 'unknown')],
    goal: 'Get his sister back on her feet without her finding out where the help comes from.',
    fear: 'That Ines will look at him the way she looks at Brand.',
    secret: "He took the Pier 9 photograph on a night shift for Brand's crew, then paid Mara to deliver it to Ines.",
    wound: 'Grew up in Ines’s shadow — she was always the one who saved everyone.',
    declaredValues: ['family'],
    capabilities: { physical: 2, persuade: 3, deceive: 3, intimidate: 1, investigate: 1, stealth: 3, craft: 2, empathize: 3 },
    resources: ['A yard access badge', 'Cash he cannot explain'],
    performerBrief:
      'You are Jonah Calder, Ines’s younger brother. You work nights on the docks for a crew you would rather not name. ' +
      'You took a photograph of the Pier 9 container and paid a dockworker named Mara to get it to your sister. Ines must never find out it came from you.',
    voice: 'Fast and funny until he is scared, then he goes very polite.',
  };

  const priya: Character = {
    id: PRIYA,
    name: 'Priya Hale',
    image: 'priya',
    role: 'ally',
    status: 'canon',
    summary: "Ines's former partner, now with the port inspectorate. Testified at the inquiry. Still wants Brand — by the book.",
    extrinsic: [
      trait('Port inspectorate investigator', 'canon'),
      trait('Can enter evidence that will survive court', 'locked'),
    ],
    intrinsic: [
      trait('Believes justice has to belong to more than one person', 'canon', 'Carries the theme.'),
      trait('Still loyal to Ines, and ashamed of it', 'proposed'),
    ],
    adaptive: [trait('Breaking a rule for the right reason', 'unknown')],
    goal: 'Build a case against Brand that survives court.',
    fear: "That Ines's revenge will burn the case and everyone in it.",
    secret: 'She testified against Ines to keep the Pier 9 case alive inside the inspectorate.',
    wound: 'Years ago she lost a witness to a partner who pushed too hard.',
    declaredValues: ['justice', 'patience'],
    capabilities: { physical: 2, persuade: 3, deceive: 1, intimidate: 2, investigate: 4, stealth: 2, craft: 2, empathize: 4 },
    resources: ['Inspectorate credentials', 'The sealed Pier 9 inquiry transcript'],
    performerBrief:
      'You are Priya Hale, an investigator with the port inspectorate and Ines Calder’s former partner. Your testimony helped get her suspended. ' +
      'You want Teodor Brand in court, and you believe that only works if the case is clean.',
    voice: 'Measured, precise, answers a question with a better question. Uses Ines’s full name when angry.',
  };

  const model: StoryModel = {
    title: 'Undertow',
    logline:
      'A disgraced harbor investigator hunting the man who buried three drownings must decide whether the truth is worth becoming the thing she hates.',
    premise:
      'Six months after the Pier 9 drownings were ruled an accident, a photograph surfaces that could reopen the case. Ines Calder will do anything to use it — and every step she takes toward Brand costs someone she needs.',
    genre: 'Neo-noir thriller',
    medium: 'Feature film',
    tone: 'Rain-soaked, tense and morally grey, with dry gallows humour',
    audience: 'Adults who love slow-burn crime drama',
    targetDuration: '110 minutes',
    theme: 'Revenge destroys the identity of the person pursuing it.',
    thematicConflict: 'justice vs revenge',
    philosophicalConflict: 'control vs trust',
    canon: [
      canon('world-rule', 'The harbor authority polices its own docks; city police need a warrant to enter the yard.', 'locked'),
      canon('world-rule', "Nothing leaves the container yard at night without a manifest stamped by Brand's office.", 'canon'),
      canon('constraint', 'No supernatural elements: every clue must be physically possible.', 'locked'),
      canon('constraint', 'Ines never carries a gun — she surrendered it with her badge.', 'canon'),
      canon('fact', 'Three dockworkers drowned at Pier 9 when a container shifted in a storm; the inquiry ruled it an accident.', 'canon'),
      canon('fact', "The port expansion vote is nine days away.", 'proposed'),
      canon('question', 'Why did whoever took the photograph send it to Ines instead of the police?', 'unknown'),
      canon('inspiration', 'Chinatown; The Wire, season two; rain-slick 1970s harbor noir.', 'canon'),
      canon('fact', "Ines's father secretly worked for Brand.", 'rejected'),
    ],
    characters: [ines, mara, brand, jonah, priya],
    relationships: [
      rel(MARA, INES, 'suspicious witness', -1, 3, 'Mara expects to be used and thrown away, the way her brother was.'),
      rel(INES, JONAH, 'brother', 4, 1, 'The one person Ines still protects without question.'),
      rel(JONAH, INES, 'sister', 3, 2, 'Loves her; hides the night job from her.'),
      rel(INES, PRIYA, 'former partner', -1, 4, 'Ines sees the testimony as betrayal.'),
      rel(PRIYA, INES, 'former partner', 2, 3, 'Still believes in Ines, not in her methods.'),
      rel(INES, BRAND, 'nemesis', -5, 5, 'Ines holds him responsible for Pier 9 — and, privately, for her father.'),
      rel(BRAND, INES, 'problem to manage', -3, 3, 'Prefers to discredit her rather than fight her.'),
      rel(BRAND, JONAH, 'night-shift hire', 1, 1, 'Brand does not yet know who Jonah is to Ines.'),
    ],
    protagonistId: INES,
  };

  const opening: Opening = {
    beatIndex: 3, // Catalyst
    goal: 'Find out who gave Mara the photograph.',
    stake: 'If you fail, Mara leaves with the only evidence.',
    obstacle: 'Mara does not trust you.',
    heading: 'EXT. CONTAINER YARD – NIGHT',
    situation:
      'Rain hammers the stacked containers and the sodium lamps buzz. Mara Voss waits beneath the last working light, an envelope inside her jacket and one eye on the gate. She agreed to meet — she did not agree to talk.',
    presentCharacterIds: [INES, MARA],
  };

  return { model, opening };
}

export function blankProject(title: string, logline: string): Seed {
  const protagonist: Character = {
    id: newId('ch'),
    name: 'Protagonist',
    role: 'protagonist',
    status: 'proposed',
    summary: '',
    extrinsic: [],
    intrinsic: [],
    adaptive: [],
    goal: '',
    fear: '',
    secret: '',
    wound: '',
    declaredValues: [],
    capabilities: emptyCapabilities(),
    resources: [],
    performerBrief: '',
  };
  const model: StoryModel = {
    title,
    logline,
    premise: '',
    genre: '',
    medium: 'Feature film',
    tone: '',
    audience: '',
    targetDuration: '',
    theme: '',
    thematicConflict: '',
    philosophicalConflict: '',
    canon: [],
    characters: [protagonist],
    relationships: [],
    protagonistId: protagonist.id,
  };
  const opening: Opening = {
    beatIndex: 0,
    goal: 'Show what the protagonist wants right now.',
    stake: 'Decide what they lose if they fail.',
    obstacle: 'Decide what stands in their way.',
    heading: 'INT. OPENING LOCATION – DAY',
    situation: 'The opening image has not been staged yet. Describe where we find the protagonist and what they are doing.',
    presentCharacterIds: [protagonist.id],
  };
  return { model, opening };
}
