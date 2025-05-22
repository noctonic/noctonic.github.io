// CodeMirror IDE integration for Lua playground

import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

let editor;
let master;

export function initIde(masterPty) {
  master = masterPty;
  editor = CodeMirror.fromTextArea(document.getElementById('src'), {
    mode: 'text/x-lua',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    autofocus: true,
    theme: 'solarized dark'
  });
  editor.addKeyMap({ 'Ctrl-Enter': runLua, 'Cmd-Enter': runLua });
  document.getElementById('run').onclick = runLua;
  document.getElementById('download').onclick = downloadProject;
  editor.setValue('print("Hello World!")');

  setupExampleToggle();
  loadExamples();
}

function runLua() {
  if (!master) return;
  const code = editor.getValue();
  // Base64-encode the Lua source
  const encoded = btoa(unescape(encodeURIComponent(code)));
  const doneToken = 'noctonic';

  master.suppressOutput();
  const decoder = new TextDecoder();
  let buf = '';
  // set up your onWrite listener once
  const listener = master.onWrite(([data, ack]) => {
    buf += decoder.decode(data);
    if (buf.includes(doneToken)) {
      listener.dispose();
      master.resumeOutput();
      master.ldisc.writeFromLower('lua /tmp/main.lua\r');
    }
  });

  const chunkSize = 1024;
  for (let i = 0; i < encoded.length; i += chunkSize) {
    const chunk = encoded.slice(i, i + chunkSize);
    // first chunk overwrites, rest append
    const redir = i === 0 ? '>' : '>>';
    const cmd = `echo ${chunk} | base64 -d ${redir} /tmp/main.lua`;
    master.ldisc.writeFromLower(cmd + '\r');
  }

  // finally emit the done token
  master.ldisc.writeFromLower(`sh -c \"echo bm9jdG9uaWM= | base64 -d &\"\r`);
}


async function downloadProject() {
  const zip = new JSZip();
  zip.file('main.lua', editor.getValue());
  try {
    const resp = await fetch('/lua-libs/example.lua');
    if (resp.ok) {
      zip.file('example.lua', await resp.text());
    }
  } catch (e) {
    console.error('unable to fetch libs', e);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: 'lua-project.zip',
    style: 'display:none'
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setupExampleToggle() {
  const toggle = document.getElementById('toggle-examples');
  const panel = document.getElementById('example-panel');
  if (!toggle || !panel) return;
  toggle.onclick = () => panel.classList.toggle('open');
}

async function loadExamples() {
  const listEl = document.getElementById('example-list');
  if (!listEl) return;
  try {
    const resp = await fetch('./examples/examples.json');
    if (!resp.ok) return;
    const data = await resp.json();
    for (const [file, code] of Object.entries(data)) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = file;
      a.href = '#';
      a.onclick = (e) => {
        e.preventDefault();
        editor.setValue(code);
      };
      li.appendChild(a);
      listEl.appendChild(li);
    }
  } catch (e) {
    console.error('failed to load examples', e);
  }
}
