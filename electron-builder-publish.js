const config = {
  publish: [
    {
      provider: 'generic',
      url: 'https://sensotrend.warifa.cloud/download/uploader/update/${os}',
      channel: 'latest',
      useMultipleRangeRequest: false
    },
  ],
  productName: 'WARIFA Uploader',
  appId: 'org.sensotrend.WarifaUploader',
  directories: {
    buildResources: 'resources',
    output: 'release'
  },
  afterSign: 'scripts/notarize.js',
  dmg: {
    contents: [
      {
        x: 381,
        y: 190,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 159,
        y: 190,
        type: 'file'
      }
    ],
    background: 'resources/background.tiff'
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true
  },
  files: [
    'dist/',
    'node_modules/',
    'resources/',
    'app.html',
    'about.html',
    'main.prod.js',
    'main.prod.js.map',
    'package.json'
  ],
  extraResources: [
    {
      from: 'resources/${os}',
      to: 'driver/',
      filter: [
        '**/*',
        '!*.md'
      ]
    },
    'sounds/',
    'locales/'
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: [
          'ia32',
          'x64'
        ]
      },
      {
        target: 'zip',
        arch: [
          'ia32',
          'x64'
        ]
      }
    ],
    publisherName: [
      'Sensotrend Oy'
    ],
    /* certificateSubjectName: "CN=Sensotrend Oy, O=Sensotrend Oy, L=Tampere, C=FI, SERIALNUMBER=2606155-7, OID.1.3.6.1.4.1.311.60.2.1.3=FI, OID.2.5.4.15=Private Organization",
    certificateSha1: "EFADADF315F82D5DF7D6F6ABCAB864E5863E19BD", */
    rfc3161TimeStampServer: 'http://timestamp.digicert.com'
  },
  mac: {
    category: 'public.app-category.tools',
    entitlements: 'resources/mac/entitlements.mac.plist',
    entitlementsInherit: 'resources/mac/entitlements.mac.plist',
    target: [
      {
        target: 'zip',
        arch: [
          'x64'
        ]
      },
      {
        target: 'dmg',
        arch: [
          'x64'
        ]
      },
      'dir'
    ]
  },
  protocols: [{
    name: 'Tidepool Uploader',
    schemes: ['tidepooluploader', 'tidepoolupload'],
  }],
};

console.log('CIRCLE_TAG:', process.env.CIRCLE_TAG);
console.log('APPVEYOR_REPO_TAG:', process.env.APPVEYOR_REPO_TAG);

if ( (process.env.CIRCLE_TAG && process.env.CIRCLE_TAG.length > 0) ||
     (process.env.APPVEYOR_REPO_TAG_NAME && process.env.APPVEYOR_REPO_TAG_NAME.length > 0) ) {
  let releaseType = null;

  if ( (process.env.CIRCLE_TAG && process.env.CIRCLE_TAG.indexOf('-') !== -1) ||
       (process.env.APPVEYOR_REPO_TAG_NAME && process.env.APPVEYOR_REPO_TAG_NAME.indexOf('-') !== -1) ) {
    releaseType = 'prerelease';
  } else {
    releaseType = 'release';
  }

  config.publish = [
    {
      provider: 'github',
      owner: 'tidepool-org', // required to overwrite existing binaries
      releaseType: releaseType,
    },
    {
      provider: 's3',
      bucket: 'downloads.tidepool.org',
    },
  ];
}

module.exports = config;
