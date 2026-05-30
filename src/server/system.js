import os from 'node:os';
import nodeMachineId from 'node-machine-id';

const machineIdSync = nodeMachineId.machineIdSync || nodeMachineId.default?.machineIdSync;

let cachedMachineId = null;
function machineId() {
  if (cachedMachineId) return cachedMachineId;
  try {
    cachedMachineId = machineIdSync ? machineIdSync({ original: false }) : 'unknown';
  } catch {
    cachedMachineId = 'unknown';
  }
  return cachedMachineId;
}

export function registerSystemRoutes(app, { rootDir }) {
  app.get('/api/system/info', (_req, res) => {
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'unknown',
      totalMem: memTotal,
      freeMem: memFree,
      uptime: os.uptime(),
      user: os.userInfo().username,
      home: os.homedir(),
      rootDir,
      machineId: machineId(),
      nodeVersion: process.version,
    });
  });
}
