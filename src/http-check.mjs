#!/usr/bin/env node
/* Vérifie qu'une liste d'URL répond (statut, durée). Code de sortie 2 si au moins une échoue. */
import { readFileSync } from 'node:fs'
import { isMain, parseArgs, usage, fail } from '../lib/cli.mjs'

export async function check(url, { timeout = 10_000, maxMs = Infinity, fetchImpl = fetch } = {}) {
  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'elzam-http-check/1.0' } })
    const ms = Date.now() - started
    const ok = res.status >= 200 && res.status < 400 && ms <= maxMs
    return { url, ok, status: res.status, ms, note: ok ? '' : res.status >= 400 ? `HTTP ${res.status}` : `trop lent (> ${maxMs} ms)` }
  } catch (e) {
    return { url, ok: false, status: 0, ms: Date.now() - started, note: e.name === 'AbortError' ? `délai dépassé (${timeout} ms)` : (e.cause?.code ?? e.message) }
  } finally { clearTimeout(timer) }
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['help'])
  usage(`
Usage : node src/http-check.mjs <url> [<url> …] [--file urls.txt] [--timeout 10000] [--max-ms 3000]
Une URL par ligne dans le fichier ; les lignes commençant par # sont ignorées.`, { ...args, _: args._.length || args.file ? ['x'] : [] }, 1)
  const urls = [...args._, ...(args.file ? readFileSync(args.file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [])]
  if (!urls.length) fail('aucune URL.')
  const results = await Promise.all(urls.map((u) => check(u, { timeout: Number(args.timeout ?? 10_000), maxMs: Number(args['max-ms'] ?? Infinity) })))
  results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${String(r.status || '---').padEnd(3)} ${String(r.ms).padStart(5)} ms  ${r.url}${r.note ? `  (${r.note})` : ''}`))
  const bad = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - bad}/${results.length} en ligne.`)
  process.exit(bad ? 2 : 0)
}
