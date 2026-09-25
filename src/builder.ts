import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** Pick the package manager from the lockfile (defaults to npm). */
export function detectPackageManager(cwd: string): PackageManager {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun';
  return 'npm';
}

export function hasBuildScript(cwd: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    return Boolean(pkg?.scripts?.build);
  } catch {
    return false;
  }
}

/** A human-readable label for the command that will run. */
export function buildLabel(cwd: string, custom?: string): string {
  if (custom && custom.trim()) return custom.trim();
  return `${detectPackageManager(cwd)} run build`;
}

/**
 * Run the project's build. `custom` (from autopush.json "build" when it's a
 * string) is a full command like "npm run build"; otherwise we default to
 * "<pm> run build". Runs on the user's machine and streams output live.
 * Throws if the build exits non-zero.
 */
export function runBuild(cwd: string, custom?: string): void {
  let cmd: string;
  let args: string[];
  if (custom && custom.trim()) {
    const parts = custom.trim().split(/\s+/);
    cmd = parts[0];
    args = parts.slice(1);
  } else {
    cmd = detectPackageManager(cwd);
    args = ['run', 'build'];
  }
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    // On Windows npm/pnpm/yarn are .cmd shims - a shell resolves them.
    shell: process.platform === 'win32',
  });
  if (res.error) throw new Error(`Could not start build: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`Build failed (${cmd} ${args.join(' ')} exited with code ${res.status ?? 'unknown'}).`);
}

function newestExisting(cwd: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestMtime = -1;
  for (const c of candidates) {
    try {
      const st = fs.statSync(path.join(cwd, c));
      if (st.isDirectory() && st.mtimeMs > bestMtime) {
        bestMtime = st.mtimeMs;
        best = c;
      }
    } catch {
      /* not present */
    }
  }
  return best;
}

/**
 * Guess the build-output folder. Framework hints first (from dependencies),
 * then the most recently written of the common output dirs. An explicit `dir`
 * in autopush.json always overrides this.
 */
export function detectOutputDir(cwd: string): string | undefined {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const deps: Record<string, string> = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const has = (name: string) => Boolean(deps[name]);
    if (has('react-scripts') && fs.existsSync(path.join(cwd, 'build'))) return 'build';
    if (has('next') && fs.existsSync(path.join(cwd, 'out'))) return 'out';
    if ((has('vite') || has('astro') || has('@sveltejs/kit') || has('vue')) && fs.existsSync(path.join(cwd, 'dist'))) return 'dist';
  } catch {
    /* ignore */
  }
  return newestExisting(cwd, ['dist', 'build', 'out', 'public']);
}
