var path = require('path');
var ScreenshotReporter = require('./test/screenshotReporter');

var files;
var report;
var platform =  process.platform + '-' + process.arch;
var installerExecSuffix = "";

if(process.platform === 'darwin') {
  installerExecSuffix = '.app/Contents/MacOS/devsuite';
} else if(process.platform === 'win32') {
  installerExecSuffix = '.exe';
}

var executable = path.join(__dirname, 'dist', platform, 'devsuite-' + platform, 'devsuite' + installerExecSuffix);
var chromeArgs = [];

if (process.env.PTOR_TEST_RUN === 'system') {
  files = ['test/system/system-test.js'];
  report = path.join(__dirname, 'system-tests');
  executable = path.join(__dirname, process.env.PTOR_BINARY);
  chromeArgs.push(executable);
  if (process.platform === 'win32') {
    executable = path.join(executable, 'devsuite.exe');
  } else {
    executable = path.join(executable, 'MacOS', 'Red\ Hat\ Development\ Suite\ Installer');
  }
} else {
  //start with login and end with installation page, because of angular synchronization issues
  files = ['test/ui/about-test.js', 'test/ui/login-test.js', 'test/ui/location-test.js', 'test/ui/confirm-test.js', 'test/ui/start-test.js', 'test/ui/install-test.js'];
  report = path.join(__dirname, 'ui-tests');
}

exports.config = {
  directConnect: true,

  specs: files,
  framework: 'jasmine2',

  capabilities: {
    browserName: 'chrome',
    chromeOptions: {
      binary: executable,
      args: chromeArgs
    }
  },

  onPrepare: function() {
    global.rootPath = path.resolve(__dirname);

    var jasmineReporters = require('jasmine-reporters');
    jasmine.getEnv().addReporter(new jasmineReporters.JUnitXmlReporter({
      consolidateAll: true,
      filePrefix: report
    }));
    jasmine.getEnv().addReporter(new ScreenshotReporter(path.join(rootPath, 'screenshots'), true));
  }
}
