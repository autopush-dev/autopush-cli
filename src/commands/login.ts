import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import { resolveApi, readGlobalConfig, writeGlobalConfig } from '../config';
import { createClient, whoami } from '../api';
import { fail, errMessage } from '../util';

export function registerLogin(program: Command): void {
  program
    .command('login')
    .description('Save an AutoPush API token on this machine')
    .option('--token <token>', 'API token (from the dashboard)')
    .option('--api <url>', 'API base URL')
    .action(async (opts: { token?: string; api?: string }) => {
      const api = resolveApi(opts.api);
      let token = opts.token || process.env.AUTOPUSH_TOKEN;

      if (!token) {
        const res = await prompts({
          type: 'password',
          name: 'token',
          message: 'Paste your API token (autopush.dev > Profile > API Tokens)',
        });
        token = res.token as string | undefined;
      }
      if (!token) fail('No token provided.');

      const spinner = ora('Verifying token...').start();
      try {
        const me = await whoami(createClient(api, token));
        writeGlobalConfig({ ...readGlobalConfig(), token, api, email: me.email });
        spinner.succeed(`Logged in as ${me.email}`);
      } catch (err) {
        spinner.fail('Token verification failed');
        fail(errMessage(err));
      }
    });
}
