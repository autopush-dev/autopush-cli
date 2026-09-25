import fs from 'fs';
import os from 'os';
import path from 'path';

/** Where a site is served: <slug>.autopush.dev. */
export const DEFAULT_API = 'https://api.autopush.dev';

export interface GlobalConfig {
  token?: string;
  api?: string;
  email?: string;
}

export interface ProjectConfig {
  siteId?: string;
  slug?: string;
  dir?: string;
  url?: string;
  /** true = run "<pm> run build" before deploy; a string = a custom build command. */
  build?: boolean | string;
}

function globalDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'autopush');
}

function globalConfigPath(): string {
  return path.join(globalDir(), 'config.json');
}

export function readGlobalConfig(): GlobalConfig {
  try {
    return JSON.parse(fs.readFileSync(globalConfigPath(), 'utf8')) as GlobalConfig;
  } catch {
    return {};
  }
}

export function writeGlobalConfig(cfg: GlobalConfig): void {
  fs.mkdirSync(globalDir(), { recursive: true });
  fs.writeFileSync(globalConfigPath(), JSON.stringify(cfg, null, 2));
  // Best-effort lock-down of the token file (no-op on Windows).
  try {
    fs.chmodSync(globalConfigPath(), 0o600);
  } catch {
    /* ignore */
  }
}

export function clearGlobalConfig(): void {
  try {
    fs.rmSync(globalConfigPath());
  } catch {
    /* ignore */
  }
}

const PROJECT_FILE = 'autopush.json';

export function projectConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, PROJECT_FILE);
}

export function readProjectConfig(cwd: string = process.cwd()): ProjectConfig {
  try {
    return JSON.parse(fs.readFileSync(projectConfigPath(cwd), 'utf8')) as ProjectConfig;
  } catch {
    return {};
  }
}

export function writeProjectConfig(cfg: ProjectConfig, cwd: string = process.cwd()): void {
  fs.writeFileSync(projectConfigPath(cwd), JSON.stringify(cfg, null, 2) + '\n');
}

/** Precedence: flag > env > global config > default. */
export function resolveApi(flag?: string): string {
  return flag || process.env.AUTOPUSH_API || readGlobalConfig().api || DEFAULT_API;
}

/** Precedence: flag > env > global config. */
export function resolveToken(flag?: string): string | undefined {
  return flag || process.env.AUTOPUSH_TOKEN || readGlobalConfig().token;
}
