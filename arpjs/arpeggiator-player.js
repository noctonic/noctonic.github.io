(function (window) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.25; 
  masterGain.connect(audioCtx.destination);
  let activeOscillators = [];
  let repeatTimer = null;
  let isRepeating = false;
  let noteDuration  = 0.05;
  let oscType       = "square";
  let attackTime    = 0.01;
  let releaseTime   = 0.05;
  let insertDeadSpace = false;

  function setVolume(volume) {
    console.log(volume)
    masterGain.gain.value = volume;
  } 
  function setNoteDuration(newDuration) {
    noteDuration = newDuration;
  }
  function setOscType(newType) {
    oscType = newType;
  }
  function setAttackTime(t) {
    attackTime = t;
  }
  function setReleaseTime(t) {
    releaseTime = t;
  }

  function setInsertDeadSpace(value) {
    insertDeadSpace = !!value; 
  }

  function getFrequency(noteName) {
    return window.NoteFrequencies[noteName] || 440;
  }

  function scheduleNote(freq, startTime, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = oscType;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.8, startTime + attackTime);
    let holdTime = duration - (attackTime + releaseTime);
    if (holdTime < 0) holdTime = 0;
    const holdEnd = startTime + attackTime + holdTime;
    gain.gain.setValueAtTime(0.8, holdEnd);
    gain.gain.linearRampToValueAtTime(0, holdEnd + releaseTime);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    const fullEnd = holdEnd + releaseTime;
    osc.stop(fullEnd);
    activeOscillators.push(osc);
    osc.onended = () => {
      const index = activeOscillators.indexOf(osc);
      if (index >= 0) activeOscillators.splice(index, 1);
    };
  }

  function playArpeggio(noteNames) {
    const startTime = audioCtx.currentTime;
    const step = insertDeadSpace ? noteDuration * 2 : noteDuration;

    noteNames.forEach((note, i) => {
      const freq = getFrequency(note);
      const noteStart = startTime + i * step;
      scheduleNote(freq, noteStart, noteDuration);
    });
  }

  function playRepeatingArpeggio(noteNames) {
    stopArpeggio(); 
    isRepeating = true;

    const step = insertDeadSpace ? noteDuration * 2 : noteDuration;
    const totalArpeggioTime = noteNames.length * step;

    function loopOnce() {
      if (!isRepeating) return;
      playArpeggio(noteNames);
      repeatTimer = setTimeout(loopOnce, totalArpeggioTime * 1000);
    }
    loopOnce();
  }

  function stopArpeggio() {
    activeOscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    activeOscillators = [];

    if (repeatTimer) {
      clearTimeout(repeatTimer);
      repeatTimer = null;
    }
    isRepeating = false;
  }

  window.ArpeggiatorPlayer = {
    playArpeggio,
    playRepeatingArpeggio,
    stopArpeggio,
    setNoteDuration,
    setOscType,
    setAttackTime,
    setReleaseTime,
    setInsertDeadSpace,
    setVolume
  };
})(window);
