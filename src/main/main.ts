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
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
const electronDl = require('electron-dl');
const Store = require('electron-store');

const fs = require('fs');
const os = require('os');
require('dotenv').config();

const DEFAULT_OUTDIR = `${os.homedir()}/Desktop/charl-e/samples`;
const CONFIG_DIR = `./stable_diffusion/configs/v1-inference.yaml`;
const store = new Store();
let charle: any = null;
process.env.PYTORCH_ENABLE_MPS_FALLBACK = '1';

export default class AppUpdater {
  constructor() {
    const log = require('electron-log');
    log.transports.file.level = 'debug';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function getLatestImage(filepath: string) {
  if (!fs.existsSync(filepath)) {
    console.log(filepath);
    fs.mkdirSync(filepath, { recursive: true });
  }
  const dirents = fs.readdirSync(filepath, { withFileTypes: true });

  const fileNames = dirents
    .filter((dirent: any) => dirent.isFile())
    .map(function (fileName: any) {
      return {
        name: fileName.name,
        time: fs.statSync(`${filepath}/${fileName.name}`).mtime.getTime(),
      };
    })
    .sort(function (a, b) {
      return a.time - b.time;
    })
    .map((file: any) => file.name);

  return {
    latestImage: `${filepath}/${fileNames.at(-1)}`,
    outDir: filepath,
    allImages: fileNames
      .map((file: string) => `${filepath}/${file}`)
      .filter((file: string) => file.endsWith('.png')),
  };
}

function getPaths(filepath: string) {
  // We're in prod
  if (fs.existsSync(filepath)) {
    return {
      config: `${process.resourcesPath}/stable_diffusion/configs/v1-inference.yaml`,
      executable: filepath,
    };
    // we're in dev
  }
  return {
    config: CONFIG_DIR,
    executable: './stable_diffusion/txt2img',
  };
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

const installWeights = async (mainWindow: BrowserWindow) => {
  if (
    fs.existsSync(
      `${app.getPath('userData')}/stable_diffusion/models/model.ckpt`
    )
  ) {
    console.log('Already downloaded!');
    return;
  }

  await electronDl.download(
    mainWindow,
    'https://charle.s3.amazonaws.com/checkpoint_liberty_with_aug.pth',
    {
      directory: `${os.homedir()}/.cache/torch/hub/checkpoints/`,
      filename: 'checkpoint_liberty_with_aug.pth',
      onCompleted: () => {
        console.log('Download checkpoint complete');
        mainWindow.webContents.send(
          'stdout-message',
          `Download Checkpoint Complete`
        );
      },
    }
  );

  await electronDl.download(
    mainWindow,
    'https://me.cmdr2.org/stable-diffusion-ui/sd-v1-4.ckpt',
    {
      directory: `${app.getPath('userData')}/stable_diffusion/models/`,
      filename: 'model.ckpt',
      onProgress: (progress: any) => {
        console.log(progress);
        mainWindow.webContents.send('download-progress', progress);
        mainWindow.webContents.send(
          'stdout-message',
          `Download weights: ${progress.transferredBytes} / ${progress.totalBytes}`
        );
      },
      onCompleted: (progress: any) => {
        console.log('Download complete');
        mainWindow.webContents.send('download-complete', progress);
      },
    }
  );
};

const objectToList = (args: Object) => {
  if (args['--plms'] == 'off') {
    delete args['--plms'];
  }
  const res: string[] = Object.entries(args)
    .flat()
    .filter((item) => item !== 'on');
  return res;
};

const savePrompt = async ({ prompt, image, command }) => {
  const promptHistory = store.get('prompts') ? store.get('prompts') : [];
  const commandHistory = store.get('commands') ? store.get('commands') : [];
  const imageHistory = store.get('images') ? store.get('images') : [];
  store.set('prompts', [prompt, ...promptHistory]);
  store.set('commands', [command, ...commandHistory]);
  store.set('images', [image, ...imageHistory]);
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

    const currentOptions = store.get('options');

    if (currentOptions == null) {
      console.log('options undefined');
      store.set('options', {
        '--ckpt': `${app.getPath(
          'userData'
        )}/stable_diffusion/models/model.ckpt`,
        '--plms': 'off',
        '--ddim_steps': '5',
        '--n_samples': '1',
        '--outdir': `${os.homedir()}/Desktop/charl-e/samples`,
        '--seed': '42',
      });
    } else {
      mainWindow!.webContents.send('loaded-options', store.get('options'));
    }

    if (
      !fs.existsSync(
        `${app.getPath('userData')}/stable_diffusion/models/model.ckpt`
      )
    ) {
      console.log(`${app.getPath('userData')}`);
      mainWindow!.webContents.send('no-weights', {});
      installWeights(mainWindow!);
    }

    mainWindow!.webContents.send('image-dir', getLatestImage(DEFAULT_OUTDIR));
  });

  ipcMain.on('open-file', (_event, file) => {
    shell.showItemInFolder(file.replace('media-loader:/', ''));
  });

  ipcMain.on('redownload-weights', (_event, _args) => {
    console.log('CALLED');
    if (
      fs.existsSync(
        `${app.getPath('userData')}/stable_diffusion/models/model.ckpt`
      )
    ) {
      fs.unlinkSync(
        `${app.getPath('userData')}/stable_diffusion/models/model.ckpt`
      );
    }
    installWeights(mainWindow!);
  });

  ipcMain.on('save-options', (_event, args) => {
    store.set('options', args);
    mainWindow!.webContents.send(
      'stdout-message',
      `Options Saved: ${JSON.stringify(args)}`
    );

    mainWindow!.webContents.send('loaded-options', store.get('options'));
  });

  ipcMain.on('run-prompt', (_event, { prompt }) => {
    mainWindow!.webContents.send('initializing', true);

    const { config, executable } = getPaths(
      `${process.resourcesPath}/stable_diffusion/txt2img`
    );

    const args = objectToList(store.get('options'));
    const execArgs = ['--prompt', prompt, ...args, '--config', config];

    mainWindow!.webContents.send('stdout-message', `Params: ${execArgs}`);

    const child = require('child_process');
    charle = child.spawn(executable, execArgs, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    charle.stderr.on('data', (data: any) => {
      if (data.toString().includes('Sampler: ')) {
        const pct = data.toString().split(':')[1].split('%')[0].trim();
        mainWindow!.webContents.send('initializing', false);
        mainWindow!.webContents.send('loading-update', pct);
      }
      mainWindow!.webContents.send('stdout-message', data.toString());
    });

    charle.on('close', () => {
      console.log('KILLEd!!! ', charle.killed);
      console.log('stats', charle.exitCode);

      if (charle.killed) {
        mainWindow!.webContents.send('killed', true);
      } else if (charle.exitCode === 1) {
        mainWindow!.webContents.send('error', true);
        mainWindow!.webContents.send('killed', true);
      } else if (charle.exitCode === 0) {
        const outpathLocation = execArgs.findIndex((x) => x == '--outdir');
        const outpath =
          outpathLocation == -1
            ? DEFAULT_OUTDIR
            : execArgs[outpathLocation + 1];
        console.log(
          `Sending ${getLatestImage(outpath).latestImage} to frontend`
        );
        mainWindow!.webContents.send(
          'image-load',
          getLatestImage(outpath).latestImage
        );

        savePrompt({
          prompt: prompt,
          image: getLatestImage(outpath).latestImage,
          command: execArgs,
        });
      } else {
        mainWindow!.webContents.send('error', true);
      }
    });
  });

  ipcMain.on('cancel-run', (_event, _value) => {
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

console.log(app.getPath('userData'));

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
        console.error(err);
        return callback('404');
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
