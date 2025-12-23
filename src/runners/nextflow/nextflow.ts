import * as path from 'path';
import * as fs_sync from 'fs';
import slash from 'slash';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { IWorkflowInstance } from '../../main/collection.js'; // should not be linking directly to main from here

type paramsT = { [key: string]: any };

export interface IRunWorkflowOpts {
  resume?: boolean;
  restart?: boolean;
  profile?: string;
}

const is_windows = process.platform === 'win32';

const toPosixPath = (base: string) => {
  return slash(base).replace('C:', '/mnt/c');
};

const resolvePath = (base: string, name: string) => {
  const rtn = toPosixPath(path.resolve(base, name));
  return rtn;
};

const looksLikePath = (s: string): boolean => {
  return /^[a-zA-Z]:\\/.test(s) || /[\\/]/.test(s);
};

const paramsToPosix = (params: any): any => {
  if (Array.isArray(params)) {
    return params.map(paramsToPosix);
  } else if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      params[key] = paramsToPosix(value);
    }
    return params;
  } else if (typeof params === 'string') {
    if (looksLikePath(params)) {
      return toPosixPath(params);
    }
    return params;
  }
  return params;
};

export async function runWorkflow(
  instance: IWorkflowInstance,
  params: paramsT,
  { resume = false, restart = false, profile = 'standard' }: IRunWorkflowOpts = {}
) {
  // Launch nextflow natively on host system
  const name = instance.name;
  const instancePath = instance.path; // launch from Windows path (on win32)
  const workPath = resolvePath(instancePath, 'work');
  await fs.mkdir(workPath, { recursive: true });
  const projectPath = instance.workflow_version?.path || instancePath;

  if (is_windows) {
    // Convert all file and folder paths in params to posix and redirect
    params = paramsToPosix(params);
  }

  // Save parameters to a file in the instance folder
  const paramsFile = path.resolve(instancePath, 'params.json');
  if (!resume && !restart) {
    fs.writeFile(paramsFile, JSON.stringify(params, null, 2), 'utf8');
  }

  // Clear logs and set to append
  if (!fs_sync.existsSync(instancePath)) {
    fs_sync.mkdirSync(instancePath, { recursive: true });
  }
  if (!fs_sync.existsSync(path.resolve(instancePath, 'stdout.log'))) {
    fs_sync.writeFileSync(path.resolve(instancePath, 'stdout.log'), '');
  }
  fs_sync.truncateSync(path.resolve(instancePath, 'stdout.log'), 0);
  const stdout = fs_sync.openSync(path.resolve(instancePath, 'stdout.log'), 'a');
  if (!fs_sync.existsSync(path.resolve(instancePath, 'stderr.log'))) {
    fs_sync.writeFileSync(path.resolve(instancePath, 'stderr.log'), '');
  }
  fs_sync.truncateSync(path.resolve(instancePath, 'stderr.log'), 0);
  const stderr = fs_sync.openSync(path.resolve(instancePath, 'stderr.log'), 'a');

  if (is_windows) {
    const args = [
      'nextflow',
      'run',
      resolvePath(projectPath, 'main.nf'),
      '-work-dir',
      toPosixPath(workPath),
      '-profile',
      profile,
      '-params-file',
      toPosixPath(paramsFile),
      '-name',
      name
    ];
    if (resume) {
      args.push('-resume');
    }
    const cmd = args.join(' ');

    const bashArgs = [
      cmd,
      '>',
      resolvePath(instancePath, 'stdout.log'),
      '2>',
      resolvePath(instancePath, 'stderr.log'),
      '<',
      '/dev/null'
    ];
    const bashCmd = bashArgs.join(' ');

    console.log(`Spawning nextflow with command: ${cmd} from ${instancePath}`);
    const p = spawn('wsl.exe', ['-e', 'bash', '-lc', bashCmd], {
      cwd: instancePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: true
    });
    p.unref();

    return p.pid;
  }

  // Unix / macOS launcher
  const cmd = [
    'run',
    resolvePath(projectPath, 'main.nf'),
    '-work-dir',
    toPosixPath(workPath),
    '-profile',
    profile,
    '-params-file',
    toPosixPath(paramsFile),
    '-name',
    name
  ];
  if (resume) {
    cmd.push('-resume');
  }

  console.log(`Spawning nextflow with command: nextflow ${cmd.join(' ')} from ${instancePath}`);
  const p = spawn('nextflow', cmd, {
    cwd: instancePath,
    stdio: ['ignore', stdout, stderr], // stdin ignored
    detached: true
  });
  p.unref(); // allow the parent to exit independently

  return p.pid;
}

export async function getAvailableProfiles(instance: IWorkflowInstance): Promise<string[]> {
  const nextflow_config_file = path.join(instance.workflow_version.path, 'nextflow.config');
  if (!fs_sync.existsSync(nextflow_config_file)) {
    console.log(`Nextflow config file ${nextflow_config_file} does not exist.`);
    return ['standard'];
  }

  async function readFileUtf8(p: string): Promise<string> {
    return fs_sync.promises.readFile(p, { encoding: 'utf8' });
  }

  try {
    const txt = await readFileUtf8(nextflow_config_file);

    // Find the "profiles { ... }" block and extract its content while respecting nested braces.
    const profilesStartMatch = txt.match(/profiles\s*\{/);
    if (!profilesStartMatch) {
      // no profiles block -> default 'standard'
      return ['standard'];
    }

    const startIdx = txt.indexOf(profilesStartMatch[0]);
    // find the opening brace position
    const openBraceIdx = txt.indexOf('{', startIdx);
    if (openBraceIdx === -1) {
      return ['standard'];
    }

    // walk forward to find matching closing brace (handle nested braces)
    let depth = 0;
    let endIdx = -1;
    for (let i = openBraceIdx; i < txt.length; i++) {
      const ch = txt[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx === -1) {
      // malformed config; fall back to default
      console.warn(
        'Could not find end of profiles block in nextflow.config; returning default profile.'
      );
      return ['standard'];
    }

    const profilesBlock = txt.slice(openBraceIdx + 1, endIdx);

    // Match profile names: support unquoted (name {) and quoted ('name' { or "name" {)
    const profiles = new Set<string>();

    depth = 0;
    let token = '';
    let inLineComment = false;

    for (let i = 0; i < profilesBlock.length; i++) {
      const ch = profilesBlock[i];
      const next = profilesBlock[i + 1];

      // detect // comment start
      if (!inLineComment && ch === '/' && next === '/') {
        inLineComment = true;
        i++; // skip second '/'
        continue;
      }

      // end comment at newline
      if (inLineComment) {
        if (ch === '\n') {
          inLineComment = false;
        }
        continue;
      }

      if (ch === '{') {
        if (depth === 0) {
          const name = token.trim().replace(/^['"]|['"]$/g, '');

          if (name.length > 0) {
            profiles.add(name);
          }
        }
        depth++;
        token = '';
      } else if (ch === '}') {
        depth--;
        token = '';
      } else if (depth === 0) {
        token += ch;
      }
    }
    // Always include 'standard' if it's not present (Nextflow assumes it as default profile)
    if (!profiles.has('standard')) {
      profiles.add('standard');
    }

    // return as array (sorted for predictable order)
    return Array.from(profiles).sort();
  } catch (err) {
    console.error('Error reading/parsing nextflow.config:', err);
    return ['standard'];
  }
}
