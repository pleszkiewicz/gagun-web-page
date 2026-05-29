(function () {
  const noopAudioEngine = {
    startRound() {},
    setDangerLevel() {},
    playerEliminated() {},
    finishRound() {},
    stop() {},
    dispose() {},
  };

  function createLinesAudioEngine() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return noopAudioEngine;
    }

    let audioContext = null;
    let masterGain = null;
    let musicGain = null;
    let effectsGain = null;
    let delayInput = null;
    let reverbInput = null;
    let noiseBuffer = null;
    let schedulerId = 0;
    let nextStepTime = 0;
    let stepIndex = 0;
    let targetDanger = 0;
    let currentDanger = 0;
    let lastDangerUpdateAt = performance.now();
    let isRoundActive = false;
    let isRoundEnding = false;
    let endingTimeoutId = 0;
    const pendingTimeoutIds = new Set();

    const chordProgression = [
      {
        root: 110,
        pad: [110, 164.81, 220, 261.63, 329.63],
        bass: [55, 82.41, 110],
        lead: [220, 261.63, 329.63, 391.99, 440],
      },
      {
        root: 87.31,
        pad: [87.31, 130.81, 174.61, 220, 261.63],
        bass: [43.65, 65.41, 87.31],
        lead: [174.61, 220, 261.63, 329.63, 391.99],
      },
      {
        root: 130.81,
        pad: [130.81, 164.81, 196, 261.63, 329.63],
        bass: [65.41, 98, 130.81],
        lead: [196, 261.63, 329.63, 391.99, 523.25],
      },
      {
        root: 98,
        pad: [98, 146.83, 196, 246.94, 293.66],
        bass: [49, 73.42, 98],
        lead: [196, 246.94, 293.66, 391.99, 493.88],
      },
    ];

    const leadPattern = [0, 2, 4, 3, 1, 2, 4, 2, 0, 2, 3, 4, 2, 1, 3, 2];
    const harmonyPattern = [2, 4, 1, 3, 4, 2, 0, 1, 3, 4, 2, 1, 0, 2, 4, 3];

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function scheduleTimeout(callback, delay) {
      const timeoutId = window.setTimeout(() => {
        pendingTimeoutIds.delete(timeoutId);
        callback();
      }, delay);

      pendingTimeoutIds.add(timeoutId);
      return timeoutId;
    }

    function clearScheduledTimeouts() {
      pendingTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pendingTimeoutIds.clear();
    }

    function createNoiseBuffer(context) {
      const frameCount = context.sampleRate * 2;
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let index = 0; index < frameCount; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }

      return buffer;
    }

    function createImpulseResponse(context) {
      const duration = 1.9;
      const frameCount = Math.floor(context.sampleRate * duration);
      const impulse = context.createBuffer(2, frameCount, context.sampleRate);

      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const data = impulse.getChannelData(channel);

        for (let index = 0; index < frameCount; index += 1) {
          const progress = index / frameCount;
          const decay = Math.pow(1 - progress, 2.4);

          data[index] = (Math.random() * 2 - 1) * decay * 0.42;
        }
      }

      return impulse;
    }

    function ensureAudioContext() {
      if (audioContext) {
        return audioContext;
      }

      audioContext = new AudioContextConstructor();

      const compressor = audioContext.createDynamicsCompressor();
      const delay = audioContext.createDelay(1);
      const delayFeedback = audioContext.createGain();
      const delayWet = audioContext.createGain();
      const reverb = audioContext.createConvolver();
      const reverbWet = audioContext.createGain();

      masterGain = audioContext.createGain();
      musicGain = audioContext.createGain();
      effectsGain = audioContext.createGain();
      delayInput = audioContext.createGain();
      reverbInput = audioContext.createGain();
      noiseBuffer = createNoiseBuffer(audioContext);

      masterGain.gain.value = 0.45;
      musicGain.gain.value = 0;
      effectsGain.gain.value = 0.86;
      delayInput.gain.value = 1;
      reverbInput.gain.value = 1;

      compressor.threshold.value = -19;
      compressor.knee.value = 17;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.012;
      compressor.release.value = 0.18;

      delay.delayTime.value = 0.29;
      delayFeedback.gain.value = 0.34;
      delayWet.gain.value = 0.18;
      reverb.buffer = createImpulseResponse(audioContext);
      reverbWet.gain.value = 0.26;

      musicGain.connect(masterGain);
      effectsGain.connect(masterGain);
      delayInput.connect(delay);
      delay.connect(delayFeedback);
      delayFeedback.connect(delay);
      delay.connect(delayWet);
      delayWet.connect(masterGain);
      reverbInput.connect(reverb);
      reverb.connect(reverbWet);
      reverbWet.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);

      return audioContext;
    }

    function resumeAudioContext() {
      const context = ensureAudioContext();

      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      return context;
    }

    function setAudioParamTarget(param, value, timeConstant = 0.08) {
      if (!audioContext || !param) return;

      const now = audioContext.currentTime;

      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, timeConstant);
    }

    function createPanner(pan) {
      if (!audioContext || !audioContext.createStereoPanner) {
        return null;
      }

      const panner = audioContext.createStereoPanner();

      panner.pan.value = clamp(pan, -1, 1);
      return panner;
    }

    function connectVoice(source, gain, destination, options = {}) {
      const {
        filterType,
        filterFrequency,
        filterQ = 0.7,
        pan = 0,
        delaySend = 0,
        reverbSend = 0,
      } = options;
      let output = source;

      if (filterType && filterFrequency) {
        const filter = audioContext.createBiquadFilter();

        filter.type = filterType;
        filter.frequency.value = filterFrequency;
        filter.Q.value = filterQ;
        output.connect(filter);
        output = filter;
      }

      const panner = createPanner(pan);

      if (panner) {
        output.connect(panner);
        output = panner;
      }

      output.connect(gain);
      gain.connect(destination);

      if (delaySend > 0 && delayInput) {
        const send = audioContext.createGain();

        send.gain.value = delaySend;
        gain.connect(send);
        send.connect(delayInput);
      }

      if (reverbSend > 0 && reverbInput) {
        const send = audioContext.createGain();

        send.gain.value = reverbSend;
        gain.connect(send);
        send.connect(reverbInput);
      }
    }

    function scheduleTone({
      time,
      duration,
      frequency,
      endFrequency = frequency,
      type = "sine",
      volume = 0.08,
      destination = musicGain,
      attack = 0.01,
      decay = 0.06,
      sustain = 0.55,
      release = 0.12,
      detunes = [0],
      filterType,
      filterFrequency,
      filterQ,
      pan = 0,
      delaySend = 0,
      reverbSend = 0,
    }) {
      if (!audioContext || !destination || frequency <= 0) return;

      const startTime = Math.max(time, audioContext.currentTime + 0.004);
      const releaseStart = Math.max(startTime + attack + decay, startTime + duration - release);
      const stopTime = startTime + duration + release + 0.04;
      const gain = audioContext.createGain();

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + attack);
      gain.gain.linearRampToValueAtTime(volume * sustain, startTime + attack + decay);
      gain.gain.setTargetAtTime(0.0001, releaseStart, release / 3);

      detunes.forEach((detune) => {
        const oscillator = audioContext.createOscillator();

        oscillator.type = type;
        oscillator.detune.setValueAtTime(detune, startTime);
        oscillator.frequency.setValueAtTime(frequency, startTime);

        if (endFrequency > 0 && Math.abs(endFrequency - frequency) > 0.001) {
          oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
        }

        connectVoice(oscillator, gain, destination, {
          filterType,
          filterFrequency,
          filterQ,
          pan,
          delaySend,
          reverbSend,
        });
        oscillator.start(startTime);
        oscillator.stop(stopTime);
      });
    }

    function scheduleNoise({
      time,
      duration,
      volume,
      destination = musicGain,
      highpass = 1500,
      lowpass = 9000,
      pan = 0,
      delaySend = 0,
      reverbSend = 0,
    }) {
      if (!audioContext || !noiseBuffer || !destination) return;

      const startTime = Math.max(time, audioContext.currentTime + 0.004);
      const source = audioContext.createBufferSource();
      const highpassFilter = audioContext.createBiquadFilter();
      const lowpassFilter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();

      source.buffer = noiseBuffer;
      highpassFilter.type = "highpass";
      highpassFilter.frequency.setValueAtTime(highpass, startTime);
      lowpassFilter.type = "lowpass";
      lowpassFilter.frequency.setValueAtTime(lowpass, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.006);
      gain.gain.setTargetAtTime(0.0001, startTime + duration * 0.32, duration * 0.2);

      source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      connectVoice(lowpassFilter, gain, destination, { pan, delaySend, reverbSend });
      source.start(startTime);
      source.stop(startTime + duration + 0.05);
    }

    function getChord(step) {
      return chordProgression[Math.floor(step / 8) % chordProgression.length];
    }

    function getStereoDrift(step, width = 0.36) {
      return Math.sin(step * 1.71) * width;
    }

    function updateDangerSmoothing() {
      const now = performance.now();
      const elapsed = Math.min(0.25, (now - lastDangerUpdateAt) / 1000);
      const response = targetDanger > currentDanger ? 4.6 : 1.35;
      const blend = 1 - Math.exp(-response * elapsed);

      currentDanger += (targetDanger - currentDanger) * blend;
      lastDangerUpdateAt = now;
      return currentDanger;
    }

    function updateContinuousMix(level) {
      if (!audioContext || isRoundEnding) return;

      setAudioParamTarget(musicGain.gain, 0.62 + level * 0.16, 0.18);
      setAudioParamTarget(masterGain.gain, 0.43 + level * 0.05, 0.18);
    }

    function schedulePad(time, chord, level, stepDuration) {
      const padDuration = stepDuration * 8.4;
      const padVolume = 0.012 + level * 0.004;

      chord.pad.forEach((note, index) => {
        scheduleTone({
          time: time + index * 0.018,
          duration: padDuration,
          frequency: note,
          type: index < 2 ? "triangle" : "sine",
          volume: padVolume,
          attack: 0.34,
          decay: 0.2,
          sustain: 0.78,
          release: 0.9,
          detunes: [-5, 5],
          filterType: "lowpass",
          filterFrequency: 820 + level * 980,
          pan: -0.34 + index * 0.17,
          reverbSend: 0.44,
        });
      });
    }

    function scheduleHighPad(time, chord, level, stepDuration) {
      const duration = stepDuration * 16.2;
      const notes = [chord.lead[1] * 2, chord.lead[3] * 2];

      notes.forEach((note, index) => {
        scheduleTone({
          time: time + index * 0.05,
          duration,
          frequency: note,
          type: "sine",
          volume: 0.006 + level * 0.005,
          attack: 0.7,
          decay: 0.3,
          sustain: 0.8,
          release: 1.15,
          detunes: [-3, 3],
          filterType: "lowpass",
          filterFrequency: 2600 + level * 1400,
          pan: index === 0 ? -0.5 : 0.5,
          reverbSend: 0.58,
        });
      });
    }

    function scheduleKick(time, level) {
      scheduleTone({
        time,
        duration: 0.32,
        frequency: 82,
        endFrequency: 42,
        type: "sine",
        volume: 0.16 + level * 0.06,
        attack: 0.004,
        decay: 0.04,
        sustain: 0.22,
        release: 0.08,
      });
    }

    function scheduleSnare(time, level) {
      scheduleNoise({
        time,
        duration: 0.12,
        volume: 0.024 + level * 0.045,
        highpass: 950,
        lowpass: 4200 + level * 1800,
        reverbSend: 0.08,
      });
      scheduleTone({
        time,
        duration: 0.09,
        frequency: 240,
        type: "triangle",
        volume: 0.01 + level * 0.015,
        attack: 0.004,
        decay: 0.035,
        sustain: 0.14,
        release: 0.06,
      });
    }

    function scheduleSoftBackbeat(time, chord, level, stepDuration) {
      scheduleTone({
        time,
        duration: stepDuration * 0.72,
        frequency: chord.lead[2] * 2,
        type: "triangle",
        volume: 0.011 + level * 0.004,
        attack: 0.006,
        decay: 0.07,
        sustain: 0.12,
        release: 0.2,
        filterType: "lowpass",
        filterFrequency: 1900,
        pan: 0.18,
        delaySend: 0.16,
        reverbSend: 0.2,
      });
    }

    function scheduleHat(time, level, accent = false) {
      scheduleNoise({
        time,
        duration: accent ? 0.07 : 0.04,
        volume: (accent ? 0.026 : 0.014) + level * 0.03,
        highpass: 4200 + level * 1800,
        lowpass: 12000,
        pan: accent ? 0.18 : -0.18,
        delaySend: level > 0.55 ? 0.05 : 0,
      });
    }

    function scheduleBass(time, chord, barStep, level, stepDuration) {
      const noteIndex = barStep === 6 ? 1 : 0;
      const note = chord.bass[noteIndex] || chord.root / 2;

      scheduleTone({
        time,
        duration: stepDuration * (level > 0.58 ? 0.8 : 1.28),
        frequency: note,
        type: "sawtooth",
        volume: 0.045 + level * 0.04,
        attack: 0.01,
        decay: 0.05,
        sustain: 0.48,
        release: 0.08,
        filterType: "lowpass",
        filterFrequency: 240 + level * 420,
        filterQ: 1.1,
      });
    }

    function schedulePluck(time, frequency, level, stepDuration, pan) {
      scheduleTone({
        time,
        duration: stepDuration * 1.05,
        frequency,
        type: "triangle",
        volume: 0.03 + level * 0.015,
        attack: 0.008,
        decay: 0.08,
        sustain: 0.16,
        release: 0.22,
        filterType: "lowpass",
        filterFrequency: 1400 + level * 1600,
        pan,
        delaySend: 0.18 + level * 0.08,
        reverbSend: 0.18,
      });
    }

    function scheduleArpeggio(time, chord, patternStep, level, stepDuration) {
      const noteIndex = harmonyPattern[patternStep % harmonyPattern.length] % chord.lead.length;
      const note = chord.lead[noteIndex] * (patternStep % 8 === 7 ? 2 : 1);
      const isAccent = patternStep % 8 === 1 || patternStep % 8 === 5;

      scheduleTone({
        time,
        duration: stepDuration * 0.78,
        frequency: note,
        type: "triangle",
        volume: (isAccent ? 0.019 : 0.014) + level * 0.012,
        attack: 0.007,
        decay: 0.06,
        sustain: 0.2,
        release: 0.18,
        filterType: "lowpass",
        filterFrequency: 1600 + level * 2100,
        pan: getStereoDrift(patternStep),
        delaySend: 0.22 + level * 0.08,
        reverbSend: 0.16,
      });
    }

    function scheduleCounterMelody(time, chord, patternStep, level, stepDuration) {
      const note = chord.lead[(patternStep / 2 + 1) % chord.lead.length] * 1.5;

      scheduleTone({
        time,
        duration: stepDuration * 1.35,
        frequency: note,
        type: "sine",
        volume: 0.012 + level * 0.01,
        attack: 0.03,
        decay: 0.08,
        sustain: 0.46,
        release: 0.28,
        filterType: "lowpass",
        filterFrequency: 2100 + level * 1800,
        pan: getStereoDrift(patternStep + 5, 0.48),
        delaySend: 0.18,
        reverbSend: 0.34,
      });
    }

    function scheduleTensionPulse(time, chord, level, stepDuration) {
      scheduleTone({
        time,
        duration: stepDuration * 1.8,
        frequency: chord.root * 2,
        endFrequency: chord.root * (2.03 + level * 0.12),
        type: "sawtooth",
        volume: 0.008 + level * 0.022,
        attack: 0.025,
        decay: 0.12,
        sustain: 0.32,
        release: 0.18,
        filterType: "bandpass",
        filterFrequency: 900 + level * 2200,
        filterQ: 4.2,
        pan: 0,
        delaySend: 0.08,
        reverbSend: 0.1,
      });
    }

    function scheduleActionLead(time, chord, patternStep, level, stepDuration) {
      const note = chord.lead[leadPattern[patternStep % leadPattern.length] % chord.lead.length];
      const octave = level > 0.82 && patternStep % 4 === 3 ? 2 : 1;

      scheduleTone({
        time,
        duration: stepDuration * 0.62,
        frequency: note * octave,
        type: "square",
        volume: 0.013 + level * 0.035,
        attack: 0.006,
        decay: 0.035,
        sustain: 0.22,
        release: 0.09,
        filterType: "lowpass",
        filterFrequency: 1500 + level * 3600,
        filterQ: 1.6,
        pan: patternStep % 4 < 2 ? -0.24 : 0.24,
        delaySend: 0.16,
        reverbSend: 0.08,
      });
    }

    function scheduleStep(step, time, level, stepDuration) {
      const barStep = step % 8;
      const phraseStep = step % 32;
      const chord = getChord(step);

      if (barStep === 0) {
        schedulePad(time, chord, level, stepDuration);
        if (phraseStep % 16 === 0) {
          scheduleHighPad(time, chord, level, stepDuration);
        }
        scheduleKick(time, level);
        scheduleBass(time, chord, barStep, level, stepDuration);
      }

      if (barStep === 4) {
        if (level > 0.36) {
          scheduleKick(time, level * 0.7);
          scheduleSnare(time, level);
        } else {
          scheduleSoftBackbeat(time, chord, level, stepDuration);
        }
      }

      if (barStep === 3 || barStep === 6 || (level > 0.58 && barStep === 7)) {
        scheduleBass(time, chord, barStep, level, stepDuration);
      }

      if (barStep === 2 || barStep === 6) {
        const note = chord.lead[barStep === 2 ? 1 : 3];

        schedulePluck(time, note, level, stepDuration, barStep === 2 ? -0.22 : 0.22);
      }

      if ([1, 3, 5, 7].includes(barStep)) {
        scheduleArpeggio(time, chord, phraseStep, level, stepDuration);
      }

      if ((phraseStep === 10 || phraseStep === 14 || phraseStep === 26) && level < 0.72) {
        scheduleCounterMelody(time, chord, phraseStep, level, stepDuration);
      }

      if (level > 0.18 && barStep % 2 === 1) {
        scheduleHat(time, level, barStep === 7);
      }

      if (level > 0.38 && barStep !== 0) {
        scheduleActionLead(time, chord, phraseStep, level, stepDuration);
      }

      if (level > 0.78 && barStep % 2 === 0 && barStep !== 0) {
        scheduleHat(time + stepDuration * 0.5, level, true);
      }

      if (level > 0.66 && (barStep === 2 || barStep === 6)) {
        scheduleTensionPulse(time, chord, level, stepDuration);
      }
    }

    function scheduleMusic() {
      if (!audioContext || !isRoundActive || isRoundEnding) return;

      const level = updateDangerSmoothing();
      const lookAhead = 0.34;

      updateContinuousMix(level);

      while (nextStepTime < audioContext.currentTime + lookAhead) {
        const bpm = 82 + level * 48;
        const stepDuration = 60 / bpm / 2;

        scheduleStep(stepIndex, nextStepTime, level, stepDuration);
        nextStepTime += stepDuration;
        stepIndex = (stepIndex + 1) % 128;
      }
    }

    function startScheduler() {
      if (schedulerId) return;

      schedulerId = window.setInterval(scheduleMusic, 38);
    }

    function stopScheduler() {
      if (!schedulerId) return;

      window.clearInterval(schedulerId);
      schedulerId = 0;
    }

    function duckMusic() {
      if (!audioContext || !musicGain || isRoundEnding) return;

      const now = audioContext.currentTime;
      const returnVolume = 0.62 + currentDanger * 0.16;

      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setTargetAtTime(0.25, now, 0.035);
      musicGain.gain.setTargetAtTime(returnVolume, now + 0.22, 0.24);
    }

    function playEliminationStinger() {
      if (!isRoundActive || isRoundEnding) return;

      const context = resumeAudioContext();
      const time = context.currentTime + 0.025;

      duckMusic();
      [392, 369.99, 311.13].forEach((frequency, index) => {
        scheduleTone({
          time: time + index * 0.035,
          duration: 0.62,
          frequency,
          endFrequency: frequency * 0.42,
          type: index === 1 ? "square" : "sawtooth",
          volume: index === 0 ? 0.08 : 0.045,
          destination: effectsGain,
          attack: 0.008,
          decay: 0.08,
          sustain: 0.38,
          release: 0.2,
          filterType: "lowpass",
          filterFrequency: 1400,
          detunes: [-4, 4],
          reverbSend: 0.22,
        });
      });
      scheduleNoise({
        time: time + 0.02,
        duration: 0.42,
        volume: 0.1,
        destination: effectsGain,
        highpass: 110,
        lowpass: 1400,
        reverbSend: 0.18,
      });
    }

    function scheduleFanfareNote(time, frequency, duration, volume = 0.1) {
      scheduleTone({
        time,
        duration,
        frequency,
        type: "sawtooth",
        volume,
        destination: effectsGain,
        attack: 0.012,
        decay: 0.05,
        sustain: 0.62,
        release: 0.16,
        filterType: "lowpass",
        filterFrequency: 2400,
        filterQ: 0.9,
        detunes: [-8, 0, 8],
        delaySend: 0.07,
        reverbSend: 0.24,
      });
    }

    function playWinnerFanfare() {
      const context = resumeAudioContext();
      const time = context.currentTime + 0.12;
      const notes = [
        { offset: 0, frequency: 261.63, duration: 0.18 },
        { offset: 0.19, frequency: 329.63, duration: 0.18 },
        { offset: 0.38, frequency: 392, duration: 0.22 },
        { offset: 0.66, frequency: 523.25, duration: 0.54, volume: 0.13 },
      ];

      notes.forEach((note) =>
        scheduleFanfareNote(time + note.offset, note.frequency, note.duration, note.volume),
      );

      [659.25, 783.99].forEach((frequency, index) => {
        scheduleFanfareNote(time + 0.7 + index * 0.045, frequency, 0.44, 0.055);
      });

      scheduleNoise({
        time: time + 0.62,
        duration: 0.18,
        volume: 0.055,
        destination: effectsGain,
        highpass: 3800,
        lowpass: 12000,
        reverbSend: 0.28,
      });
    }

    function playNoWinnerEnding() {
      const context = resumeAudioContext();
      const time = context.currentTime + 0.08;

      [196, 207.65, 246.94, 293.66].forEach((frequency, index) => {
        scheduleTone({
          time: time + index * 0.025,
          duration: 0.78,
          frequency,
          endFrequency: frequency * 0.92,
          type: "triangle",
          volume: 0.044,
          destination: effectsGain,
          attack: 0.024,
          decay: 0.08,
          sustain: 0.58,
          release: 0.32,
          reverbSend: 0.32,
        });
      });
    }

    function startRound() {
      const context = resumeAudioContext();

      window.clearTimeout(endingTimeoutId);
      endingTimeoutId = 0;
      targetDanger = 0;
      currentDanger = 0;
      lastDangerUpdateAt = performance.now();
      isRoundEnding = false;
      isRoundActive = true;
      nextStepTime = context.currentTime + 0.08;
      stepIndex = 0;
      setAudioParamTarget(musicGain.gain, 0.62, 0.26);
      startScheduler();
    }

    function setDangerLevel(level) {
      targetDanger = clamp(Number.isFinite(level) ? level : 0, 0, 1);
    }

    function finishRound({ hasWinner = false } = {}) {
      if (!audioContext) return;

      resumeAudioContext();
      isRoundEnding = true;
      isRoundActive = false;
      targetDanger = 0;
      stopScheduler();
      setAudioParamTarget(musicGain.gain, 0.02, 0.24);

      if (hasWinner) {
        playWinnerFanfare();
      } else {
        playNoWinnerEnding();
      }

      window.clearTimeout(endingTimeoutId);
      endingTimeoutId = scheduleTimeout(() => {
        setAudioParamTarget(musicGain.gain, 0, 0.24);
        isRoundEnding = false;
      }, 2200);
    }

    function stop() {
      if (!audioContext) return;

      window.clearTimeout(endingTimeoutId);
      endingTimeoutId = 0;
      isRoundActive = false;
      isRoundEnding = false;
      targetDanger = 0;
      currentDanger = 0;
      stopScheduler();
      setAudioParamTarget(musicGain.gain, 0, 0.1);
    }

    function dispose() {
      stop();
      clearScheduledTimeouts();

      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }

      audioContext = null;
      masterGain = null;
      musicGain = null;
      effectsGain = null;
      delayInput = null;
      reverbInput = null;
      noiseBuffer = null;
    }

    return {
      startRound,
      setDangerLevel,
      playerEliminated: playEliminationStinger,
      finishRound,
      stop,
      dispose,
    };
  }

  window.createLinesAudioEngine = createLinesAudioEngine;
})();
