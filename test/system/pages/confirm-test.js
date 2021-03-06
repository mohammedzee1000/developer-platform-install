'use strict';

const pageIndex = 2;
const name = 'Confirm Page';

let expectedComponents, reqs;
let nextButton, backButton;

function setup(common = require('./common')) {
  expectedComponents = common.expectedComponents,
  reqs = common.reqs;

  nextButton = element(By.id('confirm-install-btn'));
  backButton = element(By.id('confirm-back-btn'));
  browser.wait(protractor.ExpectedConditions.elementToBeClickable(backButton), 60000);

  for (var key in reqs) {
    reqs[key].installedNote = element(By.id(key + '-installed-note'));
    reqs[key].panel = element(By.id(key + '-panel-heading'));
    reqs[key].checkbox = element(By.id(key + '-checkbox'));
    reqs[key].newerWarning = element(By.id(key + '-newer-warning'));
    reqs[key].olderWarning = element(By.id(key + '-older-warning'));
  }
}

function testPage(common = require('./common')) {
  if (common.detectComponents) {
    it('should properly detect the installed components', function() {
      for (var key in reqs) {
        if (expectedComponents[key] && expectedComponents[key].installedVersion) {
          expect(reqs[key].installedNote.isDisplayed()).toBe(true);
          expect(reqs[key].panel.getAttribute('class')).toMatch('dotted-panel');
          expect(reqs[key].installedNote.getText()).toMatch(expectedComponents[key].installedVersion);
        }
      }
    });

    it('should not affect the undetected components', function() {
      for (var key in reqs) {
        if (expectedComponents[key] && !expectedComponents[key].installedVersion) {
          expect(reqs[key].installedNote.isDisplayed()).toBe(false);
          expect(reqs[key].panel.getAttribute('class')).not.toMatch('dotted-panel');
        }
      }
    });

    it('should allow reinstallation of non-msi software', function() {
      for (var key in expectedComponents) {
        if (expectedComponents[key].installedVersion && !(key === 'virtualbox' || key === 'jdk' || key === 'hyperv')) {
          expect(reqs[key].checkbox.isEnabled()).toBe(true);
        }
      }
    });

    it('should not allow reinstallation of msi packages', function() {
      for (var key in expectedComponents) {
        if (expectedComponents[key].installedVersion && (key === 'virtualbox' || key === 'jdk' || key === 'hyperv')) {
          expect(reqs[key].checkbox.isEnabled()).toBe(false);
        }
      }
    });

    it('should display a warning when a component is newer than recommended', function() {
      for (var key in expectedComponents) {
        if (reqs[key].newerWarning && expectedComponents[key].installedVersion > expectedComponents[key].recommendedVersion) {
          expect(reqs[key].newerWarning.isDisplayed()).toBe(true);
        }
      }
    });

    it('should display a warning when a component is older than recommended', function() {
      for (var key in expectedComponents) {
        if (expectedComponents[key].recommendedVersion) {
          let recommended = expectedComponents[key].recommendedVersion.match(/\d+\.\d+\.\d+/)[0];
          if (reqs[key].newerWarning && expectedComponents[key].installedVersion < recommended) {
            common.error = true;
            expect(reqs[key].olderWarning.isDisplayed()).toBe(true);
          }
        }
      }
    });
  }

  it('should not allow to continue if an error is present', function() {
    if (common.error) {
      expect(nextButton.isEnabled()).toBe(false);
    }
  });

  it('should confirm the installation with no errors', function() {
    if (!common.error) {
      let promises = [];
      for (let key in reqs) {
        promises.push(reqs[key].checkbox.isSelected().then((value) => {
          if (value) {
            common.progressBars[key] = 'install';
          }
        }));
      }
      Promise.all(promises).then(() => {
        nextButton.click();
      });
    }
  });
}


module.exports = {
  'name': name,
  'pageIndex': pageIndex,
  'setup': setup,
  'testPage': testPage
};
