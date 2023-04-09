self.addEventListener('install', e => {
    e.waitUntil(
    (async function() {
      const cache = await caches.open("your-app-name-assets");
  
      const resources = [
        // Static files you want to cache.
        "../index.html",
        "../css/style.css",
        "../css/meter.css",
        "../js/app.js",
        "../js/polyfill.js",
        // "manifest.json",
        // A built, minified bundle of dependencies.
        "https://cdn.jsdelivr.net/npm/@magenta/music",
        // SoundFont manifest.
        'https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus/soundfont.json',
        // Model checkpoint.
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/weights_manifest.json',
        // "https://storage.googleapis.com/magentadata/js/checkpoints/piano_genie/model/epiano/stp_iq_auto_contour_dt_166006/weights_manifest.json",
        // "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus/acoustic_grand_piano/instrument.json",
        // 'https://storage.googleapis.com/magentadata/js/soundfonts/salamander/instrument.json',
        // List here all the actual shards of your model.
        // "https://storage.googleapis.com/magentadata/js/checkpoints/piano_genie/model/epiano/stp_iq_auto_contour_dt_166006/group1-shard1of1"
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard1of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard2of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard3of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard4of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard5of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard6of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard7of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard8of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard9of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard10of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard11of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard12of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard13of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard14of15',
        'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni/group1-shard15of15',
      ];
      // The actual SoundFont files you will use.
      // for (let i = 21; i < 105; i++) {
      //   resources.push(`https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus/acoustic_grand_piano/p${i}_v79.mp3`)
      // }
  
      // Cache all of these
      const local = cache.addAll(resources);
      await Promise.all([local]);
    })()
    );
  });
  
  self.addEventListener('fetch', e => {
    // If the resource is cached, send it.
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
  });