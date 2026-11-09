# Stats graphic visual QA

final result: passed

## Target and evidence

- Source visual truth: `/Users/benjaminschachter/Downloads/IMG_3155.PNG` (1206 × 2622 pixels).
- Selected region: stats graphic only, crop x=0, y=557, width=1206, height=1518. Reddit and phone UI excluded.
- Source crop: `.audit/graphic/reference.png`.
- Final browser-rendered implementation: `.audit/graphic/final-desktop.png`.
- Full-view comparison: `.audit/graphic/comparison-final-rgb.png`, source left / implementation right.
- Focused header/type comparison: `.audit/graphic/final-header-comparison.png`.
- Focused standings/schedule/leaders comparison: `.audit/graphic/final-detail-comparison.png`.
- Phone evidence: `.audit/graphic/final-mobile.png`.
- Tablet evidence: `.audit/graphic/final-tablet.png`.
- Local preview: http://127.0.0.1:4173/.

## Viewport and normalization

Final desktop capture uses the in-app browser at 1206 × 1518 CSS pixels, devicePixelRatio=1. The poster is 1206 × 1518 pixels; no screenshot resampling is required. Earlier Chrome native captures used a 2× display at 50% browser zoom, yielding the same 1206 × 1518 poster pixel dimensions after excluding browser chrome and centering margins. Source and implementation are in the same static November 8 state.

The iPhone source carries Display P3 color metadata. The banner and semantic win/loss colors were refined against its sampled color values using CSS Display P3 colors. ImageMagick palette/profile-converted comparison attempts produced invalid darkened composites and are excluded from evidence; the final comparisons explicitly use truecolor RGB PNG output. This is a visual comparison, not a claimed numerical pixel-difference score.

## Comparison history

1. **Initial pass — P1/P2 differences.** `comparison-1.png`: wrong numeral font, undersized official logos due to their built-in SVG whitespace, excessive standings seed-column width, and chart baseline slightly high. Fixed logo sizing, explicit table columns, and chart placement.
2. **Typography pass — P2 differences.** `comparison-2.png`: Barlow Condensed too narrow and Kode Mono had the wrong zero. Compared font specimens, selected Roboto Condensed for the body and found Graduate for the distinctive octagonal dotted-zero numerals.
3. **Content/layout pass — P2 differences.** `comparison-3.png`: Capitals wordmark needed its eagle variant in the schedule and matchups; lineup icons were too far right; special-teams/leader vertical spacing drifted. Added the official secondary eagle, corrected icon spacing and section rhythm. A transient hot-update error while changing the logo prop was corrected and TypeScript was rerun.
4. **Final refinement.** `comparison-4.png`: matching Graduate numerals now present. Reduced date/value sizes, refined header size and semantic colors, and verified the final result with direct in-app-browser captures.
5. **Independent review — P2 responsive containment.** A reviewer identified that a scaled fixed-size poster could retain its unscaled scrollable bounds. Added `overflow: clip` to the poster shell. Browser measurements confirm document scroll width equals viewport width at 402px and 768px. The reviewer found no other actionable correctness/security issue.

## Required fidelity surfaces

- **Fonts and typography:** Graduate matches the reference's distinctive numeric shapes. Roboto Condensed closely matches body text and heading density. Heading hierarchy, data values, line breaks, and labels are preserved. Minor weight/antialiasing differences from the low-resolution screenshot remain P3.
- **Spacing and layout:** Original fixed poster proportions, 53px side margins, chart widths, two division columns, standings column, and schedule column are retained. Dates, leader rows, footer legend, and chart alignment checked in focused comparisons. No overlap or clipping of content.
- **Colors and tokens:** Black background, Devils red, muted white/gray text, gold borders/labels, and green/red result semantics match the reference closely. Display/profile and source compression differences prevent a claim of exact pixel equality.
- **Image quality:** Real locally stored NHL logos and headshots, including the correct WSH secondary eagle. Official Material icons for venues. No generated logos, placeholder portraits, or whole-screenshot substitution. Player photos can differ in pose/crop from the source's small compressed portraits; P3.
- **Copy and content:** All visible sections, records, standings, upcoming/recent games, percentages, leader values, and footer copy match the supplied graphic. All data is static and documented as such. No live-data claim.

## Browser validation

- Desktop: innerWidth=1206, scrollWidth=1206, height=1518, scrollHeight=1518; all fonts loaded; zero missing images.
- Phone: viewport=402 × 874; poster=402 × 506; document scrollWidth=402 and scrollHeight=874; zero missing images. Original dense poster scales proportionally, so small labels are intentionally small, as in the source. Pinch/browser zoom is not disabled.
- Tablet: viewport=768 × 1024; poster height=966.69; document scrollWidth=768 and scrollHeight=1024.
- Clean final in-app browser console: no warnings or errors.
- Primary interactions: none; this is the requested static graphic. Verified resizing, content loading, semantic headings/tables, and chart accessible descriptions.
- Preview viewport override reset and tab marked as a deliverable.

## Validation commands

`npm run build` (includes TypeScript), `npm run lint`, and `npm run check:tamagui` passed. Independent reviewer also ran no-output TypeScript and lint checks.

## Findings / follow-up polish

No remaining actionable P0/P1/P2 findings. P3 limitations: body-font rasterization, a few pixels of icon/label geometry, and headshot crop/season differences. An original full-resolution graphic or source design could resolve these remaining differences. This is a close editable recreation, not a promise of pixel-identical reproduction.

## Implementation checklist

- [x] Stats-only scope; existing app retained.
- [x] Hardcoded data, real text, semantic tables, data-rendered charts.
- [x] Local source assets/fonts with attribution and licenses; no new dependencies.
- [x] Full-view and focused render-and-compare passes.
- [x] Desktop, tablet, and phone browser checks.
- [x] Independent code review and responsive finding fixed.
- [x] Build, lint, and Tamagui checks passed.

## November 9 responsive polish pass

The current implementation includes an updated 18-game snapshot and responsive interactive layouts. The original 17-game poster remains the composition reference. Data, chart scales, additional interaction instructions, responsive reflow, and the light theme are intentional differences.

### Evidence and normalization

Source visual truth remains .audit/graphic/reference.png, 1206 × 1518 pixels, cropped from the supplied screenshot. Implementation evidence is .audit/design-polish/final-dark.png and final-light.png, captured at 1206 × 1518 CSS pixels with devicePixelRatio 1, including a 64px appearance toolbar. The cropped final-poster.png is 1206 × 1518 pixels. comparison-final.png places source and implementation together at equal scale. final-detail.png shows the standings, matchup and schedule regions in light mode. before-desktop.png and compare-before.png preserve the initial comparison.

Phone evidence is final-phone.png at 320 × 812 CSS pixels, density 1. after-phone.png records the 375px chart layout. after-tablet-light.png records the 768 × 1024 light layout. Captures returned JPEG bytes despite the .png filenames; image tools decoded those bytes before generating PNG comparison artifacts.

### Findings and iteration history

- P2 fixed. The 320px legend expanded document width to 355px. Constraining its wrapping list now gives document width 320px.
- P2 fixed. Narrow charts hid their value labels at the far end of the scroll area. Separate axis canvases keep both scales visible. At 375px both axes stayed at x=317 while plot scroll moved from 0 to 757 and keyboard selection reached Game 84.
- P2 fixed. Tablet matchups stacked into four rows beside standings. The division grid now spans the tablet layout above adjacent standings and schedule sections.
- P2 fixed. Upcoming matchup selection gave no local feedback. Date, venue, opponent, and pending/result details now appear locally.
- P2 fixed after independent review. Details below a division could be outside the phone viewport. A bottom-sticky strip now keeps feedback visible. The BOS selection was observed at y=610–634 inside an 812px viewport.
- P2 fixed. Appearance controls used a missing size/font recipe, producing warnings and undersized buttons. Native buttons now use the existing contract's sizing and type tokens.
- User-directed asset correction. Toronto's existing SVG has a locally inverted RGB copy for light mode. All three currently rendered Toronto marks use it in light mode and the original in dark mode. The upcoming schedule callsite also selects the inverted asset when Toronto appears.
- P3 fixed. Centered the header logo vertically, reduced mobile summary text size, tightened matchup spacing, removed redundant rank punctuation, and clarified the chart scroll hint.

### Required fidelity surfaces

Typography retains Graduate numerals and Roboto Condensed text. Header wrapping and control labels were inspected. Layout retains the desktop composition and uses the existing approved spacing scale. Colors use semantic themes and selected appearance controls have a gold border. Toronto inversion is explicitly user-directed and preserves every SVG path. Other logos and portraits retain their supplied assets. Content reflects the current snapshot with clearer interaction guidance.

The full-view comparison preserves the reference's hierarchy and major regions. Focused inspection of final-detail.png confirms the revised labels, portraits, standings and Toronto contrast. Minor source rasterization and portrait differences remain accepted P3 limitations.

### Validation and remaining scope

Lint passed with 60 design-rule cases. Strict Tamagui validation passed. Production build including TypeScript passed. git diff --check passed. Browser checks covered light/dark switching, preference persistence, 320px containment, tablet layout, game selection, arrow navigation and Escape clearing. The final browser console had zero warnings or errors. Print CSS was reviewed, but actual print preview was not exercised.

Changed UI files are App.tsx, Charts.tsx, ThemePreference.tsx and design/contract.json. TOR-inverted.svg and its SOURCES.md attribution record the requested asset edit.

final result: passed

## Hover stability follow-up

Reproduced the shared hover/focus detail state moving the lower division row down 16px when selecting BOS. Division height grew from 326px to 342px because the detail wrapped.

App.tsx now reserves a fixed 64px detail area. Charts.tsx reserves 64px below narrow charts and 24px on desktop. Chart auto-scroll tolerates half a game step at visible edges, matching pointer rounding, and mouse leave preserves focused chart selection.

Browser selection sweeps covered all 84 matchup buttons and all 84 chart games at 320, 768 and 1206px widths. All 504 selections produced zero measured section movement and zero clipped detail areas. These sweeps exercised keyboard selection through the same shared detail state; continuous physical pointer motion was not automated. Independent review found no actionable regression. Screenshot evidence is .audit/design-polish/hover-stable.png.

Lint, strict Tamagui validation and production build passed after the changes.
