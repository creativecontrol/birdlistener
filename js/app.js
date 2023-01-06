let visualizer;
let recorder;
let isRecording = false;
let recordingBroken = false;
const PLAYERS = {};

let filenum = 0;

const ui = initUI();

const model = initModel();
let player = initPlayers();
let midiAccess;
let outputOptions = [];
let settings = {
  numBirds: 4,
  inputActive: true,
  inputs: [0],
  inputChannel: 'all',
  inputEventType: '',
  inputEventNumber: 0,
  inputOnValue: 127,
  inputOffValue: 0,
  outputActive: true,
  outputs: [0,0,0,0],
};

let isBirdPlaying = false;

setupListeners();
updateBirdSettings();

function setupListeners() {
  settingsDialogOpen.onclick = () => {
    console.debug('opening settings dialog');
    settingsDialog.hidden = false;
  };

  settingsStore.onclick = () => {
    storeSettings();
  };

  settingsCancel.onclick = () => {
    settingsDialog.hidden = true;
  }


  btnRecord.addEventListener('click', () => {
    // Things are broken on old ios
    if (!navigator.mediaDevices) {
      recordingBroken = true;
      recordingError.hidden = false;
      btnRecord.disabled = true;
      return;
    }
    
    if (isRecording) {
      isRecording = false;
      updateRecordBtn(true);
      recorder.stop();
    } else {
      // Request permissions to record audio. Also this sometimes fails on Linux. I don't know.
      navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
        isRecording = true;
        updateRecordBtn(false);
        hideVisualizer();

        recorder = new window.MediaRecorder(stream);
        recorder.addEventListener('dataavailable', (e) => {
          updateWorkingState(btnRecord, btnUpload);
          requestAnimationFrame(() => requestAnimationFrame(() => transcribeFromFile(e.data)));
        });
        recorder.start();
      }, () => {
        recordingBroken = true;
        recordingError.hidden = false;
        btnRecord.disabled = true;
      });
    }
  });

  playBirds.addEventListener('click', (e) => {
    if (isBirdPlaying) {
      isBirdPlaying = false;
      updateBirdButton(true);
      // stop birds
      birdListener.birdControl('stop');
    } else {
      birdListener.birdControl('start');
      isBirdPlaying = true;
      updateBirdButton(false);
    }

  });

  fileInput.addEventListener('change', (e) => {
    recordingError.hidden = true;
    updateWorkingState(btnUpload, btnRecord);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      transcribeFromFile(e.target.files[0]);
      fileInput.value = null;
    }));
    
    return false;
  });

  container.addEventListener('click', () => {
    if (player.isPlaying()) {
      stopPlayer();
    } else {
      startPlayer();
    }
  });
}

async function transcribeFromFile(blob) {
  hideVisualizer();
  
  model.transcribeFromAudioFile(blob).then((ns) => {
    PLAYERS.soundfont.loadSamples(ns).then(() => {
      visualizer = new mm.Visualizer(ns, canvas, {
          noteRGB: '255, 255, 255', 
          activeNoteRGB: '232, 69, 164', 
          pixelsPerTimeStep: window.innerWidth < 500 ? null: 80,
      });
      resetUIState();
      showVisualizer();
      let midi = [mm.sequenceProtoToMidi(visualizer.noteSequence)];
      console.debug(visualizer.noteSequence);
      console.debug(midi);

      // In Electron conversion to MIDI will happen on the NODEJS side because of Blob passing issues
      window.birdListener.storeTranscription(visualizer.noteSequence);

    });
  });
}

function setActivePlayer(event, isSynthPlayer) {
  document.querySelector('button.player.active').classList.remove('active');
  event.target.classList.add('active');
  stopPlayer();
  player = isSynthPlayer ? PLAYERS.synth : PLAYERS.soundfont;
  startPlayer();
}

function stopPlayer() {
  player.stop();
  container.classList.remove('playing');
}

function startPlayer() {
  container.scrollLeft = 0;
  container.classList.add('playing');
  mm.Player.tone.context.resume();
  player.start(visualizer.noteSequence);
}

function updateWorkingState(active, inactive) {
  help.hidden = true;
  transcribingMessage.hidden = false;
  active.classList.add('working');
  inactive.setAttribute('disabled', true);
}

function updateRecordBtn(defaultState) {
  const el = btnRecord.firstElementChild;
  el.textContent = defaultState ? 'Record audio' : 'Stop';
  recording.hidden = defaultState;
}

function updateBirdButton(defaultState) {
  const el = playBirds.firstElementChild;
  el.textContent = defaultState ? 'Play Birds' : 'Stop Birds';
}

function resetUIState() {
  btnUpload.classList.remove('working');
  btnUpload.removeAttribute('disabled');
  btnRecord.classList.remove('working');
  playBirds.classList.remove('working');
  if (!recordingBroken) {
    btnRecord.removeAttribute('disabled');
  }
}

function hideVisualizer() {
  players.hidden = true;
  saveBtn.hidden = true;
  container.hidden = true;
}

function showVisualizer() {
  container.hidden = false;
  saveBtn.hidden = false;
  players.hidden = false;
  transcribingMessage.hidden = true;
  help.hidden = true;
}

function saveMidi(event) {
  event.stopImmediatePropagation();
  saveAs(new File([mm.sequenceProtoToMidi(visualizer.noteSequence)], `transcription_${filenum}.mid`));
  filenum += 1;
}

function initPlayers() {
  PLAYERS.synth = new mm.Player(false, {
    run: (note) => {
      const currentNotePosition = visualizer.redraw(note);

      // See if we need to scroll the container.
      const containerWidth = container.getBoundingClientRect().width;
      if (currentNotePosition > (container.scrollLeft + containerWidth)) {
        container.scrollLeft = currentNotePosition - 20;
      }
    },
    stop: () => {container.classList.remove('playing')}
  });

  PLAYERS.soundfont = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/salamander');
  // TODO: fix this after magenta 1.1.15
  PLAYERS.soundfont.callbackObject = {
    run: (note) => {
      const currentNotePosition = visualizer.redraw(note);

      // See if we need to scroll the container.
      const containerWidth = container.getBoundingClientRect().width;
      if (currentNotePosition > (container.scrollLeft + containerWidth)) {
        container.scrollLeft = currentNotePosition - 20;
      }
    },
    stop: () => {container.classList.remove('playing')}
  };
  return PLAYERS.soundfont;
}

function initModel() {
  const model = new mm.OnsetsAndFrames('https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni');
  
  model.initialize().then(() => {
    resetUIState();
    modelLoading.hidden = true;
    modelReady.hidden = false;
  });
  
  // Things are slow on Safari.
  if (window.webkitOfflineAudioContext) {
    safariWarning.hidden = false;
  }
  
  // Things are very broken on ios12.
  if (navigator.userAgent.indexOf('iPhone OS 12_0') >= 0) {
    iosError.hidden = false;
    buttons.hidden = true;
  }
  return model;
}

function initUI() {
  navigator.requestMIDIAccess().then((access) => {
    midiAccess = access;
    loadMidiInputsAndOutputs(access);
    updateNumberOfBirds();
  });
}

function recallSettings() {

}

function storeSettings() {
  settings.inputActive = midiInActive.value || true;
  settings.inputs = [];
  settings.inputs.push(midiInput.selectedIndex) || [0];

  
  settings.inputChannel = midiChannel.value || 'all';
  settings.inputEventType = eventType.value || 'cc',
  settings.inputEventNumber = eventNumber.value || 0,
  settings.inputOnValue = onValue.value || 127,
  settings.inputOffValue = offValue.value || 0,

  settings.numBirds = numberOfBirds.value || 4;
  settings.outputActive = midiOutActive.value || true

  settings.outputs = [];

  midiOutSelects.querySelectorAll("select").forEach(element => {
    settings.outputs.push(element.selectedIndex);
  });

  console.debug('stored settings', settings);

  updateBirdSettings();
  updateBirdButton(true);
  isBirdPlaying = false;

  settingsDialog.hidden = true;

}

function updateBirdSettings() {
  birdListener.updateSettings(JSON.stringify(settings));
}

function loadMidiInputsAndOutputs(_midiAccess) {
  _midiAccess.inputs.forEach((port, key) => {
    const opt = document.createElement("option");
    opt.text = port.name;
    opt.value = port.id;
    document.getElementById("midiInput").add(opt);
  });

  _midiAccess.outputs.forEach((port, key) => {
    outputOptions.push({name: port.name, id: port.id});
  });
}

function updateNumberOfBirds() {
  console.debug('updating number of birds');
  const outputs = document.getElementById('midiOutSelects');
    outputs.innerHTML = '';
    
    for (let index = 0; index < settings.numBirds; index++) {
      const br = document.createElement('br');
      const label = document.createElement('label');
      const id = `bird${index+1}Output`;
      label.innerHTML = `Bird ${index+1} output`;
      label.htmlFor = id;

      const select = document.createElement('select');
      select.id = id;
      
      outputs.appendChild(label);
      outputs.appendChild(select);
      outputs.appendChild(br);

      // console.debug(`Bird ${id} options `, outputOptions.length);
      
      let thisSelect = document.getElementById(id); 
      
      for (let j = 0; j < outputOptions.length; j++) {
        const opt = document.createElement('option');
        opt.text = outputOptions[j].name;
        opt.id = outputOptions[j].id;
        thisSelect.add(opt);
      }

      // console.debug(`${thisSelect.id} ${[...thisSelect.options].map(o => o.text)}`);
    }

}
