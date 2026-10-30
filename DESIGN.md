---
name: CCM Portal
description: The agency's content portal, browsed like a catalogue of typeset title cards on one dark ground.
colors:
  ground: "#0e0f12"
  tile: "#1b1d22"
  tile-hi: "#23262c"
  tile-dim: "#131417"
  raised: "#282b32"
  raised-hi: "#33363e"
  well: "#15161a"
  line: "#2a2d34"
  ctl: "#3c4049"
  ctl-hi: "#565b66"
  ink: "#eceef2"
  ink-2: "#a6aab3"
  icon: "#9a9ea7"
  placeholder: "#8e939c"
  acc: "#ffd23f"
  acc-hi: "#ffdc66"
  acc-ink: "#0e0f12"
  approved: "#6fd99b"
  ready: "#6ea8ff"
  changes: "#f7922f"
  waiting: "#767b87"
  late: "#ff6461"
  confirm: "#d3d7de"
typography:
  display:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 2.8vw, 40px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  display-phone:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(26px, 7vw, 32px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  cover:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 15cqi, 44px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  cover-medium:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(26px, 11.5cqi, 38px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  cover-long:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(22px, 9cqi, 30px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  cover-overview:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(20px, 8.5cqi, 26px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: '"tnum" 1'
  headline:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title-compact:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"tnum" 1'
  body-sm:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"tnum" 1'
  label:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  caption:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  input-phone:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  accessibility-dyslexic:
    fontFamily: "OpenDyslexic, Comic Sans MS, cursive, sans-serif"
    lineHeight: 1.8
    letterSpacing: "0.05em"
  print-xs:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
  print-sm:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
  print-base:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
  print-lg:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
  print-xl:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
  print-2xl:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
rounded:
  cell: "3px"
  chip: "6px"
  ctl: "8px"
  tile: "10px"
  full: "999px"
spacing:
  cell-gap: "4px"
  tile-pad: "12px 16px 12px 12px"
  gap: "16px"
  gap-phone: "12px"
  shelf: "28px"
  page-x: "40px"
  page-x-tablet: "28px"
  page-x-phone: "16px"
  rail: "64px"
  rail-expanded: "232px"
components:
  button-primary:
    backgroundColor: "{colors.acc}"
    textColor: "{colors.acc-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.ctl}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.acc-hi}"
    textColor: "{colors.acc-ink}"
  button-light:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.ctl}"
    padding: "0 14px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.tile-hi}"
  button-secondary:
    backgroundColor: "{colors.tile-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  button-destructive:
    backgroundColor: "#ff64611f"
    textColor: "{colors.late}"
    rounded: "{rounded.ctl}"
    height: "36px"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "0 12px"
    height: "36px"
  input-phone:
    height: "44px"
  chip-neutral:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "22px"
  chip-todo:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
    height: "22px"
  chip-ready:
    backgroundColor: "#6ea8ff1f"
    textColor: "{colors.ready}"
    rounded: "{rounded.chip}"
    height: "22px"
  chip-approved:
    backgroundColor: "#6fd99b1f"
    textColor: "{colors.approved}"
    rounded: "{rounded.chip}"
    height: "22px"
  chip-changes:
    backgroundColor: "#f7922f1f"
    textColor: "{colors.changes}"
    rounded: "{rounded.chip}"
    height: "22px"
  chip-overdue:
    backgroundColor: "#ff64611a"
    textColor: "{colors.late}"
    rounded: "{rounded.chip}"
    height: "22px"
  card:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "16px"
  title-card:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    typography: "{typography.cover}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  title-card-hover:
    backgroundColor: "{colors.tile-hi}"
  title-card-stepped-back:
    backgroundColor: "{colors.tile-dim}"
  billboard:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.tile}"
    padding: "24px 28px"
  field-cell:
    rounded: "{rounded.cell}"
    size: "14px"
  nav-rail:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.icon}"
    width: "{spacing.rail}"
  nav-rail-item-active:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
  overlay:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
  dialog:
    backgroundColor: "{colors.tile-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
  preview-plate:
    backgroundColor: "#24272e"
    textColor: "{colors.icon}"
    rounded: "{rounded.chip}"
---

# Design System: CCM Portal

## Overview

**Creative North Star: "The Title Wall"**

CCM Portal is browsed like a catalogue you already know how to use. Every request is a typeset title card: its name set as heavy display lettering on a flat tile, a narrow strip of field cells running down its left edge, the creator and the time left at its foot. Cards sit in horizontal shelves that scroll and let the next title peek at the edge. When a title is focused it widens in place to show its fields, and the rest of the wall steps back a tone. The most urgent request is featured above the shelves as a billboard, the largest lettering on the screen.

The world is one dark theme, pinned, for staff who review creator uploads late at night in dim rooms and for creators on their phones. Depth comes from tone steps on a deep neutral ground, never from shadow at rest. Colour is scarce on purpose: a single marquee yellow marks keyboard focus and the one primary action in a region, and the field-state hues (to-do grey, ready blue, needs-changes orange, overdue red, approved green) live only inside tiles, strips and the chips that sit in them. Every state is a colour, an icon and a word together, never colour alone. There is no brand green: green means Approved and nothing else.

Discretion is part of the look. Uploads never show until someone chooses to reveal them; request titles never leave the app through tab titles, texts or email subjects. Dates and countdowns all read on one agency clock. The old green shadcn look, gradients, glass, glows and the KPI-row-over-a-table dashboard are rejected.

**Key Characteristics:**
- One pinned dark theme: ground #0e0f12, tiles #1b1d22, every surface one tone step from the next.
- Titles set as display lettering in Onest 800 with -0.035em tracking, sized by their length, two lines at most.
- One accent, marquee yellow, for focus and the one primary action per region.
- Field-state colour lives only inside tiles; the coloured spine is the request title card's alone.
- Shelves of fractional width so the next tile always peeks; focus widens a title in place.
- Flat at rest; soft shadows only on true overlays.
- Previews hidden until revealed; no request title in any channel that leaves the app unless staff add it to an email in Wording.

## Colors

A near-black neutral ground stepped up in cool greys, lit by one warm yellow and five field-state colours that never leave the tiles. The states follow conventions people already know (grey to do, blue in review, green approved, orange needs changes, red overdue), and each always travels with its icon and word.

### Primary
- **Marquee Yellow** (acc): the only accent. It draws the keyboard focus outline on every control and tile, the fill of the one primary action in a region (Review on the billboard, Send on the composer), the text caret, and toast action text. It always carries dark ink (acc-ink), never white. Hover lifts it to **Marquee Yellow Lit** (acc-hi).

### Secondary
The state vocabulary (types in `src/components/title-wall/types.ts`: `FIELD_STATE_LABEL`, `FIELD_STATE_SHORT`, `CREATOR_FIELD_STATE_*`, `FIELD_STATE_ICON`; components `FieldCell`, `FieldStrip`, `StateIcon`, `StatePill`, `StateLegend`):

| State | Token | Staff word | Creator word | Icon | Cell shape |
|---|---|---|---|---|---|
| waiting | Waiting Outline #767b87 | To do | To do | dashed circle | hollow grey outline |
| ready | Ready Blue #6ea8ff | Ready to review | Waiting for review | clock | plain blue fill |
| approved | Approved Green #6fd99b | Approved | Approved | circle check | green fill, check cut in ground ink |
| changes | Changes Orange #f7922f | Needs changes | Needs changes | undo arrow | orange fill, undo arrow cut in ground ink |
| overdue | Late Red #ff6461 | Overdue | Overdue | alert triangle | hollow red outline, red exclamation mark |

- **Ready Blue** (ready): a field has been uploaded and is waiting for review. Fills the field cell, tints the ready chip, leads charts. 6.99:1 on tile, 7.95:1 on ground.
- **Approved Green** (approved): a field, upload or request is approved. The only green in the product: it never marks brand, chrome, buttons, success toasts or "saved". 9.69:1 on tile, 11.02:1 on ground.
- **Changes Orange** (changes): changes were asked for on a field or upload. Fills the cell and tints the chip. 7.31:1 on tile, 8.31:1 on ground. It sits well away from the yellow accent in hue (about 60 against 90 degrees OKLCH) and is never used for focus or action.
- **Late Red** (late): past due or under 48 hours left. It draws the overdue cell as a red outline, the urgent countdown, overdue chips, destructive tints and invalid input borders. 5.82:1 on tile, 6.61:1 on ground, 4.89:1 on raised.
- **Waiting Outline** (waiting): a field not uploaded yet, drawn as a hollow 1.5px outline (3.98:1 against the tile), never a fill. Its word is set in Quiet Ink, not in the outline grey.
- **Confirm Silver** (confirm, the `success` utility): neutral confirmation (saved, sent, copied, invited). Light grey, never green.
- Colour-blind safety: green, orange and red sit at distinct lightness (OKLCH L .81, .75, .70). Under deuteranopia or protanopia, where orange and red move close in hue, the cell marks, icons and words still separate every state.
- Creators with uploads they have not sent in yet keep the ready cell, but the word reads "Uploaded, not sent yet" with an upload icon in Quiet Ink (`UNSENT_*`), because nobody is reviewing it yet.

### Neutral
- **Night Ground** (ground): the page, the staff rail, the phone bars, browser chrome and the PWA status bar.
- **Cover Tile** (tile): tiles, title cards, cards, panels, the billboard plate.
- **Lifted Tile** (tile-hi): hover, the focused title, selected and pressed states, dialog panels, the secondary button.
- **Stepped-Back Tile** (tile-dim): the rest of the wall while one title is focused, and finished cards. Only the surface dims; text never does.
- **Overlay Slate** (raised) and **Overlay Highlight** (raised-hi): true overlays (popover, menu, select list, tooltip, toast) and the highlighted item inside them.
- **Input Well** (well): one step below the tile; inputs, segmented and tab tracks, the empty preview stage.
- **Hairline** (line): structural 1px lines and dividers.
- **Control Edge** (ctl) and **Control Edge Hover** (ctl-hi): control borders at rest and on hover; also selection background and scrollbar thumbs.
- **Paper Ink** (ink): running text and headings; also the checked checkbox, the on switch, progress fills and the light button.
- **Quiet Ink** (ink-2): secondary text, meta lines, table headers. Holds 4.5:1 on tile and tile-dim.
- **Icon Grey** (icon): icons at rest.
- **Placeholder Grey** (placeholder): input placeholders.

### Print-only (paper)
Applies inside `@media print` only and never on screen. Printed requests, reports, invoices and creator profiles drop the dark world for paper so they read on a white page and spend no toner on the ground.
- **Paper White** (#ffffff, also `white`): the page and `print:bg-white`.
- **Paper Wash** (#f9fafb) and **Paper Wash Deep** (#f3f4f6): faint panel fills.
- **Print Black** (#000000) and **Print Ink** (#111111): body text and the remapped foreground.
- **Print Grey Dark** (#374151) and **Print Grey** (#6b7280): secondary and tertiary text.
- **Print Rule** (#e5e7eb) and **Print Rule Strong** (#d1d5db): borders, row rules and card outlines on paper.

### Email-only
Used only in `src/lib/email-layout.ts`. Mail clients such as Outlook ignore translucent colours, so the chips' 14% state tints are precomputed over the tile:
- **Approved Tint on Tile** (#273733): behind the Approved chip in emails.
- **Changes Tint on Tile** (#3a2d24): behind the Needs changes chip in emails.
- **Late Tint on Tile** (#3b272b): behind the Overdue chip in emails.
- **Ready Tint on Tile** (#273141): behind the Waiting for review chip in emails.

### Mask-only
- **Mask Opaque** (#000 in `mask-image` gradients): the billboard plate's fade into the ground (`linear-gradient(90deg, #000 0%, #000 52%, transparent 100%)`, and 180deg with the stop at 60% under 900px). In a mask, #000 means "fully visible", so it is an alpha value and never paints a surface. Do not use it as a colour.

### Named Rules
**The One Marquee Rule.** Yellow appears only as the focus outline and as the fill of the one primary action in a region. When a page-level create action (New request) would compete with a region's yellow, it takes the light ink fill instead. Pressed, selected and current states are tone steps, never yellow.

**The Green Means Approved Rule.** There is no brand green. Green appears only as Approved Green, on things that are approved (field cells, upload and request chips, the approved count), always with its check icon and the word. Success toasts and "saved" confirmations are neutral (Confirm Silver); switches and checkboxes turn on in ink; buttons, chrome and navigation are never green. Green also survives as one choice in user-pickable data palettes (tags, groups, annotations), which are data, not brand.

**The States Stay Inside Rule.** Ready blue, changes orange, late red and approved green appear only inside tiles, field strips, and chips that sit in rows or tiles, and always with their icon and word (never colour alone). Page chrome, headings, navigation and buttons never carry a state hue; destructive actions use a late-red tint, not a red slab.

## Typography

**Display Font:** Onest (with ui-sans-serif, system-ui)
**Body Font:** Onest (with ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono, only for codes and data (2FA secrets, template variables, keyboard hints, IDs)
**Accessibility Font:** OpenDyslexic, only when a user turns on the dyslexia-friendly font in accessibility settings (`html.dyslexia-font`); it replaces Onest everywhere for that user and is the one sanctioned exception to a single family

**Character:** One geometric-humanist family carries everything, from 64px lettering to 13px meta. Weight does the work colour would elsewhere: covers and the billboard at 800 with tight negative tracking read like poster type, while running text stays at 400 with tabular numerals throughout.

### Hierarchy
- **Display** (800, clamp(30px, 2.8vw, 40px), 1.05, -0.03em): the billboard title only; the largest type on any screen. Clamps to two lines. **Display phone** (same weight and tracking, clamp(26px, 7vw, 32px)) takes over under 900px. The auth cover wordmark uses the same lettering at up to 104px.
- **Cover** (800, clamp(30px, 15cqi, 44px), 1, -0.035em): request, template and creator title cards. Typeset by length so every title fits two lines: Cover up to 44px under 15 characters; **Cover medium** (clamp(26px, 11.5cqi, 38px)) from 15 to 24; **Cover long** (clamp(22px, 9cqi, 30px), tracking -0.025em) beyond. Empty-state headlines on tiles use the same lettering. **Cover overview** (700, clamp(20px, 8.5cqi, 26px), 1.1, -0.02em; medium clamp(19px, 7.5cqi, 23px), long clamp(18px, 6.8cqi, 21px)) sets the covers on the Overview's shelves, on a shorter 3:1 cover, so the wall reads calmly under the billboard.
- **Figure** (600, 26px, 1.05, -0.02em, tabular): the billboard countdown; its unit word drops to 14px 500.
- **Headline** (700, 28px rising to 32px on wide screens, 1.25, -0.02em): page titles (Requests, the request page). Overview sets its h1 smaller (22px, 26px from sm) so the billboard stays the largest type.
- **Title compact** (700, 22px, 1.25, -0.01em): a standalone card title outside the shell, such as the crash page card; matches the Overview h1 on phones.
- **Title** (600, 17px, 1.4): shelf headings, card titles, rail panel headings, empty-state titles; 15px in small cards and thread headers.
- **Body** (400, 15px, 1.5): page finding sentences, billboard notes, briefs. Notes cap at 60ch; header copy at 80ch.
- **Body small** (400, 14px, 1.5): tile foot lines, shelf subtitles, due lines, controls (buttons are 14px 600).
- **Label** (500, 13px, 1.5): meta lines in Quiet Ink, table headers in sentence case, strip labels.
- **Caption** (500, 12px, 1.5): chip text, preview kind captions and support lines (the crash page's contact line). The smallest size in the ramp.
- **Input phone** (400, 16px, 1.5): text in inputs and textareas on phones, so iOS does not zoom on focus; inputs drop to 14px from 768px.
- **Accessibility** (OpenDyslexic, line-height 1.8, letter-spacing 0.05em, word-spacing 0.1em): replaces Onest at every size only for a user who turns it on; never chosen by design.
- **Print** (`@media print` only; tokens print-xs to print-2xl): the print utilities set 0.75, 0.875, 1, 1.125, 1.25 and 1.5rem on paper. The 18, 20 and 24px steps exist only in print and must never appear on screen.

### Named Rules
**The Lettering Rule.** A title is set, not written: Onest 800, tracking -0.035em, sized by its length, never more than two lines, balanced. Nothing else in the interface uses 800. The one exception is the Overview's shelves, whose covers step down to Cover overview (700) beneath the billboard.

**The Heading First Rule.** Nothing sits above a heading: no eyebrow, kicker or overline. Context (kind, sender, "sent 15 days ago", "404") goes in a line under the title. Headings and labels are sentence case; nothing is set in tracked uppercase.

**The Tabular Rule.** Every number is tabular: body, tables, times and countdowns set `tabular-nums` so figures do not jitter as they tick.

## Layout

**Staff app.** From 768px a slim 64px icon rail sits on the ground with a 1px hairline edge (expandable to 232px with labels, remembered per browser). Content runs beside it with page margins of 40px, 28px under 1100px and 16px under 600px, up to a 1680px maximum. A page opens with its h1 and one sentence that answers the screen's question, then a quiet counts line in Quiet Ink; the page-level create action sits top right and goes full width on phones. Under 768px the rail folds into a 48px phone bar (menu, mark or Back, the screen's nav name, Messages) and a slide-in menu sheet; there is no bottom tab bar.

**The wall.** Below the header, a compact billboard (a two-column grid, `minmax(0,1fr) minmax(260px,340px)`, gap 32px) features the most urgent request, then shelves follow with generous room between them. The Overview is deliberately quiet: one emphasis per region, lettering a step down on the shelves, and lower-priority sections (New from creators, Messages) sit below a divider, with New from creators folded until opened (remembered per browser) and Messages collapsing to one line when nothing is unread. Each shelf is a horizontally scrolling, snap-aligned row whose tile widths are fractional by container width: 1.15 tiles under 520px, then 2.3, 3.3, 4.3 and 5.3 from 520, 760, 1000 and 1400px, so the next tile always peeks. The tile gap is 16px (12px under 600px). Under 900px the billboard stacks to one column with 18px by 16px padding.

**The request page.** A main player column with a right rail of panels (Up next, Details, Message, Brief, History, For the team) whose bottoms end level with the main column.

**Creator portal.** A sticky 56px top bar on the ground, with destinations inline from 640px; a single centred column of at most 560px. Under 640px a bottom tab bar on tile (Home, Requests, Calendar, Messages, Settings) with 44px or larger targets and safe-area padding, and 104px of bottom padding so nothing sits under it.

**Touch.** Controls are 40 to 44px tall on touch and 36px from 768px; inputs set 16px text on phones so iOS does not zoom.

## Elevation & Depth

The system is flat at rest and conveys depth by tone: ground, then well one step up for inputs, tile for content, tile-hi for hover and focus, raised for overlays. Every shadow token below lg resolves to nothing, so legacy shadow utilities fall flat. Real soft shadows appear only on things that truly float above the page.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.55), 0 2px 8px -2px rgb(0 0 0 / 0.4)`): popovers, menus, select lists, tooltips, toasts.
- **Dialog** (`box-shadow: 0 18px 44px -10px rgb(0 0 0 / 0.6), 0 4px 12px -4px rgb(0 0 0 / 0.4)`): dialogs, alert dialogs, sheets.
- **Deep** (`box-shadow: 0 24px 56px -12px rgb(0 0 0 / 0.65)`): the largest floating panels.
- **Scrim** (`rgb(8 9 11 / 0.74)`): behind dialogs and sheets; no blur.

### Named Rules
**The Tone Step Rule.** If it does not float, it has no shadow. Lift a surface by moving it one tone step, never by adding a shadow, a glow, glass or a gradient. The one gradient in the world is the billboard plate's mask, which fades a flat tile into the ground (horizontally on desktop, vertically under 900px) rather than blending colours.

## Shapes

Corners are tight and fixed, stepped by scale: field cells 3px (2px inside spines and labelled strips), chips and preview plates 6px, controls 8px, tiles, cards, dialogs and the billboard 10px. The larger legacy radius steps fold down (xl 10px, 2xl 12px) so old rounded cards read as tiles. Circles are for avatars, count badges and scrollbar thumbs only. Borders are rare: tiles and cards have none; 1px hairlines separate structure; controls carry a ctl border. Overlays carry a ctl hairline at 60%.

**The Only Spine Rule.** The vertical strip of field cells down the left edge of a request title card is the only coloured edge in the system. Creator cards, template cards, message cards, alerts and list rows never take a coloured side stripe.

## Components

### Buttons
Firm and quiet: tone and outline everywhere except the one yellow.
- **Shape:** 8px corners, a transparent 1px border so variants line up.
- **Primary:** Marquee Yellow fill with dark ink, 14px 600; 40px tall on touch, 36px from 768px (sm 36/32px, lg 44px). One per region.
- **Hover / Focus:** 150ms ease-out colour transitions; yellow lifts to acc-hi. Every button scales to 0.97 under the finger (not under reduced motion) and shows a 2px yellow focus outline offset 2px.
- **Light:** an ink fill with ground text for a page-level create action when yellow is taken; hovers to white.
- **Outline:** a ctl border on transparent, hovering to ctl-hi and tile-hi. The default for secondary actions (Send reminder, Message).
- **Secondary / Ghost:** a tile-hi fill hovering to raised; ghost is bare until hover.
- **Destructive:** a late-red tint (12%) with late text and a 35% late border, never a solid red slab.
- **Disabled:** transparent with a hairline border and Quiet Ink text.

### Chips
- **Style:** 22px tall pills with 6px corners, 12px 500 text, tabular numerals. Neutral chips sit on raised; status chips are a pale tint (12%; 10% for overdue) of their state with same-hue ink and the state's icon before the word: ready (clock), approved (green, check), changes (undo arrow), overdue (alert triangle). To do is an outline with a dashed-circle icon. Draft is an outline only, with no icon (a draft is not a field state). `StatePill` draws any state; `Badge` status variants add the icon themselves. A solid yellow accent chip exists for the one item that needs action now, used sparingly.
- **State:** chips sit inside rows and beside values, never above a heading.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** tile, hovering to tile-hi; finished items rest on tile-dim.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; card footers carry no rule and no band.
- **Internal Padding:** 16px (12px for small cards); card titles at 17px 600.

### Inputs / Fields
- **Style:** a well background, 1px ctl border hovering to ctl-hi, 8px corners; 44px on touch and 36px from 768px. Textareas and selects share it. The caret is yellow; placeholders are Placeholder Grey.
- **Focus:** the border turns yellow and a 2px yellow outline appears at 1px offset.
- **Error / Disabled:** invalid turns the border late red; disabled drops to a hairline border and Quiet Ink. Dates use the themed picker, never the native date input.
- **Checkbox / Switch:** checked and on are an ink fill with a ground tick or thumb; never green, never yellow.
- **Tabs:** a well track with the active tab on tile-hi; the line variant underlines in ink.

### Navigation
- **Staff rail:** 64px on the ground, icons in Icon Grey with 1.5px strokes. From top: the CCM mark, Search (Ctrl K), nav groups separated by short hairlines, an expand toggle, the account avatar. Every icon has a portalled tooltip and an accessible name. The active item is a tile background plus a 2px ink bar at the rail edge, never colour. Counts are small neutral raised-hi badges.
- **Phone:** a 48px bar on the ground and a slide-in menu sheet with every destination; titles come from the nav, never from a request.
- **Creator:** inline links from 640px (36px, tile background when current, Quiet Ink otherwise); below that a bottom tab bar on tile whose active item turns ink with a heavier icon stroke.

### Field Strip
The field-state vocabulary in three forms, all built from the same cell. **Cells:** 14px squares at 3px corners with 4px gaps. Waiting is a hollow waiting-grey outline; overdue a hollow late-red outline with a red exclamation mark; ready is a plain fill; approved a fill with a check and changes a fill with an undo arrow, both cut in ground ink. **Spine:** 6px wide, stretched down a request title card's edge, 3px gaps. **Labelled:** a grid of 10px bars, one column per field, each with a 13px ink name and under it the state's 12px icon and word in Quiet Ink; used on the billboard, the creator cover and the review player. Spines and bars carry no marks (too small); they keep fill against outline. **Legend:** `StateLegend` lists each state's cell and word in a wrapping row of 13px Quiet Ink; it sits under the requests list. A changed cell fills from its leading edge (450ms). Every strip carries an accessible name built from its fields.

### Title Card
A typeset cover on a tile: 10px corners, padding 12px 16px 12px 12px, 14px between the spine and the face. The title sits in a fixed 12:5 cover region in Cover lettering; nothing sits above it. The foot holds the creator (14px 500) and the time left, then a 13px Quiet Ink summary ("0 of 2 approved · 2 to review"). The whole card is the link's hit area; hover lifts it to tile-hi and keyboard focus draws a 1.5px inset yellow outline.

### Shelf and Wall
A shelf is a 17px 600 heading with a 14px Quiet Ink subtitle on one line, prev/next buttons only when the row overflows, then the snap-scrolling row. On the wall, arrows move across and between rows, Space opens a title in place, Enter goes to it, Esc closes; a mouse hover focuses after 260ms. The focused title widens to two tiles (500ms Flip), its cover keeps one tile's width and its details slide in; the rest of the wall steps back to tile-dim while its text stays full strength. A key-hint line in kbd chips sits at the foot of the wall.

### Billboard
The featured request: a tile plate fading into the ground by mask, Display lettering, a 15px creator line with the name in ink, an optional note, and the labelled field strip at the foot. The right column holds the large Figure countdown, the due line and the summary, then the yellow primary at its natural width and the secondaries (Send reminder, Message) as quiet text buttons that gain a tone step on hover.

### Countdown
Time left in one rule: 600 weight, tabular. It turns late red only when overdue or under 48 hours left; otherwise it stays ink. On the Overview it turns red only when actually late, so the wall does not shout about every request due this week. "1 d 10 h" under three days, whole days beyond. Completed requests read "Finished on time" or "Finished N days late".

### Discreet Preview
Uploads are hidden by default: a flat plate (6px corners) with an eye-off icon and a 12px kind caption ("4 photos", "Video 0:22"), optionally over a heavily blurred tone field. No image is requested until it is revealed by click, Space or Enter, press-and-hold or holding P to peek, or a page-level "Show previews" toggle. Revealed captions sit on a dark chip. "Nothing yet" uses the well.

### Overlays
Dialogs on tile-hi, sheets on tile, both with the dialog shadow, 10px corners and 36 to 44px close targets. Popovers, menus, select lists and tooltips are raised panels with a ctl hairline; items are at least 36px and highlight to raised-hi. Toasts sit bottom centre on raised with a ctl border; error icons late, warning icons yellow, success neutral.

### Email
The inbox gets the same world (`src/lib/email-layout.ts`, built per message in `src/lib/creator-emails.ts`). On the night ground, a 560px column with 24px gutters (16px on phones). From the top: the typeset "CCM" wordmark (22px 800, -0.035em; never an image, which mail clients block). Then a cover tile with the heading in Cover lettering, sized by length (40, 34 or 28px; 30px on phones), and an optional chip under it. Then the message in 15px ink, the request on a tile (17px 600 title, 14px Quiet Ink meta, a state chip, and the team's note under a hairline). Then the one yellow button (left-aligned, full width on phones), the paste-this-link box in a well in mono, 13px Quiet Ink notes, and a hairline footer in 12 to 13px Quiet Ink. Chips use the state's precomputed 14% tint on the tile, with the glyph before the word (✓ Approved, ↺ Needs changes, ! Overdue). The email declares itself dark only. Gmail's iOS app inverts it in dark mode and it stays legible. The wording is staff-edited plain text (Reminders > Wording) inside this fixed layout. Texts never carry the request or template name; the standard subjects, headings and buttons don't either, but staff may add it to an email's on Reminders > Wording (with a heads-up).

### Motion
Controls transition colour in 150ms ease-out; tiles in 200 to 250ms. Choreography runs on GSAP with shared durations (press 100ms, release 220ms, tick 320ms, fill 450ms, flip 500ms, panel 300ms) and power-curve easing, animating only transform and opacity. Nothing animates on page load and no content waits for script. Under reduced motion every state change is instant.

### Named Rules
**The Discretion Rule.** Request titles can be explicit, so they never leave the app by default: tab titles on request pages are generic ("Request · CCM Portal"), SMS bodies never carry a request or template name, and the standard email subjects and preheaders carry none. Since 2026-10-30 staff may choose to put the request or template name in an email's subject, heading or button on Reminders > Wording; the editor shows a heads-up that it will appear on lock screens and in inbox lists. Upload previews stay hidden, with no image request, until a person reveals them.

**The Agency Clock Rule.** Every date, due line and countdown is formatted through the display-timezone helpers in `src/components/title-wall/time.ts`, never the machine's local time. A plain date is due at 23:59 on that day in the agency's timezone; a timestamp is used as is.

## Do's and Don'ts

### Do:
- **Do** set every surface as a tone step on the ground: tile for content, tile-hi for hover and focus, raised for overlays, well for inputs.
- **Do** give each region exactly one yellow primary action, and use the light ink button for a page-level create action when yellow is taken.
- **Do** draw keyboard focus as a 2px yellow outline (1.5px inset on title cards) on everything interactive.
- **Do** set titles in Onest 800 at -0.035em, sized by length, two lines at most, with the billboard title the largest type on the screen.
- **Do** open each page with its title and one sentence that answers the screen's question, with context lines under headings.
- **Do** show field state with cells, spines, labelled strips and tinted chips inside tiles, with the state's icon and word wherever it is written out; take colours, icons and words from the shared vocabulary, never hard-code them.
- **Do** keep shelves at fractional widths so the next tile peeks, and step the rest of the wall back to tile-dim without dimming its text.
- **Do** route every date and countdown through `src/components/title-wall/time.ts`, and turn countdowns red only when late or under 48 hours (on the Overview, only when late).
- **Do** keep previews hidden until revealed and keep request titles out of tab titles and SMS bodies, and out of email subjects unless staff choose to add them in Wording.
- **Do** keep controls 40 to 44px on touch and 36px from 768px, with 16px input text on phones.

### Don't:
- **Don't** use green for anything but Approved: not for success toasts, "saved", switches, checkboxes, buttons or brand.
- **Don't** show a state by colour alone, or use orange and yellow interchangeably: orange is Needs changes, yellow is focus and the one primary action.
- **Don't** use yellow for selected, pressed or current states, for decoration, or for more than one action per region.
- **Don't** put state hues in page chrome, headings, navigation or buttons; destructive actions are a tint, not a red slab.
- **Don't** put a coloured edge stripe on anything but a request title card.
- **Don't** place an eyebrow, kicker or overline above a heading, or set labels in tracked uppercase.
- **Don't** add a light theme, a theme toggle, gradients, glass, glows or a shadow on anything that does not float.
- **Don't** build a KPI row over a table; counts go in a sentence and a quiet counts line.
- **Don't** format dates with the browser's or server's local timezone.
- **Don't** render an upload thumbnail before the person reveals it.
