/**
 * Main JS file for BirdListener Web App
* TODO:
*   Store previous settings for reuse on next opening (and default to other input/output if not existing)
*   Add low and high range for bird timing in settings
*   Add variable for probability of playing each note to add variation   
*/

class BirdListener {
  constructor() {
    this.visualizer;
    this.recorder;
    this.isRecording = false;
    this.recordingBroken = false;
    this.PLAYERS = {};

    this.audioContext;
    this.mediaStreamAudioSourceNode;
    this.analyserNode;
    this.pcmData;

    this.filenum = 0;

    this.model;
    this.player;
    this.midiAccess;
    this.outputOptions = [];
    this.settings = {
      numBirds: 4,
      birdTimeFloor: 3000,
      birdTimeCeiling: 15000,
      audioSource: '',
      inputActive: true,
      inputs: ['input-0'],
      inputChannel: 'all',
      inputEventType: '',
      inputEventNumber: 0,
      inputOnValue: 127,
      inputOffValue: 0,
      outputActive: true,
      outputs: [0,0,0,0],
      transcriptionPath: './'
    };

    this.isBirdPlaying = false;

  }

  init() {
    this.ui = this.initUI()
    this.createAudioContext();
    this.setupListeners()
    this.initPostLoad();
    this.updateBirdSettings();
  }

  /**
   * 
   */
  setupListeners() {

    settingsDialogOpen.onclick = () => {
      console.debug('opening settings dialog');
      this.recallSettings();
      settingsDialog.hidden = false;
    };
  
    settingsStore.onclick = () => {
      this.storeSettings();
    };
  
    settingsCancel.onclick = () => {
      this.recallSettings();
      settingsDialog.hidden = true;
    }
  
    document.addEventListener('keydown', (event) => {
      console.debug(event);
      if (event.repeat) {
        return;
      } 
  
      if (event.code == 'Space') {
        btnRecord.click();
      }
    })
  
    btnRecord.addEventListener('click', () => {
      // Things are broken on old ios
      if (!navigator.mediaDevices) {
        this.recordingBroken = true;
        recordingError.hidden = false;
        btnRecord.disabled = true;
        return;
      }
      
      if (this.isRecording) {
        this.isRecording = false;
        this.updateRecordBtn(true);
        this.recorder.stop();
      } else {
        this.updateAudioInput()
        .then((stream) => {
          this.startRecording(stream);
        })
        .catch((error) => {
          console.error(error);
        })
        
      }
    });
  
    playBirds.addEventListener('click', (e) => {
      if (this.isBirdPlaying) {
        this.isBirdPlaying = false;
        this.updateBirdButton(true);
        // stop birds (how is this different from window.birdListener?)
        birdListener.birdControl('stop');
      } else {
        birdListener.birdControl('start');
        this.isBirdPlaying = true;
        this.updateBirdButton(false);
      }
  
    });
  
    fileInput.addEventListener('change', (e) => {
      recordingError.hidden = true;
      this.updateWorkingState(btnUpload, btnRecord);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.transcribeFromFile(e.target.files[0]);
        fileInput.value = null;
      }));
      
      return false;
    });
  
    container.addEventListener('click', () => {
      if (this.player.isPlaying()) {
        this.stopPlayer();
      } else {
        this.startPlayer();
      }
    });

    pianoBtn.addEventListener('click', (event) => {
      this.setActivePlayer(event, false);
    });

    synthBtn.addEventListener('click', (event) => {
      this.setActivePlayer(event, false);
    });
  }

  createAudioContext() {
    this.audioContext = new AudioContext();
    this.analyserNode = this.audioContext.createAnalyser();
    console.debug('Analyser node', this.analyserNode);
  }

  initPlayers () {
    this.PLAYERS.synth = new mm.Player(false, {
      run: (note) => {
        const currentNotePosition = this.visualizer.redraw(note);
  
        // See if we need to scroll the container.
        const containerWidth = container.getBoundingClientRect().width;
        if (currentNotePosition > (container.scrollLeft + containerWidth)) {
          container.scrollLeft = currentNotePosition - 20;
        }
      },
      stop: () => {container.classList.remove('playing')}
    });
  
    this.PLAYERS.soundfont = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/salamander');
    // TODO: fix this after magenta 1.1.15
    this.PLAYERS.soundfont.callbackObject = {
      run: (note) => {
        const currentNotePosition = this.visualizer.redraw(note);
  
        // See if we need to scroll the container.
        const containerWidth = container.getBoundingClientRect().width;
        if (currentNotePosition > (container.scrollLeft + containerWidth)) {
          container.scrollLeft = currentNotePosition - 20;
        }
      },
      stop: () => {container.classList.remove('playing')}
    };
    return this.PLAYERS.synth;
  }

  initModel() {
    const model = new mm.OnsetsAndFrames('https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni');
    
    model.initialize().then(() => {
      this.resetUIState();
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

  initUI() {
    navigator.mediaDevices.enumerateDevices()
    .then((deviceInfo) => {
      this.gotAudioDevices(deviceInfo);
    })
    .catch((error) => {
      this.handleAudioError(error);
    });
  
    navigator.requestMIDIAccess().then((access) => {
      this.midiAccess = access;
      this.loadMidiInputsAndOutputs(access);
      window.birdListener.loadSettings()
      .then((loadedSettings) => {
        console.debug('loaded settings', loadedSettings);
        this.settings = loadedSettings;
        this.recallSettings();
        this.initPostLoad();
      })
      .catch((e) => {
        console.debug('no stored settings, using defaults', e);
        this.storeSettings();
        this.initPostLoad();
      })
      
    });
  }

  initPostLoad() {
    this.updateNumberOfBirds();
    this.model = this.initModel();
    this.player = this.initPlayers();
  }

  initMicMeter(stream) {
    this.mediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(stream);
    this.pcmData = new Float32Array(this.analyserNode.fftSize);
    this.mediaStreamAudioSourceNode.connect(this.analyserNode);
    requestAnimationFrame(() => {
      this.updateMicMeter();
    });
  }

  loadMidiInputsAndOutputs(_midiAccess) {
    _midiAccess.inputs.forEach((port, key) => {
      const opt = document.createElement("option");
      opt.text = port.name;
      opt.value = port.id;
      document.getElementById("midiInput").add(opt);
    });
  
    _midiAccess.outputs.forEach((port, key) => {
      this.outputOptions.push({name: port.name, id: port.id});
    });
  
    this.updateMidiListener();
  }

  /**
 * MIDI message formatting helper function
 * @param {*} message 
 * @returns MIDI message object
 */
  parseMidiMessage(message) {
    let command = message.data[0] >> 4;
    let commandType = '';
    switch(command) {
      case 8:
        commandType = 'noteOff';
        break;
      case 9:
        commandType = 'noteOn';
        break;
      case 11:
        commandType = 'cc';
        break;
    }

    return {
      command: commandType,
      channel: message.data[0] & 0xf,
      note: message.data[1],
      velocity: message.data[2]
    }
  }

  /**
   * Save MIDI file manually
   * @param {*} event 
   */
  saveMidi(event) {
    event.stopImmediatePropagation();
    saveAs(new File([mm.sequenceProtoToMidi(this.visualizer.noteSequence)], `transcription_${filenum}.mid`));
    filenum += 1;
  }

  /**
   * Rebuild MIDI message listener when initialized or when settings are stored
   */
  updateMidiListener() {
    if (this.settings.inputActive) {
      let selectedInput = this.settings.inputs[0];
      let inputs = this.midiAccess.inputs;
      console.debug(`selected midi Input ${selectedInput}`);
      console.debug(inputs.get(selectedInput));

      if (inputs.get(selectedInput)) {
        inputs.get(selectedInput).onmidimessage = (message) => {
          let midiMessage = this.parseMidiMessage(message);
          console.debug(midiMessage);

          if (midiMessage.commandType === '') {
            return;
          }

          if ((this.settings.inputChannel === 'all' || parseInt(this.settings.inputChannel) === midiMessage.channel) && 
            this.settings.inputEventType === midiMessage.command && parseInt(this.settings.inputEventNumber) === midiMessage.note ) {
              console.debug(`correct trigger received`);
              btnRecord.click();
          }
          
        }
      }
    }
  }

  /**
   * Transcribe the recorded or uploaded audio file
   * @param {*} blob 
   */
  async transcribeFromFile(blob) {
    this.hideVisualizer();
    this.hideNoTransription();
    
    this.model.transcribeFromAudioFile(blob).then((ns) => {
      this.PLAYERS.soundfont.loadSamples(ns).then(() => {
        this.visualizer = new mm.Visualizer(ns, canvas, {
            noteRGB: '255, 255, 255', 
            activeNoteRGB: '232, 69, 164', 
            pixelsPerTimeStep: window.innerWidth < 500 ? null: 80,
        });
        this.resetUIState();
        
        
        console.debug(this.visualizer.noteSequence);
        console.debug(this.visualizer.noteSequence.notes.length);
        
        // In Electron conversion to MIDI will happen on the NODEJS side because of Blob passing issues
        if (this.visualizer.noteSequence.notes.length > 0) {
          this.showVisualizer();
          window.birdListener.storeTranscription(this.visualizer.noteSequence);
        } else {
          this.showNoTranscription();
          console.debug('It seems like there were no events in that transcription.');
        }
      });
    });
  }

  /**
   * 
   * @param {*} event 
   * @param {*} isSynthPlayer 
   */
  setActivePlayer(event, isSynthPlayer) {
    document.querySelector('button.player.active').classList.remove('active');
    event.target.classList.add('active');
    this.stopPlayer();
    this.player = isSynthPlayer ? this.PLAYERS.synth : this.PLAYERS.soundfont;
    this.startPlayer();
  }

  /**
   * 
   */
  startPlayer() {
    container.scrollLeft = 0;
    container.classList.add('playing');
    mm.Player.tone.context.resume();
    this.player.start(this.visualizer.noteSequence);
  }
  /**
   * 
   */
  stopPlayer() {
    this.player.stop();
    container.classList.remove('playing');
  }

  hideNoTransription() {
    noTranscription.hidden = true;
  }

  showNoTranscription() {
    transcribingMessage.hidden = true;
    this.hideVisualizer();
    noTranscription.hidden = false;
  }

  hideVisualizer() {
    players.hidden = true;
    saveBtn.hidden = true;
    container.hidden = true;
  }

  showVisualizer() {
    container.hidden = false;
    saveBtn.hidden = false;
    players.hidden = false;
    transcribingMessage.hidden = true;
    help.hidden = true;
  }

  resetUIState() {
    btnUpload.classList.remove('working');
    btnUpload.removeAttribute('disabled');
    btnRecord.classList.remove('working');
    playBirds.classList.remove('working');
    if (!this.recordingBroken) {
      btnRecord.removeAttribute('disabled');
    }
  }

  /**
   * 
   * @param {*} defaultState 
   */
  updateBirdButton(defaultState) {
    const el = playBirds.firstElementChild;
    el.textContent = defaultState ? 'Play Birds' : 'Stop Birds';
  }

  /**
   * 
   * @param {*} defaultState 
   */
  updateRecordBtn(defaultState) {
    const el = btnRecord.firstElementChild;
    el.textContent = defaultState ? 'Record audio' : 'Stop';
    recording.hidden = defaultState;
  }

  /**
   * 
   * @param {*} active 
   * @param {*} inactive 
   */
  updateWorkingState(active, inactive) {
    help.hidden = true;
    transcribingMessage.hidden = false;
    active.classList.add('working');
    inactive.setAttribute('disabled', true);
  }

  /**
   * 
   *
   */
  updateMicMeter() {
    this.analyserNode.getFloatTimeDomainData(this.pcmData);
    let sumSquares = 0.0;
    for (const amplitude of this.pcmData) { sumSquares += amplitude*amplitude; }
    volumeMeter.value = Math.sqrt(sumSquares / this.pcmData.length);
    // console.log("Meter value: ", volumeMeter.value);
    window.requestAnimationFrame(() => {
      this.updateMicMeter();
    });
  }

  /**
   * 
   * @param {*} deviceInfos 
   */
  gotAudioDevices(deviceInfos) {
    audioInputSelect.innerHTML = '';

    for (let i = 0; i !== deviceInfos.length; ++i) {
      const deviceInfo = deviceInfos[i];
      const option = document.createElement('option');
      option.value = deviceInfo.deviceId;
      if (deviceInfo.kind === 'audioinput') {
        option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
        audioInputSelect.appendChild(option);
      }
    }

    this.settings.audioSource = audioInputSelect.value;
  }

  /**
   * 
   * @param {*} error 
   */
  handleAudioError(error) {
    console.debug('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
  }

  /**
   * 
   * @param {*} stream 
   */
  startRecording(stream) {

    this.isRecording = true;
    this.updateRecordBtn(false);
    this.hideVisualizer();
    this.hideNoTransription();
    
    this.recorder = new MediaRecorder(stream);
    this.recorder.addEventListener('dataavailable', (e) => {
      this.updateWorkingState(btnRecord, btnUpload);
      requestAnimationFrame(() => requestAnimationFrame(() => this.transcribeFromFile(e.data)));
    });
    this.recorder.start();
  
  }

  /**
   * 
   */
  updateAudioInput() {

    return new Promise((resolve,reject) =>{

      // Request permissions to record audio. Also this sometimes fails on Linux. I don't know.
      navigator.mediaDevices.getUserMedia({
        audio: {deviceId: this.settings.audioSource ? {exact: this.settings.audioSource} : undefined},
      })
      .then((stream) => {
        this.initMicMeter(stream);
        resolve(stream);
        
      }, () => {
        this.recordingBroken = true;
        recordingError.hidden = false;
        btnRecord.disabled = true;
        reject(new Error(`cannot retrieve audio source ${settings.audioSource}`));
      });

    })
  }

  /**
   * Recall current settings to UI when settings pane cancelled
   */
  recallSettings() {
    audioInputSelect.value = this.settings.audioSource;
    midiInActive.value = this.settings.inputActive;
    midiInput.selectedIndex = this.settings.inputs[0];
    midiChannel.value = this.settings.inputChannel;
    eventType.value = this.settings.inputEventType;
    eventNumber.value = this.settings.inputEventNumber;
    onValue.value = this.settings.inputOnValue;
    offValue.value = this.settings.inputOffValue;
    numberOfBirds.value = this.settings.numBirds;
    birdTimeFloor.value = this.settings.birdTimeFloor;
    birdTimeCeiling.value = this.settings.birdTimeCeiling;
    midiOutActive.value = this.settings.outputActive;

    midiOutSelects.querySelectorAll("select").forEach((element, idx) => {
      element.selectedIndex = this.settings.outputs[idx];
    });
  }

  /**
   * 
   */
  storeSettings() {
    this.settings.audioSource = audioInputSelect.value || 0;
    this.settings.inputActive = midiInActive.value || true;
    this.settings.inputs = [];
    this.settings.inputs.push(midiInput.selectedIndex) || [0];

    
    this.settings.inputChannel = midiChannel.value || 'all';
    this.settings.inputEventType = eventType.value || 'cc',
    this.settings.inputEventNumber = eventNumber.value || 0,
    this.settings.inputOnValue = onValue.value || 127,
    this.settings.inputOffValue = offValue.value || 0,

    this.settings.numBirds = numberOfBirds.value || 4;
    this.settings.birdTimeFloor = birdTimeFloor.value || 1000;
    this.settings.birdTimeCeiling = birdTimeCeiling.value || 10000;
    this.settings.outputActive = midiOutActive.value || true

    this.settings.outputs = [];

    midiOutSelects.querySelectorAll("select").forEach((element) => {
      this.settings.outputs.push(element.selectedIndex);
    });

    console.debug('stored settings', this.settings);

    this.updateMidiListener();
    this.updateAudioInput();
    this.updateBirdSettings();
    this.updateBirdButton(true);
    this.isBirdPlaying = false;

    settingsDialog.hidden = true;

  }

  /**
   * 
   */
  updateBirdSettings() {
    window.birdListener.updateSettings(JSON.stringify(this.settings));
  }

  /**
   * 
   */
  updateNumberOfBirds() {
    console.debug('updating number of birds', this.settings);
    const outputs = document.getElementById('midiOutSelects');
      outputs.innerHTML = '';
      
      for (let index = 0; index < this.settings.numBirds; index++) {
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
        
        for (let j = 0; j < this.outputOptions.length; j++) {
          const opt = document.createElement('option');
          opt.text = this.outputOptions[j].name;
          opt.id = this.outputOptions[j].id;
          thisSelect.add(opt);
        }

        // console.debug(`${thisSelect.id} ${[...thisSelect.options].map(o => o.text)}`);
      }

  }
}


window.onload = function() {
  window.app = new BirdListener();
  window.app.init();
};