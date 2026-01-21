import { Command } from 'commander';
import { howToUse } from './how-to-use';

export function registerHowToUseCommand(program: Command): void {
  program
    .command('how_to_use')
    .alias('quick-start')
    .description('Show quick start guide for RecursiveManager')
    .action(() => {
      howToUse();
    });
}
