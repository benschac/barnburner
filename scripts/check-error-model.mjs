#!/usr/bin/env node
// Enforces the error model in AGENTS.md: package source returns expected failures as tagged
// errors. It rejects a class that extends Error directly and any throw that is not marked as a
// defect by a "// defect: <reason>" comment on the line above it.
import { logError } from '../lib/logger.mjs'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXTENDS_ERROR = /\bextends\s+Error\b/
const THROW = /(^|[^\w.$])throw\b/
const DEFECT = /\/\/\s*defect:\s*\S/
const LINE_COMMENT = /^\s*(\/\/|\*|\/\*)/

export const findViolations = (text) => {
  const lines = text.split('\n')
  const violations = []
  lines.forEach((line, index) => {
    if (LINE_COMMENT.test(line)) return
    if (EXTENDS_ERROR.test(line)) {
      violations.push({ line: index + 1, message: 'class extends Error; use Schema.TaggedError' })
    }
    if (THROW.test(line) && !DEFECT.test(lines[index - 1] ?? '')) {
      violations.push({
        line: index + 1,
        message: 'throw without a "// defect: <reason>" comment on the line above; return a tagged error instead',
      })
    }
  })
  return violations
}

// Accepts a directory to walk or a single source file.
const sourceFiles = (dir) =>
  !statSync(dir).isDirectory() ? [dir] : readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mts)$/.test(name) && !/\.(test|d)\.(ts|tsx|mts)$/.test(name) ? [path] : []
  })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2)
  if (dirs.length === 0) {
    logError('usage: node scripts/check-error-model.mjs <dir or file> [<dir or file> ...]')
    process.exit(2)
  }
  let count = 0
  for (const file of dirs.flatMap(sourceFiles)) {
    for (const violation of findViolations(readFileSync(file, 'utf8'))) {
      count += 1
      logError(`${relative(process.cwd(), file)}:${violation.line} ${violation.message}`)
    }
  }
  if (count > 0) {
    logError(`${count} error-model violation${count === 1 ? '' : 's'}. See "Error model" in AGENTS.md.`)
    process.exit(1)
  }
}
