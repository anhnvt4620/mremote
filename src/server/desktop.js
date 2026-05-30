import { spawn, exec } from 'node:child_process';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// ---- Screen Capture ----
// Uses screenshot-desktop (cross-platform, no native build needed)

let screenshotLib = null;
async function getScreenshot() {
  if (!screenshotLib) {
    screenshotLib = (await import('screenshot-desktop')).default;
  }
  return screenshotLib({ format: 'png' });
}

// ---- Mouse/Keyboard Injection (cross-platform) ----

function execPromise(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
}

async function injectMouse(evt) {
  try {
    if (isWindows) {
      // Use PowerShell to move mouse
      const ps = `Add-Type -AssemblyName System.Windows.Forms\n`;
      if (evt.type === 'move') {
        return await execPromise('powershell', ['-NoProfile', '-Command',
          `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(evt.x)},${Math.round(evt.y)})`
        ]);
      }
      if (evt.type === 'click') {
        const btn = evt.button === 'right' ? 'Right' : 'Left';
        const isDown = evt.action === 'down';
        // Move and click
        const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);' -Name Win32 -Namespace NA
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(evt.x)},${Math.round(evt.y)})
$down = ${isDown ? 2 : 4} * ${btn === 'Right' ? 8 : 1} * ${isDown ? 1 : 0} + ${!isDown ? 2 : 0} * ${btn === 'Right' ? 8 : 1}
[NA.Win32]::mouse_event(${btn === 'Right' && isDown ? '0x0008' : isDown ? '0x0002' : '0x0004'}, 0, 0, 0, 0)
`;
        return await execPromise('powershell', ['-NoProfile', '-Command', script]);
      }
      if (evt.type === 'scroll') {
        const script = `
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);' -Name Win32 -Namespace NA
[NA.Win32]::mouse_event(0x0800, 0, 0, ${Math.round(evt.deltaY)}, 0)
`;
        return await execPromise('powershell', ['-NoProfile', '-Command', script]);
      }
    } else if (isMac) {
      if (evt.type === 'click') {
        const btn = evt.button === 'right' ? 'right' : '';
        const state = evt.action === 'down' ? 'mousedown' : 'mouseup';
        return await execPromise('osascript', ['-e', `tell application "System Events" to ${state} ${btn}`]);
      }
      if (evt.type === 'move') {
        return await execPromise('osascript', ['-e',
          `tell application "System Events" to set position of mouse to {${Math.round(evt.x)}, ${Math.round(evt.y)}}`
        ]);
      }
    } else if (isLinux) {
      if (evt.type === 'move') {
        return await execPromise('xdotool', ['mousemove', Math.round(evt.x), Math.round(evt.y)]);
      }
      if (evt.type === 'click') {
        const btn = evt.button === 'right' ? '3' : '1';
        return await execPromise('xdotool', [evt.action === 'down' ? 'mousedown' : 'mouseup', btn]);
      }
      if (evt.type === 'scroll') {
        const dir = evt.deltaY > 0 ? '5' : '4';
        return await execPromise('xdotool', ['click', dir]);
      }
    }
  } catch {
    // Non-critical - input injection may fail silently
  }
}

async function injectKey(evt) {
  try {
    if (isWindows) {
      // PowerShell keyboard injection
      if (evt.type === 'keydown') {
        return await execPromise('powershell', ['-NoProfile', '-Command',
          `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${escapeForSendKeys(evt.key)}')`
        ]);
      }
    } else if (isMac) {
      if (evt.type === 'keydown') {
        return await execPromise('osascript', ['-e',
          `tell application "System Events" to keystroke "${evt.key}"`
        ]);
      }
    } else if (isLinux) {
      if (evt.type === 'keydown') {
        return await execPromise('xdotool', ['key', evt.key]);
      }
    }
  } catch {
    // Non-critical
  }
}

function escapeForSendKeys(key) {
  // Map common keys to SendKeys format
  const map = {
    'Enter': '{ENTER}',
    'Backspace': '{BS}',
    'Delete': '{DEL}',
    'Escape': '{ESC}',
    'Tab': '{TAB}',
    'ArrowUp': '{UP}',
    'ArrowDown': '{DOWN}',
    'ArrowLeft': '{LEFT}',
    'ArrowRight': '{RIGHT}',
    'Home': '{HOME}',
    'End': '{END}',
    'PageUp': '{PGUP}',
    'PageDown': '{PGDN}',
    ' ': ' ',
    '+': '{+}',
    '^': '{^}',
    '%': '{%}',
    '~': '{~}',
    '(': '{(}',
    ')': '{)}',
    '{': '{{}',
    '}': '{}}',
  };
  return map[key] || key;
}

// ---- Screen info ----

async function getScreenInfo() {
  try {
    const shot = await getScreenshot();
    // Check if we can get resolution
    const { screen } = await import('screenshot-desktop');
    const displays = await screen.listDisplays();
    if (displays && displays.length > 0) {
      const primary = displays.find((d) => d.primary) || displays[0];
      return {
        width: primary.width,
        height: primary.height,
        displays,
      };
    }
  } catch {}
  return { width: 1920, height: 1080, displays: [] };
}

// ---- Streaming handler ----

export function attachDesktop(io) {
  const ns = io.of('/desktop');
  const streams = new Map(); // socketId -> stream info

  ns.on('connection', (socket) => {
    let captureInterval = null;
    let quality = 'medium';
    let isStreaming = false;

    socket.on('start', async () => {
      if (isStreaming) return;
      isStreaming = true;

      const info = await getScreenInfo();
      socket.emit('screen-info', info);

      // Adaptive frame rate based on quality
      const fpsMap = { high: 100, medium: 200, low: 500 };
      let frameDelay = fpsMap[quality] || 200;

      const capture = async () => {
        if (!isStreaming) return;
        try {
          const img = await getScreenshot();
          if (socket.connected && isStreaming) {
            socket.emit('frame', img.toString('base64'));
          }
        } catch (err) {
          console.error('[desktop capture error]', err.message);
        }
        if (isStreaming) {
          captureInterval = setTimeout(capture, frameDelay);
        }
      };

      capture();
      streams.set(socket.id, { quality });
    });

    socket.on('stop', () => {
      isStreaming = false;
      if (captureInterval) {
        clearTimeout(captureInterval);
        captureInterval = null;
      }
      streams.delete(socket.id);
    });

    socket.on('set-quality', (q) => {
      quality = q;
      if (streams.has(socket.id)) {
        streams.get(socket.id).quality = q;
      }
    });

    socket.on('mouse', (evt) => {
      if (isStreaming) injectMouse(evt).catch(() => {});
    });

    socket.on('keyboard', (evt) => {
      if (isStreaming) injectKey(evt).catch(() => {});
    });

    socket.on('disconnect', () => {
      isStreaming = false;
      if (captureInterval) {
        clearTimeout(captureInterval);
        captureInterval = null;
      }
      streams.delete(socket.id);
    });
  });
}
