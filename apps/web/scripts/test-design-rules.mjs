import { logInfo } from '../../../lib/logger.mjs'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rmdir, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const contract = JSON.parse(await readFile(new URL('../design/contract.json', import.meta.url), 'utf8'))
const teams = JSON.parse(await readFile(new URL('../../../data/teams.json', import.meta.url), 'utf8'))
assert.deepEqual(Object.keys(contract.teamPalettes).sort(), teams.map((team) => team.abbrev).sort())
for (const { abbrev } of teams) {
  const logo = await readFile(new URL(`../public/assets/teams/${abbrev}.svg`, import.meta.url), 'utf8')
  for (const [role, color] of Object.entries(contract.teamPalettes[abbrev])) {
    assert.ok(['team-primary', 'team-secondary'].includes(role))
    assert.match(color, /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/)
    assert.ok(logo.includes(color) || (abbrev === 'TBL' && role === 'team-primary' && color === '#00205b'), `${abbrev} ${role} must come from its documented NHL logo`)
  }
  assert.deepEqual(Object.keys(contract.teamPalettes[abbrev]).sort(), ['team-primary', 'team-secondary'])
}
const dir = await mkdtemp(`${root}src/design-rule-test-`)
const cases = [
  ['team banner colors', '<View bg="team-primary" borderColor="team-secondary" />', true],
  ['theme token', '<View bg="surface hover:highlight" p="4 sm:6" />', true],
  ['conditional', '<View color={active ? "win" : "loss"} />', true],
  ['const token', 'const color = "win"; <View color={color} />', true],
  ['object token lookup', 'const palette = {good: "win", bad: "loss"}; <View bg={palette.good} />', true],
  ['Object.assign mutation', 'const palette = {good: "win"}; Object.assign(palette, {good: "#fff"}); <View bg={palette.good} />', false],
  ['call escape', 'const palette = {good: "win"}; mutate(palette); <View bg={palette.good} />', false],
  ['alias mutation', 'const palette = {good: "win"}; const alias = palette; alias.good = "#fff"; <View bg={palette.good} />', false],
  ['nested alias mutation', 'const palette = {nested: {good: "win"}}; const alias = palette.nested; alias.good = "#fff"; <View bg={palette.nested.good} />', false],
  ['logical colors valid', '<View borderInlineColor="rule" caretColor="color" textShadowColor="muted" />', true],
  ['logical spacing valid', '<View paddingInline="4" marginBlock="2" insetInlineStart="0" />', true],
  ['logical radius valid', '<View borderStartStartRadius="sm" />', true],
  ['logical size valid', '<View inlineSize="100%" />', true],
  ['logical border width valid', '<View borderInlineStartWidth={2} />', true],
  ['mutated const', 'const palette = {good: "win"}; palette.good = getColor(); <View bg={palette.good} />', false],
  ['ticket torn edge', '<View clipPath="polygon(0 0, calc(100% - 4px) 0, 100% 7%, calc(100% - 3px) 15%, 100% 24%, calc(100% - 6px) 33%, calc(100% - 1px) 42%, calc(100% - 4px) 51%, 100% 60%, calc(100% - 5px) 70%, calc(100% - 1px) 79%, calc(100% - 4px) 89%, calc(100% - 2px) 100%, 0 100%)" />', true],
  ['unlisted clip path', '<View clipPath="polygon(0 0, 100% 0, 0 100%)" />', false],
  ['shadow escape', '<View boxShadow="0 0 4px red" />', false],
  ['palette', '<View bg="red-500" />', false],
  ['hover literal', '<View bg="surface hover:#fff" />', false],
  ['object condition', '<View bg={{ default: "surface", hover: "#fff" }} />', false],
  ['number', '<View gap={15} />', false],
  ['longhand', '<View padding={15} backgroundColor="red-500" />', false],
  ['styled', 'import { styled as recipe } from "tamagui"; recipe(View, { gap: 15 });', false],
  ['unknown dynamic', '<View bg={getColor()} />', false],
  ['const bad', 'const shade = "#fff"; <View color={shade} />', false],
  ['spread', 'const attrs = { bg: "surface" }; <View {...attrs} />', false],
  ['object spread', 'const a = {}; const b = {...a};', false],
  ['computed key', 'const recipe = {[key]: "#fff"};', false],
  ['inline css', '<View style={{ color: "red" }} />', false],
  ['table adapter', '<View style={{ display: "table-cell" }} />', true],
  ['css import', 'import "./bad.css";', false],
  ['generated import', 'import "./tamagui.generated.css";', true],
  ['dynamic JSON', 'void import("../../../data/season.json", { with: { type: "json" } });', true],
  ['dynamic CSS', 'import("./bad.css");', false],
  ['dynamic code', 'import("./module.js");', false],
  ['dynamic variable', 'import(path);', false],
  ['JSON query escape', 'import("./season.json?inline");', false],
  ['CSS query suffix escape', 'import("./bad.css?name.json");', false],
  ['code fragment suffix escape', 'import("./code.js#data.json");', false],
  ['unknown styled recipe', 'import { styled as recipe } from "tamagui"; recipe(View, styles);', false],
]
for (const prop of ['textShadowColor', 'caretColor', 'borderBlockColor', 'borderBlockStartColor', 'borderBlockEndColor', 'borderInlineColor', 'borderInlineStartColor', 'borderInlineEndColor', 'borderStartColor', 'borderEndColor']) cases.push([prop, `<View ${prop}="#fff" />`, false])
for (const prop of ['paddingInline', 'paddingBlockStart', 'marginInlineEnd', 'marginBlock', 'insetBlockEnd', 'insetInlineStart', 'paddingStart', 'marginEnd', 'inlineSize', 'maxBlockSize', 'flexBasis', 'borderStartStartRadius', 'borderTopEndRadius', 'borderInlineWidth', 'borderBlockStartWidth']) cases.push([prop, `<View ${prop}={15} />`, false])
for (const prop of ['border', 'borderBlock', 'borderInline', 'borderInlineStart']) cases.push([prop, `<View ${prop}="1px solid #fff" />`, false])
const vizCases = [
  ['viz theme colour', 'const fill = theme.series[0]; export default fill', true],
  ['viz hex literal', 'const fill = "#ff0000"; export default fill', false],
  ['viz prose mentioning rgb()', 'export const label = "Convert rgb() to hex"', true],
  ['viz rgb function', 'export const fill = "rgb(255, 0, 0)"', false],
  ['viz field named gold', 'type Key = "gold" | "brand"; const key: Key = theme.gold; export default [theme["gold"], { gold: key }]', true],
  ['viz named colour value', 'const fill = "gold"; export default fill', false],
  ['viz token in JSX conditional', 'export default ({ on }: { on: boolean }) => <View borderColor={on ? "gold" : "rule"} />', true],
  ['viz token in styled options', 'import { styled, View } from "tamagui"; export default styled(View, { borderColor: "gold" })', true],
  ['viz named colour in JSX', 'export default <View borderColor="red" />', false],
  ['viz token in plain object', 'export const spec = { fill: "gold" }', false],
  ['viz token in nested style object', 'export const spec = { style: { fill: "gold" } }', false],
  ['viz named colour property value', 'export default { fill: "gold" }', false],
  ['viz chart theme object', 'const t = { background: theme.background, node: { style: { fill: theme.surface, stroke: theme.rule } } }; export default t', true],
  ['viz chart spec keys', "const spec = { type: 'interval', style: { fill: theme.win }, width: 640, padding: 12 }; export default spec", true],
  ['viz spread with colour key', 'const merged = { ...base, color: theme.color }; export default merged', true],
  ['viz chart spec hex', "const spec = { style: { fill: '#ff0000' } }; export default spec", false],
  ['viz styled options still checked', 'import { styled, View } from "tamagui"; export default styled(View, { backgroundColor: theme.background })', false, 'design(semantic-colors)'],
  ['viz nested rgb function', 'export const fill = "rgb(calc(100 + 28) 0 0)"', false],
  ['viz empty rgb label', 'export const label = "rgb()"', true],
  ['viz token on native element', 'export default <path fill="gold" />', false],
  ['viz token in native spread', 'export default <path {...{ fill: "gold" }} />', false],
  ['viz token in Tamagui object prop', 'export default <View bg={{ default: "gold", hover: "win" }} />', true],
  ['viz token in Tamagui spread', 'export default <View {...{ bg: "gold" }} />', true],
  ['viz spec passed inline', 'export default <G2Chart spec={{ style: { fill: theme.win } }} />', true],
  ['viz colour literal in inline spec', 'export default <G2Chart spec={{ fill: "gold" }} />', false],
  ['viz aliased styled options', 'import { styled as recipe, View } from "tamagui"; export default recipe(View, { gap: 15 })', false, 'design(token-values)'],
  ['viz aliased styled token', 'import { styled as recipe, View } from "tamagui"; export default recipe(View, { borderColor: "gold" })', true],
  ['viz JSX style still escapes', 'export default <View style={{ fill: theme.win }} />', false, 'design(no-style-escape)'],
]
const vizRoot = `${root}src/viz`
const explorerRoot = `${root}src/explorer`
const explorerDir = `${explorerRoot}/design-rule-test-${dir.split('-').at(-1)}`
const createdExplorerRoot = (await mkdir(explorerRoot, { recursive: true })) !== undefined
await mkdir(explorerDir)
cases.push(
  ['explorer RPC payload', "const payload = { from: 1, to: 2, filter: { competition: 'all' } }; export default payload", true, explorerDir],
  ['explorer payload spread', "const payload = {}; const next = { ...payload, limit: 10 }; export default next", true, explorerDir],
  ['explorer styled options still checked', 'import { styled, View } from "tamagui"; export default styled(View, { filter: "blur(2px)" })', false, explorerDir, 'design(no-style-escape)'],
  ['explorer JSX style still escapes', 'export default <View style={{ filter: "blur(2px)" }} />', false, explorerDir, 'design(no-style-escape)'],
)
const frameDir = `${vizRoot}/frame`
const frameFile = `${frameDir}/frame.ts`
// The override applies to exactly this path, so lint the fixture there only when no real file would be overwritten.
const frameFree = !(await readFile(frameFile, 'utf8').then(() => true, () => false))
const frameSource = 'const mod = await import(URL.createObjectURL(blob)); document.documentElement.style.setProperty("--bg", theme.background); export default mod'
const rmdirIfEmpty = (path) => rmdir(path).catch((error) => { if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes(error.code)) throw error })
const createdVizRoot = (await mkdir(vizRoot, { recursive: true })) !== undefined
const vizDir = `${root}src/viz/design-rule-test-${dir.split('-').at(-1)}`
await mkdir(vizDir)
for (const [name, source, pass, code = 'design(viz-theme-colors)'] of vizCases) cases.push([name, source, pass, vizDir, code])
if (frameFree) cases.push(['frame page blob import and setProperty', frameSource, true, frameDir, undefined, 'frame.ts'])
else logInfo('skipping the frame.ts fixture: a real src/viz/frame/frame.ts exists')
cases.push(['frame page source elsewhere in src/viz', frameSource, false, vizDir, 'design(no-css-imports)'])
cases.push(['chart theme object outside src/viz', 'const t = { background: theme.background, node: { style: { fill: theme.surface, stroke: theme.rule } } }; export default t', false, dir, 'design(semantic-colors)'])
try {
  for (const [name, source, pass, caseDir = dir, expected, fileName = 'case.tsx'] of cases) {
    if (caseDir === frameDir) await mkdir(frameDir, { recursive: true })
    const file = `${caseDir}/${fileName}`
    await writeFile(file, source)
    const result = spawnSync(`${root}../../node_modules/.bin/effect-tsgo`, ['--tsrs-lint', 'oxlint', '--format', 'json', file], { cwd: root, encoding: 'utf8' })
    assert.equal(result.error, undefined, name)
    const diagnostics = JSON.parse(result.stdout).diagnostics
    assert.ok(!diagnostics.some((d) => d.message.includes('Error running JS plugin')), `${name}: plugin crashed`)
    // anti-slop rules also report on the fixture, a new file; count only the rules under test.
    const errors = diagnostics.filter((d) => d.severity === 'error' && !/^(anti-slop[a-z-]*|landmines|ai-guard|enfect)\(/.test(d.code))
    assert.equal(errors.length === 0, pass, `${name}: ${result.stdout}`)
    if (expected) assert.ok(pass ? errors.length === 0 : errors.some((d) => d.code === expected), `${name}: expected ${expected}: ${result.stdout}`)
    assert.equal(result.status === 0, !diagnostics.some((d) => d.severity === 'error'), `${name}: wrong process status`)
  }
  const css = `${dir}/unused.css`
  await writeFile(css, 'body {}')
  const result = spawnSync(process.execPath, ['scripts/check-design-files.mjs'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 1, 'unused CSS must fail')
  logInfo(`${cases.length} Oxlint rule cases and unused CSS check passed`)
} finally {
  await rm(dir, { recursive: true, force: true })
  await rm(vizDir, { recursive: true, force: true })
  await rm(explorerDir, { recursive: true, force: true })
  if (createdExplorerRoot) await rmdirIfEmpty(explorerRoot)
  if (frameFree) { await rm(frameFile, { force: true }); await rmdirIfEmpty(frameDir) }
  if (createdVizRoot) await rmdirIfEmpty(vizRoot)
}
