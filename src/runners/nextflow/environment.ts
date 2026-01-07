import https from 'https';
import { mkdirSync, chmodSync, createWriteStream } from 'fs';
import { execFileSync, spawn } from 'child_process';
import path from 'path';

const is_windows = process.platform === 'win32';
const nextflowPath = path.join(process.env.HOME || '', 'GLACIER', 'bin', 'nextflow');

export async function nextflowStatus() {
  if (is_windows) {
    return nextflowStatus_win32();
  } else {
    return nextflowStatus_unix();
  }
}

export async function nextflowAction(action: string) {
  switch (action) {
    case 'install.nextflow':
      return installNextflow();
    default:
      throw new Error(`Unknown Nextflow action: ${action}`);
  }
}

function nextflowStatus_win32() {
  // Windows Nextflow installation process
  return [
    {
      title: 'WSL',
      description: 'Is WSL2 installed and accessible?',
      status: 'info',
      actions: []
    },
    {
      title: 'Setup GLACIER distribution in WSL',
      description: 'Is the GLACIER WSL distribution set up?',
      status: 'info',
      actions: []
    }
  ];
}

function nextflowStatus_unix() {
  // Non-Windows Nextflow installation process (MacOS, Linux)
  if (isNextflowInstalled(nextflowPath)) {
    // GLACIER Nextflow installation
    return [
      {
        title: 'Nextflow',
        description: 'A GLACIER managed version of Nextflow is installed and accessible.',
        status: 'info',
        actions: []
      }
    ];
  } else if (isNextflowInstalled()) {
    // System Nextflow installation
    return [
      {
        title: 'Nextflow',
        description:
          'A system install is available and accessible. You can install a GLACIER managed version if you prefer.',
        status: 'info',
        actions: [
          {
            action: 'install.nextflow',
            label: 'Install Nextflow'
          }
        ]
      }
    ];
  } else {
    // No Nextflow installation found
    return [
      {
        title: 'Nextflow',
        description: 'A working Nextflow installation cannot be found. Please install Nextflow.',
        status: 'warning',
        actions: [
          {
            action: 'install.nextflow',
            label: 'Install Nextflow'
          }
        ]
      }
    ];
  }
}

function isNextflowInstalled(nextflowPath: string = 'nextflow'): boolean {
  try {
    execFileSync(nextflowPath, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function installNextflow() {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(nextflowPath), { recursive: true });
    https
      .get('https://get.nextflow.io', (res) => {
        if (res.statusCode !== 200) return reject({ ok: false });
        const file = createWriteStream(nextflowPath);
        res.pipe(file);
        file.on('finish', () => {
          chmodSync(nextflowPath, 0o755);
          const p = spawn(nextflowPath, ['-version'], { stdio: 'ignore' });
          p.on('close', (code) => {
            code === 0 ? resolve({ ok: true }) : reject({ ok: false });
          });
        });
      })
      .on('error', () => reject({ ok: false }));
  });
}
