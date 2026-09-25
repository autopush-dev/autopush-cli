import path from 'path';
import { Command } from 'commander';
import prompts from 'prompts';
import { readProjectConfig, writeProjectConfig, projectConfigPath } from '../config';
import { log, fail, detectDir, slugify } from '../util';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create autopush.json in this folder')
    .action(async () => {
      const existing = readProjectConfig();
      const res = await prompts([
        {
          type: 'text',
          name: 'slug',
          message: 'Site slug (used as <slug>.autopush.dev)',
          initial: existing.slug || slugify(path.basename(process.cwd())),
        },
        {
          type: 'text',
          name: 'dir',
          message: 'Folder to deploy (your build output)',
          initial: existing.dir || detectDir() || 'dist',
        },
      ]);

      if (!res.slug) fail('Cancelled.');
      const slug = slugify(res.slug as string);
      if (!slug) fail('That slug is empty after cleanup - use letters, numbers and hyphens.');

      writeProjectConfig({ ...existing, slug, dir: (res.dir as string) || 'dist' });
      log.success(`Wrote ${projectConfigPath()}`);
      log.dim('Next: autopush deploy');
    });
}
