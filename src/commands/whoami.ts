import { Command } from 'commander';
import { resolveApi, resolveToken } from '../config';
import { createClient, whoami } from '../api';
import { log, fail, errMessage } from '../util';

export function registerWhoami(program: Command): void {
  program
    .command('whoami')
    .description('Show the signed-in account')
    .option('--token <token>', 'API token')
    .option('--api <url>', 'API base URL')
    .action(async (opts: { token?: string; api?: string }) => {
      const api = resolveApi(opts.api);
      const token = resolveToken(opts.token);
      if (!token) fail('Not logged in - run `autopush login`.');
      try {
        const me = await whoami(createClient(api, token));
        log.info(`${me.name} <${me.email}>`);
        log.dim(`API: ${api}`);
      } catch (err) {
        fail(errMessage(err));
      }
    });
}
