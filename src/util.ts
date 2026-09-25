import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import pc from 'picocolors';

export const log = {
  info: (m: string) => console.log(m),
  success: (m: string) => console.log(pc.green(m)),
  warn: (m: string) => console.log(pc.yellow('! ') + m),
  dim: (m: string) => console.log(pc.dim(m)),
};

/** Print an error and exit non-zero. */
export function fail(message: string): never {
  console.error(pc.red('x ') + message);
  process.exit(1);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Turn an axios/network error into a short, actionable message. */
export function errMessage(err: unknown): string {
  const e = err as { response?: { status: number; statusText: string; data?: { message?: string } }; code?: string; message?: string };
  if (e?.response) {
    const status = e.response.status;
    const msg = e.response.data?.message || e.response.statusText;
    if (status === 401) return 'Unauthorized - run `autopush login` with a valid token.';
    if (status === 403) return `Forbidden: ${msg}`;
    if (status === 413) return 'Upload too large - your build exceeds the size limit.';
    return `Request failed (${status}): ${msg}`;
  }
  if (e?.code === 'ECONNABORTED') return 'Request timed out.';
  if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') return 'Could not reach the AutoPush API - check your connection or --api URL.';
  return e?.message || String(err);
}

/** Open a URL in the default browser (cross-platform, no dependency). */
export function openUrl(url: string): void {
  const platform = process.platform;
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else if (platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

/** Guess the build-output folder if none is configured. */
export function detectDir(cwd: string = process.cwd()): string | undefined {
  for (const d of ['dist', 'build', 'out', 'public']) {
    const full = path.join(cwd, d);
    try {
      if (fs.statSync(full).isDirectory()) return d;
    } catch {
      /* not present */
    }
  }
  return undefined;
}

/** Normalise a user-typed slug to what the platform accepts. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Read .autopushignore (gitignore-style, one glob per line) if present. */
export function readIgnoreFile(cwd: string = process.cwd()): string[] {
  try {
    return fs
      .readFileSync(path.join(cwd, '.autopushignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}
