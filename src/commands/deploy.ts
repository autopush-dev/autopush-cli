import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import { resolveApi, resolveToken, readProjectConfig, writeProjectConfig } from '../config';
import { createClient, deploy, listSites, SiteSummary } from '../api';
import { log, fail, errMessage, formatBytes, detectDir, slugify, readIgnoreFile } from '../util';
import { zipDir, ZipResult } from '../zip';
import { runBuild, buildLabel, detectOutputDir, hasBuildScript } from '../builder';

const MAX_ZIP_BYTES = 50 * 1024 * 1024; // matches the backend uploadZip limit

interface DeployOpts {
  dir?: string;
  site?: string;
  message?: string;
  token?: string;
  api?: string;
  yes?: boolean;
  build?: boolean; // false only when --no-build is passed
}

/** What we're deploying to. `create` means the backend should make a new site. */
interface Target {
  siteId?: string;
  slug?: string;
  name?: string;
}

export function registerDeploy(program: Command): void {
  program
    .command('deploy [dir]')
    .description('Build (if there is a build script) and deploy to AutoPush')
    .option('--dir <path>', 'folder to upload (overrides autopush.json / auto-detect)')
    .option('--site <slug>', 'target a specific site by slug')
    .option('--message <text>', 'label this deploy in the dashboard')
    .option('--token <token>', 'API token (or set AUTOPUSH_TOKEN)')
    .option('--api <url>', 'API base URL')
    .option('--no-build', 'skip the build step and upload the folder as-is')
    .option('-y, --yes', 'skip prompts; use the configured site (for CI)')
    .action(async (dirArg: string | undefined, opts: DeployOpts) => {
      const api = resolveApi(opts.api);
      const token = resolveToken(opts.token);
      if (!token) fail('Not logged in - run `autopush login` (or set AUTOPUSH_TOKEN).');

      const client = createClient(api, token);
      const project = readProjectConfig();
      const interactive = Boolean(process.stdout.isTTY) && !opts.yes;

      // 1) Decide which site to deploy to.
      const target = await resolveTarget(client, project, opts, interactive);

      // 2) Build first (default on when a build script exists), unless --no-build.
      const buildCustom = typeof project.build === 'string' ? project.build : undefined;
      const buildDisabled = opts.build === false || project.build === false;
      const wantBuild = !buildDisabled && (buildCustom !== undefined || hasBuildScript(process.cwd()));
      if (wantBuild) {
        log.info(`Building with ${buildLabel(process.cwd(), buildCustom)}...`);
        try {
          runBuild(process.cwd(), buildCustom);
        } catch (err) {
          fail(errMessage(err));
        }
      }

      // 3) Resolve the folder to upload.
      const dir = path.resolve(
        dirArg || opts.dir || project.dir || (wantBuild ? detectOutputDir(process.cwd()) : undefined) || detectDir() || 'dist',
      );
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        fail(`Folder not found: ${dir}\nPass a folder (autopush deploy ./dist) or set "dir" in autopush.json.`);
      }
      if (!fs.existsSync(path.join(dir, 'index.html'))) {
        log.warn(`No index.html in ${path.relative(process.cwd(), dir) || '.'} - is this your build output?`);
      }

      // 4) Pack.
      const packSpin = ora(`Packing ${path.relative(process.cwd(), dir) || '.'}`).start();
      let zip: ZipResult;
      try {
        zip = await zipDir(dir, readIgnoreFile());
      } catch (err) {
        packSpin.fail('Packing failed');
        fail(errMessage(err));
      }
      if (zip.fileCount === 0) {
        packSpin.fail('Nothing to deploy');
        return fail(`No files found in ${dir}.`);
      }
      if (zip.buffer.length > MAX_ZIP_BYTES) {
        packSpin.fail('Too large');
        return fail(`Zipped build is ${formatBytes(zip.buffer.length)}, over the ${formatBytes(MAX_ZIP_BYTES)} limit.`);
      }
      packSpin.succeed(`Packed ${zip.fileCount} files (${formatBytes(zip.buffer.length)})`);

      // 5) Upload.
      const upSpin = ora('Uploading to AutoPush...').start();
      try {
        const result = await deploy(client, zip.buffer, {
          siteId: target.siteId,
          slug: target.slug,
          name: target.name || target.slug,
          message: opts.message,
        });
        upSpin.succeed('Deployed');
        writeProjectConfig({
          ...project,
          siteId: result.siteId,
          slug: result.slug,
          dir: path.relative(process.cwd(), dir) || '.',
          url: result.url,
        });
        log.success(`\n  ${result.url}\n`);
      } catch (err) {
        upSpin.fail('Upload failed');
        fail(errMessage(err));
      }
    });
}

/**
 * Work out the deploy target:
 *  - `--site` always wins.
 *  - a site saved in autopush.json is confirmed (interactive) or used (CI).
 *  - otherwise pick from the account's sites, or create a new one.
 */
async function resolveTarget(
  client: ReturnType<typeof createClient>,
  project: ReturnType<typeof readProjectConfig>,
  opts: DeployOpts,
  interactive: boolean,
): Promise<Target> {
  if (opts.site) return { slug: opts.site };

  const configured: Target | undefined =
    project.siteId || project.slug ? { siteId: project.siteId, slug: project.slug } : undefined;

  if (configured) {
    if (!interactive) return configured;
    const { same } = await prompts({
      type: 'confirm',
      name: 'same',
      message: `Deploy to "${project.slug}"?`,
      initial: true,
    });
    if (same) return configured;
    // fall through to picker
  } else if (!interactive) {
    // CI with nothing configured: derive a slug from the folder name.
    return { slug: slugify(path.basename(process.cwd())) };
  }

  // Interactive picker.
  let sites: SiteSummary[] = [];
  try {
    sites = await listSites(client);
  } catch (err) {
    fail(errMessage(err));
  }

  const { pick } = await prompts({
    type: 'select',
    name: 'pick',
    message: sites.length ? 'Deploy to which site?' : 'You have no sites yet',
    choices: [
      ...sites.map((s) => ({ title: `${s.slug}  ·  ${s.name}`, value: s.siteId })),
      { title: '+ Create a new site', value: '__new__' },
    ],
    initial: 0,
  });
  if (pick === undefined) fail('Cancelled.');

  if (pick === '__new__') {
    const { slug } = await prompts({
      type: 'text',
      name: 'slug',
      message: 'New site slug (used as <slug>.autopush.dev)',
      initial: slugify(path.basename(process.cwd())),
    });
    if (!slug) fail('Cancelled.');
    const clean = slugify(slug as string);
    if (!clean) fail('That slug is empty after cleanup - use letters, numbers and hyphens.');
    return { slug: clean, name: clean };
  }

  const chosen = sites.find((s) => s.siteId === pick);
  if (!chosen) fail('Could not resolve the selected site.');
  return { siteId: chosen.siteId, slug: chosen.slug };
}
