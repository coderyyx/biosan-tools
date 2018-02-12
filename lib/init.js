
'use strict';

// from publish-please

const path = require('path');
const writeFile = require('fs').writeFileSync;
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');

const pathJoin = path.join;

function reportNoConfig() {
  console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
  console.log(chalk.bgRed('!! Unable to setup biosan-tools: project\'s package.json either missing !!'));
  console.log(chalk.bgRed('!! or malformed. Run `npm init` and then reinstall biosan-tools.       !!'));
  console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
}

function reportCompletion() {
  console.log(chalk.bgGreen('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
  console.log(chalk.bgGreen('!! biosan-tools was successfully installed for the project. !!'));
  console.log(chalk.bgGreen('!! Use `npm run pub` command for publishing.       !!'));
  console.log(chalk.bgGreen('!! publishing configuration.                                  !!'));
  console.log(chalk.bgGreen('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
}

function addConfigHooks(cfg, projectDir) {
  let config = {};
  if (!cfg.scripts) {
    cfg.scripts = {};
  }

  // if (cfg.scripts.pub) {
  //   return false;
  // }
  if(cfg.name!=='treat')
    config={
        dist: 'biosan-tools run dist',
        compile: 'biosan-tools run compile',
        clean: 'biosan-tools run clean',
        site: 'biosan-tools run site',
        deploy: 'biosan-tools run update-self && biosan-tools run deploy',
        'just-deploy': 'biosan-tools run just-deploy',
        pub: 'biosan-tools run update-self && biosan-tools run pub',
    };
  else
    config={
      hot:'biosan-tools run treat-develop',
      common_babel: "biosan-tools run common-task-babel"
    }

  cfg.scripts = Object.assign(cfg.scripts,config);

  if (cfg.scripts.prepublish) {
    cfg.scripts['pre-publish'] = cfg.scripts.prepublish;
  }

  cfg.scripts.prepublish = 'biosan-tools run guard';
  writeFile(pathJoin(projectDir, 'package.json'), JSON.stringify(cfg, null, 2));

  return true;
}

function init() {
  console.log('installed-----');
  console.log(process.argv);
  console.log('------');

  const testMode = process.argv.indexOf('--test-mode') > -1;

  // NOTE: don't run on dev installation (running `npm install` in this repo)
  if (!testMode) {
    const npmArgs = getNpmArgs();
    if(npmArgs.indexOf('--global')>-1){
      console.log(chalk.bgRed('不允许全局安装 biosan-tools!'));
      process.exit(1);
    }

    console.log('npmArgs-----');
    console.log(npmArgs);
    
    if (!npmArgs || !npmArgs.some(arg => /^biosan-tools(@\d+\.\d+.\d+)?$/.test(arg))) {
      return;
    }
  }
  // NOTE: <projectDir>/node_modules/antd-tools/lib
  const projectDir = pathJoin(__dirname, '../../../');

  const cfg = require(path.join(projectDir, 'package.json'));

  if (!cfg) {
    reportNoConfig();
    process.exit(1);
  }else if (addConfigHooks(cfg, projectDir)) {
    reportCompletion();
  }

}

init();
