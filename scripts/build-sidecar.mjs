import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'src-tauri', 'sidecar');
const final = path.join(out, 'm-termius-sidecar.cjs');

if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'cli', 'index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: final,
  external: [
    'cpu-features',
    'ssh2',
    'node-pty',
    'sharp',
    'bufferutil',
    'utf-8-validate',
    'node-machine-id',
  ],
  legalComments: 'none',
  logLevel: 'info',
});

const uiSrc = path.join(root, 'ui-dist');
const uiDst = path.join(out, 'ui-dist');
if (fs.existsSync(uiDst)) fs.rmSync(uiDst, { recursive: true, force: true });
if (fs.existsSync(uiSrc)) {
  fs.cpSync(uiSrc, uiDst, { recursive: true });
}

const nodeModulesDst = path.join(out, 'node_modules');
if (!fs.existsSync(nodeModulesDst)) fs.mkdirSync(nodeModulesDst, { recursive: true });
for (const pkg of ['ssh2', 'node-machine-id', 'cpu-features', 'asn1', 'safer-buffer', 'bcrypt-pbkdf', 'tweetnacl']) {
  const src = path.join(root, 'node_modules', pkg);
  const dst = path.join(nodeModulesDst, pkg);
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    fs.cpSync(src, dst, { recursive: true, errorOnExist: false });
  }
}

console.log('Sidecar bundled →', final);
console.log('UI copied → ', uiDst);
console.log('Native deps shipped → ', nodeModulesDst);
