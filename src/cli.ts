#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('vitest-testid')
  .description('CLI for managing test identities')
  .version('0.1.0')

program
  .command('status <uuid>')
  .description('Show test status by UUID')
  .action((uuid: string) => {
    console.log(`Status for test UUID: ${uuid}`)
  })

program.parse()