---
name: The Story Desk
description: A screenwriter's desk at night and the cork board above it, where the crew runs the story before making it.
colors:
  brass: "#C9A25B"
  brass-text: "#DBB872"
  on-brass: "#1D150A"
  brass-soft: "#3A2E1A"
  brass-ink: "#6B480E"
  brass-wash: "#E4D3AC"
  string-red: "#A8201A"
  string-highlight: "#D2473A"
  paper: "#EDE3CC"
  paper-light: "#F4ECDA"
  paper-sunken: "#E2D5B8"
  paper-rule: "#C4B38D"
  paper-separator: "#D5C7A6"
  ink: "#241E17"
  ink-secondary: "#4A4034"
  ink-tertiary: "#5B4F40"
  ink-fill: "#2B241C"
  desk: "#14110E"
  desk-surface: "#1E1A16"
  desk-raised: "#2A241E"
  desk-border: "#3B332B"
  desk-separator: "#2C2620"
  chalk: "#EFE7D8"
  chalk-secondary: "#B7AD9C"
  chalk-tertiary: "#968C7C"
  cork: "#5B3F26"
  walnut-frame: "#2A1E14"
  tape: "#D8CAA6"
  print-white: "#F3EEE3"
  darkroom: "#1A1714"
  note-yellow: "#E6D38E"
  note-pink: "#E2AFA6"
  note-blue: "#A8C4CF"
  note-green: "#B9CC9C"
  danger-ink: "#9E2A22"
  danger-chalk: "#E4705F"
  on-danger-ink: "#FBF3E6"
  on-danger-chalk: "#1A0B08"
  tier-critical-ink: "#1D5A70"
  tier-success-ink: "#2D663C"
  tier-complication-ink: "#8F4E10"
  tier-critical-chalk: "#6BB8D4"
  tier-success-chalk: "#79C394"
  tier-complication-chalk: "#E7985C"
  canon-ink: "#27507A"
  canon-chalk: "#8DB7E2"
typography:
  display:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: "22px"
    letterSpacing: "0.18em"
  headline:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0.2px"
  title:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "22px"
    letterSpacing: "0.3px"
  body:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  typed-field:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  caption:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  label:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: "14px"
    letterSpacing: "1.2px"
  screenplay:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
  hand-label:
    fontFamily: "Caveat, cursive"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "28px"
  hand-note:
    fontFamily: "Caveat, cursive"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "24px"
  chrome-title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.3px"
  chrome-heading:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.1px"
  chrome-body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  chrome-caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0.1px"
rounded:
  hairline: "1px"
  sm: "2px"
  md: "4px"
  pill: "999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.on-brass}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-paper:
    backgroundColor: "{colors.ink-fill}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.desk-surface}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary-paper:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brass-text}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.danger-chalk}"
    textColor: "{colors.on-danger-chalk}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  index-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "26px 16px 16px 26px"
  slip:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px"
  blank-slip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.hand-note}"
    rounded: "{rounded.sm}"
    padding: "12px"
  field-label:
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
  stamp:
    backgroundColor: "transparent"
    textColor: "#20434E" # tier-critical-ink pressed: 62% source + 38% ink (#241E17)
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tape-label:
    backgroundColor: "{colors.tape}"
    textColor: "{colors.ink}"
    typography: "{typography.hand-label}"
    padding: "2px 16px"
    height: "34px"
  polaroid:
    backgroundColor: "{colors.print-white}"
    textColor: "{colors.ink}"
    typography: "{typography.hand-note}"
    rounded: "{rounded.hairline}"
    padding: "7px 7px 4px"
  sticky-note:
    backgroundColor: "{colors.note-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "24px 16px 16px"
  chip:
    backgroundColor: "{colors.desk-surface}"
    textColor: "{colors.chalk}"
    typography: "{typography.chrome-caption}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.brass-soft}"
    textColor: "{colors.brass-text}"
    rounded: "{rounded.pill}"
  text-field:
    backgroundColor: "{colors.desk-surface}"
    textColor: "{colors.chalk}"
    typography: "{typography.chrome-body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "48px"
  text-field-typed:
    textColor: "{colors.ink}"
    typography: "{typography.typed-field}"
    rounded: "0"
    padding: "10px 4px"
    height: "48px"
  nav-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 6px 4px"
  index-tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "44px"
---

# Design System: The Story Desk

## Overview

**Creative North Star: "The Screenwriter's Desk at Night"**

The app is a real room, not an interface in the shape of one. A warm near-black desk sits under a single lamp; above it hangs a cork board in a walnut frame. Every screen is that board: aged index cards typed in Courier Prime, pinned with red and brass push pins, joined by one red string that is both the story's causal chain and the way you move through the app. Section labels are strips of masking tape written on in marker. Characters and scenes are noir prints with handwritten captions. Nothing on the board is a flat UI card; everything is a physical object with a fastening, a slight hand-pinned tilt, and a lamp shadow under it.

The system runs on two surfaces, not two themes. The desk carries chrome in chalk on warm charcoal and the platform face (native headers, controls, the composer). Paper carries everything the story is made of, in ink and type. Components read which surface they sit on, so the same Caption is chalk on the desk and ink on a card, and a color chosen at screen scope is carried to its paper counterpart when drawn on a card. Density is that of a working board: many cards, tight typed groups inside each card, generous cork between them.

The world refuses the category default of flat cards in a tab app: navigation is a string you follow, sections are tape, status is a rubber stamp, discoveries are sticky notes. Photographs are generated and illustrative and say so in `assets/story/PROVENANCE.md`.

**Key Characteristics:**
- Two surfaces with paired palettes: chalk on the desk, ink on paper.
- One interactive accent, brass; red belongs to the string, the pins and failure.
- Courier Prime for everything typed on paper, Caveat for tape and margins, Cinzel for the wordmark alone, the platform face for chrome.
- Physical depth: paper lifts off cork under one overhead lamp.
- Paper is cut, not rounded; cards hang with a small deterministic tilt.
- The red string connects cards in reading order and carries navigation.

## Colors

A lamplit palette of warm charcoal, aged ivory and cork brown, with brass for the hand and string red for the board.

### Primary
- **Lamp Brass** (#C9A25B): the one interactive fill on the desk: primary buttons, focus borders on desk fields, the lit mark under the chosen index tab, the current-card edge (2px) and the current frame in the Story filmstrip. Text on it is **Brass Shadow** (#1D150A).
- **Polished Brass** (#DBB872): brass as text or icon on the desk: header tint, ghost buttons, selected chips, the caret.
- **Brass Ink** (#6B480E): brass as text on paper (links and actions typed on a card, the selected-chip label, the caret in a typed field). It holds 5.6:1 on brass wash and 6.4:1 on aged ivory, and paper is never dimmed by the lamp falloff (see The Lamp Falloff Rule).
- **Brass Soft** (#3A2E1A) / **Brass Wash** (#E4D3AC): the selected-chip ground on the desk and on paper.

### Secondary
- **String Red** (#A8201A): the red string between pins, the red push pin (raster, which also marks the current place), and never a control color. The thread is drawn as three strokes: a hard offset shadow, the 2.2px string, and a 0.7px **String Highlight** (#D2473A) sheen that also colors the travelling bead's glow and edges the current frame of the Home filmstrip.

### Neutral
- **Aged Ivory** (#EDE3CC): index-card paper, always under the `paper.jpg` fibre texture. **Card Stock** (#F4ECDA) is the lighter sheet (text on ink buttons, secondary buttons on paper); **Slip Paper** (#E2D5B8) is the darker, unpinned slip nested inside a card.
- **Typewriter Ink** (#241E17): body and titles on paper. **Faded Ink** (#4A4034) for secondary lines and field labels, **Pencil** (#5B4F40) for tertiary notes and placeholders. **Ink Fill** (#2B241C) is the interactive fill on paper.
- **Ruled Tan** (#C4B38D) and **Crease** (#D5C7A6): borders and separators on paper.
- **Night Desk** (#14110E): the desk, native headers and the sidebar. **Desk Surface** (#1E1A16) under the scroll view and desk fields, **Desk Raised** (#2A241E) for filled icon buttons.
- **Chalk** (#EFE7D8), **Dust** (#B7AD9C), **Ash** (#968C7C): text on the desk, primary to tertiary. **Desk Seam** (#3B332B) and **Desk Seam Dark** (#2C2620): borders and separators on the desk.

### World Materials
- **Cork** (#5B3F26) and **Masking Tape** (#D8CAA6) are the reference hues of the cork and tape rasters (defined in `tokens.ts` but not drawn; the rasters are the surfaces). **Walnut Frame** (#2A1E14) backs the home screen's walnut rail.
- **Print White** (#F3EEE3) and **Darkroom** (#1A1714): the border of every photographic print and the empty photo well behind it.
- **Sticky notes**: Faded Yellow (#E6D38E), Faded Rose (#E2AFA6), Faded Blue (#A8C4CF), Faded Sage (#B9CC9C), dyed over the same paper fibre at 70%.

### Semantic
- **Outcome tiers**, each with an ink value for paper and a chalk value for the desk: critical (#1D5A70 / #6BB8D4), success (#2D663C / #79C394), complication (#8F4E10 / #E7985C), failure (#9E2A22 / #E4705F, shared with danger; text on a danger fill is #FBF3E6 on paper and #1A0B08 on the desk).
- **Canon** blue (#27507A / #8DB7E2). Locked is ink/chalk; proposed is #554A3C on paper and dust on the desk; unknown and rejected are #6A5D4C on paper and ash on the desk; emergent is complication amber #8F4E10 on paper and Polished Brass #DBB872 on the desk. On paper these hues reach the page only as pressed stamp ink. Role and risk hues follow the same ink/chalk pairing in `src/theme/tokens.ts`.

### Named Rules
**The Two Surfaces Rule.** Every color is a role on a surface. Each desk role has a paper counterpart with the same key, and a color handed from the desk to a card resolves to its paper counterpart. Never add a role to one surface only.

**The Brass Hand Rule.** Brass is the only interactive fill and focus color on the desk, and ink is the only interactive fill on paper. String red is never a button, link or focus color. It marks 'you are here' only as material: the red pin on the active nav tag and on the chosen discoveries tab, and the String Highlight edge on the Home filmstrip's current frame. (The direction contract named string red as the accent; the build gave interaction to brass and kept red as material. The build is the record.)

**The Faded Dye Rule.** Note dyes are faded, never neon. A sticky note lays its dye over paper fibre at 70%. The discovery filter tags use the same four dyes as flat fills. Stamp ink is the exception: pressed, not faded, at full opacity (see Rubber Stamps).

## Typography

**Display Font:** Cinzel 500 (with Georgia, serif), wordmark only
**Body Font:** Courier Prime 400 / 700 / 400 italic (with Courier New, monospace), everything typed on paper
**Hand Font:** Caveat 600 (with cursive), tape labels, captions and margin notes
**Chrome Font:** the platform face (SF on iOS, Roboto on Android, system-ui on web)

**Character:** A typewriter on index cards, a marker on masking tape, and an engraved nameplate, set against quiet native chrome. The typed voice carries all story content; the hand voice only annotates it.

### Hierarchy
- **Display** (Cinzel 500, 18px base, tracking ~0.18em of size): the THE / STORY DESK lockup, scaled per placement: 16px in the board header, 18px in the sidebar, 34px on the phone hero, 58px on the wide hero. THE is set at 0.36 of the mark size (10px minimum), tracked at half its size, in the header and hero lockups. The sidebar lockup sets THE at 11px with 3px tracking over an 18px STORY DESK with 3.2px tracking.
- **Headline** (Courier Prime Bold, 22/28, 0.2px) = the `<Title>` component (`paperTypography.title`): card and page titles on paper, often in capitals (UNDERTOW, a beat name).
- **Title** (Courier Prime Bold, 16/22, 0.3px) = the `<Heading>` component (`paperTypography.heading`): card headings, sheet titles.
- **Body** (Courier Prime, 15/22): all prose on paper; loglines in italic. Content columns cap at 720px.
- **Caption** (Courier Prime, 13/18): secondary lines on paper (act and beat position, timestamps). On a beat card the definition is faded-ink Caption at 12/16 in a box of at least 3 lines (48px) that grows to at most 5, and the position line beneath it ("at 10%") is Courier Prime Italic in pencil, so it reads as its own tier. Pencil and faded ink sit only about 1.27:1 apart, so caption tiers are separated by type style or size, never by ink alone.
- **Label** (Courier Prime Bold, 11/14, 1.2px, uppercase) = the `<Eyebrow>` component: typed field labels on a card, the heading of a section inside a card.
- **Screenplay** (Courier Prime, 15/21): screenplay pages and scene sluglines.
- **Hand label** (Caveat 600, 26/28) and **Hand note** (Caveat 600, 22/24): tape labels, their asides, print captions, the sidebar motto (19px).
- **Chrome** (platform face): title 26/32 600, heading 18/24 600, body 16/23, caption 13/18. Native header titles are 17px 600, large titles 30px on iOS. Button labels are the chrome body at 14 / 16 / 17px, weight 600.

### Named Rules
**The Typed Paper Rule.** Anything written onto paper is Courier Prime. Desk chrome (headers, controls, fields, chips, nav labels) is the platform face. Courier Prime appears on the desk only as typed story identity: the hero line, the sidebar project name, panel titles and filmstrip frame labels. Custom faces carry weight in the family name: emphasis on paper swaps to Courier Prime Bold, never a synthesized weight.

**The Field Label Rule.** Small tracked capitals are the typed field headings of an index card or title page (PREMISE, THEME STATEMENT, WHOSE MOVE): each labels the value directly beneath it, or heads a section inside a card whose rows follow. A label never sits above a Title or Headline; a heading carries its own weight.

**The Hand Is Annotation Rule.** Caveat labels, captions and asides only. Data, values and anything a user must read precisely are typed.

**The Nameplate Rule.** Cinzel appears only in the wordmark.

## Layout

The board is a single centred column (max 720px) of pinned paper on cork, with 16px side gutters, 24px between sections and cards, 12px between the typed groups inside a card, and 4px between a field label and its value within a group. A board opens with 24px of cork above the first card and ends with 48px below the last.

Phones run the cork edge to edge beneath a native dark header, with a 9px walnut rail along the top edge and the string rail (walnut, paper tags on the string) along the bottom as navigation. From 900px wide the board is framed as the desk mockup shows it: a 232px desk sidebar strung top to bottom on the left, and the cork set in a 13px walnut frame with 18px of desk around it and desk props resting on the frame's lower lip. Grids of cards (beats, canon items, projects) wrap into as many columns as fit a minimum card width; an act too long for the board runs off its edge as a horizontally scrolling row, strung in its own board and headed by tape.

Forms and settings use the plain desk instead of cork. Sheets are paper: a page sheet on iOS, a full-screen slide on Android, a centred 560px sheet over a warm scrim on web.

### Named Rules
**The Reading Order Rule.** The string joins cards in the order they are read. Stacked cards pin top-left and the thread hangs in the cork gutter to their left, clear of the cards; cards in a row pin at top centre and the thread sags between them.

**The Lamp Falloff Rule.** Light pools in the middle of the board and darkens toward the frame. The cork and its raster vignette are one fixed layer under the scrolling cards, so the falloff stays with the viewport and shades the cork, never the paper: text on paper keeps its contrast into the corners.

## Elevation & Depth

Depth is physical and has one light source, the lamp overhead. Paper is lifted off the cork by a soft, downward shadow; tape, pins and prints sit on top of paper; the string lies above the paper and below the pin heads, casting its own offset shadow. Text set directly on cork gets a soft dark halo so chalk stays legible over lighter granules. Nothing uses a border to fake elevation.

### Shadow Vocabulary
- **Paper lift** (`box-shadow: 0 3px 8px rgba(0,0,0,0.42), 0 1px 1px rgba(0,0,0,0.3)`; native: black at 0.45, radius 7, y 3; Android elevation 5): every pinned card, blank slip, print, sticky note and the walnut frame on the desk.
- **Tag lift** (`box-shadow: 0 2px 4px rgba(0,0,0,0.5)`): the paper tags hanging on the nav string.
- **Tab lift** (black at 0.4, radius 5, y 3, plus a 2px rise): the selected index tab.
- **Clip** (`box-shadow: 0 2px 3px rgba(0,0,0,0.45)`): the binder clip on screenplay pages.
- **Sheet** (black at 0.2, radius 24, y 8): the web sheet over its scrim.
- **String shadow** (rgba(10,6,4,0.45), 3px stroke offset 1.5 / 3): under the red thread.
- **Chalk halo** (`text-shadow: 0 1px 3px rgba(8,5,3,0.75)`): chalk text on the desk and cork.

### Named Rules
**The One Lamp Rule.** Every lift shadow falls downward with a soft blur in black (rgba(0,0,0,…)). The warm tints belong to the string shadow and the chalk halo. The string alone casts a hard offset stroke shadow (1.5px right, 3px down), because string lies on the board. No other zero-blur, sideways or colored shadows; the only glow is the bead riding the string.

## Shapes

Paper is cut, not rounded. Index cards, slips, stamps, tags and tabs take 2px corners; buttons, desk fields and the walnut frame 4px; prints and sticky notes 1px. Typed fields on paper have no box at all, only a ruled line. Pills are reserved for small controls: chips, icon buttons and reaction counters. The centred web sheet currently rounds to 10px, the one piece of paper outside the rule below.

Cards hang the way a hand pins them: a deterministic tilt derived from the card's key (up to ±0.8° for cards, ±2° for tape labels and blank slips, ±2.5° for stamps), stable between renders. Forms, title pages and long reading hang square.

### Named Rules
**The Cut Paper Rule.** Paper takes 2px corners at most and hangs by a pin, a strip of tape, or nothing. Rounded rectangles and pills never stand in for paper.

## Components

### Buttons
Tactile and plain: a platform-face label on a solid fill, giving slightly under the finger.
- **Shape:** gently squared (4px), hairline border.
- **Primary:** brass fill with brass-shadow text on the desk; ink fill with card-stock text on paper. Heights 36 / 44 / 52px for sm / md / lg; padding 12px (sm) or 16px; small buttons extend their hit area to 44pt.
- **Press:** scales to 0.98 in 120ms and back in 200ms with a strong ease-out (cubic-bezier(0.23, 1, 0.32, 1)) on iOS and web; Android uses its ripple. Disabled at 45% opacity; loading swaps the icon for a spinner.
- **Secondary:** surface fill with a hairline border in the surface's border color. **Ghost:** transparent, brass text. **Destructive:** danger fill.
- **Icon button:** 44px circle, optional desk-raised fill, always a spoken label.

### Chips
- **Style:** 32px pill, surface fill, hairline border, chrome caption at weight 500; 44pt hit slop.
- **State:** selected turns brass-soft with brass text and a 60% brass border. Static chips (no press) serve as tags.

### Rubber Stamps and Badges
On paper, every status is a rubber stamp: outline (1.5px) and lettering in pressed ink at full opacity, 2px corners, Courier Prime Bold 12/16 in capitals at 1.2px tracking, tilted up to ±2.5°. Pressed ink is the status color mixed 62% with typewriter ink (#241E17), so critical #1D5A70 stamps as #20434E, complication #8F4E10 as #663C13, rejected #6A5D4C as #4F4538 and brass ink #6B480E as #503811 (8.6:1 on aged ivory, 5.7:1 on Faded Rose, the weakest dye); every stamp holds 4.5:1 on the sticky-note dyes as well as plain paper. Rejected material is struck through. On the desk the same Badge is a small 22px label (soft, solid, outline, dashed or dotted by canon status). Stamps always carry their word; tier and canon are never color alone.

### Cards / Containers
- **Index card:** aged ivory under the paper texture, 2px corners, paper lift, fastened by a red pin by default, a brass pin for the current or chosen card (then edged 2px in brass) and for anchor cards such as the project title, a strip of tape, or nothing. Padding 16px with 26px on the pinned top and left sides (16px left when pinned at top centre); 12px between groups.
- **Slip:** a card inside a card becomes a flat slip of darker paper with a hairline crease border, 12px padding, no pin, no shadow.
- **Title page:** taped square to the board: title in capitals and centred, a short ink rule, the logline in italic, then typed particulars as label/value rows.
- **Polaroid:** print-white border 7px (4px at the foot), darkroom photo well, handwritten caption.
- **Sticky note:** faded dye over paper fibre, 1px corners, 24px top padding, for discoveries and reactions.
- **Blank slip:** where the next item goes (New character, New world rule) is a blank index card lying loose on the cork: aged ivory under the paper texture, paper lift, 2px corners, a deterministic tilt from its label (up to ±2°), no pin or tape, at least 96px tall, with a pencilled "+ label" centred in Caveat (hand note, 22/24) in typewriter ink (#241E17). An unanswered slot in the crew report is bare cork with a handwritten "no answer". The home screen's New project card is a taped card with a solid 1.5px ruled-tan ring (#C4B38D) around its plus.

### Inputs / Fields
- **On the desk:** desk-surface box, 1px desk-seam border, 4px corners, 48px minimum height, chrome body text; focus thickens the border to 1.5px brass.
- **On paper:** a typed line, not a box: Courier Prime at the chrome body size (16/23) on a faint 45% ivory wash, selected text in the ink fill, a 1.25px ink-rule underline that becomes 2px ink on focus. Errors turn the border danger and replace the helper text.
- **Labels:** the chrome or typed caption in bold above the field; the placeholder is pencil or ash.
- **Stepper and index tabs:** steppers pair 44px filled icon buttons around a tabular value. Mutually exclusive choices on the desk are index-card tabs: paper tabs in Courier Prime Bold capitals (12/16, 1.1px); idle tabs stay opaque paper under a warm shade (rgba(38, 26, 14, 0.24)), the chosen one is unshaded, lifted 2px and marked with a brass line. On paper the same control is a typed row with an ink underline. On-off choices take the same control, never a platform switch: the crew's Blind session setting is an Open | Blind pair.

### Navigation
The string nav is the app's navigation and its signature. Five areas (Home, Story, Rehearse, Crew, Discover) hang from one red string with tablist semantics.
- **Phone rail:** a walnut rail along the bottom; each area is a paper tag (Courier Prime Bold 10/13 capitals, 0.8px tracking, 2px corners, tag lift) hanging from a pin on the string. The active tag carries a red pin (18px) on bare paper; idle tags carry brass pins (13px) and stay opaque paper, with a warm shade (rgba(38, 26, 14, 0.22)) laid over the paper raster so they sit back in the lamp's shadow without the string showing through.
- **Wide sidebar:** 232px of desk with the wordmark, the project name typed in capitals, the string running top to bottom through a pin per area (red and 20px when active, brass and 15px otherwise), chrome labels at 15px, a 7% chalk wash on the active row, the beat progress track and the handwritten motto.
- **Following the string:** choosing an area sends a bead of light along the string from the old pin to the new one (460ms, cubic-bezier(0.77, 0, 0.175, 1), following the thread's sag), swings the arriving tag from ±5° on a spring (damping 9, stiffness 180), and slides the new board in 28px from that side over 280ms (strong ease-out) while it fades up from 35% over 240ms. Reanimated follows the system Reduce Motion setting.

### Tape Label
Section headings on the board are masking-tape strips with a Caveat label in ink (26px), tilted up to ±2°, with an optional handwritten aside in chalk beside the tape that drops beneath it when the row is narrow. Inside a card, the same Section becomes a typed label instead.

### The String
A StringBoard measures every pinned card within it and draws one thread per key through the pins in order, one quadratic curve per span. A sideways span sags by its slack (8px plus a tenth of its length, at most 44px); a vertical span (horizontal distance under half the vertical) bows left by a control offset of max(48, slack × 0.7) on the board (the sidebar thread, which clears no cards, keeps the gentle slack × 0.7), so its midpoint swings at least 24px left of pins that sit about 14px inside their cards, and the thread hangs in the cork gutter beside stacked cards instead of crossing them. The wide sidebar's thread starts 12px above the top of its tag list (38px above the first pin) and that overhang is drawn (its Svg is shifted up 12px with a matching viewBox), not clipped. Pins are photographic rasters (red and brass, 22px), drawn above the string.

## Do's and Don'ts

### Do:
- **Do** put every piece of content on the board on paper: an index card, slip, print, sticky note or stamp, fastened by pin, tape or nothing.
- **Do** read the surface: chalk and the platform face for desk chrome (#14110E), ink and Courier Prime on paper (#EDE3CC).
- **Do** keep brass (#C9A25B) as the only interactive accent on the desk and ink (#2B241C) as the interactive fill on paper.
- **Do** join related cards with the red string in reading order, and let navigation travel along it.
- **Do** give every outcome tier and canon status its word on a stamp as well as its color.
- **Do** keep touch targets at 44pt, extending small controls with hit slop.
- **Do** tilt pinned cards deterministically by key (up to ±0.8°) and hang forms and long reading square.

### Don't:
- **Don't** use string red (#A8201A) for buttons, links or focus; it belongs to the string, the pins (including the pin that marks the current place) and failure.
- **Don't** round paper past 2px, and don't use a pill as a piece of paper; pills belong only to small controls (chips, icon buttons, reaction counters), on the desk or on a card.
- **Don't** set data or values in Caveat, or use Cinzel anywhere but the wordmark.
- **Don't** set a tracked-capitals label above a heading; labels head values and in-card sections only.
- **Don't** add zero-blur, sideways or colored shadows beyond the string's own stroke shadow and the bead's glow; depth comes from the one lamp overhead.
- **Don't** use flat bordered UI cards on the cork, or textures that are not from the desk's own materials (cork, walnut, paper, tape).
- **Don't** type text on paper lighter than pencil (#5B4F40), the lightest paper ink: it holds 5.5:1 on slip paper (#E2D5B8) and 6.2:1 on aged ivory (#EDE3CC). The lighter canon hues (#554A3C, #6A5D4C) reach paper only pressed into a stamp.
- **Don't** mark where the next item goes with a dashed or dotted outline or an empty drop zone; it is a blank slip lying loose on the cork, or bare cork with a handwritten note. (The desk Badge's dashed and dotted outlines are canon status marks for proposed and unknown, not placeholders.)
