(function(){
  const CircleConfig = {
    labels: ["I", "II", "III", "IV", "V", "VI", "VII"],
    colors: [
      "#ff4f4f", 
      "#ffac33", 
      "#ffeb3b", 
      "#76ff03", 
      "#03a9f4", 
      "#9c27b0", 
      "#e91e63"  
    ],
    radius: 200
  };

  const { labels, colors, radius } = CircleConfig;
  const PARTITIONS = labels.length; // 7
  const anglePerPartition = 360 / PARTITIONS;
  const halfPartition = anglePerPartition / 2;

  const container = document.getElementById("circle-container");

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", radius * 2);
  svg.setAttribute("height", radius * 2);
  svg.setAttribute("viewBox", `0 0 ${radius * 2} ${radius * 2}`);

  const partitionsGroup = document.createElementNS(svgNS, "g");
  partitionsGroup.setAttribute("transform", `translate(${radius}, ${radius})`);
  svg.appendChild(partitionsGroup);

  function degToRad(deg) {
    return (Math.PI / 180) * deg;
  }

  for (let i = 0; i < PARTITIONS; i++) {
    const centerAngle = -90 + i * anglePerPartition; 
    const startAngle  = centerAngle - halfPartition;
    const endAngle    = centerAngle + halfPartition;

    const startRad = degToRad(startAngle);
    const endRad   = degToRad(endAngle);

    const x1 = Math.cos(startRad) * radius;
    const y1 = Math.sin(startRad) * radius;
    const x2 = Math.cos(endRad) * radius;
    const y2 = Math.sin(endRad) * radius;

    const pathData = [
      `M 0 0`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 0 1 ${x2} ${y2}`,
      `Z`
    ].join(" ");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", colors[i] || "#ccc");
    path.setAttribute("stroke", "#00000033");
    path.setAttribute("stroke-width", "1");
    partitionsGroup.appendChild(path);

    const labelRadius = radius * 0.5;
    const labelRad = degToRad(centerAngle);
    const lx = Math.cos(labelRad) * labelRadius;
    const ly = Math.sin(labelRad) * labelRadius;

    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", lx);
    text.setAttribute("y", ly);
    text.setAttribute("fill", "#fff");
    text.setAttribute("font-size", "16");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.textContent = labels[i];
    partitionsGroup.appendChild(text);
  }

  const cursor = document.createElementNS(svgNS, "circle");
  cursor.setAttribute("cx", "0");
  cursor.setAttribute("cy", "0");
  cursor.setAttribute("r", "8");
  cursor.setAttribute("fill", "#000");
  partitionsGroup.appendChild(cursor);

  let cursorAngle = 0;
  let cursorRadius = 0;
  let isDragging = false;

  function onMouseDown(evt) {
    isDragging = true;
    moveCursor(evt);
  }
  function onMouseMove(evt) {
    if (!isDragging) return;
    moveCursor(evt);
  }
  function onMouseUp() {
    isDragging = false;
  }

  function moveCursor(evt) {
    const rect = svg.getBoundingClientRect();
    const offsetX = evt.clientX - rect.left - radius;
    const offsetY = evt.clientY - rect.top - radius;

    cursorAngle = Math.atan2(offsetY, offsetX) * (180 / Math.PI); 
    const dist = Math.sqrt(offsetX**2 + offsetY**2);
    cursorRadius = Math.min(dist, radius);

    const x = Math.cos(degToRad(cursorAngle)) * cursorRadius;
    const y = Math.sin(degToRad(cursorAngle)) * cursorRadius;
    cursor.setAttribute("cx", x);
    cursor.setAttribute("cy", y);
  }

  svg.addEventListener("mousedown", onMouseDown);
  svg.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  container.appendChild(svg);

  window.CircleUI = {
    getCursorPolar: function() {
      return {
        angle: cursorAngle,
        radiusFraction: cursorRadius / radius
      };
    },
    getRadius: function() {
      return radius;
    },
    getPartitions: function() {
      return PARTITIONS;
    }
  };
})();
