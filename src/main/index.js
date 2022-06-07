// -*- mode: js-jsx -*-
/* Chrysalis -- Kaleidoscope Command Center
 * Copyright (C) 2018-2022  Keyboardio, Inc.
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { resolveHtmlPath } from './util';

import { app, BrowserWindow, ipcMain } from 'electron';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';
import windowStateKeeper from 'electron-window-state';
import { format as formatUrl } from 'url';
import { Environment } from './dragons';
import { registerBackupHandlers } from './ipc_backups';
import {
  addUsbEventListeners,
  registerDeviceDiscoveryHandlers,
  removeUsbEventListeners,
} from './ipc_device_discovery';
import { registerDevtoolsHandlers } from './ipc_devtools';
import { registerFileIoHandlers } from './ipc_file_io';
import { registerNativeThemeHandlers } from './ipc_nativetheme';
import { registerLoggingHandlers } from './ipc_logging';
import { buildMenu } from './menu';

export default class AppUpdater {
  constructor() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}
const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

// Settings storage
const Store = require('electron-store');
Store.initRenderer();

let mainWindow = null;
export const windows = [];

async function createMainWindow() {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths) => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 900,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    resizable: true,
    icon: getAssetPath('icon.png'),

    autoHideMenuBar: true,
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindowState.manage(mainWindow);
  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.focus();
    setImmediate(() => {
      mainWindow.focus();
    });
  });

  const handleRedirect = (e, url) => {
    if (url != mainWindow.webContents.getURL()) {
      e.preventDefault();
      require('electron').shell.openExternal(url);
    }
  };

  mainWindow.webContents.on('will-navigate', handleRedirect);
  mainWindow.webContents.on('new-window', handleRedirect);

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.send('devtools.opened');
  });

  mainWindow.webContents.on('devtools-closed', () => {
    mainWindow.webContents.send('devtools.closed');
  });

  windows.push(mainWindow);
  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();

}
ipcMain.on('app-exit', (event, arg) => {
  app.quit();
});

// This is a workaround for the lack of context-awareness in two native modules
// we use, serialport (serialport/node-serialport#2051) and usb
// (tessel/node-usb#380). See electron/electron#18397 for more context.
//app.allowRendererProcessReuse = true;

/**
 *
 * Allow remote debugging & set debug parameters on child renderer process.
 * @see: https://github.com/electron-userland/electron-webpack/issues/76#issuecomment-392201080
 *
 * 1. Define an explicit debugger port
 * 2. Create a new Chrome user so that we don't conflict with browser
 *    sessions. (@see: https://github.com/microsoft/vscode-chrome-debug#chrome-user-profile-note-cannot-connect-to-the-target-connect-econnrefused)
 */
if (isDevelopment && process.env.ELECTRON_WEBPACK_APP_DEBUG_PORT) {
  app.commandLine.appendSwitch(
    'remote-debugging-port',
    process.env.ELECTRON_WEBPACK_APP_DEBUG_PORT
  ); /* 1 */
  app.commandLine.appendSwitch('userDataDir', true); /* 2 */
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  removeUsbEventListeners();

  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    createMainWindow();
  }
});

// create main BrowserWindow when electron is ready
app.whenReady().then(async () => {
  addUsbEventListeners();
  if (isDevelopment) {
    await installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
  }

  createMainWindow();
  buildMenu();
});

app.on('web-contents-created', (_, wc) => {
  wc.on('before-input-event', (_, input) => {
    if (input.type == 'keyDown' && input.control) {
      if (input.shift && input.code == 'KeyI') {
        wc.openDevTools();
      }
      if (input.code == 'KeyR') {
        wc.reload();
      }
      if (input.code == 'KeyQ') {
        app.quit();
      }
    }
  });
});

process.on('uncaughtException', function (error) {
  console.log(error); // Handle the error
});

registerDeviceDiscoveryHandlers();
registerFileIoHandlers();
registerDevtoolsHandlers();
registerBackupHandlers();
registerNativeThemeHandlers();
registerLoggingHandlers();
