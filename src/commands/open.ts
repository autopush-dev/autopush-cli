import { Command } from 'commander';
import { readProjectConfig } from '../config';
import { log, fail, openUrl } from '../util';

export function registerOpen(program: Command): void {
  program
    .command('open')
    .description('Open the deployed site in your browser')
    .action(() => {
      const p = readProjectConfig();
      const url = p.url || (p.slug ? `https://${p.slug}.autopush.dev` : undefined);
      if (!url) fail('No deployed URL yet - run `autopush deploy` first.');
      openUrl(url);
      log.dim(url);
    });
}
