import { Command } from 'commander';
import { clearGlobalConfig } from '../config';
import { log } from '../util';

export function registerLogout(program: Command): void {
  program
    .command('logout')
    .description('Remove the saved API token')
    .action(() => {
      clearGlobalConfig();
      log.success('Logged out.');
    });
}
