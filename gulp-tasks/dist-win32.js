'use strict';

let path = require('path'),
  minimatch = require('minimatch'),
  common = require('./common.js'),
  download = require('./download.js'),
  mkdirp = require('mkdirp'),
  config = require('./config.js'),
  pjson = require('../package.json'),
  runSequence = require('run-sequence'),
  fs = require('fs-extra'),
  loadMetadata = require('../browser/services/metadata'),
  exec = require('child_process').exec,
  rcedit = require('rcedit'),
  del = require('del'),
  unzip = require('gulp-unzip'),
  child_process = require('child_process'),
  replace = require('replace-in-file');

module.exports = function(gulp, reqs) {

  let zaRoot = path.resolve(config.buildFolderRoot);
  let toolsFolder = 'tools';
  let zaZip = path.join(toolsFolder, '7zip.zip');
  let zaExe = path.join(zaRoot, '7za.exe');
  let zaSfx = path.join(zaRoot, '7zS.sfx');
  let zaExtra7z = path.join(toolsFolder, '7zip-extra.7z');
  let zaElectronPackage = path.join(zaRoot, config.artifactName + '-win32-x64');
  let bundled7z = path.join(zaRoot, config.artifactName +'-win32-x64.7z');
  let installerExe = path.join(zaRoot, config.artifactName + '-' + pjson.version + '-installer.exe');

  gulp.task('prepare-tools', function(cb) {
    runSequence('prefetch-tools', ['unzip-7zip'], 'unzip-7zip-extra', cb);
  });

  gulp.task('unzip-7zip', function() {
    return gulp.src(zaZip)
      .pipe(unzip({ filter : function(entry) { return minimatch(entry.path, '**/7za.exe'); } }))
      .pipe(gulp.dest(config.buildFolderRoot));
  });

  gulp.task('unzip-7zip-extra', function(cb) {
    let cmd = zaExe + ' e ' + zaExtra7z + ' -o' + zaRoot + ' -y ' + '7zS.sfx';
    // console.log(cmd);
    exec(cmd, common.createExecCallback(cb, true));
  });

  gulp.task('prepare-tools', function(cb) {
    runSequence('prefetch-tools', ['unzip-7zip'], 'unzip-7zip-extra', cb);
  });

  // wrap electron-generated app to 7zip archive
  gulp.task('create-7zip-archive', function(cb) {
    let packCmd = zaExe + ' a ' + bundled7z;
    // only include prefetch folder when zipping if the folder exists and we're doing a bundle build
    if (fs.existsSync(path.resolve(config.prefetchFolder)) && installerExe.indexOf('-bundle') > 0) {
      packCmd = zaExe + ' a -m0=Copy ' + bundled7z + ' ' + installerExe.replace('-bundle', '') + ' ' + path.resolve(config.prefetchFolder) + path.sep + '*';
    } else {
      packCmd = zaExe + ' a ' + bundled7z + ' ' + zaElectronPackage + path.sep + '* ' + path.resolve(config.prefetchFolder) + path.sep + reqs['cygwin'].fileName;
    }
    //console.log('[DEBUG]' + packCmd);
    exec(packCmd, common.createExecCallback(cb, true));
  });

  gulp.task('create-final-exe', ['update-7zip-config'], function(cb) {
    let configTxt = installerExe.indexOf('-bundle') > 0 ? path.resolve(path.join(zaRoot, '..', '..', 'config-bundle.txt')) :path.resolve(path.join(zaRoot, '..', '..', 'config.txt'));
    let packageCmd = 'copy /b ' + zaSfx + ' + ' + configTxt + ' + ' + bundled7z + ' ' + installerExe;

    exec(packageCmd, common.createExecCallback(cb, true));
  });

  gulp.task('update-7zip-config', function(cb) {
    if (installerExe.indexOf('-bundle') > 0) {
      const options = {
        files: path.resolve(path.join(zaRoot, '..', '..', 'config-bundle.txt')),
        from: /RunProgram=".*"/,
        to: 'RunProgram="' + path.basename(installerExe.replace('-bundle', '')) + ' %%T"'
      };
      replace(options, (err) => {
        cb(err);
      });
    } else {
      cb();
    }
  });

  gulp.task('create-sha256sum-of-exe', function(cb) {
    common.createSHA256File(installerExe, cb);
  });

  gulp.task('package', function(cb) {
    runSequence('create-7zip-archive', 'update-metadata', 'create-final-exe', 'create-sha256sum-of-exe', cb);
  });

  // Create stub installer that will then download all the requirements
  gulp.task('package-simple', function(cb) {
    runSequence(['check-requirements', 'clean'], 'create-dist-dir', ['generate',
      'prepare-tools'], 'prefetch-cygwin', 'package', cb);
  });

  gulp.task('package-bundle', function(cb) {
    runSequence('package-simple', 'clean-old-cache', 'prefetch', 'prefetch-cygwin-packages', 'cleanup', 'package', 'cleanup-dist', cb);
  });

  // Create both installers
  gulp.task('dist', ['package-bundle'], function(cb) {
    cb();
  });

  // prefetch cygwin to always include into installer
  gulp.task('prefetch-cygwin', ['create-prefetch-cache-dir'], function() {
    return download.prefetch(reqs, 'always', config.prefetchFolder);
  });

  // prefetch cygwin to always include into installer
  gulp.task('prefetch-cygwin-packages', ['create-prefetch-cache-dir'], function() {
    return new Promise(function(resolve, reject) {
      child_process.exec(`${path.resolve(config.prefetchFolder)}\\${reqs.cygwin.fileName} -D --no-admin --quiet-mode --only-site -l ${path.resolve(config.prefetchFolder, 'packages')} --site http://mirrors.xmission.com/cygwin --categories Base --packages openssh,rsync --root ${path.resolve(config.prefetchFolder, 'packages')}`, function(error, std, err) {
        if(error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });

  gulp.task('prefetch-tools', ['create-tools-dir'], function() {
    return download.prefetch(reqs, 'tools', toolsFolder);
  });

  gulp.task('prefetch-all', ['create-prefetch-cache-dir'], function() {
    return download.prefetch(reqs, 'no', config.prefetchFolder).then(()=>{
      return download.prefetch(reqs, 'yes', config.prefetchFolder);
    });
  });

  gulp.task('create-tools-dir', function() {
    if (!fs.existsSync(toolsFolder)) {
      mkdirp(toolsFolder);
    }
  });

  // prefetch all the installer dependencies so we can package them up into the .exe
  gulp.task('prefetch', ['create-prefetch-cache-dir'], function() {
    return download.prefetch(reqs, 'yes', config.prefetchFolder).then(()=>{
      return new Promise((resolve)=>{
        installerExe = path.join(zaRoot, config.artifactName + '-' + pjson.version + '-bundle' + '-installer.exe');
        resolve(true);
      });
    });
  });

  gulp.task('update-metadata', function(cb) {
    return rcedit(zaSfx, {
      'icon': config.configIcon,
      'file-version': pjson.version,
      'product-version': pjson.version,
      'application-manifest': 'devstudio.manifest',
      'version-string': {
        'ProductName': pjson.productName,
        'FileDescription': pjson.description + ' v' + pjson.version,
        'CompanyName': 'Red Hat, Inc.',
        'LegalCopyright': 'Copyright 2016 Red Hat, Inc.',
        'OriginalFilename': config.artifactName + '-' + pjson.version + '-installer.exe'
      }
    }, cb);
  });

  gulp.task('cleanup', function() {
    return del([bundled7z],
      { force: false });
  });

  gulp.task('cleanup-dist', function() {
    return del([bundled7z, zaExe, zaSfx, zaElectronPackage],
      { force: false });
  });
};
