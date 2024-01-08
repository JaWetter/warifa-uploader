/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014-2016, Tidepool Project
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

import _ from 'lodash';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ipcRenderer } from 'electron';
import { Route, Switch } from 'react-router-dom';
import bows from 'bows';
// import dns from 'dns';

import i18nextOptions from '../utils/config.i18next';
import localeNames from '../utils/locales.json';

import config from '../../lib/config.js';
import api from '../../lib/core/api';

import device from '../../lib/core/device.js';
import localStore from '../../lib/core/localStore.js';

import actions from '../actions/';

import { urls, pagesMap, paths } from '../constants/otherConstants';
import { checkVersion } from '../utils/drivers';
import debugMode from '../utils/debugMode';

import MainPage from './MainPage';
import Login from '../components/Login';
import Loading from '../components/Loading';
import SettingsPage from './SettingsPage';
import ClinicUserSelectPage from './ClinicUserSelectPage';
import ClinicUserEditPage from './ClinicUserEditPage';
import NoUploadTargetsPage from './NoUploadTargetsPage';
import WorkspacePage from './WorkspacePage';
import UpdatePlease from '../components/UpdatePlease';
import VersionCheckError from '../components/VersionCheckError';
import Footer from '../components/Footer';
import Header from '../components/Header';
import UpdateModal from '../components/UpdateModal';
import UpdateDriverModal from '../components/UpdateDriverModal';
import DeviceTimeModal from '../components/DeviceTimeModal';
import AdHocModal from '../components/AdHocModal';
import BluetoothModal from '../components/BluetoothModal';
import LoggedOut from '../components/LoggedOut.js';

import styles from '../../styles/components/App.module.less';

const asyncActions = actions.async;
const syncActions = actions.sync;

const remote = require('@electron/remote');
const { getCurrentWindow, Menu } = remote;
const i18n = remote.getGlobal( 'i18n' );


const serverdata = {
  Local: {
    API_URL: 'http://localhost:1300/tpapi',
    UPLOAD_URL: 'http://localhost:1300/tpupload',
    DATA_URL: 'http://localhost:1300/tpdata',
    BLIP_URL: 'https://localhost:8443/api'
  },
  Development: {
    API_URL: 'https://dev-connect.sensotrend.fi/tpapi',
    UPLOAD_URL: 'https://dev-connect.sensotrend.fi/tpupload',
    DATA_URL: 'https://dev-connect.sensotrend.fi/tpdata',
    BLIP_URL: 'https://dev.sensotrend.fi/api'
  },
  Staging: {
    API_URL: 'https://test-connect.sensotrend.fi/tpapi',
    UPLOAD_URL: 'https://test-connect.sensotrend.fi/tpupload',
    DATA_URL: 'https://test-connect.sensotrend.fi/tpdata',
    BLIP_URL: 'https://test.sensotrend.fi/api'
  },
  Integration: {
    API_URL: 'https://test-connect.sensotrend.fi/tpapi',
    UPLOAD_URL: 'https://test-connect.sensotrend.fi/tpupload',
    DATA_URL: 'https://test-connect.sensotrend.fi/tpdata',
    BLIP_URL: 'https://test.sensotrend.fi/api'
  },
  Production: {
    API_URL: 'https://connect.sensotrend.fi/tpapi',
    UPLOAD_URL: 'https://connect.sensotrend.fi/tpupload',
    DATA_URL: 'https://connect.sensotrend.fi/tpdata',
    BLIP_URL: 'https://www.sensotrend.fi/api'
  }
};


const availableLanguages = i18nextOptions.supportedLngs;

export class App extends Component {
  static propTypes = {
    route: PropTypes.shape({
      api: PropTypes.func.isRequired
    }).isRequired
  };

  constructor(props) {
    super(props);
    this.log = bows('App');
    let initial_server = _.findKey(serverdata, (key) => key.BLIP_URL === config.BLIP_URL);
    const selectedEnv = localStore.getItem('selectedEnv');
    if (selectedEnv) {
      let parsedEnv = JSON.parse(selectedEnv);
      console.log('setting initial server from localstore:', parsedEnv.environment);
      api.setHosts(parsedEnv);
      initial_server = parsedEnv.environment;
    }
    this.state = {
      server: initial_server
    };
  }

  UNSAFE_componentWillMount(){
    checkVersion(this.props.dispatch);
    const selectedEnv = localStore.getItem('selectedEnv')
      ? JSON.parse(localStore.getItem('selectedEnv'))
      : null;

    this.props.async.fetchInfo(() => {
      this.props.async.doAppInit(
        _.assign({ environment: this.state.server }, config, selectedEnv),
        {
          api: api,
          device,
          log: this.log,
        }
      );
    });

    /*
    dns.resolveSrv('environments-srv.tidepool.org', (err, servers) => {
      if (err) {
        this.log(`DNS resolver error: ${err}. Retrying...`);
        dns.resolveSrv('environments-srv.tidepool.org', (err2, servers2) => {
          if (!err2) {
           this.addServers(servers2);
          }
        });
      } else {
        this.addServers(servers);
      }
    });
    */

    window.addEventListener('contextmenu', this.handleContextMenu, false);
  }

  componentWillUnmount(){
    window.removeEventListener('contextmenu', this.handleContextMenu, false);
  }

  addServers = (servers) => {
    if (servers && servers.length && servers.length > 0) {
      for (let server of servers) {
        const protocol = server.name === 'localhost' ? 'http://' : 'https://';
        const url = `${protocol}${server.name}:${server.port}`;
        serverdata[server.name] = {
          API_URL: url,
          UPLOAD_URL: url,
          DATA_URL: `${url}/dataservices`,
          BLIP_URL: url,
        };
      }
    } else {
      this.log('No servers found');
    }
  };

  setServer = info => {
    console.log('will use', info.label, 'server');
    this.setState({ server: info.label }, ()=> {
      const { sync, async } = this.props;
      var serverinfo = serverdata[info.label];
      serverinfo.environment = info.label;
      api.setHosts(serverinfo);
      localStore.setItem('selectedEnv', JSON.stringify(serverinfo));

      sync.keycloakReset();
      sync.setForgotPasswordUrl(api.makeBlipUrl(paths.FORGOT_PASSWORD));
      sync.setSignUpUrl(api.makeBlipUrl(paths.SIGNUP));
      sync.setNewPatientUrl(api.makeBlipUrl(paths.NEW_PATIENT));
      sync.setBlipUrl(api.makeBlipUrl('/'));
      async.fetchInfo((err, configInfo) => {
        if (err) {
          this.log(`Error getting server info: ${err}`);
        } else {
          if (_.get(configInfo, 'auth')) {
            ipcRenderer.send('keycloakInfo', configInfo.auth);
          }

          serverinfo.keycloakUrl = _.get(configInfo, 'auth.url', null);
          serverinfo.keycloakRealm = _.get(configInfo, 'auth.realm', null);
          localStore.setItem('selectedEnv', JSON.stringify(serverinfo));
        }
      });
    });
  };

  render() {
    return (
      <div className={styles.app} onClick={this.handleDismissDropdown}>
        <Header location={this.props.location} />
        <Switch>
          <Route exact strict path="/" component={Loading} />
          <Route path="/login" component={Login} />
          <Route path="/main" component={MainPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/clinic_user_select" component={ClinicUserSelectPage} />
          <Route path="/clinic_user_edit" component={ClinicUserEditPage} />
          <Route path="/no_upload_targets" component={NoUploadTargetsPage} />
          <Route path="/workspace_switch" component={WorkspacePage} />
          <Route path="/logged_out" component={LoggedOut} />
        </Switch>
        <Footer version={config.version} environment={this.state.server} />
        {/* VersionCheck as overlay */}
        {this.renderVersionCheck()}
        <UpdateModal />
        <UpdateDriverModal />
        <DeviceTimeModal />
        <AdHocModal />
        <BluetoothModal />
      </div>
    );
  }

/*   handleContextMenu = e => {
    e.preventDefault();
    const { clientX, clientY } = e;
    let template = [];
    if (process.env.NODE_ENV === 'development') {
      template.push({
        label: 'Inspect element',
        click() {
          remote.getCurrentWindow().inspectElement(clientX, clientY);
        }
      });
      template.push({
        type: 'separator'
      });
    }
    if (this.props.location.pathname === pagesMap.LOGIN) {
      const submenus = [];
      for (let server of _.keys(serverdata)) {
        submenus.push({
          label: server,
          click: this.setServer,
          type: 'radio',
          checked: this.state.server === server
        });
      }
      template.push({
        label: 'Change server',
        submenu: submenus,
      });
      template.push({
        label: 'Toggle Debug Mode',
        type: 'checkbox',
        checked: debugMode.isDebug,
        click() {
          debugMode.setDebug(!debugMode.isDebug);
        }
      });
    }
    if (availableLanguages.length > 0) {
      // Build the language submenu
      template.push({
        label: 'Change language',
        submenu: availableLanguages.map(locale => ({
          label: `${localeNames[locale]} (${locale})`,
          click() {
            i18n.changeLanguage(locale)
            .then((t) => {
              console.log('New language', i18n.language, t('Done'));
              getCurrentWindow().reload();              
            })
            .catch(console.error);
          },
          type: 'radio',
          checked: i18n.language === locale
        }))
      });
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup(remote.getCurrentWindow());
  }; */

  handleDismissDropdown = () => {
    const { dropdown } = this.props;
    // only toggle the dropdown by clicking elsewhere if it's open
    if (dropdown === true) {
      this.props.sync.toggleDropdown(dropdown);
    }
  };

  renderVersionCheck() {
    const { readyToRenderVersionCheckOverlay, unsupported } = this.props;
    if (readyToRenderVersionCheckOverlay === false || unsupported === false) {
      return null;
    }
    if (unsupported instanceof Error) {
      return (
        <VersionCheckError errorMessage={unsupported.message || 'Unknown error'}/>
      );
    }
    if (unsupported === true) {
      return (
        <UpdatePlease knowledgeBaseLink={urls.HOW_TO_UPDATE_KB_ARTICLE} />
      );
    }
  }
}

App.propTypes = {};

export default connect(
  (state, ownProps) => {
    return {
      // plain state
      dropdown: state.dropdown,
      unsupported: state.unsupported,
      // derived state
      readyToRenderVersionCheckOverlay: (
        !(state.working.initializingApp.inProgress || state.working.checkingVersion.inProgress)
      )
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch),
      dispatch: dispatch
    };
  }
)(App);
