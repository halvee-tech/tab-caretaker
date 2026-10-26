---
name: Tab Caretaker
description: A compact tab-management interface in Coco's calm, adaptive workbench system.
colors:
  accent: "#3458e6"
  accent-strong: "#2948c7"
  accent-soft: "#edf2ff"
  on-accent: "#ffffff"
  canvas: "#f0f3f9"
  surface: "#ffffff"
  surface-subtle: "#f6f8fc"
  ink: "#152034"
  body: "#354154"
  muted: "#536077"
  border: "#e1e6ef"
  border-strong: "#c7d1e2"
  success: "#087f5b"
  success-soft: "#e9f7f2"
  error: "#b3485e"
  error-soft: "#fff0f3"
  error-border: "#e7b8c2"
  dark-accent: "#8da4ff"
  dark-accent-strong: "#a5b6ff"
  dark-accent-soft: "#29365f"
  dark-accent-ink: "#c1ccff"
  dark-accent-muted: "#a6b5df"
  dark-on-accent: "#101522"
  dark-canvas: "#11151d"
  dark-surface: "#181d27"
  dark-surface-subtle: "#202633"
  dark-ink: "#f1f4fb"
  dark-body: "#d9dfec"
  dark-muted: "#aeb9ce"
  dark-border: "#2d3748"
  dark-border-strong: "#47556d"
  dark-border-hover: "#61708a"
  dark-control-hover: "#303d66"
  dark-control-pressed: "#35456f"
  dark-toggle-off: "#59657a"
  dark-separator: "#68758a"
  dark-scrollbar: "#556177"
  dark-selection-ink: "#f1f4fb"
  dark-selection-bg: "#354b87"
  dark-focus: "#9aafff"
  dark-focus-soft: "rgb(141 164 255 / 24%)"
  dark-success: "#70d6b2"
  dark-success-soft: "#16372d"
  dark-error: "#ff9cb0"
  dark-error-soft: "#3a2028"
  dark-error-border: "#70404c"
typography:
  headline:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  control: "8px"
  field: "9px"
  search-panel: "10px"
  state: "10px"
  group: "12px"
  panel: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "10px"
  md: "12px"
  lg: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "36px"
  search-field-popup:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "34px"
  search-field-sidepanel:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.search-panel}"
    padding: "0 10px"
    height: "34px"
  work-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  tab-row-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
    height: "52px"
---

# Design System: Tab Caretaker

## Overview

**Creative North Star: "The Quiet Tab Desk"**

Tab Caretaker is a compact operating surface built from Coco's calm adaptive workbench language. In light mode, a cool-gray canvas, white work surfaces, deep navy text, pale-blue state surfaces, and one authoritative blue carry the hierarchy. In dark mode, deep navy-charcoal surfaces, light ink, restrained blue state layers, and a brighter Coco blue preserve the same semantic hierarchy. Density stays purposeful because the interface is used to scan, search, and act on many tabs without visual ceremony.

The product keeps its own stacked-tab mark. Three offset tab rectangles move from near-white through light blue to Coco blue, preserving the caretaker identity while making the palette visibly part of the Coco family. The interface follows the operating-system preference through `prefers-color-scheme`; dark mode changes semantic token values, not component structure, density, or interaction meaning.

**Key Characteristics:**

- Compact, readable controls and rows preserve the extension's high information density.
- Light or dark work surfaces sit on their theme canvas with one-pixel structural boundaries.
- Coco blue is reserved for primary action, focus, selection, and active state.
- Pale blue carries hover, selected, and informational state surfaces without becoming decoration.
- The stacked-tab mark uses deep-blue and light-blue geometry without an added logo container.

## Colors

The palette is cool, quiet, and functional in both color schemes: ink establishes hierarchy, neutral surfaces build structure, and blue appears only where interaction needs a clear signal. The frontmatter is normative for the exact light and dark semantic values.

### Primary

- **Coco Action Blue:** The only general-purpose accent, used for primary buttons, checked controls, active text, carets, focus borders, and focus outlines.
- **Coco Deep Blue:** The hover and active strengthening of the primary accent, also used as the deepest edge of the stacked-tab mark.
- **Pale Selection Blue:** The low-emphasis surface for hover, selected rows, count badges, and informational feedback.

### Neutral

- **Cool Canvas:** The page and side-panel backdrop behind white work surfaces.
- **Work Surface:** The popup ground, cards, grouped-tab containers, and input fill at rest.
- **Quiet Surface:** A gentle input, footer, hover, and group-header layer.
- **Navy Ink:** Headings and primary row content.
- **Slate Body:** Supporting copy that still participates in the main reading flow.
- **Accessible Muted:** Metadata, placeholders, counts, and secondary labels; do not make this role lighter than the established muted token.
- **Hairline Border:** Section separators and the single boundaries around panels and groups.
- **Strong Border:** Input and secondary-control boundaries that need clearer affordance.

### Adaptive Dark Scheme

- **Theme trigger:** Apply the dark semantic tokens only inside `@media (prefers-color-scheme: dark)`; no manual theme class is required.
- **Surfaces and ink:** Dark Canvas, Dark Work Surface, and Dark Quiet Surface replace their light counterparts, while Dark Ink, Dark Body, and Dark Muted preserve the same hierarchy.
- **Interaction:** Dark Coco Action Blue, Dark Deep Blue, Dark Selection Blue, Dark Focus, hover, pressed, selection, scrollbar, toggle, and separator tokens retain their existing semantic roles.
- **Feedback:** Dark Success and Dark Recovery tokens replace the light status colors without changing component structure or copy.
- **Surface-specific tokens:** Dark Accent Muted, control hover/pressed, toggle-off, and separator are used by the popup; Dark Border Hover is used by the options page. Shared tokens remain identical across popup, options, and side panel.

### Named Rules

**The One Accent Rule.** Coco blue means action, focus, selection, or active state; it does not fill large decorative regions.

**The Accessible Quiet Rule.** Muted copy and placeholders use the established accessible muted color, while all focus borders and outlines use solid Coco blue.

**The Semantic Theme Rule.** Dark mode swaps semantic token values through `prefers-color-scheme`; it does not introduce a second component system or change the meaning of accent, surface, border, focus, success, or error roles.

## Typography

**Display Font:** Inter with the native Chinese sans stack
**Body Font:** Inter with the native Chinese sans stack

**Character:** Neutral, compact, and highly legible. Weight and spacing create hierarchy without introducing a decorative display face.

### Hierarchy

- **Headline** (700, 20px, 1.25): The options-page product heading; this is the largest type in the system.
- **Title** (650–700, 15px, 1.25): Popup and side-panel headings plus section titles.
- **Body** (400, 12px, 1.55): Settings copy, field content, state messages, and explanatory text.
- **Label** (600–650, 10–11px, 1.4): Metadata, counts, button labels, group labels, and compact tab details.

### Named Rules

**The Density Without Squinting Rule.** Reduce size for metadata, not contrast: compact labels remain readable through the muted token, deliberate weight, and short line lengths.

## Layout

The popup is a fixed 380px work surface with 17–18px edge padding. Its layout is a single vertical flow: identity and utility, search, status and actions, automation rows, results or notices, then footer actions. Controls remain close to the content they affect.

The options page centers a fluid container up to 720px wide on the cool canvas, with 40px desktop side clearance and 24px card padding. At 620px and below, page gutters contract to 12px per side, two-column advanced fields stack, and save and archive actions become full-width.

The side panel is a narrow continuous browser surface with a sticky work-surface header, 10px content gutters, 9px group spacing, and 52px tab rows. Sections are separated once; nested decorative frames are avoided. Popup and side-panel search inputs share a compact 34px height and 0 10px horizontal padding. The popup search uses a 9px radius; the side-panel search uses a 10px radius. The shared rhythm is compact and intentionally drawn from 8, 10, 12, 16, and 24px intervals.

## Elevation & Depth

The system is flat by default. Tonal contrast and one-pixel borders separate canvas, panels, groups, rows, and fields. Small blue-tinted shadows appear only under the stacked-tab mark and primary action, while the defined ambient panel shadows are reserved for temporary raised UI rather than resting cards.

### Shadow Vocabulary

- **Primary action** (`0 4px 12px rgb(52 88 230 / 18%)`): A restrained blue-tinted lift on the principal commit action.
- **Brand mark** (`0 3px 8px rgb(41 72 199 / 8%)` to `0 4px 10px rgb(41 72 199 / 8%)`): A faint separation between overlapping tab layers.
- **Popover:** Reserved for popup-scale temporary layers; the light shadow becomes a stronger neutral-black ambient shadow in dark mode.
- **Dialog:** Reserved for dialog-scale temporary layers; the light shadow becomes a stronger neutral-black ambient shadow in dark mode.

### Named Rules

**The One Boundary Rule.** A resting region gets one structural boundary—tone or border—not an accumulating stack of border, shadow, and nested frame.

## Shapes

Corners are restrained and proportional to scale. Buttons use 8px corners, standard fields and the popup search use 9px, the side-panel search uses 10px, grouped rows use 12px, and major work panels use 14px. Fully rounded geometry is limited to switches, dots, and similarly compact status indicators. The brand mark repeats 6–7px rounded tab rectangles in a stepped diagonal stack.

## Components

### Brand Mark

- **Geometry:** Three overlapping tab rectangles progress diagonally from near-white to light blue to Coco blue.
- **Shape:** Small 6–7px corners and thin blue borders keep the mark legible at 34–42px.
- **Usage:** Show the mark directly beside the product or surface title; do not place it inside another rounded app tile.

### Buttons

- **Shape:** Compact controls with 8px corners and 34–38px minimum height.
- **Primary:** On-accent text on Coco blue; reserve it for the main available action in a local region.
- **Secondary:** Coco-blue text on the work surface or selection surface with a neutral boundary where the affordance needs definition.
- **Hover / Focus:** Hover deepens or softens the appropriate blue surface. Keyboard focus always adds a 2px solid Coco-blue outline with 2px offset; fields use a solid Coco-blue border plus a soft outer ring.

### Search and Inputs

- **Style:** Work-surface or quiet-surface fill, primary ink, accessible muted placeholders, and a strong neutral border, using the active color scheme's semantic values.
- **Shape:** Popup and side-panel search inputs are 34px tall with 0 10px horizontal padding. The popup uses a 9px radius; the side panel uses a 10px radius. Standard settings fields remain 9px.
- **Focus:** The border switches to solid Coco blue with a 3px translucent blue ring, without changing geometry.
- **Invalid:** Error red replaces the field border; error copy sits on a pale red surface where a message is present.

### Switches

- **Style:** A 36px by 22px neutral track with a 16px work-surface thumb.
- **State:** Checked uses Coco blue. The thumb translates horizontally without changing track size.

### Cards and Containers

- **Corner Style:** Group containers use 12px corners; major options-page panels use 14px corners.
- **Background:** Work surfaces on the active scheme's canvas; the quiet surface may identify a header or footer subdivision.
- **Border:** One hairline neutral boundary carries the resting structure.
- **Internal Padding:** Major panels use 24px; dense groups use 3–10px around rows.

### Tab Rows and Groups

- **Rows:** A 52px minimum row keeps favicon, title, metadata, and status aligned in a compact three-column grid.
- **Selection:** The active row uses a pale-blue surface and Coco-blue title while retaining navy and muted hierarchy elsewhere.
- **Groups:** A quiet header, one small semantic color dot, count, and disclosure icon identify each browser tab group without adding another accent system.

### Notices and States

- **Success:** Green text on a pale green surface.
- **Error:** Muted red text on a pale red surface, with a matching border only when the state needs a bounded recovery action.
- **Loading / Disabled:** Preserve layout, reduce enabled emphasis, and retain explicit text rather than introducing ornamental loaders.

## Do's and Don'ts

### Do:

- **Do** preserve compact density, ellipsis behavior, and tabular numerals for counts.
- **Do** use the active scheme's surface and canvas tokens with one-pixel borders as the primary structural system.
- **Do** let `prefers-color-scheme` select the approved light or dark semantic values while preserving component geometry and hierarchy.
- **Do** reserve Coco blue for action, focus, selection, active state, and the deepest layer of the brand mark.
- **Do** keep muted and placeholder copy at the accessible muted token and focus indicators at solid Coco blue.
- **Do** preserve visible hover, focus, loading, disabled, empty, success, and error states.

### Don't:

- **Don't** add a separate theme class, theme-specific component layout, decorative gradients, glass effects, or broad accent-filled regions.
- **Don't** inflate controls, headings, or spacing at the cost of popup and side-panel scanability.
- **Don't** stack borders, shadows, and nested rounded containers around the same resting region.
- **Don't** replace the stacked-tab identity with Coco Travel imagery or another product mark.
- **Don't** use low-contrast gray for secondary text or a translucent-only focus border.
