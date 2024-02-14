#!/usr/bin/env node
/* eslint-disable quotes */
const fs = require('fs');
const electron = require('electron');
const i18n = require('i18next');
const i18nextBackend = require('i18next-fs-backend');
const i18nextOptions = require('./utils/config.i18next');
console.log(electron);

const PKG = 'app/package.json';
const SRC = 'scripts/about.html';
const DST = 'app/about';
const LICENSE = 'LICENSE';

const SOURCES = [PKG, SRC, DST, LICENSE];
const LANGUAGES= ['fi', 'sv', 'en'];


function pad(number) {
    return `${number < 10 ? 0 : ''}${number}`;
}

async function makeAbout(language) {
    console.log(`Updating ${DST + '-' + language + '.html'}`);
    await i18n.changeLanguage(language);
    console.log(i18n.language);
    const pkg = JSON.parse(fs.readFileSync(PKG).toString());
    const template = fs.readFileSync(SRC).toString()
      .replace('Warifa Uploader is a class I medical device.', i18n.t('Warifa Uploader is a class I medical device.'));
    const licenseFile = fs.readFileSync(LICENSE).toString()
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;');
    pkg[':licenseFile'] = licenseFile;

    const copyrights = [];
    for (const line of licenseFile.split('\n')) {
        if (line.startsWith('Copyright (c) ')) {
            copyrights.push(line.replace('Copyright (c)', '&copy;'));
        } else {
            break;
        }
    }
    pkg[':copyrights'] = copyrights.join('<br/>\n');

    const now = new Date();
    pkg[':date'] = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const sub = new RegExp('\\${([^}]+)}', 'g');

    const result = template.replace(sub, function (str, g1) {
        return pkg[g1] || '';
    });

    fs.writeFileSync(DST + '-' + language + '.html', result);
}

function main() {
  for (const l of LANGUAGES){
    let dStat;
    try {
        dStat = fs.statSync(DST + '-' + l + '.html');
    } catch (ignored) {
        dStat = null;
    }

    if (dStat === null) {
        makeAbout(l);
    } else {
        for (const s of SOURCES) {
            if (fs.statSync(s).mtimeMs > dStat.mtimeMs) {
                makeAbout(l);
                break;
            }
        }
    }
  }
}
if (!i18n.Initialize) {
    i18n.use(i18nextBackend).init(i18nextOptions, function(err, t) {
      if (err) {
        console.log('An error occurred in i18next:', err);
      }

      
      main();
    });
  }

