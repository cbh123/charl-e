/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const fs = require('fs');
const os = require('os');
require('update-electron-app')();

const DEFAULT_OUTDIR = `${os.homedir()}/Desktop/charl-e/samples`;
const MODEL_DIR = `${os.homedir()}/Desktop/charl-e/models/model.ckpt`;
const CONFIG_DIR = `./stable_diffusion/configs/v1-inference.yaml`;
let charle = null;
process.env.PYTORCH_ENABLE_MPS_FALLBACK = 1;
process.env.INCLUDE_WEIGHTS = false;

function getLatestImage(filepath: string) {
  if (!fs.existsSync(filepath)) {
    console.log(filepath);
    fs.mkdirSync(filepath, { recursive: true });
  }

  const dirents = fs.readdirSync(filepath, { withFileTypes: true });

  const fileNames = dirents
    .filter((dirent) => dirent.isFile())
    .map(function (fileName) {
      return {
        name: fileName.name,
        time: fs.statSync(`${filepath}/${fileName.name}`).mtime.getTime(),
      };
    })
    .sort(function (a, b) {
      return a.time - b.time;
    })
    .map((file) => file.name);

  return {
    latestImage: `${filepath}/${fileNames.at(-1)}`,
    outDir: filepath,
    allImages: fileNames
      .map((file) => `${filepath}/${file}`)
      .filter((file) => file.endsWith('.png')),
  };
}

function getPaths(filepath: string) {
  // We're in prod
  if (fs.existsSync(filepath)) {
    return {
      config: `${process.resourcesPath}/stable_diffusion/configs/v1-inference.yaml`,
      executable: filepath,
      // the following depends on if we're in with weights or not weights mode!
      weights: fs.existsSync(
        `${process.resourcesPath}/stable_diffusion/models/model.ckpt`
      )
        ? `${process.resourcesPath}/stable_diffusion/models/model.ckpt`
        : MODEL_DIR,
    };
    // we're in dev
  }
  return {
    config: CONFIG_DIR,
    executable: './stable_diffusion/txt2img',
    weights: MODEL_DIR,
  };
}

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
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

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('painting.icns'),
    webPreferences: {
      sandbox: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    // If we want to load recent images on load
    // mainWindow.webContents.send("image-load", getLatestImage(DEFAULT_OUTDIR));

    const obj = {
      ...getLatestImage(DEFAULT_OUTDIR),
      ...getPaths(`${process.resourcesPath}/stable_diffusion/txt2img`),
    };

    mainWindow.webContents.send('default-outdir', {
      ...getLatestImage(DEFAULT_OUTDIR),
      ...getPaths(`${process.resourcesPath}/stable_diffusion/txt2img`),
    });

    if (
      !fs.existsSync(
        `${process.resourcesPath}/stable_diffusion/models/model.ckpt`
      ) ||
      !fs.existsSync(MODEL_DIR)
    ) {
      mainWindow.webContents.send('no-weights', {});
    }
  });

  ipcMain.on('open-file', (event, file) => {
    shell.showItemInFolder(file.replace('media-loader:/', ''));
  });

  ipcMain.on('run-prompt', (event, { prompt, args }) => {
    console.log('PROMPT: ', prompt);
    console.log('ARGS: ', args);

    mainWindow.webContents.send('initializing', true);

    const { config, executable, weights } = getPaths(
      `${process.resourcesPath}/stable_diffusion/txt2img`
    );
    const execArgs = ['--prompt', prompt, ...args, '--config', config];

    console.log(execArgs);
    const child = require('child_process');
    charle = child.spawn(executable, execArgs, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    charle.stderr.on('data', (data) => {
      if (data.toString().includes('Sampler: ')) {
        const pct = data.toString().split(':')[1].split('%')[0].trim();
        mainWindow.webContents.send('initializing', false);
        mainWindow.webContents.send('loading-update', pct);
      }
      console.log(data.toString());

      mainWindow.webContents.send('stdout-message', data.toString());
    });

    charle.on('close', () => {
      console.log('KILLEd!!! ', charle.killed);

      if (!charle.killed) {
        const outpathLocation = execArgs.findIndex((x) => x == '--outdir');
        const outpath =
          outpathLocation == -1
            ? DEFAULT_OUTDIR
            : execArgs[outpathLocation + 1];
        console.log(
          `Sending ${getLatestImage(outpath).latestImage} to frontend`
        );
        mainWindow.webContents.send(
          'image-load',
          getLatestImage(outpath).latestImage
        ); // Send the data to the render thread
      } else {
        mainWindow.webContents.send('killed', true);
      }
    });
  });

  ipcMain.on('cancel-run', (event, value) => {
    charle.kill();
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // Custom protocol
    protocol.registerFileProtocol('media-loader', (request, callback) => {
      const url = request.url.replace('media-loader://', '');
      try {
        return callback(url);
      } catch (err) {
        console.error(error);
        return callback(404);
      }
    });

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
