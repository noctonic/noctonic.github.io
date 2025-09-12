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

let myCall = localStorage.getItem('callsign') || 'WEB';
let carrierFrequency = parseInt(localStorage.getItem('carrierFrequency')) || 1500;
let noiseSymbols = parseInt(localStorage.getItem('noiseSymbols')) || 0;
let fancyHeader = localStorage.getItem('fancyHeader') === '1';
let sampleRate = parseInt(localStorage.getItem('sampleRate')) || 48000;
let channel = parseInt(localStorage.getItem('channel')) || 0;

const messages = document.getElementById('messages');
const inputEl  = document.getElementById('input');
document.getElementById('send').onclick = send;
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');

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

const fancyInput = document.getElementById('fancyHeader');
fancyInput.checked = fancyHeader;
fancyInput.onchange = () => {
  fancyHeader = fancyInput.checked;
  localStorage.setItem('fancyHeader', fancyHeader ? '1' : '0');
};

const sampleRateSelect = document.getElementById('sampleRate');
sampleRateSelect.value = String(sampleRate);
sampleRateSelect.onchange = async () => {
  sampleRate = parseInt(sampleRateSelect.value);
  localStorage.setItem('sampleRate', sampleRate);
  await initMic();
};

const channelSelect = document.getElementById('channel');
channelSelect.value = String(channel);
channelSelect.onchange = () => {
  channel = parseInt(channelSelect.value);
  localStorage.setItem('channel', channel);
};

settingsBtn.onclick = () => settingsPanel.classList.toggle('hidden');

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtTime(d = new Date()){
  return `[${pad2(d.getHours())}:${pad2(d.getMinutes())}]`;
}

function linkify(text){
  const esc = text
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
  return esc.replace(
    /\b(https?:\/\/[^\s<]+[^\s<\.)])/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function createRow(role, nick, htmlText, timeStr = fmtTime()){
  const row = document.createElement('div');
  row.className = `row ${role}`;
  row.dataset.ts = timeStr;
  row.dataset.nick = nick;

  const ts = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = timeStr;

  const nk = document.createElement('span');
  nk.className = 'nick';
  nk.textContent = `<${nick || (role==='system' ? '***' : '???')}>`;

  const tx = document.createElement('span');
  tx.className = 'text';
  tx.innerHTML = htmlText;

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

function highlightMentions(text, nick = '') {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function addMessage(role, nick, text){
  const stick = shouldStick();
  const html = highlightMentions(text, nick);
  const row = createRow(role, nick, html);
  messages.appendChild(row);
  if (stick) scrollToBottom();
  if (document.hidden) {
    pendingUnread++;
    updateTitleBadge();
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

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

async function initMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (micTrack) micTrack.stop();
  micTrack = stream.getAudioTracks()[0];

  if (audioCtx) await audioCtx.close();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  await audioCtx.audioWorklet.addModule('decoder-worklet.js');

  sourceNode = audioCtx.createMediaStreamSource(stream);
  workletNode = new AudioWorkletNode(audioCtx, 'decoder-worklet');
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
      addMessage('them', call, msg);
      syncing = false;
    } else if (len === -2) {
      if (!syncing) addMessage('system', '***', 'signal detected');
      syncing = true;
    } else if (len === -5) {
      addMessage('system', '***', 'preamble nope');
      syncing = false;
    } else if (len === -6) {
      addMessage('system', '***', 'preamble ping');
      syncing = false;
    } else if (len === -1) {
      addMessage('system', '***', 'decode failed');
      syncing = false;
    }

    Module._free(ptr);
    Module._free(outPtr);
    Module._free(callPtr);
  };

  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  sourceNode.connect(workletNode).connect(gain).connect(audioCtx.destination);

  addMessage('system', '***', `mic initialized @ ${audioCtx.sampleRate} Hz`);
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  addMessage('me', myCall, text);

  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch {}

  } else if (!audioCtx) {
    await initMic();
  }

  const rate = audioCtx.sampleRate;
  const maxSamples = rate * 10;
  const ptr = Module._malloc(maxSamples * 2);
  const written = encode(text, myCall, carrierFrequency, noiseSymbols, fancyHeader ? 1 : 0, rate, channel, ptr, maxSamples);

  const samples = new Int16Array(Module.HEAP16.buffer, ptr, written);
  const buffer = audioCtx.createBuffer(1, written, rate);
  const float = new Float32Array(written);
  for (let i = 0; i < written; i++) float[i] = samples[i] / 32768;
  buffer.getChannelData(0).set(float);
  Module._free(ptr);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(audioCtx.destination);

  const mute = document.getElementById('muteDuringTx').checked;
  if (mute && micTrack) micTrack.enabled = false;

  src.start();
  src.onended = () => {
    if (mute && micTrack) micTrack.enabled = true;
  };
}

initMic().catch(err => {
  console.error(err);
  addMessage('system', '***', 'mic init failed — allow microphone access');
});

document.querySelectorAll('#messages .row').forEach(row => {
  const ts = row.querySelector('.ts');
  const nk = row.querySelector('.nick');
  const tx = row.querySelector('.text');
  if (ts && !ts.textContent) ts.textContent = row.dataset.ts || fmtTime();
  if (nk && !nk.textContent) nk.textContent = `<${row.dataset.nick || '???'}>`;
  if (tx && tx.textContent) tx.innerHTML = linkify(tx.textContent);
});
