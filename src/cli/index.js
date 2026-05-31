import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import qrcodeTerminal from 'qrcode-terminal';
import { startServer } from '../server/index.js';
import { createAuth } from '../server/auth.js';
import { startTunnel } from '../server/tunnel.js';
import { notifyPairing } from '../server/notify.js';

const __filename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url)
  : (typeof require !== 'undefined' && require.main && require.main.filename) || process.argv[1] || '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();
const ROOT = process.env.MTERMIUS_RESOURCE_ROOT || path.resolve(__dirname, '..', '..');

const VERSION = '0.5.0';
const DEFAULT_PORT = Number(process.env.PORT) || 2208;

function banner() {
  const lines = [
    chalk.hex('#e68a6e')('╔══════════════════════════════════════════╗'),
    chalk.hex('#e68a6e')('║') + '                                          ' + chalk.hex('#e68a6e')('║'),
    chalk.hex('#e68a6e')('║') + chalk.bold.hex('#e68a6e')(`          🚀  MRemote v${VERSION}              `) + chalk.hex('#e68a6e')('║'),
    chalk.hex('#e68a6e')('║') + chalk.dim('   Remote terminal in your pocket         ') + chalk.hex('#e68a6e')('║'),
    chalk.hex('#e68a6e')('║') + '                                          ' + chalk.hex('#e68a6e')('║'),
    chalk.hex('#e68a6e')('╚══════════════════════════════════════════╝'),
  ];
  console.log('\n' + lines.join('\n') + '\n');
}

function help() {
  banner();
  console.log(`Usage: m-termius [command] [options]\n`);
  console.log(`Commands:`);
  console.log(`  ui              Start web UI server (default)`);
  console.log(`  start           Same as 'ui'`);
  console.log(`  --no-auth       Disable pairing (open access — local only)`);
  console.log(`  --no-tunnel     Disable Cloudflare tunnel`);
  console.log(`  --version, -v   Print version`);
  console.log(`  --help, -h      Show this help\n`);
  console.log(`Environment variables:`);
  console.log(`  PORT            Server port (default ${DEFAULT_PORT})`);
  console.log(`  HOST            Bind address (default 0.0.0.0)`);
  console.log(`  ROOT_DIR        File explorer root (default ${os.homedir()})`);
  console.log(`  MTERMIUS_SHELL  Override shell binary`);
  console.log();
}

function showQR({ port, pairing, tunnel }) {
  const localUrl = `http://localhost:${port}`;
  const lanUrl = (() => {
    const ifs = os.networkInterfaces();
    for (const list of Object.values(ifs)) {
      for (const i of list || []) {
        if (i.family === 'IPv4' && !i.internal) return `http://${i.address}:${port}`;
      }
    }
    return null;
  })();
  const remote = tunnel?.url || null;
  const url = remote || lanUrl || localUrl;
  const pairUrl = `${url}/pair?code=${pairing.code}`;

  console.log(chalk.bold('  Pair a device:'));
  console.log();
  qrcodeTerminal.generate(pairUrl, { small: true }, (qr) => {
    qr.split('\n').forEach((l) => console.log('  ' + l));
  });
  console.log();
  console.log(`  Pair code:   ${chalk.hex('#e68a6e').bold(pairing.code)}`);
  console.log(`  Pair URL:    ${chalk.cyan(pairUrl)}`);
  console.log(`  Local:       ${chalk.dim(localUrl)}`);
  if (lanUrl) console.log(`  LAN:         ${chalk.dim(lanUrl)}`);
  if (remote) console.log(`  Remote:      ${chalk.green(remote)}`);
  console.log();
  console.log(chalk.dim(`  Code expires in 30 minutes. Anyone with this code can pair a device.`));
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--version') || args.includes('-v')) { console.log(VERSION); return; }
  if (args.includes('--help') || args.includes('-h')) { help(); return; }

  const enableAuth = !args.includes('--no-auth') && !process.env.MTERMIUS_NO_AUTH;
  const enableTunnel = !args.includes('--no-tunnel');

  banner();

  const auth = createAuth({ enabled: enableAuth });

  await startServer({
    port: DEFAULT_PORT,
    host: process.env.HOST || '0.0.0.0',
    rootDir: process.env.ROOT_DIR || os.homedir(),
    projectRoot: ROOT,
    auth,
  });

  let tunnel = null;
  if (enableTunnel) {
    console.log(chalk.dim('   Starting Cloudflare tunnel…'));
    tunnel = await startTunnel({ port: DEFAULT_PORT });
    if (tunnel) console.log(chalk.green('🌍'), `Tunnel ${chalk.cyan(tunnel.url)}`);
    else console.log(chalk.yellow('⚠'), 'Tunnel failed — local/LAN access only');
    console.log();
  }

  if (enableAuth) {
    showQR({ port: DEFAULT_PORT, pairing: auth.getPairing(), tunnel });
    // Push code to configured notification services
    const p = auth.getPairing();
    const url = tunnel?.url || `http://localhost:${DEFAULT_PORT}`;
    notifyPairing({ code: p.code, pairUrl: `${url}/pair?code=${p.code}`, localUrl: `http://localhost:${DEFAULT_PORT}`, tunnelUrl: tunnel?.url });
  } else {
    console.log(chalk.yellow('⚠'), `Auth disabled (--no-auth). API is open on this port.`);
    console.log();
  }

  const shutdown = () => {
    console.log('\n' + chalk.dim('Stopping…'));
    tunnel?.stop?.();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(chalk.red('Fatal:'), err);
  process.exit(1);
});
