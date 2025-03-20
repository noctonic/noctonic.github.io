(function() {
  const pollIntervalMs = 100;
  const PARTITIONS = window.CircleUI.getPartitions();
  const anglePerPartition = 360 / PARTITIONS;

  let lastPartitionIndex = -1;

  function pollCursor() {
    const { angle } = window.CircleUI.getCursorPolar();
    let angle12 = angle + 90;
    if (angle12 < 0) angle12 += 360;
    if (angle12 >= 360) angle12 -= 360;
    const halfPartition = anglePerPartition / 2;
    let shifted = angle12 + halfPartition;
    shifted = shifted % 360;

    const partitionIndex = Math.floor(shifted / anglePerPartition);

    if (partitionIndex !== lastPartitionIndex) {
      lastPartitionIndex = partitionIndex;
      console.log("Partition =>", partitionIndex);

      ArpeggiatorPlayer.stopArpeggio();

      const notes = ArpeggioManager.getNotesForPartition(partitionIndex);
      ArpeggiatorPlayer.playRepeatingArpeggio(notes);
    }
  }

  setInterval(pollCursor, pollIntervalMs);

  // === ADD A GLOBAL ACCESSOR ===
  window.CirclePolling = {
    getCurrentPartitionIndex() {
      return lastPartitionIndex;
    }
  };

})();
