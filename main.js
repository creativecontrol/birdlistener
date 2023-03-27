/**
 * ElectronJS main function for birdListener
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mm = require('@magenta/music/node/core');
const fs = require('fs');
const { fork } = require('child_process');


let settings; 
let userData = app.getPath('userData');
let settingsPath = path.join(userData, 'settings.json')
let musicPath = app.getPath('music');
const transcriptionPath = path.join(musicPath,'bird-transcriptions/');

let birds;

function createBirds() {
  birds = fork(path.join(__dirname, 'birds.js'), {
    stdio: ['ipc'],
  });

  ipcMain.on('bird-control', birdControl);
  ipcMain.on('bird-range', birdRange);
  
  // birds.on('close', (code) => {
  //   console.debug(`child process exited with code ${code}`);
  // });
  
  // birds.on('exit', () => {
  //   console.debug('I am an ex-parrot');
  // });
}

function storeTranscription (event, transcription) {
    let midi = mm.sequenceProtoToMidi(transcription);
    console.debug('storing transcription', midi);

    let data = Buffer.from(midi);

    if (!fs.existsSync(transcriptionPath)) {
        fs.mkdir(transcriptionPath, (err) => {
            console.error(err);
        });
    }

    const time = Date.now();
    fs.writeFile(`${transcriptionPath}transcription_${time}.mid`, data, (err) => {
        if (err) return console.error(err);
    });
}

function storeSettings (settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
}

function loadSettings (event) {
  let settings; 
  
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, {encoding: "utf8"}));
    // console.debug('loaded settings', settings);

    if (birds) {
      if (birds.connected) {
        birds.send({type: 'settings', data: settings});
      } else {
        console.error('birds not connected')
      }
    }

    return settings;
  } catch (error) {
    console.error('error loading settings file', error);

  }
}

function updateSettings (event, _settings) {
  console.debug('updating settings', _settings);
  settings = JSON.parse(_settings);
  if (settings.outputActive && !_settings.outputActive) {
    // turn off output
  } else if (!settings.outputActive && _settings.outputActive) {
    // turn on output
  }
  settings.transcriptionPath = transcriptionPath;
  
  storeSettings(settings);

  if (birds.connected) {
    birds.send({type: 'settings', data: settings});
  }
}

function birdControl (event, control) {
  if (birds.connected) {
    birds.send({type: control});
  }
}

function birdRange (event, data) {
  if (birds.connected) {
    birds.send({type: 'range-update', data: data})
  }
}

const createWindow = () => {

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
  })

  

  win.loadFile(path.join(__dirname, 'index.html'));

  win.removeMenu();

  createBirds();
};

app.whenReady().then(() => {
  ipcMain.on('store-transcription', storeTranscription);
  ipcMain.on('update-settings', updateSettings);

  ipcMain.handle('load-settings', loadSettings);

  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
});