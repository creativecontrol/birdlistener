const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mm = require('@magenta/music/node/core');
const fs = require('fs');
const { fork } = require('child_process');

const transcriptionsPath = '../transcriptions/';
let settings; 

let birds = fork('birds.js');

birds.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

function storeTranscription (event, transcription) {
    let midi = mm.sequenceProtoToMidi(transcription);
    console.log('storing transcription', midi);

    let data = Buffer.from(midi);

    if (!fs.existsSync(transcriptionsPath)) {
        fs.mkdir(transcriptionsPath, (err) => {
            console.error(err);
        });
    }

    const time = Date.now();
    fs.writeFile(`${transcriptionsPath}transcription_${time}.mid`, data, (err) => {
        if (err) return console.log(err);
    });
}

function updateSettings (event, _settings) {
  console.log('updating settings', _settings);
  settings = JSON.parse(_settings);
  if (settings.outputActive && !_settings.outputActive) {
    // turn off output
  } else if (!settings.outputActive && _settings.outputActive) {
    // turn on output
  }

  if (birds) {
    birds.send({type: 'settings', data: settings});
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

  ipcMain.on('store-transcription', storeTranscription);
  ipcMain.on('update-settings', updateSettings);

  win.loadFile('index.html');

  win.removeMenu();
};

app.whenReady().then(() => {

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