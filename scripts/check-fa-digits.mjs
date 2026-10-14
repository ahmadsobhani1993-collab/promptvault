import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'src', 'lib', 'fa-digits.ts')
const source = readFileSync(sourcePath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})

const require = createRequire(import.meta.url)
const module = { exports: {} }
const fn = new Function('exports', 'module', 'require', outputText)
fn(module.exports, module, require)
const { faDigits } = module.exports

const expected = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const oldBuggy = (n) => String(n).replace(/\d/g, (d) => '۰۱۳۴۵۶۷۸۹'[+d])

const cases = [0, 1, 2, 9, 10, 20, 29, 99]
for (const n of cases) {
  const got = faDigits(n)
  const want = String(n).replace(/\d/g, (d) => expected[Number(d)])
  if (got !== want) {
    console.error(`FAIL faDigits(${n}): got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
    process.exit(1)
  }
}

if (faDigits(29) === oldBuggy(29)) {
  console.error('FAIL: new mapping still matches the buggy 9-character table')
  process.exit(1)
}

if (String(oldBuggy(9)) === 'undefined' || oldBuggy(9) == null) {
  // expected: digit 9 indexed past the old string
}

if (faDigits('0123456789') !== expected.join('')) {
  console.error('FAIL: full digit row mismatch', faDigits('0123456789'))
  process.exit(1)
}

console.log('ok', {
  '2': faDigits(2),
  '9': faDigits(9),
  '29': faDigits(29),
  old29: String(oldBuggy(29)),
  all: faDigits('0123456789'),
})
