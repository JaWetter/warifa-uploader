/*
* == BSD2 LICENSE ==
* Copyright (c) 2016, Tidepool Project
*
* This program is free software; you can redistribute it and/or modify it under
* the terms of the associated License, which is identical to the BSD 2-Clause
* License as published by the Open Source Initiative at opensource.org.
*
* This program is distributed in the hope that it will be useful, but WITHOUT
* ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
* FOR A PARTICULAR PURPOSE. See the License for more details.
*
* You should have received a copy of the License along with this program; if
* not, you can obtain one from Tidepool Project at tidepool.org.
* == BSD2 LICENSE ==
*/

import PropTypes from 'prop-types';

import React, { Component } from 'react';
import { BrowserWindow, shell } from 'electron';
import path from 'path';

import styles from '../../styles/components/Footer.module.less';
import logo from '../../images/JDRF_Reverse_Logo x2.png';
import debugMode from '../utils/debugMode';
import { getOSDetails } from '../actions/utils';
const remote = require('@electron/remote');
const { getCurrentWindow } = remote;
const i18n = remote.getGlobal( 'i18n' );


let aboutWindow = null;
function aboutDialog() {
  if (aboutWindow !== null) {
    aboutWindow.show();
    return;
  }

  aboutWindow = new remote.BrowserWindow({
    width: 600,
    height: 600,
    minWidth: 400,
    minHeight: 400,
    useContentSize: true,
    center: true,
    titleBarStyle: 'hidden-inset',
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
    },
    skipTaskbar: true,
    // devTools: false,
    // modal: true,
    show: false
  });
  aboutWindow.loadURL('file://'+ path.join(__dirname + '/../about.html')).catch((reason) => {
    console.log(reason);
  });
  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });
  aboutWindow.once('closed', () => {
    aboutWindow = null;
  });
  aboutWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    shell.openExternal(url).catch((reason) => {
      console.log('Could not open external: ' + reason);
    });
  });
  aboutWindow.setMenu(null);
}

function instructionClick() {
  console.log(`${__dirname}/../about.html`);
  const win = new remote.BrowserWindow({ width: 800, height: 600, frame:false, titleBarStyle: 'hidden', titleBarOverlay: true });
  win.loadURL('https://www.sensotrend.fi/connect/instructions/uploader');
}
function privacyClick() {
  const win = new remote.BrowserWindow({ width: 800, height: 600, frame:false, titleBarStyle: 'hidden', titleBarOverlay: true });
  win.loadURL('https://www.sensotrend.fi/connect/privacy/');
}
function eulaClick() {
  const win = new remote.BrowserWindow({ width: 800, height: 600, frame:false, titleBarStyle: 'hidden', titleBarOverlay: true });
  win.loadURL('https://www.sensotrend.fi/connect/eula/');
}

function finnishClick() {
  i18n.changeLanguage('fi')
            .then((t) => {
              console.log('New language', i18n.language, t('Done'));
              getCurrentWindow().reload();              
            })
            .catch(console.error);
}
function swedishClick() {
  i18n.changeLanguage('sv')
            .then((t) => {
              console.log('New language', i18n.language, t('Done'));
              getCurrentWindow().reload();              
            })
            .catch(console.error);
}

export default class Footer extends Component {
  static propTypes = {
    version: PropTypes.string.isRequired,
  };

  render() {
    const version = this.props.version;
    let osArch = '';
    let environment = '';

    if (debugMode.isDebug) {
      osArch = ` (${getOSDetails()})`;
      environment = `  - ${this.props.environment}`;
    }

    return (
      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <div className={styles.el1}>
            <a className={styles.footerLink} href="#" onClick={instructionClick}>{i18n.t('Get Support')}</a>
          </div>
          <div className={styles.el2}>
            <a className={styles.footerLink} href="#" onClick={privacyClick}>{i18n.t('Privacy')}</a>
          </div>
          <div className={styles.el3}>
            <a className={styles.footerLink} href="#" onClick={eulaClick}>{i18n.t('Terms of Use')}</a>
          </div>
          <div className={styles.el3}>
            <a className={styles.footerLink} href="#" onClick={aboutDialog}>{i18n.t('About')}</a>
          </div>
          <div className={styles.el3}>
            <a className={i18n.language === 'fi' ? styles.activeLng : styles.inactiveLng} href="#" onClick={finnishClick}>🇫🇮</a>
          </div>
          <div className={styles.el3}>
            <a className={i18n.language === 'sv' ? styles.activeLng : styles.inactiveLng} href="#" onClick={swedishClick}>🇸🇪</a>
          </div>
          {/*
          <div className={styles.jdrfContainer}>
            <span className={styles.jdrfText}>{i18n.t('Made possible by')}</span><img className={styles.jdrfImage} src={logo}/>
          </div>
          */}
        </div>
        <div className={styles.footerRow}>
          <div className={styles.version}>{`v${version}${osArch}${environment}`}</div>
        </div>
      </div>
    );
  }
}
