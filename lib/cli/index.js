#!/usr/bin/env node

'use strict';

require('colorful').colorful();

const program = require('commander');
const packageInfo = require('../../package.json');
const getNpmArgs = require('./utils/get-npm-args');

program
  .version(packageInfo.version)
  .command('run [name]', 'run specified task')
  .parse(process.argv);

// https://github.com/tj/commander.js/pull/260
const proc = program.runningCommand;
if (proc) {
  proc.on('close', process.exit.bind(process));
  proc.on('error', () => {
    process.exit(1);
  });
}

const npmArgs = getNpmArgs();
if(npmArgs.indexOf('--global')>-1){
  console.log(chalk.bgRed('不允许全局安装 biosan-tools!'));
  process.exit(1);
}

const subCmd = program.args[0];
// console.log('----subCmd----');
// console.log(subCmd);

if (!subCmd || subCmd !== 'run') {
  program.help();
}
