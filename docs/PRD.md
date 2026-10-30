# PRODUCT REQUIREMENTS DOCUMENT

# Narrative Rehearsal Platform

## Collaborative Story Simulation, Discovery & Screenplay Development

**Version:** 0.2
**Status:** Product-definition draft
**Primary market:** Professional film and television production teams
**MVP:** Yes
**Core medium:** Collaborative interactive narrative simulation
**Initial screenplay structure:** Save the Cat! 15-beat framework
**Primary structural reference:** Eric Edson's Hero Goal Sequence framework

---

# 1. Executive Summary

The Narrative Rehearsal Platform is a collaborative story-development system in which professional creative teams **experience an unfinished story before committing it to screenplay form**.

Instead of treating the screenplay as the primary working document, the system creates an underlying **playable story model** containing:

* characters
* goals
* traits
* relationships
* world rules
* dramatic stakes
* structural beats
* unresolved questions
* thematic conflicts
* motifs
* future consequences
* known information
* hidden information
* continuity

The team then enters this model through an AI Director.

The Director behaves as an **omniscient narrative party**: it knows the broader story state, reminds participants of stakes, controls supporting characters and the world, introduces obstacles and consequences, and resolves player actions through a chance-and-capability system.

Participants retain freeform agency.

They choose what their character intends to do, while the system determines the difficulty and resolves the attempted action according to:

> **Character capability + current circumstances + chosen risk + dramatic stakes + chance**

Successful actions advance the current goal.

Failures do not simply mean “you lose.”

They generate consequences, escalation, complications, new information or altered relationships.

The simulation therefore produces an evolving **story state**.

The team then reviews:

* what actually happened
* how people interpreted the characters
* what unexpected behaviours emerged
* what themes became visible
* what unresolved elements were created
* which setups now require payoffs
* how the character web changed
* whether the structure still works

The system compiles those discoveries into screenplay material.

The fundamental loop becomes:

> **AUTHOR → MODEL → EXPERIENCE → RESOLVE → CONSEQUENCE → DISCOVER → ALIGN → COMPILE → REPLAY**

The product is therefore not merely screenplay-generation software.

It is:

> **A collaborative narrative rehearsal environment for discovering the story before producing the story.**

---

# 2. Product Thesis

Traditional development largely moves in this direction:

> Idea → outline → screenplay → rehearsal → production

This platform inserts a new creative layer:

> Idea → **experience** → discovery → screenplay → rehearsal → production

The central hypothesis is:

> **A character decision experienced under pressure provides more useful dramatic information than a character trait written in a document.**

A writer can state:

> “The protagonist is loyal.”

The simulation can test:

> “Will they still be loyal if loyalty costs the life of someone else?”

That difference is the foundation of the product.

---

# 3. What Makes This a New Medium

The product should not be positioned as:

**AI screenplay writer + RPG interface**

That would undersell the idea.

The new medium is:

## Executable Story

A normal story document describes what should happen.

An executable story defines:

* who wants what
* what they know
* what they fear
* what they are capable of
* what prevents them from succeeding
* what happens when they act
* what other characters are doing simultaneously
* what consequences persist
* what future beats require resolution

The crew can therefore **run the story**.

This creates a new creative artifact between:

**story outline**

and

**finished screenplay**

called the:

# Story Model

The Story Model becomes the actual source of truth.

The screenplay is one output of that model.

---

# 4. Primary Product Promise

The product should enable a professional crew to say:

> “We didn't just discuss this story. We experienced it together.”

And after iteration:

> “Now we understand what story we are actually making.”

The strongest emotional product outcome is therefore not:

> “The AI wrote our script.”

It is:

> **“We discovered the story we actually want to make.”**

---

# 5. Target Customer

## Primary

Professional production teams developing:

* feature films
* television episodes
* limited series
* animation
* narrative games
* short films
* scripted digital productions

## Primary users

### Project Owner

The person with final authority over project canon.

May be:

* producer
* director
* writer-producer
* production company representative

### Director

Controls creative simulation direction and selects between viable dramatic possibilities.

### Writer

Defines story intent and converts discoveries into canonical story material.

### Performer

Inhabits a character and provides behavioural evidence.

### Observer

Participates without controlling a character.

### Producer

Monitors progress, structural status, unresolved issues and development decisions.

---

# 6. Authority Model

The application separates:

## Creative Authority

What the project intends to be.

Controlled by:

> **Project Owner / Director / Producer**

depending on project permissions.

## Simulation Authority

What happens during the experience.

Controlled by:

> **AI Director + Story State**

## Player Agency

What the participant attempts.

Controlled by:

> **Participant**

## Canon Authority

What becomes part of the official story.

Controlled by:

> **Project Owner**

This prevents the simulation from silently changing the project.

---

# 7. Core Product Architecture

The MVP consists of seven interconnected systems:

1. **Story Model**
2. **Character Laboratory**
3. **Narrative State Graph**
4. **AI Director**
5. **Dramatic Resolution Engine**
6. **Crew Discovery Room**
7. **Screenplay Compiler**

---

# 8. Story Model

The Story Model contains explicit project intent.

## Project

* title
* logline
* premise
* genre
* medium
* tone
* audience
* target duration
* thematic conflict
* philosophical conflict
* world rules
* inspirations
* canon
* constraints

## Canon states

Every story element is assigned one status:

### Locked

Must remain true.

### Canon

Established and authoritative.

### Proposed

Possible but not yet accepted.

### Emergent

Discovered through simulation.

### Unknown

Intentionally unresolved.

### Rejected

Previously tested and discarded.

This allows the project to evolve without losing history.

---

# 9. Character Laboratory

Every major character is modeled across three dimensions.

## 9.1 Extrinsic Traits

What the character possesses because of their history or environment.

Examples:

* profession
* training
* social position
* education
* resources
* physical capability
* authority
* tools
* relationships
* cultural knowledge
* reputation
* practical skills

## 9.2 Intrinsic Traits

What exists internally.

Examples:

* values
* beliefs
* fears
* desires
* moral boundaries
* worldview
* insecurities
* emotional wounds
* attachments
* identity
* temperament
* contradictions

## 9.3 Adaptive Traits

What the new world forces the character to develop.

The core relationship is:

> **Starting Character → World Demand → Pressure → Behaviour → Consequence → Adaptation**

This becomes the basis of character transformation.

---

# 10. Character World-Fit Engine

The system studies what the new world requires from the protagonist.

For each protagonist:

### Starting State

Who are they before the story?

### World Requirements

What qualities does this environment demand?

### Existing Strengths

What already allows them to function?

### Trait Gaps

What do they lack?

### False Strengths

What strength becomes a liability?

### Required Adaptation

What must they learn?

### Resistance

What do they refuse to become?

### Cost

What does adaptation take away?

### Final State

Who do they become?

This prevents superficial character construction.

A samurai, chef and revenge-driven detective may all be “disciplined,” but the system asks **why the trait exists, what environment created it, what the environment now demands, and what conflict that creates.**

---

# 11. Protagonist Empathy Model

The MVP incorporates Edson-derived empathy signals as diagnostic observations rather than a numerical quality system.

Potential signals include:

* courage
* unfair injury
* skill
* humour
* kindness
* danger
* being loved
* hard work
* obsession

The system can identify which signals are emerging through play.

Example:

> **Observed:** protagonist demonstrates high skill and obsession.

> **Observed:** protagonist has repeatedly exposed themselves to danger.

> **Missing evidence:** little demonstrated vulnerability or attachment.

The system must never turn these observations into:

> “Your protagonist is 63% empathetic.”

That destroys the usefulness of the framework.

---

# 12. Story Structure

The MVP uses:

## Save the Cat! Beat Sheet

as the primary high-level structural scaffold.

Save the Cat's official framework uses 15 major beats, from Opening Image through Final Image.

The MVP therefore tracks:

1. Opening Image
2. Theme Stated
3. Set-Up
4. Catalyst
5. Debate
6. Break into Two
7. B Story
8. Fun and Games
9. Midpoint
10. Bad Guys Close In
11. All Is Lost
12. Dark Night of the Soul
13. Break into Three
14. Finale
15. Final Image

The product does not assume these beats are identical in every genre.

They provide the **structural operating system** for the MVP.

---

# 13. Hero Goal Sequence Layer

Within the Save the Cat! structure, the system uses Hero Goal Sequences as a more granular pursuit model.

Edson defines a Hero Goal Sequence as a unit in which the hero pursues a physical, visible, short-term goal, with the sequence ending when “fresh news” changes the immediate objective and generates the next goal.

Edson's published model proposes 20–23 sequences for the one-hero feature model, with six in Act One, twelve in Act Two and two to five in Act Three.

The MVP should use this as a **structural diagnostic rather than a hard law**.

The hierarchy becomes:

> **Act → Save the Cat Beat → Hero Goal Sequence → Scene → Beat → Action**

This solves an important problem.

A Save the Cat beat is not treated as a single scene.

A Hero Goal Sequence is not treated as a single beat.

A scene is not forced to contain one artificial “story beat.”

Save the Cat itself describes beats as meaningful moments that can exist inside scenes and can expand into multiple scenes.

---

# 14. Structural Administration View

The Director, Producer and Project Owner receive a structural dashboard.

Example:

> ACT II
> MIDPOINT APPROACHING
> HGS 11 / 20
> Current STC Beat: FUN & GAMES
> Current Goal: Gain access to the restricted facility
> Required dramatic movement: increasing opposition
> Known unresolved elements: 4
> Pending payoffs: 2
> Character arc pressure: increasing

Writers and performers do not need to see all of this during performance.

Structural theory is therefore:

> **visible to administrators, invisible when distracting to performers.**

---

# 15. Beat Guidance Engine

The system does not tell the Director:

> “This is the correct scene.”

Instead, it generates **viable dramatic options**.

Example:

### Current Beat

Midpoint

### Narrative requirement

A major reversal that changes the protagonist's understanding or strategic position.

### Available dramatic versions

**A — Revelation**
The ally is secretly responsible.

**B — Victory**
The protagonist apparently succeeds, but creates a larger threat.

**C — Reversal**
The protagonist discovers they have been pursuing the wrong objective.

Each option is evaluated against:

* character arc
* theme
* current state
* unresolved elements
* future payoff potential
* genre
* tone
* crew discoveries

The Director selects the version that appears most dramatically productive.

This makes the Director **a creative selector rather than an autonomous author.**

---

# 16. AI Director

The AI Director is the heart of the simulation.

It combines:

**Dungeon Master**

with:

**Film Director**

with:

**Dramaturg**

with:

**Omniscient Narrator**

The Director knows:

* the current story beat
* the current Hero Goal Sequence
* hidden information
* NPC objectives
* future consequences
* thematic pressures
* unresolved setups
* canonical outcomes
* current stakes
* possible routes forward

The player does not.

---

# 17. The Director's Primary Responsibilities

The Director must continuously:

### Remind

Keep the participant aware of:

* stakes
* immediate goal
* consequences
* time pressure
* relevant information

### Challenge

Introduce obstacles.

### Resolve

Determine consequences of actions.

### Escalate

Make failure meaningful.

### Reveal

Deliver appropriate information.

### Maintain

Protect continuity.

### Adapt

Respond to unexpected player behaviour.

### Guide

Present the next meaningful choice without removing agency.

---

# 18. The Dramatic Resolution System

The player is given genuine freedom.

However, freedom does not mean:

> “Everything automatically works.”

Every significant action contains:

## Intention

What the character is trying to accomplish.

## Obstacle

What prevents easy success.

## Risk

What the character stands to lose.

## Capability

What the character is capable of doing.

## Difficulty

How difficult the action is under current circumstances.

## Stakes

Why the outcome matters.

## Chance

The unpredictable resolution factor.

---

# 19. Action Resolution

The participant declares an action.

Example:

> “I convince him to give me the key.”

The system evaluates:

**Character social capability**

*

**relationship**

*

**available evidence**

*

**NPC resistance**

*

**risk level**

*

**story stakes**

*

**current circumstances**

The Director generates a difficulty.

The system then resolves through a chance mechanism.

The underlying principle is:

> **The character's capability establishes the baseline. Risk changes the difficulty. Chance determines the immediate outcome.**

Therefore a highly skilled character attempting something sensible may have a strong probability of success.

A weak or poorly positioned character attempting something extremely risky may have a poor probability.

---

# 20. Resolution Tiers

Do not use only:

> SUCCESS / FAILURE

Use at least four outcomes.

### Critical Success

The action succeeds and creates an advantageous secondary consequence.

### Success

The action succeeds and advances the current goal.

### Complication

The action partially works but creates a new problem.

### Failure

The immediate action fails and the situation escalates.

This is essential.

Otherwise low rolls merely become:

> “Try again.”

That becomes boring.

Failure needs to **change the story state**.

---

# 21. Fail Forward

Failure should advance drama.

Example:

Player attempts to persuade an NPC.

### Success

NPC gives the information.

### Complication

NPC gives the information but now knows the protagonist is investigating.

### Failure

NPC refuses and alerts an adversary.

The protagonist has not “lost the story.”

The protagonist has moved into a **more difficult version of the story**.

This makes the chance system generate narrative escalation rather than gameplay punishment.

---

# 22. Risk-Reward Choice Architecture

At important moments the Director should expose several viable actions.

Example:

> The protagonist needs information.

### Option A — Ask politely

Low risk
Low difficulty
Slow progress

### Option B — Lie

Moderate risk
Moderate difficulty
Potential relationship damage

### Option C — Threaten

High risk
High difficulty
Fast potential progress
Major future consequence

The player is not choosing the “correct” answer.

They are choosing:

> **What risk are you willing to accept to achieve your goal?**

This becomes the fundamental interaction mechanic.

---

# 23. Why the Dice Matter

The dice are not there to make the product feel like a game.

They solve a creative problem.

Without uncertainty:

> The writer already knows what happens.

With uncontrolled randomness:

> The story becomes nonsense.

The system therefore uses:

> **bounded uncertainty.**

The story establishes what is plausible.

The character establishes capability.

The Director establishes stakes.

The player chooses risk.

Chance determines which plausible branch occurs.

The dice are therefore the mechanism that introduces **productive unpredictability**.

---

# 24. Dramatic Progression

The simulation tracks progress at multiple levels.

### Action

Did this specific attempt succeed?

### Beat

Did the dramatic situation change?

### Scene

Did the situation produce a meaningful shift?

### Hero Goal

Did the protagonist advance, change approach or receive fresh news?

### Save the Cat Beat

Did the story satisfy the current structural purpose?

### Act

Has the story accumulated enough meaningful movement to advance?

The system should never advance purely because a timer expired.

It advances because:

> **sufficient dramatic change has occurred.**

---

# 25. Required Beat Progress

Each structural beat has a **dramatic requirement**, not simply a numeric counter.

For example:

### Catalyst

The protagonist must encounter an event that disrupts their established state.

### Debate

The protagonist must meaningfully resist or question the next course of action.

### Midpoint

The story must undergo a major reversal or significant shift in stakes/understanding.

### All Is Lost

The protagonist must experience a meaningful collapse of the current strategy.

The system may track completion using multiple conditions.

This is more robust than:

> “Roll five times and unlock Act II.”

---

# 26. Character Web

This is one of the defining features of the platform.

The story does not behave like:

> Protagonist → NPC → next scene.

It behaves like a **dynamic relationship network**.

Every major character possesses:

* goal
* knowledge
* secret
* fear
* relationship state
* resources
* conflicting interests
* dependencies
* obligations

Actions performed by one character alter the possible actions of others.

---

# 27. Example of Character-Web Propagation

Character A lies to Character B.

That causes:

**B loses trust in A.**

Which causes:

**B shares information with C.**

Which causes:

**C changes their strategy.**

Which causes:

**D becomes endangered.**

Which forces:

**A to choose between protecting D and achieving the original goal.**

The protagonist's action therefore changes the story world beyond the immediate scene.

This is critical.

It makes the story feel **alive rather than staged.**

---

# 28. Persistence Rules

The following should persist:

* information
* injuries or other non-sensitive state changes where appropriate
* relationships
* promises
* betrayals
* discovered locations
* reputation
* resource changes
* character knowledge
* emotional consequences
* unresolved questions
* setup/payoff obligations

The Director should never conveniently forget consequences simply because the current scene has changed.

---

# 29. Setup / Payoff Engine

Every important unresolved element is tracked.

Example:

> Character mentions an unexplained scar.

The system creates:

**Setup #42**

Potential payoff later.

If another scene references the scar, the engine detects reinforcement.

Eventually:

**Payoff candidate**

The system can propose:

> This unresolved element has accumulated relevance. Potential payoff opportunity detected during Sequence 8.

The Director can then choose whether to reveal its significance.

---

# 30. Theme Alignment

The system maintains a thematic model.

Example:

> **Theme: Revenge destroys the identity of the person pursuing it.**

The simulation tracks decisions involving:

* revenge
* justice
* forgiveness
* obsession
* sacrifice
* relationships
* moral compromise

It then detects whether player behaviour is creating:

**Theme reinforcement**

**Theme contradiction**

**Theme development**

**Unresolved thematic tension**

The Director can use these to construct future situations.

---

# 31. Discovery Is Not the Same as Canon

Suppose the writer intends:

> protagonist values compassion.

During simulation, the protagonist repeatedly chooses violent solutions.

The system reports:

> **Character divergence detected.**

### Declared

Compassion.

### Observed

Aggression under pressure.

### Possible interpretation

Compassion may be conditional rather than foundational.

### Director question

Does this behaviour become:

**Character revelation**

or

**Performance deviation**

or

**Temporary story-state behaviour?**

Only the Project Owner can promote it into canon.

---

# 32. Blind Character Discovery

The MVP includes optional blind sessions.

Participants can enter a simulation without seeing the full character-design document.

They receive only the information necessary to play the role.

This allows the project to observe:

> **What interpretation naturally emerges when participants aren't told the answer?**

Afterward the team compares:

**Written character**

versus

**Played character**

versus

**Observed audience reaction**

This is an important pre-production exercise.

---

# 33. Crew Session

The first crew experience should be designed as a creative icebreaker.

Rather than saying:

> “Let's discuss the protagonist.”

The team enters a scene immediately.

They make decisions.

They encounter consequences.

They laugh, disagree, improvise and discover unexpected character behaviour.

Afterward the system creates a:

# Shared Story Interpretation

Report.

This can show:

* what people thought the protagonist wanted
* which relationships they prioritized
* what tone they naturally created
* what moments affected them
* where interpretations diverged
* which discoveries emerged collectively

The goal is:

> **alignment through shared experience rather than meeting-room abstraction.**

---

# 34. Crew Interpretation Matrix

The matrix must never judge participants.

Example:

| Element                     | Writer  | Actor           | Director                 | Producer       |
| --------------------------- | ------- | --------------- | ------------------------ | -------------- |
| Protagonist's Goal          | Justice | Closure         | Revenge                  | Justice        |
| Core Fear                   | Failure | Abandonment     | Becoming like antagonist | Losing control |
| Scene Tone                  | Serious | Darkly humorous | Tense                    | Emotional      |
| Most Important Relationship | Partner | Sister          | Partner                  | Antagonist     |

The system identifies:

> **Interpretation divergence**

not:

> “Actor misunderstands character.”

That distinction matters.

---

# 35. The Director's Meta Layer

The Director can see information performers should not see.

Example:

> **CURRENT BEAT:** Midpoint
> **STORY FUNCTION:** Major reversal
> **REQUIRED:** Protagonist's understanding must change
> **AVAILABLE OPTIONS:** 3
> **SETUPS AVAILABLE FOR PAYOFF:** 2
> **CHARACTER ARC PRESSURE:** Trust vs control
> **THEME PRESSURE:** Justice vs revenge

The Director chooses among available dramatic possibilities.

The performer experiences the result naturally.

---

# 36. Director as Story Curator

This is one of the most important distinctions.

The AI should not be:

> **The Author**

It should be:

> **The Curator of Possibilities**

The Director continually asks:

> What can happen here that satisfies the current dramatic requirement while preserving continuity and creating meaningful future possibilities?

It generates options.

The human creative leader chooses the direction.

---

# 37. Structural Opportunity Cards

For each upcoming beat, the Director receives possible dramatic opportunities.

Example:

## Upcoming Beat: Midpoint

### Opportunity A

Reveal antagonist's connection to protagonist.

### Opportunity B

Give protagonist apparent victory that creates a larger threat.

### Opportunity C

Reveal protagonist has misunderstood the central problem.

Each opportunity displays:

**Character effect**

**Theme effect**

**Relationship effect**

**Setup created**

**Potential payoff**

**Risk**

**Future branches**

The Director can select one.

This gives professional creators meaningful control without requiring them to micromanage every sentence.

---

# 38. Independent Simulation Mode

Not part of the initial MVP, but included in the architecture.

For complex narrative structures such as:

* Rashomon-style narratives
* multiple protagonists
* contradictory perspectives
* ensemble films
* unreliable narrators

the system can eventually support:

> **Same Scenario → Independent Experiences → Interpretation Comparison**

Each participant experiences the event without seeing the others' responses.

The system compares:

* actions
* perceived motives
* remembered information
* moral judgments
* conflicting testimony
* emotional response

This would make the platform especially powerful for perspective-driven storytelling.

---

# 39. MVP Position on Independent Mode

The feature should **not** be implemented in the MVP.

However, the underlying Story Model must be designed so independent perspectives can be introduced later.

Therefore all important events need:

* objective story state
* character-specific knowledge
* participant interpretation
* hidden information
* perspective

This is an architectural requirement even though the UX ships later.

---

# 40. Narrative State Graph

The underlying story should be represented as a graph.

Nodes include:

* characters
* scenes
* goals
* events
* secrets
* relationships
* discoveries
* setups
* payoffs
* structural beats

Edges represent:

* causes
* knows
* wants
* opposes
* depends on
* caused by
* revealed by
* foreshadows
* pays off
* changes
* threatens

This enables the system to answer:

> “If the protagonist makes this decision, what does it affect?”

without relying entirely on conversational memory.

---

# 41. Screenplay Compiler

The screenplay is generated **after experience**, not before it.

Inputs:

* canonical Story Model
* final simulation state
* participant performance
* reactions
* structural placement
* character development
* thematic development
* setup/payoff state
* selected Director version

Output:

> screenplay scene / sequence / outline

---

# 42. Dialogue Provenance

Each line is classified.

### PERFORMED

Meaning and/or wording directly emerged from the participant.

### RECONSTRUCTED

AI rewrote the participant's expression into screenplay dialogue while preserving intent and demonstrated voice.

### GENERATED

AI created the line because connective dialogue was necessary.

This allows the writer to inspect the screenplay's origin.

---

# 43. Action-Line Provenance

### OBSERVED

Directly occurred during the simulation.

### DIRECTED

Created by the AI Director as staging/environment.

### CONNECTIVE

Added by the compiler to bridge narrative gaps.

Again:

> **The system never disguises invention as discovery.**

---

# 44. Replay & Iteration

Iteration is not a debugging feature.

It is the **primary creative process**.

The Director should allow:

### Replay

Same conditions.

### Variation

One major decision changes.

### Escalation

The same scene but with higher stakes.

### Character reinterpretation

One character's internal priority changes.

### Goal reinterpretation

The protagonist's immediate objective changes.

The system compares outcomes.

---

# 45. Story Versioning

Each major simulation becomes a branch.

Example:

**Story v0.7**

→ Simulation A

→ Simulation B

→ Simulation C

The Project Owner can choose:

> **Promote Branch B to Canon**

without deleting the other versions.

This creates a history of the story's development.

---

# 46. MVP Interface Structure

## Project Dashboard

* current story state
* progress
* structural position
* unresolved elements
* latest discoveries
* crew activity

## Story Bible

* world
* characters
* themes
* constraints
* canon

## Character Lab

* intrinsic traits
* extrinsic traits
* adaptive traits
* goals
* fears
* relationships
* discoveries

## Structure Board

* Save the Cat beats
* Hero Goals
* scenes
* progress
* upcoming dramatic requirements

## Simulation Room

* current situation
* stakes
* goal
* freeform input
* available action intents
* resolution
* consequences

## Crew Room

* participants
* roles
* shared session
* reactions

## Discovery Room

* character discoveries
* story discoveries
* theme discoveries
* setup/payoff
* divergence

## Screenplay Room

* generated screenplay
* provenance
* revisions

---

# 47. Simulation Interaction Model

The player should encounter something like:

> **GOAL**

Find out who gave Mara the photograph.

> **STAKE**

If you fail, Mara leaves with the only evidence.

> **OBSERVED OBSTACLE**

Mara does not trust you.

### Player

Freeform response.

The system interprets the intent.

Then presents:

### Resolution

**Low Risk — Ask directly**

Difficulty: Low

**Medium Risk — Bluff**

Difficulty: Medium

**High Risk — Threaten to expose her**

Difficulty: High

The player can choose one of the suggested approaches or attempt something else.

The freeform action remains primary.

The options are there to expose the **dramatic shape of the available choices**, not to turn the story into a menu-driven game.

---

# 48. The Player Should Never Feel Like They're Playing “the Correct Answer”

There must be no:

> “GOOD CHOICE”

or

> “BAD CHOICE”

Instead:

> **CONSEQUENCE**

This is crucial.

The application isn't teaching the user how to write the scene.

It is revealing what each choice does to the story.

---

# 49. Example

Player:

> “I accuse Mara of lying.”

The Director determines:

**Intent:** force truth through confrontation.

**Character capability:** strong intimidation.

**Relationship:** already unstable.

**Risk:** high.

**Theme:** directly reinforces control vs trust.

Resolution:

> **Complication**

Mara admits she lied.

But now she believes the protagonist is capable of destroying her.

### Story effects

**Current Goal:** advances.

**Relationship:** trust −2.

**New Knowledge:** Mara knows protagonist has evidence.

**Future Setup:** Mara may seek protection elsewhere.

**Theme:** protagonist chooses control over trust.

The story has moved forward.

No arbitrary game-over.

---

# 50. Story Progression Philosophy

The system should follow:

> **Every meaningful action should either change the situation, reveal information, deepen a relationship, create a future obligation, or force a new decision.**

If an action does none of those things, the Director should avoid spending unnecessary simulation time on it.

This keeps the experience dramatic rather than conversationally bloated.

---

# 51. MVP Scope

The MVP should support:

### One project

### One Story Model

### One Save the Cat 15-beat structure

### One primary protagonist

### 3–8 major supporting characters

### Dynamic character relationships

### One active Hero Goal Sequence at a time

### Multiple scenes within a sequence

### Freeform player actions

### Suggested intention/obstacle choices

### Chance-based resolution

### Consequence propagation

### Character trait tracking

### Setup/payoff tracking

### Theme tracking

### Crew multiplayer

### Blind character sessions

### Reaction capture

### Discovery analysis

### Canon approval

### Screenplay compilation

### Branch/replay

### Administrative structural dashboard

---

# 52. Explicit MVP Non-Goals

Do not build:

* fully animated 3D environments
* virtual cinematography
* AI actors with realistic faces
* full D&D rule systems
* voice cloning
* complete feature-length simulation
* independent Rashomon sessions
* automated casting
* production scheduling
* budgeting
* shot listing
* storyboard generation
* automated final screenplay polishing
* personality assessment of real participants

These features risk obscuring the core experiment.

---

# 53. MVP Success Test

The MVP succeeds if a professional team can take a new project through:

> **Premise → character setup → simulation → discovery → iteration → shared interpretation → screenplay scene**

and at least one meaningful discovery occurs that the team did not explicitly plan beforehand.

The strongest success case would be:

> The writer believed the protagonist was one kind of person.

> The actor played them differently.

> The simulation repeatedly exposed the difference.

> The Director used that difference to create stronger future situations.

> The team discussed it.

> The Project Owner promoted the discovery to canon.

> The resulting screenplay became more specific.

That proves the medium works.

---

# 54. North-Star Metric

The primary product metric should not be:

> number of screenplay pages generated.

Nor:

> number of simulation minutes.

Nor:

> AI response quality.

The north-star metric should be:

# Meaningful Story Discoveries Per Development Session

A meaningful discovery is something that:

1. emerged from simulation,
2. was not already explicit in canon,
3. was accepted or seriously considered by the team,
4. changed character, structure, theme, relationship or plot.

Secondary metric:

# Crew Alignment Gain

Measured by comparing interpretation divergence before and after a shared simulation.

Not as a psychological score.

As a creative coordination measurement.

---

# 55. The Product's Unique Creative Loop

Traditional:

> Writer imagines → writer writes → team discusses.

This platform:

> Writer defines → crew experiences → characters react → chance creates uncertainty → consequences propagate → crew interprets → Director curates → story evolves → screenplay compiles.

That is the product.

---

# 56. The Critical Design Principle

The product should never ask:

> **“What should happen next?”**

as its primary question.

It should ask:

> **“Given what has happened, what does everyone now want, know, fear and need?”**

From that state:

> **What meaningful goal can the protagonist pursue?**

Then:

> **What stands in the way?**

Then:

> **What risk is the protagonist willing to accept?**

Then:

> **What happens if that attempt succeeds, complicates or fails?**

Then:

> **What new information changes the next goal?**

This creates the causal engine of the story.

---

# 57. The Deeper Product Philosophy

The system treats story as:

> **A chain of pressures and choices rather than a chain of predetermined events.**

The writer supplies the world.

The characters supply desire.

The world creates resistance.

The player creates choice.

The resolution system creates uncertainty.

The consequences create continuity.

The structure creates direction.

The crew creates interpretation.

The Director creates pressure.

The screenplay records the resulting dramatic experience.

---

# 58. Final Product Definition

The strongest description of the platform is:

> **A collaborative narrative rehearsal system that turns stories into playable dramatic models, allowing professional creative teams to inhabit characters, test goals under pressure, discover unexpected behaviour, experience consequences, align their interpretation of the project, and compile the resulting dramatic evidence into screenplay form.**

It is not:

> “AI writes your screenplay.”

It is:

> **“Run the story before you make the story.”**

And the central creative loop is:

# PLAY → DISCOVER → DEBATE → PROMOTE → REPLAY

until the team reaches:

# “This is the story we actually want to make.”
