/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

import os from 'os';
import _ from 'lodash';
import async from 'async';
import util from 'util';
import bows from 'bows';

/* eslint-disable import/no-extraneous-dependencies */
import { getDeviceList, findByIds, webusb } from 'usb';

import debugMode from '../../app/utils/debugMode';
import serialDevice from '../serialDevice';
import hidDevice from '../hidDevice';
import usbDevice from '../usbDevice';
import bleDevice from '../bleDevice';
import driverManager from '../driverManager';
import builder from '../objectBuilder';
import driverManifests from './driverManifests';

import dexcomDriver from '../drivers/dexcom/dexcomDriver';
import oneTouchUltraMini from '../drivers/onetouch/oneTouchUltraMini';
import abbottPrecisionXtra from '../drivers/abbott/abbottPrecisionXtra';
import insuletOmniPod from '../drivers/insulet/insuletDriver';
import oneTouchUltra2 from '../drivers/onetouch/oneTouchUltra2';
import oneTouchVerio from '../drivers/onetouch/oneTouchVerio';
import oneTouchVerioIQ from '../drivers/onetouch/oneTouchVerioIQ';
import oneTouchVerioBLE from '../drivers/onetouch/oneTouchVerioBLE';
import abbottFreeStyleLite from '../drivers/abbott/abbottFreeStyleLite';
import abbottFreeStyleLibre from '../drivers/abbott/abbottFreeStyleLibre';
import abbottFreeStyleNeo from '../drivers/abbott/abbottFreeStyleNeo';
import bayerContourNext from '../drivers/bayer/bayerContourNext';
import bayerContour from '../drivers/bayer/bayerContour';
import animasDriver from '../drivers/animas/animasDriver';
import medtronicDriver from '../drivers/medtronic/medtronicDriver';
import medtronic600Driver from '../drivers/medtronic600/medtronic600Driver';
import TrueMetrixDriver from '../drivers/trividia/trueMetrix';
import accuChekUSBDriver from '../drivers/roche/accuChekUSB';
import accuChekSmartPixDriver from '../drivers/roche/accuChekSmartPix';
import bluetoothLEDriver from '../drivers/bluetoothLE/bluetoothLEDriver';
import careSensDriver from '../drivers/i-sens/careSens';
import WeitaiUSB from '../drivers/weitai/weiTaiUSB';
import glucocardExpression from '../drivers/i-sens/glucocardExpression';
import libreViewDriver from '../drivers/abbott/libreViewDriver';
import reliOnPrime from '../drivers/i-sens/reliOnPrime';
import glucoRxDriver from '../drivers/glucorx/glucoRxDriver';

const device = {
  log: bows('Device'),
};

let tandemDriver;
try {
  // eslint-disable-next-line global-require, import/no-unresolved, import/extensions
  tandemDriver = require('../drivers/tandem/tandemDriver');
} catch (e) {
  device.log('Tandem driver is only available to Tidepool developers.');
}

const hostMap = {
  darwin: 'mac',
  win32: 'win',
  linux: 'linux',
};

device.deviceDrivers = {
  Dexcom: dexcomDriver,
  OneTouchUltraMini: oneTouchUltraMini,
  AbbottPrecisionXtra: abbottPrecisionXtra,
  InsuletOmniPod: insuletOmniPod,
  Tandem: tandemDriver,
  OneTouchUltra2: oneTouchUltra2,
  OneTouchVerio: oneTouchVerio,
  OneTouchVerioIQ: oneTouchVerioIQ,
  OneTouchVerioBLE: oneTouchVerioBLE,
  OneTouchSelect: oneTouchVerio,
  AbbottFreeStyleLite: abbottFreeStyleLite,
  AbbottFreeStyleLibre: abbottFreeStyleLibre,
  AbbottFreeStyleNeo: abbottFreeStyleNeo,
  BayerContourNext: bayerContourNext,
  BayerContour: bayerContour,
  ContourPlus: bayerContourNext,
  Animas: animasDriver,
  Medtronic: medtronicDriver,
  Medtronic600: medtronic600Driver,
  TrueMetrix: TrueMetrixDriver,
  AccuChekUSB: accuChekUSBDriver,
  AccuChekSmartPix: accuChekSmartPixDriver,
  BluetoothLE: bluetoothLEDriver,
  CareSens: careSensDriver,
  Weitai: WeitaiUSB,
  ReliOnPremier: careSensDriver,
  ReliOnPrime: reliOnPrime,
  GlucocardExpression: glucocardExpression,
  GlucocardShine: careSensDriver,
  GlucocardShineHID: careSensDriver,
  GlucocardVital: reliOnPrime,
  AbbottLibreView: libreViewDriver,
  GlucoRx: glucoRxDriver,
  ReliOnPlatinum: accuChekUSBDriver,
};

device.deviceComms = {
  Dexcom: serialDevice,
  OneTouchUltraMini: serialDevice,
  AbbottPrecisionXtra: serialDevice,
  OneTouchUltra2: serialDevice,
  OneTouchVerio: usbDevice,
  OneTouchVerioIQ: serialDevice,
  OneTouchVerioBLE: bleDevice,
  OneTouchSelect: usbDevice,
  AbbottFreeStyleLite: serialDevice,
  AbbottFreeStyleLibre: hidDevice,
  AbbottFreeStyleNeo: hidDevice,
  Tandem: serialDevice,
  BayerContourNext: hidDevice,
  BayerContour: serialDevice,
  ContourPlus: hidDevice,
  Animas: serialDevice,
  Medtronic: hidDevice,
  Medtronic600: hidDevice,
  TrueMetrix: hidDevice,
  AccuChekUSB: usbDevice,
  AccuChekSmartPix: usbDevice,
  BluetoothLE: bleDevice,
  CareSens: hidDevice,
  Weitai: usbDevice,
  ReliOnPremier: serialDevice,
  ReliOnPrime: serialDevice,
  GlucocardExpression: serialDevice,
  GlucocardShine: serialDevice,
  GlucocardShineHID: hidDevice,
  GlucocardVital: serialDevice,
  AbbottLibreView: libreViewDriver,
  GlucoRx: hidDevice,
  ReliOnPlatinum: usbDevice,
};

_.forEach(_.keys(device.deviceComms), (driverId) => {
  const comm = device.deviceComms[driverId];

  if (comm.name !== 'UsbDevice' && comm.name !== 'BLEDevice') {
    // usbDevice and BLEDevice are ES6 classes not handled here
    device.deviceComms[driverId] = comm();
  }
});

// this is a cache for device information
// we need it so that what we learn in detect()
// can be used by process().
device.deviceInfoCache = {};

device.init = (options, cb) => {
  device.defaultTimezone = options.defaultTimezone;
  device.api = options.api;
  device.version = options.version;
  device.groupId = options.targetId;
  device.os = hostMap[os.platform()];
  cb();
};

device.getDriverManifests = () => _.cloneDeep(driverManifests);

device.getDriverIds = () => _.keys(driverManifests);

device.getDriverManifest = (driverId) => {
  const driverManifest = driverManifests[driverId];
  if (!driverManifest) {
    throw new Error(`Could not find driver manifest for ${driverId}`);
  }
  return driverManifest;
};

device.detectHelper = (driverId, options, cb) => {
  const dm = device.createDriverManager(driverId, options);
  if (dm == null) {
    cb(new Error('Driver not available.'));
  } else {
    dm.detect(driverId, cb);
  }
};

device.createDriverManager = (driverId, options) => {
  const drivers = {};
  drivers[driverId] = device.deviceDrivers[driverId];
  const configs = {};
  configs[driverId] = device.createDriverConfig(driverId, options);
  configs.debug = debugMode.isDebug;

  return driverManager(drivers, configs);
};

device.createDriverConfig = (driverId, options = {}) => {
  const timezone = options.timezone || device.defaultTimezone;
  const comms = device.deviceComms;
  const uploadGroup = options.targetId || device.groupId;

  // handle config for block-mode devices, which includes the file name and data
  if (options.filename != null) {
    return {
      filename: options.filename,
      filedata: options.filedata,
      deviceInfo: device.deviceInfoCache[driverId],
      timezone,
      groupId: uploadGroup,
      api: device.api,
      version: options.version,
      builder: builder(),
      progress: options.progress,
      displayTimeModal: options.displayTimeModal,
      displayAdHocModal: options.displayAdHocModal,
    };
  }

  const deviceInfo = device.deviceInfoCache[driverId];

  if (options.serialNumber) {
    _.assign(deviceInfo, { serialNumber: options.serialNumber });
  }

  return {
    deviceInfo,
    deviceComms: comms[driverId],
    timezone,
    groupId: uploadGroup,
    api: device.api,
    version: options.version,
    builder: builder(),
    progress: options.progress,
    displayTimeModal: options.displayTimeModal,
    displayAdHocModal: options.displayAdHocModal,
  };
};

device.findUsbDevice = (driverId, usbDevices) => {
  let userSpaceDriver = null;
  const driverManifest = device.getDriverManifest(driverId);
  const combos = _.map(usbDevices, (i) => _.pick(i, 'product', 'vendorId', 'productId'));

  device.log('Looking for USB PID/VID(s): ', JSON.stringify(driverManifest.usb));
  device.log('Available USB PID/VIDs:', JSON.stringify(combos));

  for (let i = 0; i < driverManifest.usb.length; i++) {
    device.log('USB details for ', JSON.stringify(driverManifest.usb[i]), ':',
      util.inspect(findByIds(
        driverManifest.usb[i].vendorId,
        driverManifest.usb[i].productId,
      )));
  }

  const matchingUsbDevices = _.filter(usbDevices, (matching) => {
    let found = false;
    for (let i = 0; i < driverManifest.usb.length; i++) {
      if (driverManifest.usb[i].vendorId === matching.vendorId
        && driverManifest.usb[i].productId === matching.productId) {
        userSpaceDriver = driverManifest.usb[i].driver;
        found = true;
      }
    }
    return found;
  });

  const devices = _.map(matchingUsbDevices, (result) => ({
    driverId,
    deviceId: result.deviceId,
    vendorId: result.vendorId,
    productId: result.productId,
    userSpaceDriver,
    bitrate: driverManifest.bitrate,
    stopBits: driverManifest.stopBits,
  }));

  if (devices.length > 1) {
    device.log(`WARNING: More than one device found for ${driverId}`);
    device.othersConnected = devices.length - 1;
  }

  return _.first(devices);
};

device.detectUsb = (driverId, cb) => {
  const usbDevices = _.map(getDeviceList(), (result) => ({
    deviceId: result.deviceDescriptor.idDevice,
    vendorId: result.deviceDescriptor.idVendor,
    productId: result.deviceDescriptor.idProduct,
  }));

  return cb(null, device.findUsbDevice(driverId, usbDevices));
};

// eslint-disable-next-line consistent-return
device.detect = (driverId, options, cb) => {
  if (_.isFunction(options)) {
    // eslint-disable-next-line no-param-reassign
    cb = options;
    // eslint-disable-next-line no-param-reassign
    options = { version: device.version };
  }
  const driverManifest = device.getDriverManifest(driverId);

  if (driverManifest.mode === 'block' && driverId === 'AbbottLibreView') {
    return cb();
  }

  if (options.hidDevice) {
    // We've got a Web HID device!
    const devdata = {
      driverId,
      hidDevice: options.hidDevice,
    };

    if ((driverId === 'AbbottFreeStyleLibre')
        && devdata.hidDevice.vendorId === 6753 && devdata.hidDevice.productId === 14672) {
      // This is an attempt to upload a Libre 2, which is not yet supported
      return cb('E_LIBRE2_UNSUPPORTED');
    }

    device.deviceInfoCache[driverId] = _.cloneDeep(devdata);
    device.detectHelper(driverId, options, (err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, devdata);
    });
  } else if (driverManifest.mode === 'usb') {
    const filters = driverManifest.usb.map(({ vendorId, productId }) => ({
      vendorId,
      productId,
    }));
    let webUSBDevice = null;
    let userSpaceDriver = null;
    let devdata = null;

    (async () => {
      const existingPermissions = await webusb.getDevices();

      for (let i = 0; i < existingPermissions.length; i++) {
        for (let j = 0; j < driverManifest.usb.length; j++) {
          if (driverManifest.usb[j].vendorId === existingPermissions[i].vendorId
            && driverManifest.usb[j].productId === existingPermissions[i].productId) {
            device.log('Device has already been granted permission');
            webUSBDevice = existingPermissions[i];
            userSpaceDriver = driverManifest.usb[i].driver;
          }
        }
      }

      devdata = {
        driverId,
        userSpaceDriver,
      };

      if (webUSBDevice == null) {
        webUSBDevice = await webusb.requestDevice({ filters });
      }

      if (webUSBDevice == null) {
        throw new Error('No device was selected.');
      }

      devdata.usbDevice = webUSBDevice;

      device.deviceInfoCache[driverId] = _.cloneDeep(devdata);
      device.detectHelper(driverId, options, (err) => {
        if (err) {
          return cb(err);
        }
        return cb(null, devdata);
      });
    })().catch((error) => {
      if (webUSBDevice == null && (
        driverId === 'InsuletOmniPod' ||
        driverId === 'OneTouchVerio' ||
        driverId === 'OneTouchSelect'
      )) {
        // could also be block mode device
        device.deviceInfoCache[driverId] = _.cloneDeep(devdata);
        device.detectHelper(driverId, options, (err) => {
          if (err) {
            cb(err);
          } else {
            cb(null, devdata);
          }
        });
      } else {
        device.log('WebUSB error:', error);
        cb(error);
      }
    });
  } else if (driverManifest.mode === 'bluetooth') {
    const devdata = {
      id: options.ble.device.id,
      name: options.ble.device.name,
      driverId,
    };
    device.deviceInfoCache[driverId] = _.cloneDeep(devdata);
    if (!device.deviceComms[driverId].ble) {
      device.deviceComms[driverId] = new device.deviceComms[driverId](options);
    }
    device.detectHelper(driverId, options, (err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, devdata);
    });
  } else if (options.port) {
    // we got a Web Serial port!
    const { usbProductId, usbVendorId } = options.port.getInfo();
    const devdata = {
      driverId,
      port: options.port,
      vendorId: usbVendorId,
      productId: usbProductId,
    };

    if (driverManifest.bitrate) {
      devdata.bitrate = driverManifest.bitrate;
    }
    if (driverManifest.ctsFlowControl) {
      devdata.ctsFlowControl = driverManifest.ctsFlowControl;
    }
    if (driverManifest.stopBits) {
      devdata.stopBits = driverManifest.stopBits;
    }
    device.deviceInfoCache[driverId] = _.cloneDeep(devdata);
    device.detectHelper(driverId, options, (err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, devdata);
    });
  } else {
    // no matching devices were found, let's see if they are
    // actually connected via USB
    device.detectUsb(driverId, (error, devdata2) => {
      if (error) {
        return cb(error);
      }
      if (!devdata2) {
        return cb();
      }
      device.deviceInfoCache[driverId] = _.cloneDeep(devdata2);
      // hey, we can see it on the USB bus!
      // let's try the userspace driver if available
      if (devdata2.userSpaceDriver) {
        return device.detectHelper(driverId, options, (error2, userspaceDevice) => {
          if (error2) {
            return cb(error2);
          }
          _.assign(device, userspaceDevice);
          return cb(null, devdata2);
        });
      }
      return cb(null, devdata2);
    });
  }
};

device.detectAll = (cb) => {
  async.map(device.getDriverIds(), device.detect.bind(device), (err, results) => {
    if (err) {
      return cb(err);
    }
    // Filter out any nulls
    const filtered = _.filter(results);
    return cb(null, filtered);
  });
};

device.upload = (driverId, options, cb) => {
  const dm = device.createDriverManager(driverId, options);
  dm.process(driverId, (err, result) => cb(err, result));
};

module.exports = device;
