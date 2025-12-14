(function(){
  const DemoRegistry = Object.create(null);

  function safeJsonParse(s, fallback = null){
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function clear(node){
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, cls){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function registerDemo(name, fn){
    DemoRegistry[name] = fn;
  }

  function mountAllDemos(){
    document.querySelectorAll("[data-demo]").forEach(node => {
      const name = node.getAttribute("data-demo");
      const optsRaw = node.getAttribute("data-demo-opts");
      const opts = optsRaw ? safeJsonParse(optsRaw, {}) : {};

      const fn = DemoRegistry[name];
      clear(node);

      if (!fn) return;
      fn(node, opts);
    });
  }

  window.Demos = { registerDemo, mountAllDemos };

  registerDemo("neighborhoodSquares", (mount, opts) => {
    const order = (opts && opts.order) || "desc";
    const base = Array.from({ length: 8 }, (_, i) => i);
    const cases = (order === "asc") ? base : base.slice().reverse();

    const stack = el("div", "sqStack");

    for (const n of cases){
      const bits = n.toString(2).padStart(3, "0");
      const row = el("div", "sqRow");

      for (const b of bits){
        const sq = el("div", "sq" + (b === "1" ? " on" : ""));
        row.appendChild(sq);
      }

      stack.appendChild(row);
    }

    mount.appendChild(stack);
  });

    Demos.registerDemo("caseTable", (mount, opts) => {
    const order = (opts && opts.order) || "asc";
    const nums = Array.from({ length: 8 }, (_, i) => i);
    const cases = (order === "desc") ? nums.slice().reverse() : nums;

    const table = document.createElement("table");
    table.className = "caseTable";
    table.innerHTML = `
        <thead>
        <tr>
            <th>decimal</th>
            <th>binary</th>
            <th>squares</th>
        </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    for (const n of cases){
        const bits = n.toString(2).padStart(3, "0");

        const tr = document.createElement("tr");
        const tdDec = document.createElement("td");
        const tdBin = document.createElement("td");
        const tdSq  = document.createElement("td");

        tdDec.textContent = String(n);
        tdBin.innerHTML = `<code>${bits}</code>`;

        const row = document.createElement("div");
        row.className = "sqRow";
        for (const b of bits){
        const sq = document.createElement("div");
        sq.className = "sq" + (b === "1" ? " on" : "");
        row.appendChild(sq);
        }
        tdSq.appendChild(row);

        tr.appendChild(tdDec);
        tr.appendChild(tdBin);
        tr.appendChild(tdSq);
        tbody.appendChild(tr);
    }

    mount.appendChild(table);
    });
    registerDemo("ruleGen", (mount, opts) => {
    const CASES = [7,6,5,4,3,2,1,0];
    const bits = new Array(8).fill(0);

    const clamp255 = (n) => Math.max(0, Math.min(255, n));

    const root = el("div", "ruleGen");

    const labelRow = el("div", "rgGrid");
    CASES.forEach(c => {
        const lab = el("div", "rgLabel");
        lab.textContent = String(c);
        labelRow.appendChild(lab);
    });

    const cellRow = el("div", "rgGrid");
    const cellBtn = {};

    CASES.forEach(c => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sq rgCell";
        b.setAttribute("aria-label", `case ${c} output`);
        b.addEventListener("click", () => {
        bits[c] = bits[c] ? 0 : 1;
        syncFromBits();
        });
        cellBtn[c] = b;
        cellRow.appendChild(b);
    });

    const outRow = el("div", "rgOut");
    const binCode = document.createElement("code");
    binCode.className = "rgBin";

    const eq = el("span", "muted");
    eq.textContent = "=";

    const decInput = document.createElement("input");
    decInput.className = "rgDec";
    decInput.type = "number";
    decInput.min = "0";
    decInput.max = "255";
    decInput.step = "1";
    decInput.inputMode = "numeric";

    outRow.appendChild(binCode);
    outRow.appendChild(eq);
    outRow.appendChild(decInput);

    root.appendChild(labelRow);
    root.appendChild(cellRow);
    root.appendChild(outRow);
    mount.appendChild(root);

    function render(binStr, dec){
        binCode.textContent = binStr;
        decInput.value = String(dec);

        CASES.forEach(c => {
        cellBtn[c].classList.toggle("on", !!bits[c]);
        });
    }

    function syncFromBits(){
        const binStr = CASES.map(c => (bits[c] ? "1" : "0")).join("");
        const dec = parseInt(binStr, 2);
        render(binStr, dec);
    }

    function setFromDecimal(dec){
        const d = clamp255(Math.floor(dec));
        const binStr = d.toString(2).padStart(8, "0");

        for (let i = 0; i < 8; i++){
        const c = CASES[i];
        bits[c] = (binStr[i] === "1") ? 1 : 0;
        }
        render(binStr, d);
    }

    decInput.addEventListener("input", () => {
        const raw = decInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        setFromDecimal(n);
    });

    decInput.addEventListener("blur", () => {
        if (decInput.value.trim() === "") syncFromBits();
    });

    const initial =
        (opts && Number.isFinite(opts.decimal)) ? opts.decimal :
        (opts && Number.isFinite(opts.rule)) ? opts.rule :
        0;

    setFromDecimal(initial);
    });

    registerDemo("3cellgame", (mount, opts) => {
    const CASES = [7,6,5,4,3,2,1,0];

    let rule =
        (opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30;

    let start = (opts && typeof opts.start === "string") ? opts.start.trim() : "010";
    if (!/^[01]{3}$/.test(start)) start = "010";

    let pqr = start.split("").map(ch => ch === "1" ? 1 : 0);

    const clamp255 = (n) => Math.max(0, Math.min(255, n|0));
    rule = clamp255(rule);

    const root = el("div", "g3Wrap");

    const controls = el("div", "g3Controls");

    const lab = document.createElement("label");
    lab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "g3RuleNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleInput.value = String(rule);

    const binCode = document.createElement("code");
    binCode.className = "g3RuleBin";

    controls.appendChild(lab);
    controls.appendChild(ruleInput);
    controls.appendChild(binCode);

    const ruleset = el("div", "g3Rules");

    const labelGrid = el("div", "g3RuleGrid");
    CASES.forEach(c => {
        const d = el("div", "g3RuleLab");
        d.textContent = String(c);
        labelGrid.appendChild(d);
    });

    const bitGrid = el("div", "g3RuleGrid");
    const bitSq = {};
    CASES.forEach(c => {
        const s = el("div", "sq g3Bit");
        bitSq[c] = s;
        bitGrid.appendChild(s);
    });

    ruleset.appendChild(labelGrid);
    ruleset.appendChild(bitGrid);

    const boardWrap = el("div", "g3BoardWrap");

    const inLabel = el("div", "g3BoardLabel");
    inLabel.textContent = "initial state";

    const board = el("div", "g3Board");

    const outLabel = el("div", "g3BoardLabel g3OutLabel");
    outLabel.textContent = "output";


    const pBtn = document.createElement("button");
    pBtn.type = "button";
    pBtn.className = "sq g3Cell";
    pBtn.style.gridRow = "1";
    pBtn.style.gridColumn = "1";
    pBtn.setAttribute("aria-label", "toggle p");

    const qBtn = document.createElement("button");
    qBtn.type = "button";
    qBtn.className = "sq g3Cell";
    qBtn.style.gridRow = "1";
    qBtn.style.gridColumn = "2";
    qBtn.setAttribute("aria-label", "toggle q");

    const rBtn = document.createElement("button");
    rBtn.type = "button";
    rBtn.className = "sq g3Cell";
    rBtn.style.gridRow = "1";
    rBtn.style.gridColumn = "3";
    rBtn.setAttribute("aria-label", "toggle r");

    const out = el("div", "sq g3Out");
    out.style.gridRow = "2";
    out.style.gridColumn = "2";

    board.appendChild(pBtn);
    board.appendChild(qBtn);
    board.appendChild(rBtn);
    board.appendChild(out);

    const topRow = el("div", "g3Controls");
    topRow.appendChild(lab);
    topRow.appendChild(ruleInput);
    topRow.appendChild(binCode);
    topRow.appendChild(ruleset);

    boardWrap.appendChild(inLabel);
    boardWrap.appendChild(board);
    boardWrap.appendChild(outLabel);

    root.appendChild(topRow);
    root.appendChild(boardWrap);


    mount.appendChild(root);

    function caseNum(){
        return (pqr[0] << 2) | (pqr[1] << 1) | (pqr[2]);
    }

    function bitForCase(c){
        return (rule >> c) & 1;
    }

    function sync(){
        rule = clamp255(rule);

        const bin = rule.toString(2).padStart(8, "0");
        binCode.textContent = bin;
        ruleInput.value = String(rule);

        const cNow = caseNum();
        CASES.forEach(c => {
        const b = bitForCase(c);
        bitSq[c].classList.toggle("on", b === 1);
        bitSq[c].classList.toggle("active", c === cNow);
        });

        pBtn.classList.toggle("on", pqr[0] === 1);
        qBtn.classList.toggle("on", pqr[1] === 1);
        rBtn.classList.toggle("on", pqr[2] === 1);

        const outBit = bitForCase(cNow);
        out.classList.toggle("on", outBit === 1);
    }

    function toggleIdx(i){
        pqr[i] = pqr[i] ? 0 : 1;
        sync();
    }

    pBtn.addEventListener("click", () => toggleIdx(0));
    qBtn.addEventListener("click", () => toggleIdx(1));
    rBtn.addEventListener("click", () => toggleIdx(2));

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = Math.floor(n);
        sync();
    });

    ruleInput.addEventListener("blur", () => {
        const n = Number(ruleInput.value);
        rule = Number.isFinite(n) ? Math.floor(n) : rule;
        sync();
    });


    sync();
    });

    registerDemo("10cellgame", (mount, opts) => {
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n|0));

    let rule = (opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30;
    let steps = (opts && Number.isFinite(opts.steps)) ? Math.floor(opts.steps) : 8;

    rule = clamp(rule, 0, 255);
    steps = clamp(steps, 1, 32);

    const root = el("div", "g10Wrap");

    const controls = el("div", "g10Controls");

    const ruleLab = document.createElement("label");
    ruleLab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "g10Num";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleInput.value = String(rule);

    const binCode = document.createElement("code");
    binCode.className = "g10Bin";

    const stepsLab = document.createElement("label");
    stepsLab.textContent = "steps";

    const stepsInput = document.createElement("input");
    stepsInput.className = "g10Num";
    stepsInput.type = "number";
    stepsInput.min = "8";
    stepsInput.max = "8";
    stepsInput.step = "1";
    stepsInput.value = String(steps);

    controls.appendChild(ruleLab);
    controls.appendChild(ruleInput);
    controls.appendChild(binCode);
    controls.appendChild(stepsLab);
    controls.appendChild(stepsInput);

    const rowsEl = el("div", "g10Rows");

    root.appendChild(controls);
    root.appendChild(rowsEl);
    mount.appendChild(root);

    const bitForCase = (c) => (rule >> c) & 1;

    function computeRows(){
        let prev = [1];
        const rows = [prev];

        for (let t = 0; t < steps; t++){
        const ext = [0, ...prev, 0];

        const next = new Array(ext.length).fill(0);

        for (let i = 0; i < ext.length; i++){
            const p = (i > 0) ? ext[i - 1] : 0;
            const q = ext[i];
            const r = (i + 1 < ext.length) ? ext[i + 1] : 0;
            const c = (p << 2) | (q << 1) | r;
            next[i] = bitForCase(c);
        }

        rows.push(next);
        prev = next;
        }

        return rows;
    }

    function render(){
        rule = clamp(rule, 0, 255);
        steps = clamp(steps, 1, 32);

        binCode.textContent = rule.toString(2).padStart(8, "0");
        ruleInput.value = String(rule);
        stepsInput.value = String(steps);

        const rows = computeRows();

        clear(rowsEl);
        for (let t = 0; t < rows.length; t++){
        const rowDiv = el("div", "g10Row");
        for (const v of rows[t]){
            rowDiv.appendChild(el("div", "sq" + (v ? " on" : "")));
        }
        rowsEl.appendChild(rowDiv);
        }
    }

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = Math.floor(n);
        render();
    });


    render();
    });

    registerDemo("rule30slice5steps10", (mount, opts) => {
    const STEPS = 10;
    const W = 5;

    const clamp255 = (n) => Math.max(0, Math.min(255, n|0));

    let rule = clamp255((opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30);
    let seed = ((opts && Number.isFinite(opts.seed)) ? (opts.seed|0) : 1);

    function makeRng(s){
        let x = (s >>> 0) || 1;
        return () => (x = (1664525 * x + 1013904223) >>> 0);
    }

    function stepRow5(row, leftOut, rightOut, ruleNum){
        const next = new Array(W).fill(0);
        for (let i = 0; i < W; i++){
        const p = (i === 0) ? leftOut : row[i - 1];
        const q = row[i];
        const r = (i === W - 1) ? rightOut : row[i + 1];
        const c = (p << 2) | (q << 1) | r;
        next[i] = (ruleNum >> c) & 1;
        }
        return next;
    }

    function computeTruth(ruleNum){
        const fullW = W + 2 * STEPS;
        const center = Math.floor(fullW / 2);

        let line = new Array(fullW).fill(0);
        line[center] = 1;

        const out = [];
        for (let t = 0; t <= STEPS; t++){
        out.push(line.slice(center - 2, center + 3));

        const next = new Array(fullW).fill(0);
        for (let i = 0; i < fullW; i++){
            const p = (i > 0) ? line[i - 1] : 0;
            const q = line[i];
            const r = (i + 1 < fullW) ? line[i + 1] : 0;
            const c = (p << 2) | (q << 1) | r;
            next[i] = (ruleNum >> c) & 1;
        }
        line = next;
        }
        return out;
    }

    function computeAssumed(ruleNum, mode, seedVal){
        let row = [0,0,1,0,0];
        const out = [row];

        const rng = makeRng(seedVal);

        for (let t = 0; t < STEPS; t++){
        let L = 0, R = 0;
        if (mode === "dead"){
            L = 0; R = 0;
        } else if (mode === "alive"){
            L = 1; R = 1;
        } else if (mode === "random"){

            L = (rng() >>> 31) & 1;
            R = (rng() >>> 31) & 1;


        }
        row = stepRow5(row, L, R, ruleNum);
        out.push(row);
        }
        return out;
    }

    const root = el("div", "sliceWrap");

    const controls = el("div", "sliceControls");

    const ruleLab = document.createElement("label");
    ruleLab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "sliceNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleInput.value = String(rule);

    const seedLab = document.createElement("label");
    seedLab.textContent = "seed";

    const seedInput = document.createElement("input");
    seedInput.className = "sliceNum";
    seedInput.type = "number";
    seedInput.step = "1";
    seedInput.value = String(seed);

    const reroll = document.createElement("button");
    reroll.type = "button";
    reroll.className = "sliceBtn";
    reroll.textContent = "reroll";

    controls.appendChild(ruleLab);
    controls.appendChild(ruleInput);
    controls.appendChild(seedLab);
    controls.appendChild(seedInput);
    controls.appendChild(reroll);

    const panels = el("div", "slicePanels");

    function makePanel(title){
        const p = el("div", "slicePanel");
        const t = el("div", "sliceTitle");
        t.textContent = title;

        const g = el("div", "sliceGrid");
        const cells = [];
        for (let i = 0; i < (STEPS + 1) * W; i++){
        const sq = el("div", "sq");
        cells.push(sq);
        g.appendChild(sq);
        }

        p.appendChild(t);
        p.appendChild(g);
        return { panel: p, cells };
    }

    const P_truth  = makePanel("truth");
    const P_dead   = makePanel("dead");
    const P_alive  = makePanel("alive");
    const P_rand   = makePanel("random");

    panels.appendChild(P_truth.panel);
    panels.appendChild(P_dead.panel);
    panels.appendChild(P_alive.panel);
    panels.appendChild(P_rand.panel);

    root.appendChild(controls);
    root.appendChild(panels);
    mount.appendChild(root);

    function paint(panelCells, rows){
        let k = 0;
        for (let t = 0; t <= STEPS; t++){
        for (let i = 0; i < W; i++){
            panelCells[k].classList.toggle("on", rows[t][i] === 1);
            k++;
        }
        }
    }

    function render(){
        rule = clamp255(rule);
        ruleInput.value = String(rule);

        const truth = computeTruth(rule);
        const dead  = computeAssumed(rule, "dead", seed);
        const alive = computeAssumed(rule, "alive", seed);
        const rand  = computeAssumed(rule, "random", seed);

        paint(P_truth.cells, truth);
        paint(P_dead.cells, dead);
        paint(P_alive.cells, alive);
        paint(P_rand.cells, rand);
    }

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = Math.floor(n);
        render();
    });

    seedInput.addEventListener("input", () => {
        const raw = seedInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        seed = n|0;
        render();
    });

    reroll.addEventListener("click", () => {
        seed = (seed|0) + 1;
        seedInput.value = String(seed);
        render();
    });

    render();
    });

    registerDemo("basiccawithcolors", (mount, opts) => {
    const CASE_COLORS = [
        "#60a5fa", 
        "#34d399", 
        "#fbbf24", 
        "#fb7185", 
        "#a78bfa", 
        "#f97316", 
        "#22c55e", 
        "#38bdf8", 
    ];

    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n|0));
    const toOdd = (n) => (n % 2 === 0) ? n + 1 : n;

    let rule  = clamp((opts && Number.isFinite(opts.rule))  ? Math.floor(opts.rule)  : 30, 0, 255);
    let steps = clamp((opts && Number.isFinite(opts.steps)) ? Math.floor(opts.steps) : 10, 1, 80);
    let width = clamp((opts && Number.isFinite(opts.width)) ? toOdd(Math.floor(opts.width)) : 21, 9, 201);

    const root = el("div", "ccWrap");

    const bar = el("div", "ccBar");

    const ruleLab = document.createElement("label");
    ruleLab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "ccNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleInput.value = String(rule);

    const stepsLab = document.createElement("label");
    stepsLab.textContent = "steps";

    const stepsInput = document.createElement("input");
    stepsInput.className = "ccNum";
    stepsInput.type = "number";
    stepsInput.min = "1";
    stepsInput.max = "80";
    stepsInput.step = "1";
    stepsInput.value = String(steps);

    const widthLab = document.createElement("label");
    widthLab.textContent = "width";

    const widthInput = document.createElement("input");
    widthInput.className = "ccNum";
    widthInput.type = "number";
    widthInput.min = "9";
    widthInput.max = "201";
    widthInput.step = "2";
    widthInput.value = String(width);

    bar.appendChild(ruleLab);
    bar.appendChild(ruleInput);
    bar.appendChild(stepsLab);
    bar.appendChild(stepsInput);
    bar.appendChild(widthLab);
    bar.appendChild(widthInput);

    const legendWrap = document.createElement("div");
    legendWrap.style.display = "flex";
    legendWrap.style.flexDirection = "column";
    legendWrap.style.gap = "6px";

    const legendNums = el("div", "ccLegend");
    const legendSw  = el("div", "ccLegend");
    const legendSwatchByCase = new Array(8);


    legendWrap.appendChild(legendNums);
    legendWrap.appendChild(legendSw);

    const gridWrap = el("div", "ccGridWrap");
    const grid = el("div", "ccGrid");
    gridWrap.appendChild(grid);

    root.appendChild(bar);
    root.appendChild(legendWrap);
    root.appendChild(gridWrap);
    mount.appendChild(root);
    function syncLegend(){
    for (let c = 0; c < 8; c++){
        const sw = legendSwatchByCase[c];
        if (!sw) continue;
        const on = bitForCase(c) === 1;
        sw.classList.toggle("on", on);
        sw.title = `case ${c} → output ${on ? 1 : 0}`;
    }
    }

    let cellEl = []; 

    function buildCells(){
        clear(grid);
        cellEl = [];
        for (let t = 0; t <= steps; t++){
        const row = el("div", "ccRow");
        const refs = [];
        for (let i = 0; i < width; i++){
            const d = el("div", "ccCell");
            refs.push(d);
            row.appendChild(d);
        }
        cellEl.push(refs);
        grid.appendChild(row);
        }
    }

    function bitForCase(c){
        return (rule >> c) & 1;
    }
    for (let c = 7; c >= 0; c--){
    const lab = el("div", "ccLegendLab");
    lab.textContent = String(c);
    legendNums.appendChild(lab);

    const sw = el("div", "ccSwatch");
    sw.style.setProperty("--c", CASE_COLORS[c]);
    legendSw.appendChild(sw);

    legendSwatchByCase[c] = sw;
    }

    function compute(){

        let prev = new Array(width).fill(0);
        prev[Math.floor(width / 2)] = 1;

        const states = [prev.slice()];
        const cases  = [new Array(width).fill(-1)];

        for (let t = 1; t <= steps; t++){
        const next = new Array(width).fill(0);
        const cRow = new Array(width).fill(0);

        for (let i = 0; i < width; i++){
            const p = (i > 0) ? prev[i - 1] : 0;
            const q = prev[i];
            const r = (i + 1 < width) ? prev[i + 1] : 0;

            const c = (p << 2) | (q << 1) | r;
            cRow[i] = c;
            next[i] = bitForCase(c);
        }

        states.push(next);
        cases.push(cRow);
        prev = next;
        }

        return { states, cases };
    }

    function paint(){
        syncLegend();
        const { states, cases } = compute();

        for (let t = 0; t <= steps; t++){
        for (let i = 0; i < width; i++){
            const state = states[t][i] & 1;
            const c = cases[t][i];

            const nibble = ((state & 1) << 3) | ((c < 0 ? 0 : c) & 7);
            const bits4 = nibble.toString(2).padStart(4, "0");

            const cell = cellEl[t][i];
            cell.classList.toggle("on", state === 1);
            cell.classList.toggle("seed", t === 0);

            const color = (t === 0) ? "#9ca3af" : CASE_COLORS[c];
            cell.style.setProperty("--c", color);

            cell.title = (t === 0)
            ? `seed: state ${state}`
            : `case ${c}, state ${state}, bits ${bits4} (${nibble})`;
        }
        }
    }

    function rebuildAndPaint(){
        buildCells();
        paint();
    }

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = clamp(Math.floor(n), 0, 255);
        paint();
    });

    stepsInput.addEventListener("input", () => {
        const raw = stepsInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        steps = clamp(Math.floor(n), 1, 80);
        rebuildAndPaint();
    });

    widthInput.addEventListener("input", () => {
        const raw = widthInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        width = clamp(toOdd(Math.floor(n)), 9, 201);
        widthInput.value = String(width);
        rebuildAndPaint();
    });


    rebuildAndPaint();
    });

    registerDemo("adjacency2cellmatrix", (mount, opts) => {
    const CASE_COLORS = [
        "#60a5fa", 
        "#34d399", 
        "#fbbf24", 
        "#fb7185", 
        "#a78bfa", 
        "#f97316", 
        "#22c55e", 
        "#38bdf8", 
    ];

    const CASES = [7,6,5,4,3,2,1,0];

    const clamp255 = (n) => Math.max(0, Math.min(255, n|0));
    const toBin = (n, len) => (n >>> 0).toString(2).padStart(len, "0");

    let rule = clamp255(
        (opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30
    );

    const root = el("div", "adjWrap");

    const bar = el("div", "adjBar");

    const lab = document.createElement("label");
    lab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "adjNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleInput.value = String(rule);

    const binCode = document.createElement("code");
    binCode.className = "adjBin";

    bar.appendChild(lab);
    bar.appendChild(ruleInput);
    bar.appendChild(binCode);


    const table = document.createElement("table");
    table.className = "adjTable";

    const thead = document.createElement("thead");
    const trH = document.createElement("tr");

    const corner = document.createElement("th");
    corner.className = "adjCorner";
    trH.appendChild(corner);

    const swatches = [];

    function addSwatchRef(c, swEl){
        swatches.push({ c, el: swEl });
    }

    for (const c of CASES){
        const th = document.createElement("th");

        const head = el("div", "adjColHead");
        const sw = el("div", "adjSwatch");
        sw.style.setProperty("--c", CASE_COLORS[c]);
        addSwatchRef(c, sw);

        const bits3 = document.createElement("code");
        bits3.className = "adjBits";
        bits3.textContent = toBin(c, 3);

        const pre2 = document.createElement("code");
        pre2.className = "adjBits2";
        pre2.textContent = toBin(c >> 1, 2); 

        head.appendChild(sw);
        head.appendChild(bits3);
        head.appendChild(pre2);

        th.appendChild(head);
        trH.appendChild(th);
    }

    thead.appendChild(trH);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const left of CASES){
        const tr = document.createElement("tr");

        const th = document.createElement("th");
        const head = el("div", "adjRowHead");

        const sw = el("div", "adjSwatch");
        sw.style.setProperty("--c", CASE_COLORS[left]);
        addSwatchRef(left, sw);

        const bits3 = document.createElement("code");
        bits3.className = "adjBits";
        bits3.textContent = toBin(left, 3);

        const suf2 = document.createElement("code");
        suf2.className = "adjBits2";
        suf2.textContent = toBin(left & 3, 2); 

        head.appendChild(sw);
        head.appendChild(bits3);
        head.appendChild(suf2);
        th.appendChild(head);
        tr.appendChild(th);

        for (const right of CASES){
        const td = document.createElement("td");
        td.className = "adjCell";

        const allowed = ((left & 3) === (right >> 1));
        if (allowed) td.classList.add("allowed");

        const tip =
            `left=${toBin(left,3)} suffix2=${toBin(left&3,2)}\n` +
            `right=${toBin(right,3)} prefix2=${toBin(right>>1,2)}\n` +
            (allowed ? "allowed" : "not allowed");
        td.title = tip;

        tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }

    table.appendChild(tbody);

    root.appendChild(bar);
    root.appendChild(table);
    mount.appendChild(root);

    function bitForCase(c){
        return (rule >> c) & 1;
    }

    function sync(){
        rule = clamp255(rule);
        ruleInput.value = String(rule);
        binCode.textContent = toBin(rule, 8);

        for (const s of swatches){
        s.el.classList.toggle("on", bitForCase(s.c) === 1);
        }
    }

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = Math.floor(n);
        sync();
    });

    ruleInput.addEventListener("blur", () => {
        const n = Number(ruleInput.value);
        if (Number.isFinite(n)) rule = Math.floor(n);
        sync();
    });

    sync();
    });

    registerDemo("adjacency3cellmatrix", (mount, opts) => {

    const CASE_COLORS = [
        "#60a5fa", 
        "#34d399", 
        "#fbbf24", 
        "#fb7185", 
        "#a78bfa", 
        "#f97316", 
        "#22c55e", 
        "#38bdf8", 
    ];

    const clamp255 = (n) => Math.max(0, Math.min(255, n|0));
    const toBin = (n, len) => (n >>> 0).toString(2).padStart(len, "0");

    let rule = clamp255(
        (opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30
    );

    const root = el("div", "adjWrap");

    const bar = el("div", "adjBar");

    const lab = document.createElement("label");
    lab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "adjNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleInput.value = String(rule);

    const binCode = document.createElement("code");
    binCode.className = "adjBin";

    bar.appendChild(lab);
    bar.appendChild(ruleInput);
    bar.appendChild(binCode);

    const table = document.createElement("table");
    table.className = "adj3Table";

    const swRefs = []; 

    function bitForCase(c){
        return (rule >> c) & 1;
    }

    function makeSwatch(c){
        const sw = el("div", "adjSwatch");
        sw.style.setProperty("--c", CASE_COLORS[c]);
        swRefs.push({ c, el: sw });
        return sw;
    }

    let id = 0;
    for (let r = 0; r < 8; r++){
        const tr = document.createElement("tr");

        for (let col = 0; col < 4; col++){
        const td = document.createElement("td");

        const a = (id >> 4) & 1;
        const b = (id >> 3) & 1;
        const c = (id >> 2) & 1;
        const d = (id >> 1) & 1;
        const e = (id >> 0) & 1;

        const x = (a << 2) | (b << 1) | c; 
        const y = (b << 2) | (c << 1) | d; 
        const z = (c << 2) | (d << 1) | e; 

        const trip = el("div", "adj3Trip");
        trip.appendChild(makeSwatch(x));
        trip.appendChild(makeSwatch(y));
        trip.appendChild(makeSwatch(z));

        td.appendChild(trip);

        td.title =
            `abcde = ${toBin(id, 5)}\n` +
            `x=abc ${toBin(x,3)} (${x})\n` +
            `y=bcd ${toBin(y,3)} (${y})\n` +
            `z=cde ${toBin(z,3)} (${z})`;

        tr.appendChild(td);
        id++;
        }

        table.appendChild(tr);
    }

    root.appendChild(bar);
    root.appendChild(table);
    mount.appendChild(root);

    function sync(){
        rule = clamp255(rule);
        ruleInput.value = String(rule);
        binCode.textContent = toBin(rule, 8);

        for (const s of swRefs){
        s.el.classList.toggle("on", bitForCase(s.c) === 1);
        s.el.title = `case ${s.c} → output ${bitForCase(s.c)}`;
        }
    }

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = Math.floor(n);
        sync();
    });

    ruleInput.addEventListener("blur", () => {
        const n = Number(ruleInput.value);
        if (Number.isFinite(n)) rule = Math.floor(n);
        sync();
    });

    sync();
    });

    registerDemo("basicgraph", (mount, opts) => {
    const CASE_COLORS = [
        "#60a5fa",
        "#34d399",
        "#fbbf24",
        "#fb7185",
        "#a78bfa",
        "#f97316",
        "#22c55e",
        "#38bdf8",
    ];

    function hexToRgb(hex){
        hex = hex.replace("#","").trim();
        if (hex.length === 3) hex = hex.split("").map(c => c+c).join("");
        const n = parseInt(hex, 16);
        return [(n>>16)&255, (n>>8)&255, n&255];
    }
    function rgbToHex(r,g,b){
        const to2 = (x) => x.toString(16).padStart(2,"0");
        return "#" + to2(r) + to2(g) + to2(b);
    }
    function darkenHex(hex, factor){
        const [r,g,b] = hexToRgb(hex);
        return rgbToHex(
        Math.round(Math.max(0, Math.min(255, r*factor))),
        Math.round(Math.max(0, Math.min(255, g*factor))),
        Math.round(Math.max(0, Math.min(255, b*factor)))
        );
    }
    const DEAD_CASE_COLORS = CASE_COLORS.map(c => darkenHex(c, 0.22));

    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n|0));
    const clamp255 = (n) => clamp(n, 0, 255);

    const toBin = (n, len) => (n >>> 0).toString(2).padStart(len, "0");
    const ruleOut = (rule, idx) => (rule >> idx) & 1;

    function bits5(id){
        return [
        (id >> 4) & 1,
        (id >> 3) & 1,
        (id >> 2) & 1,
        (id >> 1) & 1,
        (id >> 0) & 1,
        ];
    }

    function casesFromId5(id){
        const [a,b,c,d,e] = bits5(id);
        const x = (a<<2) | (b<<1) | c;
        const y = (b<<2) | (c<<1) | d;
        const z = (c<<2) | (d<<1) | e;
        return [x,y,z];
    }

    function childFromParent(rule, parentId, L, R){
        const [a,b,c,d,e] = bits5(parentId);

        const o0 = ruleOut(rule, (L<<2) | (a<<1) | b);
        const o1 = ruleOut(rule, (a<<2) | (b<<1) | c);
        const o2 = ruleOut(rule, (b<<2) | (c<<1) | d);
        const o3 = ruleOut(rule, (c<<2) | (d<<1) | e);
        const o4 = ruleOut(rule, (d<<2) | (e<<1) | R);

        return (o0<<4) | (o1<<3) | (o2<<2) | (o3<<1) | o4;
    }

    let rule = clamp255((opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30);

    const root = el("div", "bgWrap");
    const bar = el("div", "bgBar");

    const ruleBox = el("div");
    const ruleLab = document.createElement("label");
    ruleLab.textContent = "rule";

    const ruleInput = document.createElement("input");
    ruleInput.className = "bgNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";

    ruleBox.appendChild(ruleLab);
    ruleBox.appendChild(ruleInput);

    const ruleBin = document.createElement("code");
    ruleBin.className = "bgCode";

    const hint = el("div", "bgInfo");
    hint.textContent = "hover to see parent/child relationships. Orphans are highlighted orange (none in rule 30)";

    bar.appendChild(ruleBox);
    bar.appendChild(ruleBin);

    const viz = el("div", "bgViz");
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "bgSvg");
    viz.appendChild(svg);

    const info = el("div", "bgInfo");

    root.appendChild(bar);
    root.appendChild(viz);
    root.appendChild(hint);
    root.appendChild(info);
    mount.appendChild(root);

    let nodeG = new Array(32).fill(null);

    let edgeP = [];

    let outAdj = Array.from({length:32}, () => []);
    let inAdj  = Array.from({length:32}, () => []);

   
    const MARK = {
        neutral: "bgArrowNeutral",
        parent:  "bgArrowParent",
        child:   "bgArrowChild",
        both:    "bgArrowBoth",
    };

    function buildGraph(){
        const edgeCount = new Map();

        for (let u=0; u<32; u++){
        for (let L=0; L<=1; L++){
            for (let R=0; R<=1; R++){
            const v = childFromParent(rule, u, L, R);
            const key = `${u}->${v}`;
            edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }
        }

        outAdj = Array.from({length:32}, () => []);
        inAdj  = Array.from({length:32}, () => []);

        for (const [key, count] of edgeCount.entries()){
        const [a,b] = key.split("->");
        const u = Number(a);
        const v = Number(b);
        outAdj[u].push({ to: v, count });
        inAdj[v].push({ from: u, count });
        }

        for (let i=0;i<32;i++){
        outAdj[i].sort((p,q)=>p.to-q.to);
        inAdj[i].sort((p,q)=>p.from-q.from);
        }

        return edgeCount;
    }

    function clearSvg(){
        while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function mk(name, attrs){
        const n = document.createElementNS(svgNS, name);
        for (const [k,v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
        return n;
    }

    function addMarker(defs, id, fill){
        const m = mk("marker", {
        id,
        viewBox: "0 0 10 10",
        refX: "9",
        refY: "5",
        markerWidth: "6",
        markerHeight: "6",
        orient: "auto"
        });
        m.appendChild(mk("path", { d: "M 0 0 L 10 5 L 0 10 z", fill }));
        defs.appendChild(m);
    }

    function render(){
        rule = clamp255(rule);
        ruleInput.value = String(rule);
        ruleBin.textContent = toBin(rule, 8);

        const edgeCount = buildGraph();
        const edgeKeys = new Set(edgeCount.keys());

        const W = Math.max(320, viz.clientWidth | 0);
        const H = Math.max(260, viz.clientHeight | 0);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        clearSvg();

       
        const defs = mk("defs");
        addMarker(defs, MARK.neutral, "#5a5a66");
        addMarker(defs, MARK.parent,  "#ffb86b");
        addMarker(defs, MARK.child,   "#7cffc4");
        addMarker(defs, MARK.both,    "#ffd54a");
        svg.appendChild(defs);

        const gEdges = mk("g");
        const gNodes = mk("g");
        svg.appendChild(gEdges);
        svg.appendChild(gNodes);

       
        const cx = W/2, cy = H/2;
        const nodeR = Math.max(10, Math.min(18, Math.min(W,H) * 0.04));
        const ringR = Math.max(10, Math.min(W,H) * 0.46 - nodeR - 10);

        const pos = new Array(32);
        for (let id=0; id<32; id++){
        const ang = -Math.PI/2 + (2*Math.PI*id/32);
        pos[id] = {
            x: cx + ringR * Math.cos(ang),
            y: cy + ringR * Math.sin(ang),
            ang
        };
        }

       
        const orphan = new Array(32).fill(false);
        let orphanCount = 0;
        for (let i=0;i<32;i++){
        if (inAdj[i].length === 0){
            orphan[i] = true;
            orphanCount++;
        }
        }

       
        edgeP = [];

        for (const [key, count] of edgeCount.entries()){
        const [a,b] = key.split("->");
        const u = Number(a), v = Number(b);

        const p1 = pos[u], p2 = pos[v];
        let d = "";

        if (u === v){
            const loopR = nodeR * 1.6;
            const rx = Math.cos(p1.ang), ry = Math.sin(p1.ang);
            const ox = p1.x + rx * (nodeR + 10);
            const oy = p1.y + ry * (nodeR + 10);

            const px = -ry, py = rx;
            const xA = ox + px * loopR;
            const yA = oy + py * loopR;
            const xB = ox - px * loopR;
            const yB = oy - py * loopR;

            d = `M ${xA} ${yA}
                C ${xA + rx*loopR} ${yA + ry*loopR},
                ${xB + rx*loopR} ${yB + ry*loopR},
                ${xB} ${yB}`;
        } else {
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const len = Math.hypot(dx,dy) || 1;
            const ux = dx/len, uy = dy/len;

            const startPad = nodeR + 2;
            const endPad   = nodeR + 4;

            const x1 = p1.x + ux * startPad;
            const y1 = p1.y + uy * startPad;
            const x2 = p2.x - ux * endPad;
            const y2 = p2.y - uy * endPad;

            const c1x = x1*0.65 + cx*0.35;
            const c1y = y1*0.65 + cy*0.35;
            const c2x = x2*0.85 + cx*0.15;
            const c2y = y2*0.85 + cy*0.15;

            d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
        }

       
       
       
        const revKey = `${v}->${u}`;
        const defaultKind = (edgeKeys.has(revKey) ? "both" : "child");
        const defaultMarker = MARK[defaultKind];

        const path = mk("path", {
            d,
            class: `bgEdge ${defaultKind}` + (count > 1 ? " multi" : ""),
            "marker-end": `url(#${defaultMarker})`
        });

        path.style.strokeWidth = String(1.2 + (count - 1) * 0.7);

        const t = mk("title");
        t.textContent = `${toBin(u,5)} → ${toBin(v,5)} (x${count})`;
        path.appendChild(t);

        gEdges.appendChild(path);
        edgeP.push({ from:u, to:v, el:path, defaultClass: defaultKind, defaultMarker });
        }

       
        nodeG = new Array(32).fill(null);

        for (let id=0; id<32; id++){
        const p = pos[id];

        const g = mk("g", { class: "bgNode" + (orphan[id] ? " orphan" : "") });
        g.dataset.id = String(id);

        g.appendChild(mk("circle", { cx:p.x, cy:p.y, r:nodeR, class:"bgCircle" }));

       
        const cases = casesFromId5(id);

        const pad = Math.max(2, nodeR * 0.22);
        const gap = Math.max(1, nodeR * 0.16);
        let mini = Math.floor((2*nodeR - 2*pad - 2*gap) / 3);
        mini = Math.max(3, Math.min(mini, Math.floor(nodeR * 0.85)));

        const totalW = 3*mini + 2*gap;
        const x0 = p.x - totalW/2;
        const y0 = p.y - mini/2;

        for (let i=0;i<3;i++){
            const c = cases[i] & 7;
            const on = ruleOut(rule, c) === 1;
            const fill = on ? CASE_COLORS[c] : DEAD_CASE_COLORS[c];

            g.appendChild(mk("rect", {
            x: x0 + i*(mini+gap),
            y: y0,
            width: mini,
            height: mini,
            class: "bgMini",
            fill
            }));
        }

        const lbl = mk("text", { x:p.x, y:p.y + nodeR + 4, class:"bgLabel" });
        lbl.appendChild(document.createTextNode(toBin(id,5)));
        g.appendChild(lbl);

        const tt = mk("title");
        tt.textContent =
            `abcde=${toBin(id,5)}\n` +
            `cases: ${cases.map(c => toBin(c,3)).join(" ")}` +
            (orphan[id] ? "\n(orphan)" : "");
        g.appendChild(tt);

        g.addEventListener("mouseenter", () => highlightNode(id));
        g.addEventListener("mouseleave", clearHighlight);

        gNodes.appendChild(g);
        nodeG[id] = g;
        }

        info.textContent = `nodes=32 · edges=${edgeP.length} · orphans=${orphanCount}`;
        clearHighlight();
    }

   
    function clearHighlight(){
        for (const g of nodeG){
        if (!g) continue;
        g.classList.remove("hl","nei","dim");
        }
        for (const e of edgeP){
        e.el.classList.remove("parent","child","both","dim");
        e.el.classList.add(e.defaultClass);
        e.el.setAttribute("marker-end", `url(#${e.defaultMarker})`);
        }
    }

    function highlightNode(id){
        const parents = new Set(inAdj[id].map(x => x.from));
        const kids    = new Set(outAdj[id].map(x => x.to));

       
        for (let i=0;i<32;i++){
        const g = nodeG[i];
        if (!g) continue;

        if (i === id) g.classList.add("hl");
        else if (parents.has(i) || kids.has(i)) g.classList.add("nei");
        else g.classList.add("dim");
        }

       
        for (const e of edgeP){
        const u = e.from, v = e.to;

        const incident = (u === id || v === id);

        if (!incident){
           
            e.el.classList.add("dim");
            e.el.classList.remove("parent","child","both");
            e.el.setAttribute("marker-end", `url(#${MARK.neutral})`);
            continue;
        }

       
       
        const isOut = (u === id);
        const other = isOut ? v : u;
        const mutual = parents.has(other) && kids.has(other);

        e.el.classList.remove("dim","parent","child","both");

        if (mutual){
            e.el.classList.add("both");
            e.el.setAttribute("marker-end", `url(#${MARK.both})`);
        } else if (isOut){
            e.el.classList.add("child");
            e.el.setAttribute("marker-end", `url(#${MARK.child})`);
        } else {
            e.el.classList.add("parent");
            e.el.setAttribute("marker-end", `url(#${MARK.parent})`);
        }
        }

        info.textContent =
        `hover ${toBin(id,5)} · children=${outAdj[id].length} · parents=${inAdj[id].length}`;
    }

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        rule = Math.floor(n);
        render();
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(render, 60);
    });

    render();
    });

    registerDemo("walkgraph", (mount, opts) => {
   
    const CASE_COLORS = [
        "#60a5fa",
        "#34d399",
        "#fbbf24",
        "#fb7185",
        "#a78bfa",
        "#f97316",
        "#22c55e",
        "#38bdf8",
    ];

    function hexToRgb(hex){
        hex = hex.replace("#","").trim();
        if (hex.length === 3) hex = hex.split("").map(c => c+c).join("");
        const n = parseInt(hex, 16);
        return [(n>>16)&255, (n>>8)&255, n&255];
    }
    function rgbToHex(r,g,b){
        const to2 = (x) => x.toString(16).padStart(2,"0");
        return "#" + to2(r) + to2(g) + to2(b);
    }
    function darkenHex(hex, factor){
        const [r,g,b] = hexToRgb(hex);
        return rgbToHex(
        Math.round(Math.max(0, Math.min(255, r*factor))),
        Math.round(Math.max(0, Math.min(255, g*factor))),
        Math.round(Math.max(0, Math.min(255, b*factor)))
        );
    }
    const DEAD_CASE_COLORS = CASE_COLORS.map(c => darkenHex(c, 0.22));

   
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n|0));
    const clamp255 = (n) => clamp(n, 0, 255);
    const toBin = (n, len) => (n >>> 0).toString(2).padStart(len, "0");
    const ruleOut = (rule, idx) => (rule >> idx) & 1;

    function bits5(id){
        return [
        (id >> 4) & 1,
        (id >> 3) & 1,
        (id >> 2) & 1,
        (id >> 1) & 1,
        (id >> 0) & 1,
        ];
    }

   
    function casesFromId5(id){
        const [a,b,c,d,e] = bits5(id);
        const x = (a<<2) | (b<<1) | c;
        const y = (b<<2) | (c<<1) | d;
        const z = (c<<2) | (d<<1) | e;
        return [x,y,z];
    }

   
    function childFromParent(rule, parentId, L, R){
        const [a,b,c,d,e] = bits5(parentId);

        const o0 = ruleOut(rule, (L<<2) | (a<<1) | b);
        const o1 = ruleOut(rule, (a<<2) | (b<<1) | c);
        const o2 = ruleOut(rule, (b<<2) | (c<<1) | d);
        const o3 = ruleOut(rule, (c<<2) | (d<<1) | e);
        const o4 = ruleOut(rule, (d<<2) | (e<<1) | R);

        return (o0<<4) | (o1<<3) | (o2<<2) | (o3<<1) | o4;
    }

   
    let rule = clamp255((opts && Number.isFinite(opts.rule)) ? Math.floor(opts.rule) : 30);
    let cur  = clamp((opts && Number.isFinite(opts.start)) ? Math.floor(opts.start) : 4, 0, 31);
    let running = false;
    let stepCount = 0;

    let speedMs = clamp((opts && Number.isFinite(opts.speedMs)) ? Math.floor(opts.speedMs) : 100, 30, 2000);
    let timer = null;

    let lastL = 0, lastR = 0;

   
    let nodeHeat = new Float32Array(32);
    let edgeHeat = new Float32Array(0);
    let lastEdgeIdx = -1;

   
    let outAdj = Array.from({length:32}, () => []);
    let inAdj  = Array.from({length:32}, () => []);

   
    const root = el("div", "bgWrap");
    root.classList.add("rwWrap");

    const bar = el("div", "bgBar");

    const ruleBox = el("div");
    const ruleLab = document.createElement("label");
    ruleLab.textContent = "rule";
    const ruleInput = document.createElement("input");
    ruleInput.className = "rwNum";
    ruleInput.type = "number";
    ruleInput.min = "0";
    ruleInput.max = "255";
    ruleInput.step = "1";
    ruleBox.appendChild(ruleLab);
    ruleBox.appendChild(ruleInput);

    const ruleBin = document.createElement("code");
    ruleBin.className = "bgCode";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "rwBtn";
    playBtn.textContent = "Play";

    const stepBtn = document.createElement("button");
    stepBtn.type = "button";
    stepBtn.className = "rwBtn";
    stepBtn.textContent = "Step";

    const speedBox = el("div");
    const speedLab = document.createElement("label");
    speedLab.textContent = "ms/step";
    const speedInput = document.createElement("input");
    speedInput.className = "rwNum";
    speedInput.type = "number";
    speedInput.min = "30";
    speedInput.max = "2000";
    speedInput.step = "10";
    speedBox.appendChild(speedLab);
    speedBox.appendChild(speedInput);

    const curCode = document.createElement("code");
    curCode.className = "bgCode";

    bar.appendChild(ruleBox);
    bar.appendChild(ruleBin);
    bar.appendChild(playBtn);
    bar.appendChild(stepBtn);
    bar.appendChild(speedBox);
    bar.appendChild(curCode);

    const hint = el("div", "bgInfo");
    hint.textContent = "click a node to set the initial state. Play runs a random walk";

    const viz = el("div", "bgViz");
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "bgSvg");
    viz.appendChild(svg);

    const main = el("div", "rwMain");
    const log = el("div", "rwLog");
    main.appendChild(viz);
    main.appendChild(log);

    const info = el("div", "bgInfo");

    root.appendChild(bar);
    root.appendChild(main);
    root.appendChild(hint);
    root.appendChild(info);
    mount.appendChild(root);

   
    let nodeG = new Array(32).fill(null);
    let edgeP = [];         
    let edgeIdx = new Map();

   
    const uid = "wg_" + Math.random().toString(36).slice(2, 9);
    const mkId = (s) => `${uid}_${s}`;

    function mk(name, attrs){
        const n = document.createElementNS(svgNS, name);
        for (const [k,v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
        return n;
    }

    function clearSvg(){
        while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function addMarker(defs, id, fill){
        const m = mk("marker", {
        id,
        viewBox: "0 0 10 10",
        refX: "9",
        refY: "5",
        markerWidth: "6",
        markerHeight: "6",
        orient: "auto"
        });
        m.appendChild(mk("path", { d: "M 0 0 L 10 5 L 0 10 z", fill }));
        defs.appendChild(m);
    }

   
    function appendLogEntry(id){
        const item = el("div", "rwLogItem");
        const trip = el("div", "rwLogTrip");

        const cases = casesFromId5(id);
        for (let i=0;i<3;i++){
        const c = cases[i] & 7;
        const on = ruleOut(rule, c) === 1;

        const sq = el("div", "rwLogSq" + (on ? " on" : ""));
        sq.style.setProperty("--c", CASE_COLORS[c]);
        sq.style.setProperty("--cd", DEAD_CASE_COLORS[c]);
        sq.title = `case ${toBin(c,3)} → ${on ? 1 : 0}`;
        trip.appendChild(sq);
        }

        item.appendChild(trip);
        log.appendChild(item);

        while (log.children.length > 38){
        log.removeChild(log.firstChild);
        }
    }

    function buildGraph(){
        const edgeCount = new Map();

        outAdj = Array.from({length:32}, () => []);
        inAdj  = Array.from({length:32}, () => []);

        for (let u=0; u<32; u++){
        for (let L=0; L<=1; L++){
            for (let R=0; R<=1; R++){
            const v = childFromParent(rule, u, L, R);
            const key = `${u}->${v}`;
            edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }
        }

        for (const [key, count] of edgeCount.entries()){
        const [a,b] = key.split("->");
        const u = Number(a);
        const v = Number(b);
        outAdj[u].push({ to:v, count });
        inAdj[v].push({ from:u, count });
        }

        for (let i=0;i<32;i++){
        outAdj[i].sort((p,q)=>p.to-q.to);
        inAdj[i].sort((p,q)=>p.from-q.from);
        }

        return edgeCount;
    }

    function heatClass(h){
        if (h > 0.66) return "rwHot3";
        if (h > 0.33) return "rwHot2";
        if (h > 0.10) return "rwHot1";
        return "";
    }

    function applyWalkStyles(){
        for (let i=0;i<32;i++){
        const g = nodeG[i];
        if (!g) continue;

        g.classList.toggle("cur", i === cur);

        g.classList.remove("rwHot1","rwHot2","rwHot3");
        const hc = heatClass(nodeHeat[i]);
        if (hc) g.classList.add(hc);
        }

        for (let i=0;i<edgeP.length;i++){
        const e = edgeP[i].el;

        e.classList.remove("rwHot1","rwHot2","rwHot3","rwNow");
        const hc = heatClass(edgeHeat[i]);
        if (hc) e.classList.add(hc);

        if (i === lastEdgeIdx) e.classList.add("rwNow");
        }
    }

    function syncCurCode(){
        curCode.textContent = `current=${toBin(cur,5)}`;
    }

    function setCurrent(id){
        cur = clamp(id, 0, 31);
        stepCount = 0;

        for (let i=0;i<nodeHeat.length;i++) nodeHeat[i] = 0;
        for (let i=0;i<edgeHeat.length;i++) edgeHeat[i] = 0;
        lastEdgeIdx = -1;

        clear(log);
        appendLogEntry(cur);

        applyWalkStyles();
        syncCurCode();
        info.textContent = `t=${stepCount} · current=${toBin(cur,5)}`;
    }

    function oneStep(){
        const decay = 0.90;
        for (let i=0;i<nodeHeat.length;i++) nodeHeat[i] *= decay;
        for (let i=0;i<edgeHeat.length;i++) edgeHeat[i] *= decay;

        lastL = (Math.random() < 0.5) ? 0 : 1;
        lastR = (Math.random() < 0.5) ? 0 : 1;

        const next = childFromParent(rule, cur, lastL, lastR);

        const key = `${cur}->${next}`;
        const idx = edgeIdx.get(key);
        lastEdgeIdx = (typeof idx === "number") ? idx : -1;

        nodeHeat[cur] = 1;
        nodeHeat[next] = 1;
        if (lastEdgeIdx >= 0) edgeHeat[lastEdgeIdx] = 1;

        cur = next;
        stepCount++;

        appendLogEntry(cur);
        applyWalkStyles();
        syncCurCode();

        info.textContent = `t=${stepCount} · current=${toBin(cur,5)} · LR=${lastL}${lastR}`;
    }

    function start(){
        if (timer) return;
        running = true;
        playBtn.textContent = "Pause";
        timer = setInterval(oneStep, speedMs);
    }

    function stop(){
        running = false;
        playBtn.textContent = "Play";
        if (timer){
        clearInterval(timer);
        timer = null;
        }
    }

    function restartTimerIfRunning(){
        if (!running) return;
        stop();
        start();
    }

    function render(){
        rule = clamp255(rule);
        ruleInput.value = String(rule);
        ruleBin.textContent = toBin(rule, 8);

        speedMs = clamp(speedMs, 30, 2000);
        speedInput.value = String(speedMs);

        const edgeCount = buildGraph();

        const W = Math.max(320, viz.clientWidth | 0);
        const H = Math.max(260, viz.clientHeight | 0);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        clearSvg();

        const defs = mk("defs");
        addMarker(defs, mkId("arrowNeutral"), "#5a5a66");
        svg.appendChild(defs);

        const gEdges = mk("g");
        const gNodes = mk("g");
        svg.appendChild(gEdges);
        svg.appendChild(gNodes);

        const cx = W/2, cy = H/2;
        const nodeR = Math.max(10, Math.min(18, Math.min(W,H) * 0.04));
        const ringR = Math.max(10, Math.min(W,H) * 0.46 - nodeR - 10);

        const pos = new Array(32);
        for (let id=0; id<32; id++){
        const ang = -Math.PI/2 + (2*Math.PI*id/32);
        pos[id] = {
            x: cx + ringR * Math.cos(ang),
            y: cy + ringR * Math.sin(ang),
            ang
        };
        }

        let orphanCount = 0;
        for (let i=0;i<32;i++){
        if (inAdj[i].length === 0) orphanCount++;
        }

        edgeP = [];
        edgeIdx = new Map();

        for (const [key, count] of edgeCount.entries()){
        const [a,b] = key.split("->");
        const u = Number(a), v = Number(b);

        const p1 = pos[u], p2 = pos[v];
        let d = "";

        if (u === v){
            const loopR = nodeR * 1.6;
            const rx = Math.cos(p1.ang), ry = Math.sin(p1.ang);
            const ox = p1.x + rx * (nodeR + 10);
            const oy = p1.y + ry * (nodeR + 10);

            const px = -ry, py = rx;
            const xA = ox + px * loopR;
            const yA = oy + py * loopR;
            const xB = ox - px * loopR;
            const yB = oy - py * loopR;

            d = `M ${xA} ${yA}
                C ${xA + rx*loopR} ${yA + ry*loopR},
                ${xB + rx*loopR} ${yB + ry*loopR},
                ${xB} ${yB}`;
        } else {
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const len = Math.hypot(dx,dy) || 1;
            const ux = dx/len, uy = dy/len;

            const startPad = nodeR + 2;
            const endPad   = nodeR + 4;

            const x1 = p1.x + ux * startPad;
            const y1 = p1.y + uy * startPad;
            const x2 = p2.x - ux * endPad;
            const y2 = p2.y - uy * endPad;

            const c1x = x1*0.65 + cx*0.35;
            const c1y = y1*0.65 + cy*0.35;
            const c2x = x2*0.85 + cx*0.15;
            const c2y = y2*0.85 + cy*0.15;

            d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
        }

        const path = mk("path", {
            d,
            class: `bgEdge` + (count > 1 ? " multi" : ""),
            "marker-end": `url(#${mkId("arrowNeutral")})`
        });

        path.style.strokeWidth = String(1.2 + (count - 1) * 0.7);

        const t = mk("title");
        t.textContent = `${toBin(u,5)} → ${toBin(v,5)} (x${count})`;
        path.appendChild(t);

        gEdges.appendChild(path);

        const idx = edgeP.length;
        edgeP.push({ from:u, to:v, el:path });
        edgeIdx.set(`${u}->${v}`, idx);
        }

        edgeHeat = new Float32Array(edgeP.length);
        nodeHeat = new Float32Array(32);
        lastEdgeIdx = -1;

        nodeG = new Array(32).fill(null);

        for (let id=0; id<32; id++){
        const p = pos[id];

        const isOrphan = (inAdj[id].length === 0);
        const g = mk("g", { class: "bgNode" + (isOrphan ? " orphan" : "") });
        g.dataset.id = String(id);

        g.appendChild(mk("circle", { cx:p.x, cy:p.y, r:nodeR, class:"bgCircle" }));

        const cases = casesFromId5(id);

        const pad = Math.max(2, nodeR * 0.22);
        const gap = Math.max(1, nodeR * 0.16);
        let mini = Math.floor((2*nodeR - 2*pad - 2*gap) / 3);
        mini = Math.max(3, Math.min(mini, Math.floor(nodeR * 0.85)));

        const totalW = 3*mini + 2*gap;
        const x0 = p.x - totalW/2;
        const y0 = p.y - mini/2;

        for (let i=0;i<3;i++){
            const c = cases[i] & 7;
            const on = ruleOut(rule, c) === 1;
            const fill = on ? CASE_COLORS[c] : DEAD_CASE_COLORS[c];

            g.appendChild(mk("rect", {
            x: x0 + i*(mini+gap),
            y: y0,
            width: mini,
            height: mini,
            class: "bgMini",
            fill
            }));
        }

        const lbl = mk("text", { x:p.x, y:p.y + nodeR + 4, class:"bgLabel" });
        lbl.appendChild(document.createTextNode(toBin(id,5)));
        g.appendChild(lbl);

        const tt = mk("title");
        tt.textContent =
            `abcde=${toBin(id,5)}\n` +
            `cases=${cases.map(c => toBin(c,3)).join(" ")}\n` +
            (isOrphan ? "orphan" : "");
        g.appendChild(tt);

        g.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setCurrent(id);
        });

        gNodes.appendChild(g);
        nodeG[id] = g;
        }

        info.textContent = `nodes=32 · edges=${edgeP.length} · orphans=${orphanCount}`;

        clear(log);
        appendLogEntry(cur);
        applyWalkStyles();
        syncCurCode();
    }

    playBtn.addEventListener("click", () => {
        if (running) stop();
        else start();
    });

    stepBtn.addEventListener("click", () => {
        oneStep();
    });

    ruleInput.addEventListener("input", () => {
        const raw = ruleInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;

        rule = clamp255(Math.floor(n));

        const wasRunning = running;
        if (wasRunning) stop();
        render();
        if (wasRunning) start();
    });

    speedInput.addEventListener("input", () => {
        const raw = speedInput.value.trim();
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;

        speedMs = clamp(Math.floor(n), 30, 2000);
        speedInput.value = String(speedMs);
        restartTimerIfRunning();
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
        const wasRunning = running;
        if (wasRunning) stop();
        render();
        if (wasRunning) start();
        }, 80);
    });

   
    render();
    setCurrent(cur);
    });




  
  document.addEventListener("DOMContentLoaded", mountAllDemos);
})();
