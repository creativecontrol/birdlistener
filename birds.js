/**
 * Bird definition - instantiated by main.js
 * 
 *  Create 4 Players
 * Receive a start message, load each player with a random file from the list 
 * wait a random amount of time then play back the file
 *
 * Each bird will have its own midi interface output to simplify channel separation.
 * Sounds will be created by a DAW
 *
 * when the file is done, load a new file, wait a random amount of time and play again
 * Expose the timing values to the main settings panel
 *
 * receive: 1
 * wait: x milliseconds
 * reply: 1, <file path>, bang 
*/

const path = require('path');
const fs = require('fs');
const os = require('os');
const MidiPlayer = require('midi-player-js');
const midi = require('midi');
const { start } = require('repl');
const midiOuts = [];

let filePath ;
let midiFiles;
let fileWatcher;

let msRange = 15000;
let msFloor = 3000;

let numBirds = 4;
let birds = [];
let birdEvents = [];
let birdPorts = [2, 3, 4, 5];
let settings;
let birdsPlaying = false;

process.on('message', (message) => {

    console.debug(`birds received message ${JSON.stringify(message)}`);
    if (message.type == 'settings') {
        settings = message.data;
        if(settings.transcriptionPath) {
            filePath = path.normalize(settings.transcriptionPath);
            updateFiles();
            watchMidiFiles();
        }
        numBirds = settings.numBirds || numBirds;
        birdPorts = settings.outputs || birdPorts;
        msFloor = parseInt(settings.birdTimeFloor) || msFloor;
        msRange = parseInt(settings.birdTimeCeiling) || msRange;

        console.debug(`birds settings updated ${numBirds} ${msFloor} ${msRange}`);

        if (settings.outputs && os.platform() == 'win32') {
            // Windows has the MS General MIDI as port 0 of the OS. The WebMIDI api does not.
            birdPorts = birdPorts.map(x => x+1);
        }

        stopAllBirds();

    } else if (message.type == 'start') {
        if (birds.length <= 0) {
            makeBirds();
        }
        birdsPlaying = true;
    } else if (message.type == 'stop') {
        // Birds will finish playing their currently scheduled files
        console.debug(`bird Events ${birdEvents}`);
        stopAllBirds();
    }
})

function rand(range) {
    const randomValue = Math.floor(Math.random() * range);
    console.debug(`new random: ${randomValue}`);
    return randomValue;
};

function birdNote(birdNum) {
   if (birdsPlaying) {
        if (midiFiles && midiFiles.length > 0) {
            let fileIndex = rand(midiFiles.length);
            let file = filePath + midiFiles[fileIndex];
            console.debug(`Bird ${birdNum} playing ${file}`);
            birds[birdNum].loadFile(file);
        } else {
            // Keep running the bird until there are files to play.
            startBird(birdNum);
        }
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
    const id = setTimeout(() => {
        console.debug(`my event id ${id}`);
        birdNote(index);
    }, rand(msRange - msFloor) + msFloor);

    birdEvents.push(id);
}

function stopAllBirds() {
    birdsPlaying = false;
    birds.forEach((bird) => {
        bird.stop();
    });

    birdEvents.forEach((event) => {
        clearTimeout(event);
    });
    birdEvents = [];
    birds = [];
}

function updateFiles() {
    if (filePath) {
        fs.readdir(filePath, (err, _midiFiles) => {
            if (err) {
                return console.debug('Unable to scan directory: ' + err);
            }
            midiFiles = _midiFiles;
        });
    }
}

function watchMidiFiles() {
    if (filePath) {
        if (fileWatcher) {
            fileWatcher.close();
        }
        console.debug(`File path ${filePath}`);
        fileWatcher = fs.watch(filePath, (eventType, fileName) => {
            updateFiles();
        });
    }
}

function updateSettings() {

}

updateFiles();
watchMidiFiles();
 
// makeBirds();




