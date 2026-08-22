#!/usr/bin/env node
// Build pipeline: TypeScript check -> esbuild bundle (minified in prod, plain in dev).
// Output is a static page in dist/: index.html references external styles.css and
// app.js (no inlining); React / ReactDOM / ReactFlow live in dist/vendor/ (same-origin
// copies downloaded by `npm run vendor`).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEV = process.argv.includes('--dev');
const DIST = join(ROOT, 'dist');

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

mkdirSync(DIST, { recursive: true });
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
  '--outfile=' + join(DIST, 'app.js')
], { stdio: 'inherit' });

const template = readFileSync(join(ROOT, 'build', 'template.html'), 'utf8');
writeFileSync(join(DIST, 'index.html'), template);
copyFileSync(join(ROOT, 'src', 'styles.css'), join(DIST, 'styles.css'));

// Copy the same-origin runtime files next to the built page so a static host
// (GitHub Pages, Vercel, file://) can serve them relative to dist/index.html.
const vendorDst = join(DIST, 'vendor');
mkdirSync(vendorDst, { recursive: true });
let copied = 2;
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

console.log('[build] wrote dist/index.html + dist/app.js + dist/styles.css (' + (DEV ? 'dev' : 'prod') + ') · copied ' + copied + ' runtime/data file(s)');
