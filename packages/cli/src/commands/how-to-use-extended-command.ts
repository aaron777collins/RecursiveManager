import { Command } from 'commander';
import { howToUseExtended } from './how-to-use-extended';

export function registerHowToUseExtendedCommand(program: Command): void {
  program
    .command('how_to_use_extended')
    .alias('extended-guide')
    .description('Show comprehensive user guide for RecursiveManager')
    .action(() => {
      howToUseExtended();
    });
}
