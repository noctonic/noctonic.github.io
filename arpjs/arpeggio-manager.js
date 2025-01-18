(function (window) {

  const NOTE_SEMITONES = {
    "C": 0,    "C#": 1, "Db": 1,
    "D": 2,    "D#": 3, "Eb": 3,
    "E": 4,
    "F": 5,    "F#": 6, "Gb": 6,
    "G": 7,    "G#": 8, "Ab": 8,
    "A": 9,    "A#": 10, "Bb": 10,
    "B": 11
  };

  const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11]; 

  let ARPEGGIOS = [];

  function semitoneOffsetToNoteName(semitoneOffset) {
    const noteNamesSharp = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

    const noteInOctave = semitoneOffset % 12;
    if (noteInOctave < 0) {
      return semitoneOffsetToNoteName(12 + semitoneOffset);
    }

    const octave = Math.floor(semitoneOffset / 12);
    const noteName = noteNamesSharp[noteInOctave];
    return noteName + octave;
  }

  function buildScaleOffsetsForKey(keyName, startingOctave) {
    const rootOffsetFromC0 = 12 * startingOctave + (NOTE_SEMITONES[keyName] || 0);
    return MAJOR_SCALE_STEPS.map(step => rootOffsetFromC0 + step);
  }

  function generateArpeggios(keyName, chordSize, startingOctave) {
    const scaleOffsets = buildScaleOffsetsForKey(keyName, startingOctave);
    const chords = [];

    for (let i = 0; i < 7; i++) {
      const chord = [];
      for (let noteIndex = 0; noteIndex < chordSize; noteIndex++) {
        const totalScaleIndex = i + 2 * noteIndex;
        const wraps = Math.floor(totalScaleIndex / 7);
        const scaleDegree = totalScaleIndex % 7;
        const baseOffset = scaleOffsets[scaleDegree];
        const finalOffset = baseOffset + 12 * wraps;
        chord.push(semitoneOffsetToNoteName(finalOffset));
      }
      chords.push(chord);
    }
    return chords;
  }

  function updateArpeggios(newKey, chordSize, startingOctave) {
    ARPEGGIOS = generateArpeggios(newKey, chordSize, startingOctave);
  }

  function getNotesForPartition(partitionIndex) {
    if (!ARPEGGIOS.length) {
      return [];
    }
    const safeIndex = partitionIndex % ARPEGGIOS.length;
    return ARPEGGIOS[safeIndex];
  }
  updateArpeggios("C", 4, 4);

  window.ArpeggioManager = {
    getNotesForPartition,
    updateArpeggios
  };
})(window);
