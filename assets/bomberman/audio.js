(function () {
  "use strict";
  const game = window.gagunBomberman;

  function createAudio(initialVolume = 0.35) {
    let context;
    let master;
    let volume = initialVolume;
    let disposed = false;
    const buffers = new Map();
    const sources = new Set();
    const requests = new AbortController();

    function unlock() {
      if (disposed) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = volume;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 8;
        master.connect(compressor);
        compressor.connect(context.destination);
        for (const [name, path] of Object.entries(game.sounds)) {
          fetch(path, { signal: requests.signal }).then(response => {
            if (!response.ok) throw new Error("Sound unavailable");
            return response.arrayBuffer();
          }).then(data => context.decodeAudioData(data)).then(buffer => {
            if (!disposed) buffers.set(name, buffer);
          }).catch(() => {}); // A short synthesized effect is available while files load or are missing.
        }
      }
      if (context.state === "suspended") context.resume().catch(() => {});
    }

    function play(name) {
      if (!context || context.state !== "running" || disposed || volume === 0) return;
      const buffer = buffers.get(name);
      if (buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(master);
        sources.add(source);
        source.onended = () => {
          sources.delete(source);
          source.disconnect();
        };
        source.start();
      } else {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const frequencies = { place: 150, explosion: 65, elimination: 180, countdown: 660, join: 523, pickup: 880, shield: 1100, victory: 784, start: 1047, draw: 260 };
        oscillator.type = name === "explosion" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequencies[name] || 440, context.currentTime);
        envelope.gain.setValueAtTime(0.25, context.currentTime);
        envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.13);
        oscillator.connect(envelope);
        envelope.connect(master);
        sources.add(oscillator);
        oscillator.onended = () => {
          sources.delete(oscillator);
          oscillator.disconnect();
          envelope.disconnect();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + 0.14);
      }
    }

    return {
      unlock, play,
      setVolume(value) {
        volume = Math.max(0, Math.min(1, value));
        if (master) master.gain.setTargetAtTime(volume, context.currentTime, 0.02);
      },
      dispose() {
        disposed = true;
        requests.abort();
        for (const source of sources) {
          try { source.stop(); } catch (_) { /* A finished source needs no further cleanup. */ }
        }
        sources.clear();
        if (context) context.close().catch(() => {});
      },
    };
  }

  game.createAudio = createAudio;
}());
