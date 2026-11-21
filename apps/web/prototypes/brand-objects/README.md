# Brand objects lab

Standalone three.js prototype of the Rinkside brand objects. Not wired into the app and not linted.

Run from the repository root (the page imports `three` from `/node_modules` and fonts from `/apps/web/public`):

```sh
python3 -m http.server 4180
# open http://127.0.0.1:4180/apps/web/prototypes/brand-objects/
```

Query flags: `?dark=1`, `?contact=1` (8 consecutive frames per object), `?sheets=1` (the drawn cuttings), `?only=puck,net`.

- `sheets.js`: palette (OKLCH, light and dark) and the seeded Canvas2D cuttings.
- `objects.js`: the window shader, part builders (slab, box, split tube, fold, gore), the six objects, and `setFrame`.
- `index.html`: tiles, hover stop-motion (a twelfth of a turn every 125 ms, plays on to the rest pose, off for touch and reduced motion).

Rules: unlit, long 20 degree lens, walls are ink (cream in dark mode), two colours plus ink and paper per object, one small goal-lamp red part, artwork looked up by screen position so it never turns with the object. No team or league marks inside objects.

Not done yet: public-domain photo layer (multiply/screen recolour), port to a typed React component under the design contract.
