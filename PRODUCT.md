# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One Expo / React Native codebase shipping to iOS and Android, also served on the web through react-native-web. Phones are the primary device class (confirmed); tablets and desktop web expand the same world.

## Users

Professional film and television development teams working a story together in one room: Project Owner (final canon authority), Director, Producer, Writer, Performer, Observer. Performers usually play from their own phones; the Director and Owner steer from a phone, tablet or laptop at the same table.

## Product Purpose

The Story Desk is a collaborative narrative rehearsal environment. A crew plays an unfinished story through an AI Director: they attempt actions, chance resolves them, consequences propagate through the character web, and what emerges is analysed into discoveries and compiled into screenplay pages. Success is at least one meaningful story discovery per session that the team did not plan (north-star metric: meaningful discoveries per development session).

## Positioning

"Run the story before you make the story." The story model is executable: characters, goals, relationships and structure can be played, not just written, and the screenplay is compiled from what the crew actually experienced, with honest provenance on every line.

## Operating Context

A development room or remote session. Rituals the product follows: a Save the Cat 15-beat structure with Edson Hero Goal Sequences, a cork planning board with index cards and string, blind sessions for performers, before/after interpretation rounds, owner-only promotion to canon, branches for replay and variation. Full specification: docs/PRD.md.

## Capabilities and Constraints

Story Bible with canon statuses (locked, canon, proposed, emergent, unknown, rejected); Character Lab (extrinsic, intrinsic, adaptive traits, World-Fit); Structure board (beats with dramatic requirements, Hero Goal Sequences, Director opportunity cards); Simulation Room (freeform action, approaches with dice odds, four outcome tiers, consequences, propagation, fresh news); Crew Room (roles, casting, blind mode, interpretation matrix, reactions); Discovery Room; Screenplay compiler with provenance; branches (replay, variation, escalation, reinterpretation). Server is authoritative; participants authenticate with a per-seat token. The AI Director runs on Claude when configured and falls back to an offline Director.

Terminology to keep: beat, Hero Goal Sequence (HGS), fresh news, canon, discovery, provenance (performed, reconstructed, generated; observed, directed, connective), branch.

## Brand Commitments

- Name: **The Story Desk** (confirmed rename from "Narrative Rehearsal"; the product is still described as a narrative rehearsal environment).
- The user supplied the visual direction as two reference mockups (a dark screenwriter's desk, a framed cork planning board with pinned aged-paper index cards, push pins, red string, masking-tape act labels, handwritten notes, noir photographs, a filmstrip of beats). Navigating the app follows the connecting strings. This direction is binding.
- Never frame a player's choice as good or bad; show consequence. Empathy signals are observations, never scores. Interpretation divergence never judges a participant. Invention is never disguised as discovery.

## Evidence on Hand

- Built-in sample story "Undertow" (neo-noir feature): Ines Calder, Mara Voss, Teodor Brand, Jonah Calder, Priya Hale. Content lives in server/src/seed.ts.
- Imagery: the user approved generating noir scene and character photographs and material textures for the sample story. Generated images are illustrative, not production stills.
- No customers, testimonials, or metrics exist; none may be invented.

## Product Principles

1. Consequence over correctness: the interface shows what a choice did to the story, never whether it was right.
2. The crew discovers; the Director curates. AI output is offered, a human chooses, and only the Owner promotes to canon.
3. Structure is visible to those who steer and invisible to those who perform.
4. Every line keeps its origin: performed, reconstructed, generated, observed, directed, connective.

## Accessibility & Inclusion

Mixed-role rooms on personal phones: text must follow the OS font size, touch targets meet 44pt (iOS) / 48dp (Android), motion respects Reduce Motion, and outcome tiers are never conveyed by color alone.
