#!/usr/bin/env node

'use strict';

require('colorful').colorful();
const gulp = require('gulp');
const program = require('commander');

program.on('--help', () => {
  console.log('  Usage:'.to.bold.blue.color);
  console.log();
});

program.parse(process.argv);

const task = program.args[0];
console.log('--task--');
console.log(task);
if (!task) {
  program.help();
} else {
  console.log('--------biosan-tools------');
  console.log('biosan-tools run', task);

  require('../gulpfile');

  gulp.start(task);
}
