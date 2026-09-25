#!/usr/bin/env node
import { Command } from 'commander';
import { registerLogin } from './commands/login';
import { registerLogout } from './commands/logout';
import { registerWhoami } from './commands/whoami';
import { registerInit } from './commands/init';
import { registerDeploy } from './commands/deploy';
import { registerOpen } from './commands/open';

// Kept in sync with package.json at publish time.
const VERSION = '0.3.2';

const program = new Command();

program
  .name('autopush')
  .description('Deploy static sites to AutoPush from the command line.')
  .version(VERSION, '-v, --version');

registerLogin(program);
registerInit(program);
registerDeploy(program);
registerWhoami(program);
registerOpen(program);
registerLogout(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
