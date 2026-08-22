#!/usr/bin/env node
// Build pipeline: TypeScript check -> esbuild bundle (minified in prod, plain in dev) ->
// inline CSS + bundle into a single dist/index.html. React / ReactDOM / ReactFlow
// are served from dist/vendor/ (same-origin copies downloaded by `npm run vendor`).
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
      '  Run `npm install` first (devDependencies: typescript, esbuild, @types/react).'
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

const js = readFileSync(bundlePath, 'utf8');

const template = readFileSync(join(ROOT, 'build', 'template.html'), 'utf8');
const css = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8');
const html = template
  .replace('{{STYLES}}', () => css)
  .replace('{{APP_BUNDLE}}', () => js);
writeFileSync(join(DIST, 'index.html'), html);

// Copy the same-origin runtime files next to the built page so a static host
// (GitHub Pages, file://) can serve them relative to dist/index.html.
const vendorDst = join(DIST, 'vendor');
mkdirSync(vendorDst, { recursive: true });
let copied = 0;
for (const name of ['courses.json', 'data.json', 'courses_klms.json']){
  const src = join(ROOT, name);
  if (existsSync(src)){
    copyFileSync(src, join(DIST, name));
    copied++;
  }
}
for (const name of ['react.production.min.js', 'react-dom.production.min.js', 'reactflow.umd.js', 'reactflow.style.css']){
  const src = join(ROOT, 'vendor', name);
  if (existsSync(src)){
    copyFileSync(src, join(vendorDst, name));
    copied++;
  }
}

console.log('[build] wrote dist/index.html (' + (DEV ? 'dev' : 'prod') + ') — ' + Math.round(html.length / 1024) + ' KB · copied ' + copied + ' runtime/data file(s)');
