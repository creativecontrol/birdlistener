/*
  Create 4 Players
  Receive a start message, load each player with a random file from the list 
  wait a random amount of time then play back the file

  Each bird will have its own midi interface output to simplify channel separation.
  Sounds will be created by a DAW

  when the file is done, load a new file, wait a random amount of time and play again
  
  receive: 1
  wait: x milliseconds
  reply: 1, <file path>, bang

*/
const path = require('path');
const fs = require('fs');
const MidiPlayer = require('midi-player-js');
const midi = require('midi');
const { start } = require('repl');
const midiOuts = [];

const filePath = '../transcriptions/';
let midiFiles;

const msRange = 10000;
const msFloor = 200;

const numBirds = 4;
let birds = [];
const birdPorts = [2, 3, 4, 5];
let settings;

process.on('message', (message) => {

    console.log(`birds received message ${JSON.stringify(message)}`);
    if (message.type == 'settings') {
        settings = message.data;
        console.log(`birds settings updated ${settings.numBirds}`);
    }
})

function rand(range) {
    return Math.floor(Math.random() * range);
};

function birdNote(birdNum) {
    if (midiFiles.length > 0) {
        let fileIndex = rand(midiFiles.length);
        let file = filePath + midiFiles[fileIndex];
        console.debug(`Bird ${birdNum} playing ${file}`);
        birds[birdNum].loadFile(file);
    } else {
        // Keep running the bird until there are files to play.
        startBird(birdNum);
    }
};

function makeBirds() {
    for (let index = 0; index < numBirds; index++) {
        birds.push(new MidiPlayer.Player());
        midiOuts.push(new midi.Output());

        try {
            midiOuts[index].closePort();
            midiOuts[index].openPort(birdPorts[index]);
            console.debug(`Bird ${index} MIDI port ${midiOuts[index].getPortName(birdPorts[index])} open: ${midiOuts[index].isPortOpen()}`);
        } catch (error) {
            console.error(error);
        }


        birds[index].on('midiEvent', (event) => {
            // maxApi.post(index, event);
            if (event.noteNumber) {
                let velocity = 0;
                if (event.name = 'Note on') {
                    velocity = event.velocity;
                }

                // Send a MIDI message.
                try {
                    midiOuts[index].sendMessage([144, event.noteNumber, velocity]);
                } catch (error) {
                    console.error(error);
                }

            }
        });

        birds[index].on('fileLoaded', () => {
            birds[index].play();
        });

        birds[index].on('endOfFile', () => {
            // load a new file and 
            startBird(index);
        });

        startBird(index);
    }

}

function startBird(index) {
    setTimeout(() => {
        birdNote(index);
    }, rand(msRange) + msFloor);
}

function updateFiles() {
    fs.readdir(filePath, (err, _midiFiles) => {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        midiFiles = _midiFiles;
    });
}

function watchMidiFiles() {
    fs.watch(filePath, (eventType, fileName) => {
        updateFiles();
    });

}

function updateSettings() {

}

watchMidiFiles();
updateFiles(); // make this return when files are read
makeBirds();




