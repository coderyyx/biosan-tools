'use strict';

const install = require('./install');
const runCmd = require('./runCmd');
const getBabelCommonConfig = require('./getBabelCommonConfig');
const merge2 = require('merge2');
const { execSync } = require('child_process');
const through2 = require('through2');
const transformLess = require('./transformLess');
const webpack = require('webpack');
const babel = require('gulp-babel');
const argv = require('minimist')(process.argv.slice(2));

const packageJson = require(`${process.cwd()}/package.json`);
const getNpm = require('./getNpm');
const selfPackage = require('../package.json');
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');
const path = require('path');
const watch = require('gulp-watch');
const ts = require('gulp-typescript');
const tsConfig = require('./getTSCommonConfig')();

const gulp = require('gulp');
const fs = require('fs');
const rimraf = require('rimraf');
const replaceLib = require('./replaceLib');
const stripCode = require('gulp-strip-code');

const tsDefaultReporter = ts.reporter.defaultReporter();
const cwd = process.cwd();
const libDir = path.join(cwd, 'lib');
const esDir = path.join(cwd, 'es');

let TreatWebpackConfig = require('./TreatWebpackConfig/basicConfig');

function dist(done) {
  rimraf.sync(path.join(cwd, 'dist'));
  process.env.RUN_ENV = 'PRODUCTION';
  const webpackConfig = require(path.join(cwd, 'webpack.config.js'));
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
      console.error(info.errors);
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings);
    }

    const buildInfo = stats.toString({
      colors: true,
      children: true,
      chunks: false,
      modules: false,
      chunkModules: false,
      hash: false,
      version: false,
    });
    console.log(buildInfo);
    done(0);
  });
}

function tag() {
  console.log('tagging');
  const { version } = packageJson;
  execSync(`git tag ${version}`);
  execSync(`git push origin ${version}:${version}`);
  execSync('git push origin master:master');
  console.log('tagged');
}

gulp.task('check-git', (done) => {
  runCmd('git', ['status', '--porcelain'], (code, result) => {
    if (/^\?\?/m.test(result)) {
      return done(`There are untracked files in the working tree.\n${result}
      `);
    }
    if (/^([ADRM]| [ADRM])/m.test(result)) {
      return done(`There are uncommitted changes in the working tree.\n${result}
      `);
    }
    return done();
  });
});

gulp.task('clean', () => {
  rimraf.sync(path.join(cwd, '_site'));
  rimraf.sync(path.join(cwd, '_data'));
});

gulp.task('dist', (done) => {
  dist(done);
});

gulp.task('ts-lint', (done) => {
  const tslintBin = require.resolve('tslint/bin/tslint');
  const tslintConfig = path.join(__dirname, './tslint.json');
  const args = [tslintBin, '-c', tslintConfig, 'components/**/*.tsx'];
  runCmd('node', args, done);
});

gulp.task('ts-lint-fix', (done) => {
  const tslintBin = require.resolve('tslint/bin/tslint');
  const tslintConfig = path.join(__dirname, './tslint.json');
  const args = [tslintBin, '-c', tslintConfig, 'components/**/*.tsx', '--fix'];
  runCmd('node', args, done);
});

const tsFiles = [
  '**/*.ts',
  '**/*.tsx',
  '!node_modules/**/*.*',
  'typings/**/*.d.ts',
];

function compileTs(stream) {
  return stream
    .pipe(ts(tsConfig)).js
    .pipe(through2.obj(function (file, encoding, next) {
      // console.log(file.path, file.base);
      file.path = file.path.replace(/\.[jt]sx$/, '.js');
      this.push(file);
      next();
    }))
    .pipe(gulp.dest(process.cwd()));
}

gulp.task('watch-tsc', ['tsc'], () => {
  watch(tsFiles, (f) => {
    if (f.event === 'unlink') {
      const fileToDelete = f.path.replace(/\.tsx?$/, '.js');
      if (fs.existsSync(fileToDelete)) {
        fs.unlinkSync(fileToDelete);
      }
      return;
    }
    const myPath = path.relative(cwd, f.path);
    compileTs(gulp.src([
      myPath,
      'typings/**/*.d.ts',
    ], {
      base: cwd,
    }));
  });
});

gulp.task('tsc', () => {
  return compileTs(gulp.src(tsFiles, {
    base: cwd,
  }));
});

function babelify(js, modules) {
  const babelConfig = getBabelCommonConfig(modules);
  delete babelConfig.cacheDirectory;
  if (modules === false) {
    babelConfig.plugins.push(replaceLib);
  }
  let stream = js.pipe(babel(babelConfig))
    .pipe(through2.obj(function z(file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/\/style\/index\.js/)) {
        const content = file.contents.toString(encoding);
        if (content.indexOf('\'react-native\'') !== -1) {
          // actually in antd-mobile@2.0, this case will never run,
          // since we both split style/index.mative.js style/index.js
          // but let us keep this check at here
          // in case some of our developer made a file name mistake ==
          next();
          return;
        }
        file.contents = Buffer.from(content
          .replace(/\/style\/?'/g, '/style/css\'')
          .replace(/\.less/g, '.css'));
        file.path = file.path.replace(/index\.js/, 'css.js');
        this.push(file);
        next();
      } else {
        next();
      }
    }));
  if (modules === false) {
    stream = stream.pipe(stripCode({
      start_comment: '@remove-on-es-build-begin',
      end_comment: '@remove-on-es-build-end',
    }));
  }
  return stream.pipe(gulp.dest(modules === false ? esDir : libDir));
}

function compile(modules) {
  rimraf.sync(modules !== false ? libDir : esDir);
  const less = gulp.src(['components/**/*.less'])
    .pipe(through2.obj(function (file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/\/style\/index\.less$/) || file.path.match(/\/style\/v2-compatible-reset\.less$/)) {
        transformLess(file.path).then((css) => {
          file.contents = Buffer.from(css);
          file.path = file.path.replace(/\.less$/, '.css');
          this.push(file);
          next();
        }).catch((e) => {
          console.error(e);
        });
      } else {
        next();
      }
    }))
    .pipe(gulp.dest(modules === false ? esDir : libDir));
  const assets = gulp.src(['components/**/*.@(png|svg)']).pipe(gulp.dest(modules === false ? esDir : libDir));
  let error = 0;
  const source = [
    'components/**/*.tsx',
    'typings/**/*.d.ts',
  ];
  // allow jsx file in components/xxx/
  if (tsConfig.allowJs) {
    source.unshift('components/**/*.jsx');
  }
  const tsResult = gulp.src(source).pipe(ts(tsConfig, {
    error(e) {
      tsDefaultReporter.error(e);
      error = 1;
    },
    finish: tsDefaultReporter.finish,
  }));

  function check() {
    if (error && !argv['ignore-error']) {
      process.exit(1);
    }
  }

  tsResult.on('finish', check);
  tsResult.on('end', check);
  const tsFilesStream = babelify(tsResult.js, modules);
  const tsd = tsResult.dts.pipe(gulp.dest(modules === false ? esDir : libDir));
  return merge2([less, tsFilesStream, tsd, assets]);
}

function publish(tagString, done) {
  let args = ['publish', '--with-biosan-tools'];
  if (tagString) {
    args = args.concat(['--tag', tagString]);
  }
  const publishNpm = process.env.PUBLISH_NPM_CLI || 'npm';
  runCmd(publishNpm, args, (code) => {
    // tag();
    done(code);
  });
}

function pub(done) {
  dist((code) => {
    if (code) {
      done(code);
      return;
    }
    const notOk = !packageJson.version.match(/^\d+\.\d+\.\d+$/);
    let tagString;
    if (argv['npm-tag']) {
      tagString = argv['npm-tag'];
    }
    if (!tagString && notOk) {
      tagString = 'next';
    }
    if (packageJson.scripts['pre-publish']) {
      runCmd('npm', ['run', 'pre-publish'], (code2) => {
        if (code2) {
          done(code2);
          return;
        }
        publish(tagString, done);
      });
    } else {
      publish(tagString, done);
    }
  });
}

gulp.task('compile', ['compile-with-es'], () => {
  compile();
});
gulp.task('compile-with-es', () => {
  compile(false);
});

gulp.task('install', (done) => {
  install(done);
});

/**
 * do not exec compile
 */
gulp.task('pub', ['check-git'], (done) => {
  pub(done);
});

gulp.task('update-self', (done) => {
  getNpm((npm) => {
    console.log(`${npm} updating ${selfPackage.name}`);
    runCmd(npm, ['update', selfPackage.name], (c) => {
      console.log(`${npm} update ${selfPackage.name} end`);
      done(c);
    });
  });
});

function reportError() {
  console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
  console.log(chalk.bgRed('!! `npm publish` is forbidden for this package. !!'));
  console.log(chalk.bgRed('!! Use `npm run pub` instead.        !!'));
  console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
}

gulp.task('guard', (done) => {
  const npmArgs = getNpmArgs();
  if (npmArgs) {
    for (let arg = npmArgs.shift(); arg; arg = npmArgs.shift()) {
      if (/^pu(b(l(i(sh?)?)?)?)?$/.test(arg) && npmArgs.indexOf('--with-biosan-tools') < 0) {
        reportError();
        done(1);
        return;
      }
    }
  }
  done();
});

/**
 * common output log
 */
function babelAndLog(config){
  webpack(config, (err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
      console.error(info.errors);
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings);
    }

    const buildInfo = stats.toString({
      colors: true,
      children: true,
      chunks: false,
      modules: false,
      chunkModules: false,
      hash: false,
      version: false,
    });
    console.log(buildInfo);

  });
}

/**
 * treatSystem compile
 */
gulp.task('treat-develop',(done) => {
  //查询报警原因
  // process.traceDeprecation = true;
  const npmArgs = getNpmArgs();
  let env = npmArgs.indexOf('hot') <0 ? true : false;
  if(!env){
    Object.assign(TreatWebpackConfig,{watch: true,devtool:'eval-source-map'});
    console.log("Webpack is watching the files…");
  }else
    rimraf.sync(path.join(cwd, 'dist'));
  process.env.RUN_ENV = env ? 'PRODUCTION' : 'DEVELOPMENT';
 
  babelAndLog(TreatWebpackConfig);
})


function checkEntryAndOut(config){
  let keys = Object.keys(config);
  if(keys==0){
    console.log(chalk.bgRed('必须配置entry & output!'));
    return false;
  }
  if(keys.indexOf('entry')<0 || keys.indexOf('output')<0){
    console.log(chalk.bgRed('必须配置entry & output!'));
    return false;
  }
  return true;
}

/**
 * 通用编译任务
 */
gulp.task("common-task-babel",(done)=>{
  // TreatWebpackConfig
    let flag = true;
    let biosan_tools_path;
    let biosan_tools_config = {};
    try {
      biosan_tools_path = path.join(cwd, 'biosan-tools.js');
      biosan_tools_config = require(biosan_tools_path);
    } catch (error) {
      console.log(chalk.bgRed('未发现biosan-tools.js文件在：'+biosan_tools_path));
      flag = false;
      return;
    }
    if(!flag)
      return;
    //check biosan-tools.js correct!
    if(!checkEntryAndOut(biosan_tools_config))
      return;
    Object.assign(TreatWebpackConfig,biosan_tools_config);
    //合并插件
    TreatWebpackConfig.plugins.concat(biosan_tools_config.plugins);
    //
    babelAndLog(TreatWebpackConfig);
})