#!/usr/bin/env node
// Download the pinned runtime libraries into vendor/ so the app and its build
// output never depend on a CDN at runtime (same-origin loading).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, 'vendor');
mkdirSync(DIR, { recursive: true });

const FILES = [
  ['react.production.min.js',        'https://unpkg.com/react@18.3.1/umd/react.production.min.js'],
  ['react-dom.production.min.js',    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'],
  ['reactflow.umd.js',               'https://unpkg.com/@xyflow/react@12.3.5/dist/umd/index.js'],
  ['reactflow.style.css',            'https://unpkg.com/@xyflow/react@12.3.5/dist/style.css'],
  ['babel.min.js',                   'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js'],
];

for (const [name, url] of FILES){
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch ' + url + ' — HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(DIR, name), buf);
  console.log('[vendor] ' + name + ' (' + Math.round(buf.byteLength / 1024) + ' KB)');
}
console.log('[vendor] done — ' + FILES.length + ' files in vendor/');
