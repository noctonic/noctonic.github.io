import createModule from './rgcli.mjs';

const Module = await createModule();
const encode = Module.cwrap('wasm_encode', 'number',
  ['string', 'string', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
const decode = Module.cwrap('wasm_decode', 'number',
  ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);

let audioCtx;
let micTrack;
let sourceNode;
let workletNode;
let syncing = false;
let playbackGainNode;

let myCall = localStorage.getItem('callsign') || 'WEB';
let carrierFrequency = parseInt(localStorage.getItem('carrierFrequency')) || 1500;
let noiseSymbols = parseInt(localStorage.getItem('noiseSymbols')) || 0;
const storedWaterfallCallsign = localStorage.getItem('waterfallCallsign');
const legacyFancyHeader = localStorage.getItem('fancyHeader');
let fancyHeader = (storedWaterfallCallsign ?? legacyFancyHeader) === '1';
let appendLocation = localStorage.getItem('appendLocation') === '1';
let lastLocationText = localStorage.getItem('lastLocationText') || '';
let lastLocationTs = parseInt(localStorage.getItem('lastLocationTs')) || 0;
let sampleRate = parseInt(localStorage.getItem('sampleRate')) || 48000;
let outputVolume = parseInt(localStorage.getItem('outputVolume')) || 100;
let aesUnlocked = localStorage.getItem('aesUnlocked') === '1';
let displayLocalTime = (localStorage.getItem('displayLocalTime') ?? '1') === '1';

const LOG_STORAGE_KEY = 'chatLog';
const MAX_LOG_ENTRIES = 500;
let logEntries = [];
const SYSTEM_NICK = 'SYSTEM';

const messages = document.getElementById('messages');
const inputEl  = document.getElementById('input');
const sendBtn = document.getElementById('send');
let lastSentMessage = '';
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const aesWrapper = document.getElementById('aesWrapper');
const clearLogBtn = document.getElementById('clearLogBtn');

const callInput = document.getElementById('callsign');
callInput.value = myCall;
callInput.onchange = () => {
  myCall = callInput.value.trim().toUpperCase() || 'WEB';
  localStorage.setItem('callsign', myCall);
};

const carrierInput = document.getElementById('carrierFrequency');
carrierInput.value = carrierFrequency;
carrierInput.onchange = () => {
  carrierFrequency = parseInt(carrierInput.value) || 1500;
  localStorage.setItem('carrierFrequency', carrierFrequency);
};

const noiseInput = document.getElementById('noiseSymbols');
noiseInput.value = noiseSymbols;
noiseInput.onchange = () => {
  noiseSymbols = parseInt(noiseInput.value) || 0;
  localStorage.setItem('noiseSymbols', noiseSymbols);
};

const waterfallCallsignInput = document.getElementById('fancyHeader');
waterfallCallsignInput.checked = fancyHeader;
waterfallCallsignInput.onchange = () => {
  fancyHeader = waterfallCallsignInput.checked;
  localStorage.setItem('fancyHeader', fancyHeader ? '1' : '0');
  localStorage.removeItem('waterfallCallsign');
};

const appendLocationInput = document.getElementById('appendLocation');
appendLocationInput.checked = appendLocation;
appendLocationInput.onchange = () => {
  appendLocation = appendLocationInput.checked;
  localStorage.setItem('appendLocation', appendLocation ? '1' : '0');
  if (appendLocation) {
    refreshLocation();
  }
  updateByteIndicator();
};

const displayLocalTimeInput = document.getElementById('displayLocalTime');
displayLocalTimeInput.checked = displayLocalTime;
displayLocalTimeInput.onchange = () => {
  displayLocalTime = displayLocalTimeInput.checked;
  localStorage.setItem('displayLocalTime', displayLocalTime ? '1' : '0');
  refreshRenderedTimestamps();
};

const sampleRateSelect = document.getElementById('sampleRate');
sampleRateSelect.value = String(sampleRate);
sampleRateSelect.onchange = async () => {
  sampleRate = parseInt(sampleRateSelect.value);
  localStorage.setItem('sampleRate', sampleRate);
  await initMic();
};

const volumeSlider = document.getElementById('outputVolume');
const volumeLabel = document.getElementById('outputVolumeLabel');
volumeSlider.value = outputVolume;
volumeLabel.textContent = `${outputVolume}%`;
volumeSlider.oninput = () => {
  outputVolume = parseInt(volumeSlider.value);
  volumeLabel.textContent = `${outputVolume}%`;
  if (playbackGainNode) playbackGainNode.gain.value = outputVolume / 100;
  localStorage.setItem('outputVolume', outputVolume);
};

function toggleSettingsPanel(){
  settingsPanel.classList.toggle('hidden');
}
settingsBtn.onclick = toggleSettingsPanel;

if (clearLogBtn) {
  clearLogBtn.addEventListener('click', () => {
    const confirmClear = window.confirm('Clear saved log entries on this device?');
    if (!confirmClear) return;
    clearPersistedLog();
    addMessage('system', SYSTEM_NICK, 'log cleared', undefined, { persist: false });
  });
}

function setAesUnlocked(unlocked){
  aesUnlocked = unlocked;
  localStorage.setItem('aesUnlocked', unlocked ? '1' : '0');
  aesWrapper?.classList.toggle('hidden', !unlocked);
  settingsBtn.classList.toggle('longPressHint', !unlocked);
}

let settingsPressTimer;
const longPressMs = 600;
function clearSettingsPress(){
  if (settingsPressTimer) {
    clearTimeout(settingsPressTimer);
    settingsPressTimer = null;
  }
}

['pointerdown','touchstart','mousedown'].forEach(evt => {
  settingsBtn.addEventListener(evt, () => {
    clearSettingsPress();
    settingsPressTimer = setTimeout(() => {
      setAesUnlocked(!aesUnlocked);
      settingsPressTimer = null;
    }, longPressMs);
  });
});

['pointerup','touchend','mouseleave','touchcancel','mouseup','blur'].forEach(evt => {
  settingsBtn.addEventListener(evt, clearSettingsPress);
});

setAesUnlocked(aesUnlocked);

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtTime(d = new Date(), useLocal = displayLocalTime){
  const year    = useLocal ? d.getFullYear()    : d.getUTCFullYear();
  const month   = useLocal ? d.getMonth() + 1   : d.getUTCMonth() + 1;
  const day     = useLocal ? d.getDate()        : d.getUTCDate();
  const hours   = useLocal ? d.getHours()       : d.getUTCHours();
  const minutes = useLocal ? d.getMinutes()     : d.getUTCMinutes();
  const seconds = useLocal ? d.getSeconds()     : d.getUTCSeconds();
  const suffix = useLocal ? '' : 'Z';
  return `[${year}-${pad2(month)}-${pad2(day)} ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}${suffix}]`;
}

function formatTimestampFromDataset(tsIso){
  const parsed = tsIso ? new Date(tsIso) : new Date();
  return fmtTime(parsed, displayLocalTime);
}

function formatLocation(coords) {
  const lat = coords.latitude;
  const lon = coords.longitude;
  const acc = Number.isFinite(coords.accuracy) ? coords.accuracy : null;
  return acc ? `[${lat},${lon} ±${acc}m]` : `[${lat},${lon}]`;
}

function cacheLocation(text) {
  lastLocationText = text;
  lastLocationTs = Date.now();
  localStorage.setItem('lastLocationText', lastLocationText);
  localStorage.setItem('lastLocationTs', String(lastLocationTs));
}

function refreshLocation() {
  if (!appendLocation) return Promise.resolve(lastLocationText);
  if (!navigator?.geolocation) {
    addMessage('system', SYSTEM_NICK, 'geolocation not supported');
    appendLocation = false;
    localStorage.setItem('appendLocation','0');
    appendLocationInput.checked = false;
    return Promise.reject(new Error('geolocation unavailable'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(pos => {
      const formatted = formatLocation(pos.coords);
      cacheLocation(formatted);
      updateByteIndicator();
      resolve(formatted);
    }, err => {
      addMessage('system', SYSTEM_NICK, `location error: ${err?.message || err}`);
      reject(err);
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 });
  });
}

function persistLogEntry(entry) {
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries = logEntries.slice(-MAX_LOG_ENTRIES);
  }
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logEntries));
  } catch (err) {
    console.warn('log persistence failed', err);
  }
}

function loadPersistedLog() {
  const stored = localStorage.getItem(LOG_STORAGE_KEY);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      logEntries = parsed.filter(entry => entry?.role && entry?.text && entry?.ts);
      logEntries.forEach(entry => {
        addMessage(entry.role, entry.nick, entry.text, entry.ts, { persist: false });
      });
    }
  } catch (err) {
    console.warn('failed to load log', err);
    logEntries = [];
  }
}

function clearPersistedLog() {
  logEntries = [];
  localStorage.removeItem(LOG_STORAGE_KEY);
  messages.innerHTML = '';
  pendingUnread = 0;
  updateTitleBadge();
}

async function ensureLocationPrefixForSend() {
  if (!appendLocation) return '';

  const staleMs = 30000;
  let locationError;
  if (!lastLocationText || Date.now() - lastLocationTs > staleMs) {
    try {
      await refreshLocation();
    } catch (err) {
      locationError = err;
    }
  }

  if (!lastLocationText) {
    if (locationError) {
      addMessage('system', SYSTEM_NICK, `location unavailable: ${locationError?.message || locationError}`);
    }
    return '';
  }

  return `${lastLocationText} `;
}

function createRow(role, nick, plainText, isoTs = new Date().toISOString()){
  const row = document.createElement('div');
  row.className = `row ${role}`;
  row.dataset.ts = isoTs;
  row.dataset.nick = nick || (role === 'system' ? SYSTEM_NICK : '');

  const ts = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = formatTimestampFromDataset(isoTs);

  const nk = document.createElement('span');
  nk.className = 'nick';
  const nickLabel = role === 'system'
    ? SYSTEM_NICK
    : `<${nick || '???'}>`;
  nk.textContent = nickLabel;

  const tx = document.createElement('span');
  tx.className = 'text';
  tx.textContent = plainText;

  row.appendChild(ts);
  row.appendChild(nk);
  row.appendChild(tx);
  return row;
}

function shouldStick(){
  const threshold = 36;
  return messages.scrollHeight - messages.scrollTop - messages.clientHeight < threshold;
}
function scrollToBottom(){
  messages.scrollTop = messages.scrollHeight;
}

function refreshRenderedTimestamps(){
  messages.querySelectorAll('.row').forEach(row => {
    const tsEl = row.querySelector('.ts');
    if (!tsEl) return;
    tsEl.textContent = formatTimestampFromDataset(row.dataset.ts);
  });
}

function addMessage(role, nick, text, isoTs, options = {}){
  const { persist = true } = options;
  const stick = shouldStick();
  const ts = isoTs || new Date().toISOString();
  const row = createRow(role, nick, text, ts);
  messages.appendChild(row);
  if (stick) scrollToBottom();
  if (document.hidden) {
    pendingUnread++;
    updateTitleBadge();
  }
  if (persist) {
    persistLogEntry({ role, nick, text, ts });
  }
}

let baselineTitle = document.title || 'Salamander Chat';
let pendingUnread = 0;
function updateTitleBadge(){
  document.title = pendingUnread > 0 ? `(${pendingUnread}) ${baselineTitle}` : baselineTitle;
}
window.addEventListener('focus', () => { pendingUnread = 0; updateTitleBadge(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { pendingUnread = 0; updateTitleBadge(); }
});

loadPersistedLog();

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

function updateSendButtonLabel() {
  const hasInput = inputEl.value.trim().length > 0;
  const canRecall = lastSentMessage.length > 0;
  sendBtn.textContent = hasInput ? 'Send' : '↻';
  sendBtn.disabled = !hasInput && !canRecall;
  sendBtn.title = hasInput ? 'Send message' : (canRecall ? 'Reuse last message' : 'No previous message');
}

function handleSendClick() {
  const currentText = inputEl.value.trim();
  if (!currentText) {
    if (!lastSentMessage) return;
    inputEl.value = lastSentMessage;
    inputEl.focus();
    updateByteIndicator();
    updateSendButtonLabel();
    return;
  }

  send();
}

sendBtn.onclick = handleSendClick;

async function deriveKeyFromPSK(psk) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(psk));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function aesEncryptToWireBase64(plaintextBytes, psk) {
  const key = await deriveKeyFromPSK(psk);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes));
  const wireBytes = new Uint8Array(iv.length + ct.length);
  wireBytes.set(iv, 0);
  wireBytes.set(ct, iv.length);
  let bin = '';
  for (let i = 0; i < wireBytes.length; i++) bin += String.fromCharCode(wireBytes[i]);
  return btoa(bin);
}
async function aesDecryptFromWireBase64(b64, psk) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length < 12 + 16) throw new Error('cipher too short');
  const iv = bytes.subarray(0, 12);
  const ct = bytes.subarray(12);
  const key = await deriveKeyFromPSK(psk);
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new Uint8Array(pt);
}

function calcOnAirBytes(plainLen, aesOn) {
  if (!aesOn) return plainLen;
  const raw = 12 + plainLen + 16;
  return 4 * Math.ceil(raw / 3);
}

async function initMic() {
  if (!isSecureContext) {
    throw new Error('mic access requires a secure context (https or localhost)');
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('browser does not support microphone access');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      throw new Error('microphone permission denied — enable it in browser or PWA settings');
    }

    if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      throw new Error('no microphone input available');
    }

    throw err;
  }
  if (micTrack) micTrack.stop();
  micTrack = stream.getAudioTracks()[0];

  if (audioCtx) await audioCtx.close();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  await audioCtx.audioWorklet.addModule('decoder-worklet.js');

  sourceNode = audioCtx.createMediaStreamSource(stream);
  workletNode = new AudioWorkletNode(audioCtx, 'decoder-worklet');
  playbackGainNode = audioCtx.createGain();
  playbackGainNode.gain.value = outputVolume / 100;
  playbackGainNode.connect(audioCtx.destination);
  workletNode.port.onmessage = ({ data }) => {
    const samples = data;
    const ptr = Module._malloc(samples.length * 2);
    Module.HEAP16.set(samples, ptr / 2);
    const outPtr = Module._malloc(256);
    const callPtr = Module._malloc(16);
    const len = decode(ptr, samples.length, audioCtx.sampleRate, 1, 0, outPtr, 256, callPtr, 16);

    if (len > 0) {
      const msg = Module.UTF8ToString(outPtr);
      const call = (Module.UTF8ToString(callPtr) || '???').toUpperCase();

      (async () => {
        try {
          const aesOnRx = !!document.getElementById('useAesGcm')?.checked;
          let text;
          if (aesOnRx) {
            const psk = (document.getElementById('psk')?.value || '').trim();
            if (!psk) throw new Error('PSK missing');
            const ptBytes = await aesDecryptFromWireBase64(msg, psk);
            text = new TextDecoder().decode(ptBytes);
          } else {
            text = msg;
          }
          addMessage('them', call, text);
        } catch (e) {
          addMessage('system', SYSTEM_NICK, `decrypt failed: ${e.message || 'unknown error'}`);
          addMessage('them', call, '[unreadable]');
        } finally {
          syncing = false;
        }
      })();

    } else if (len === -2) {
      if (!syncing) addMessage('system', SYSTEM_NICK, 'signal detected');
      syncing = true;
    } else if (len === -5) {
      addMessage('system', SYSTEM_NICK, 'preamble nope');
      syncing = false;
    } else if (len === -6) {
      addMessage('system', SYSTEM_NICK, 'preamble ping');
      syncing = false;
    } else if (len === -1) {
      addMessage('system', SYSTEM_NICK, 'decode failed');
      syncing = false;
    }

    Module._free(ptr);
    Module._free(outPtr);
    Module._free(callPtr);
  };

  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  sourceNode.connect(workletNode).connect(gain).connect(audioCtx.destination);

  addMessage('system', SYSTEM_NICK, `mic initialized @ ${audioCtx.sampleRate} Hz`);
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;

  const prefix = await ensureLocationPrefixForSend();
  const textWithLocation = prefix ? `${prefix}${text}` : text;

  const aesOn = !!document.getElementById('useAesGcm')?.checked;
  const psk   = (document.getElementById('psk')?.value || '').trim();

  const plainLen = new TextEncoder().encode(textWithLocation).length;
  const predicted = calcOnAirBytes(plainLen, aesOn);
  if (predicted > 170) {
    addMessage('system', SYSTEM_NICK, `message too long ${aesOn ? 'after encryption ' : ''}(${predicted} > 170). Shorten it.`);
    return;
  }


  let wireStr;
  if (aesOn) {
    if (!psk) { addMessage('system', SYSTEM_NICK, 'encryption enabled but PSK empty'); return; }
    try {
      const ptBytes = new TextEncoder().encode(textWithLocation);
      wireStr = await aesEncryptToWireBase64(ptBytes, psk);
    } catch (e) {
      addMessage('system', SYSTEM_NICK, `encryption error: ${e.message || e}`);
      return;
    }
  } else {
    wireStr = textWithLocation;
  }

  addMessage('me', myCall, aesOn ? `🔒 ${textWithLocation}` : textWithLocation);
  lastSentMessage = text;
  inputEl.value = '';
  updateByteIndicator();
  updateSendButtonLabel();

  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch {}
  } else if (!audioCtx) {
    await initMic();
  }

  const rate = audioCtx.sampleRate;
  const maxSamples = rate * 10;
  const ptr = Module._malloc(maxSamples * 2);
  const written = encode(wireStr, myCall, carrierFrequency, noiseSymbols, fancyHeader ? 1 : 0, rate, 0, ptr, maxSamples);

  const samples = new Int16Array(Module.HEAP16.buffer, ptr, written);
  const buffer = audioCtx.createBuffer(1, written, rate);
  const float = new Float32Array(written);
  for (let i = 0; i < written; i++) float[i] = samples[i] / 32768;

  buffer.getChannelData(0).set(float);
  Module._free(ptr);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(playbackGainNode || audioCtx.destination);

  const mute = document.getElementById('muteDuringTx').checked;
  if (mute && micTrack) micTrack.enabled = false;

  src.start();
  src.onended = () => {
    if (mute && micTrack) micTrack.enabled = true;
  };
}

initMic().catch(err => {
  console.error(err);
  const detail = err?.message ? `: ${err.message}` : '';
  addMessage('system', SYSTEM_NICK, `mic init failed${detail}`);
});

document.querySelectorAll('#messages .row').forEach(row => {
  const ts = row.querySelector('.ts');
  const nk = row.querySelector('.nick');
  if (!row.dataset.ts) row.dataset.ts = new Date().toISOString();
  if (ts) ts.textContent = formatTimestampFromDataset(row.dataset.ts);
  if (nk && !nk.textContent) nk.textContent = `<${row.dataset.nick || '???'}>`;
});

const byteIndicator = document.getElementById('byteIndicator');
const maxBytes = 170;

const aesCheckbox = document.getElementById('useAesGcm');
const pskInput = document.getElementById('psk');

function updateByteIndicator() {
  const baseText = inputEl.value.trim();
  const previewPrefix = appendLocation && lastLocationText ? `${lastLocationText} ` : '';
  const plainLen = new TextEncoder().encode(`${previewPrefix}${baseText}`).length;
  const aesOn = !!aesCheckbox?.checked;
  const wireBytes = calcOnAirBytes(plainLen, aesOn);

  byteIndicator.textContent = `${wireBytes} / ${maxBytes} bytes${aesOn ? ' (enc)' : ''}`;
  byteIndicator.classList.toggle('over', wireBytes > maxBytes);
}
inputEl.addEventListener('input', () => {
  updateByteIndicator();
  updateSendButtonLabel();
});
aesCheckbox?.addEventListener('change', updateByteIndicator);

updateByteIndicator();
updateSendButtonLabel();

if (appendLocation) {
  refreshLocation();
}

const dangerZone = document.getElementById('dangerZone');
const dangerZoneFields = document.getElementById('dangerZoneFields');

if (dangerZone && dangerZoneFields) {
  dangerZoneFields.classList.toggle('hidden', !dangerZone.checked);
  dangerZone.addEventListener('change', () => {
    dangerZoneFields.classList.toggle('hidden', !dangerZone.checked);
    updateByteIndicator();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('service worker failed', err);
    });
  });
}
