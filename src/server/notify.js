import https from 'node:https';
import http from 'node:http';
import chalk from 'chalk';

const NOTIFY_WEBHOOK = process.env.MREMOTE_NOTIFY_WEBHOOK || '';
const TG_BOT_TOKEN = process.env.MREMOTE_TELEGRAM_BOT || '';
const TG_CHAT_ID = process.env.MREMOTE_TELEGRAM_CHAT || '';
const DISCORD_WEBHOOK = process.env.MREMOTE_DISCORD_WEBHOOK || '';

function post(url, body) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 8000,
    };
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(opts, () => resolve(true));
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

export async function notifyPairing({ code, pairUrl, localUrl, tunnelUrl }) {
  const msg = `MRemote Pair Code: ${code}\nPair URL: ${pairUrl}\nLocal: ${localUrl}${tunnelUrl ? `\nTunnel: ${tunnelUrl}` : ''}`;
  let sent = 0;

  // Telegram
  if (TG_BOT_TOKEN && TG_CHAT_ID) {
    const ok = await post(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      { chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' }
    );
    if (ok) { sent++; console.log(chalk.green('\u2713'), 'Sent to Telegram'); }
    else console.log(chalk.yellow('\u26a0'), 'Telegram notification failed');
  }

  // Discord
  if (DISCORD_WEBHOOK) {
    const ok = await post(DISCORD_WEBHOOK, { content: msg });
    if (ok) { sent++; console.log(chalk.green('\u2713'), 'Sent to Discord'); }
    else console.log(chalk.yellow('\u26a0'), 'Discord notification failed');
  }

  // Generic webhook
  if (NOTIFY_WEBHOOK) {
    const ok = await post(NOTIFY_WEBHOOK, { code, pairUrl, localUrl, tunnelUrl, timestamp: Date.now() });
    if (ok) { sent++; console.log(chalk.green('\u2713'), 'Sent to webhook'); }
    else console.log(chalk.yellow('\u26a0'), 'Webhook notification failed');
  }

  return sent;
}
