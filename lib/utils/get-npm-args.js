'use strict';

// NOTE: the following code was partially adopted from https://github.com/iarna/in-publish
module.exports = function getNpmArgs() {
  let npmArgv = null;

  try {
    /**
     * process.env node进程相关环境参数
     * npm_config_argv //npm install biosan-tools==>["install","biosan-tools"]从第三位开始可获取传入的参数
     * // {"remain":["biosan-tools"],"cooked":["install","biosan-tools"],"original":["install","biosan-tools"]}
     */
    npmArgv = JSON.parse(process.env.npm_config_argv);

  } catch (err) {
    return null;
  }

  if (typeof npmArgv !== 'object' || !npmArgv.cooked || !Array.isArray(npmArgv.cooked)) {
    return null;
  }

  return npmArgv.cooked;
};
