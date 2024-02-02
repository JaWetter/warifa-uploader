import _ from 'lodash';
import React, { Fragment } from 'react';
import { render } from 'react-dom';
import BuildTime from './BuildTime';

import { remote } from 'electron';
const i18n = remote.getGlobal( 'i18n' );


import config from '../lib/config';
window.DEBUG = config.DEBUG;

import './app.global.css';
import '../styles/main.less';
const fs = require('fs');

const PKG = 'app/package.json';
const LICENSE = 'LICENSE';
//Closing the about page using'ESC' key
let _isEscDown = false;
function isEsc(event) {
  return event.code === 'Escape' && !(event.isComposing || event.altKey || event.ctrlKey || event.shiftKey);
}
document.onkeydown = function (event) {
  _isEscDown = isEsc(event);
};
document.onkeyup = function (event) {
  if (_isEscDown && isEsc(event)) {
    window.close();
  } else {
    _isEscDown = false;
  }
};
//parsing the package.json file
const pkg = JSON.parse((fs.readFileSync(PKG)));


function toggleLicense() {
  const license = document.querySelector('#license');
  const main = document.querySelector('#main');
  if (license.classList.contains('top')) {
    license.classList.remove('top');
    license.querySelector('button').textContent = i18n.t('Show license');
    license.setAttribute('aria-hidden', 'true');
    main.setAttribute('aria-hidden', 'false');
  } else {
    license.classList.add('top');
    license.querySelector('button').textContent = i18n.t('Hide license');
    license.setAttribute('aria-hidden', 'false');
    main.setAttribute('aria-hidden', 'true');
  }
}

const licenseFile = fs.readFileSync(LICENSE).toString();
pkg['licenseFile'] = licenseFile;

const copyrights = [];
for (const line of licenseFile.split('\n')) {
    if (line.startsWith('Copyright (c) ')) {
        copyrights.push(line.replace('Copyright (c)', '\u00a9'));
    } else {
        break;
    }
}

render(
  <div id='about-dialog'>
    <header>
      <img alt="" height="35" src="resources/sensotrend.svg"></img>
    </header>
    <article id="main" aria-hidden="false">
    <h2>{pkg.description} <small>v{pkg.version}</small></h2>
    <section id="ce">
      <img alt="CE" src="resources/ce.svg" />
      <p>{i18n.t('Sensotrend Uploader is a class I medical device.')}</p>
      <p>{i18n.t('See')} <a
        href="https://www.sensotrend.fi/connect/static/media/DECO-T5-DC-MDD_EU_Declaration_of_Conformity_-_Sensotrend_Uploader_-_signed.17445413.pdf">{i18n.t('Declaration of Conformity')}</a>.</p>
    </section>
    <section id="device">
      <img alt={i18n.t('Unique Device Identification')} title={i18n.t('Unique Device Identification')} src="resources/udi.png" />
      <p>UDI-DI: D-FIMF000000500SU000001QT</p>
    </section>
    <section id="date">
      <img alt={i18n.t('Manufacturing date')} title={i18n.t('Manufacturing date')} src="resources/manufacturingDate.png" />
      {BuildTime}
    </section>
    <section id="manufacturer">
      <img alt={i18n.t('Manufacturer')} title={i18n.t('Manufacturer')} src="resources/manufacturer.png" />
      <address>Sensotrend Oy<br />
        Tampellan esplanadi 19 A 55<br />
        33180 Tampere{i18n.t(', Finland')}<br />
        <a href={i18n.t('mailto:support@sensotrend.com')}>{i18n.t('support@sensotrend.com')}</a>
      </address>
    </section>
    <section id="instructions">
      <img alt={i18n.t('Consult instructions for use')} title={i18n.t('Consult instructions for use')} src="resources/e-instruction.png" />
      <p><a href={i18n.t('https://www.sensotrend.fi/connect/instructions/uploaders/?l=en')}>{i18n.t('Instructions for use in electronic form')}</a></p>
      <br/>
      <p>{i18n.t('This instruction for use is supplied in electronic form only. You can request a paper version from ')}<a href={i18n.t('mailto:support@sensotrend.com')}>{i18n.t('support@sensotrend.com')}</a>. {i18n.t('The paper version will be delivered within 7 calendar days of receiving the request.')}</p>
    </section>
    <section id="info">
      <img alt={i18n.t('Additional info')} title={i18n.t('Additional info')} src="resources/website.png" />
      <p><a href={i18n.t('https://www.sensotrend.com/uploader.html')}>{i18n.t('https://www.sensotrend.com/uploader.html')}</a></p>
    </section>
    <section id="credits">
      <h4>{i18n.t('Based on')}<a href="https://www.tidepool.org/download#tidepool-uploader">{i18n.t('Tidepool Universal Uploader')}</a>.</h4>
      <p className='copyrights'>{copyrights}
        <br />{i18n.t('Shared using')} {pkg.license} {i18n.t('license')}
      </p>
    </section>
    </article>
    <aside id="license" aria-hidden="true">
    <button type="button" onClick={toggleLicense}>{i18n.t('Show license')}</button>
    <pre>${licenseFile}</pre>
  </aside>

  </div>,
  document.getElementById('about-page')
);
