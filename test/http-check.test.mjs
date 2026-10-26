import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sample = (n) => readFileSync(new URL(`../samples/${n}`, import.meta.url), 'utf8')
const mod = (n) => import(`../src/${n}.mjs`)

test('11 http-check : succès, erreur HTTP, trop lent, réseau', async () => {
  const { check } = await mod('http-check')
  const res = (status) => async () => ({ status })
  assert.equal((await check('https://a', { fetchImpl: res(200) })).ok, true)
  assert.equal((await check('https://a', { fetchImpl: res(503) })).note, 'HTTP 503')
  const slow = async () => { await new Promise((r) => setTimeout(r, 30)); return { status: 200 } }
  assert.match((await check('https://a', { fetchImpl: slow, maxMs: 5 })).note, /trop lent/)
  const boom = async () => { throw Object.assign(new Error('x'), { cause: { code: 'ENOTFOUND' } }) }
  assert.equal((await check('https://a', { fetchImpl: boom })).note, 'ENOTFOUND')
})
