import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const dir = await mkdtemp(`${root}src/design-rule-test-`)
const cases = [
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
  ['unknown styled recipe', 'import { styled as recipe } from "tamagui"; recipe(View, styles);', false],
]
for (const prop of ['textShadowColor', 'caretColor', 'borderBlockColor', 'borderBlockStartColor', 'borderBlockEndColor', 'borderInlineColor', 'borderInlineStartColor', 'borderInlineEndColor', 'borderStartColor', 'borderEndColor']) cases.push([prop, `<View ${prop}="#fff" />`, false])
for (const prop of ['paddingInline', 'paddingBlockStart', 'marginInlineEnd', 'marginBlock', 'insetBlockEnd', 'insetInlineStart', 'paddingStart', 'marginEnd', 'inlineSize', 'maxBlockSize', 'flexBasis', 'borderStartStartRadius', 'borderTopEndRadius', 'borderInlineWidth', 'borderBlockStartWidth']) cases.push([prop, `<View ${prop}={15} />`, false])
for (const prop of ['border', 'borderBlock', 'borderInline', 'borderInlineStart']) cases.push([prop, `<View ${prop}="1px solid #fff" />`, false])
try {
  for (const [name, source, pass] of cases) {
    const file = `${dir}/case.tsx`
    await writeFile(file, source)
    const result = spawnSync(`${root}../../node_modules/.bin/oxlint`, ['--format', 'json', file], { cwd: root, encoding: 'utf8' })
    assert.equal(result.error, undefined, name)
    const diagnostics = JSON.parse(result.stdout).diagnostics
    assert.ok(!diagnostics.some((d) => d.message.includes('Error running JS plugin')), `${name}: plugin crashed`)
    const errors = diagnostics.filter((d) => d.severity === 'error')
    assert.equal(errors.length === 0, pass, `${name}: ${result.stdout}`)
    assert.equal(result.status === 0, pass, `${name}: wrong process status`)
  }
  const css = `${dir}/unused.css`
  await writeFile(css, 'body {}')
  const result = spawnSync(process.execPath, ['scripts/check-design-files.mjs'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 1, 'unused CSS must fail')
  console.log(`${cases.length} Oxlint rule cases and unused CSS check passed`)
} finally { await rm(dir, { recursive: true, force: true }) }
