/**
 * BirdListener ElectronJS IPC communications 
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('birdListener', {
  'storeTranscription': (transcription) => ipcRenderer.send('store-transcription', transcription),
  'updateSettings': (settings) => ipcRenderer.send('update-settings', settings),
  'birdControl': (control) => ipcRenderer.send('bird-control', control), 
  'loadSettings': () => ipcRenderer.invoke('load-settings'),
})