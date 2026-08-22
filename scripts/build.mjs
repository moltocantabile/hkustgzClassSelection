#!/usr/bin/env node
// Build pipeline: TypeScript check -> esbuild bundle -> javascript-obfuscator ->
// inline CSS + bundle into a single dist/index.html (React / ReactDOM / ReactFlow stay on CDN).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEV = process.argv.includes('--dev');
const DIST = join(ROOT, 'dist');
const TMP = join(DIST, '.tmp');

function bin(name){
  const p = join(ROOT, 'node_modules', '.bin', name);
  if (!existsSync(p)){
    console.error(
      '[build] Missing tool: ' + name + '\n' +
      '  Run `npm install` first (devDependencies: typescript, esbuild, javascript-obfuscator, @types/react).'
    );
    process.exit(1);
  }
  return p;
}

console.log('[build] TypeScript type check (tsc --noEmit)…');
execFileSync(bin('tsc'), ['--noEmit', '-p', join(ROOT, 'tsconfig.json')], { stdio: 'inherit' });

mkdirSync(TMP, { recursive: true });
const bundlePath = join(TMP, 'app.js');
console.log('[build] esbuild bundle' + (DEV ? ' (dev, unminified)' : ' (minified)') + '…');
execFileSync(bin('esbuild'), [
  join(ROOT, 'src', 'main.tsx'),
  '--bundle',
  '--format=iife',
  '--jsx=transform',
  '--jsx-factory=window.React.createElement',
  '--jsx-fragment=window.React.Fragment',
  '--target=es2020',
  ...(DEV ? [] : ['--minify']),
  '--outfile=' + bundlePath
], { stdio: 'inherit' });

let js = readFileSync(bundlePath, 'utf8');
if (!DEV){
  console.log('[build] javascript-obfuscator…');
  const obfPath = join(TMP, 'app.obf.js');
  execFileSync(bin('javascript-obfuscator'), [
    bundlePath,
    '--output', obfPath,
    '--compact', 'true',
    '--identifier-names-generator', 'hexadecimal',
    '--string-array', 'true',
    '--string-array-threshold', '0.6',
    '--string-array-rotate', 'true',
    '--self-defending', 'false',
    '--control-flow-flattening', 'false',
    '--rename-globals', 'false'
  ], { stdio: 'inherit' });
  js = readFileSync(obfPath, 'utf8');
}

const template = readFileSync(join(ROOT, 'build', 'template.html'), 'utf8');
const css = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8');
const html = template
  .replace('{{STYLES}}', () => css)
  .replace('{{APP_BUNDLE}}', () => js);
writeFileSync(join(DIST, 'index.html'), html);

// Copy the auto-load datasets next to the built page so a static host
// (GitHub Pages, file://) can serve them relative to dist/index.html.
let copied = 0;
for (const name of ['courses.json', 'data.json', 'courses_klms.json']){
  const src = join(ROOT, name);
  if (existsSync(src)){
    copyFileSync(src, join(DIST, name));
    copied++;
  }
}

console.log('[build] wrote dist/index.html (' + (DEV ? 'dev' : 'prod') + ') — ' + Math.round(html.length / 1024) + ' KB' + (copied ? ' · copied ' + copied + ' data file(s)' : ' · no data files found'));
