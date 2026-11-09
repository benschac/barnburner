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
