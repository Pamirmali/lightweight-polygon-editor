(function () {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const nInput = document.getElementById("nInput");
  const resetBtn = document.getElementById("resetBtn");
  const centerBtn = document.getElementById("centerBtn");
  const mirrorChk = document.getElementById("mirrorChk");
  const weightChk = document.getElementById("weightChk");
  const falloffInput = document.getElementById("falloffInput");
  const hopsInput = document.getElementById("hopsInput");
  const exportBtn = document.getElementById("exportBtn");
  const vertsOut = document.getElementById("vertsOut");
  const trisOut = document.getElementById("trisOut");
  const copyVertsBtn = document.getElementById("copyVerts");
  const copyTrisBtn = document.getElementById("copyTris");
  const runTestsBtn = document.getElementById("runTests");
  const testOut = document.getElementById("testOut");

  // State
  let points = []; // node array, each entry is {id,x,y,mirrorId,primary}
  let nodeIdCounter = 1;
  const idToIndex = new Map();
  let selectedIds = new Set();
  let hoverIdx = -1;
  let dragging = false;
  let dragMode = null; // 'move' | 'pan' | 'box'
  let dragAnchorWorld = { x: 0, y: 0 };
  let boxStart = null; // screen space {x,y}
  let boxEnd = null; // screen space {x,y}
  let boxAdditive = false; // shift-add mode
  let pan = { x: 0, y: 0 };
  let zoom = 1;
  let mirrorEnabled = false; // Y-axis mirror
  let weightEnabled = false; // weighted follow
  let perHopFalloff = 0.5; // 0..1
  let maxHops = 3;
  const EPS = 1e-6;
  let suppressHistory = false;
  const history = createHistoryManager();
  let moveHistoryActive = false;
  let moveApplied = false;
  let activeDragCanonical = -1;
  let activeDragIsMirror = false;

  function createNode(x, y, opts = {}) {
    return {
      id: nodeIdCounter++,
      x,
      y,
      mirrorId: opts.mirrorId ?? null,
      primary: opts.primary ?? true,
    };
  }

  function cloneNode(node) {
    return {
      id: node.id,
      x: node.x,
      y: node.y,
      mirrorId: node.mirrorId,
      primary: node.primary,
    };
  }

  function rebuildIndex() {
    idToIndex.clear();
    points.forEach((node, idx) => {
      idToIndex.set(node.id, idx);
    });
  }

  function indexOfNodeId(id) {
    if (id == null) return -1;
    return idToIndex.has(id) ? idToIndex.get(id) : -1;
  }

  function linkMirrorPair(primaryIdx, mirrorIdx) {
    if (primaryIdx < 0 || mirrorIdx < 0) return;
    const primary = points[primaryIdx];
    const mirror = points[mirrorIdx];
    if (!primary || !mirror) return;
    primary.mirrorId = mirror.id;
    mirror.mirrorId = primary.id;
    mirror.primary = false;
    primary.primary = true;
  }

  function unlinkMirror(idx) {
    const node = points[idx];
    if (!node || node.mirrorId == null) return;
    const partnerIdx = indexOfNodeId(node.mirrorId);
    node.mirrorId = null;
    if (partnerIdx >= 0) {
      points[partnerIdx].mirrorId = null;
      points[partnerIdx].primary = true;
    }
  }

  function getMirrorIndex(idx) {
    if (idx < 0) return -1;
    const node = points[idx];
    if (!node || node.mirrorId == null) return -1;
    return indexOfNodeId(node.mirrorId);
  }

  function primaryIndexFor(idx) {
    if (idx < 0) return -1;
    const node = points[idx];
    if (!node) return -1;
    if (node.primary || node.mirrorId == null) return idx;
    const partnerIdx = indexOfNodeId(node.mirrorId);
    return partnerIdx >= 0 ? partnerIdx : idx;
  }

  function clearSelection() {
    selectedIds.clear();
  }

  function isIndexSelected(idx) {
    const node = points[idx];
    return !!node && selectedIds.has(node.id);
  }

  function addIndexToSelection(idx) {
    const node = points[idx];
    if (node) selectedIds.add(node.id);
  }

  function removeIndexFromSelection(idx) {
    const node = points[idx];
    if (node) selectedIds.delete(node.id);
  }

  function getSelectedIndices() {
    const out = [];
    selectedIds.forEach((id) => {
      const idx = indexOfNodeId(id);
      if (idx >= 0) out.push(idx);
    });
    return out;
  }

  function createHistoryManager() {
    const past = [];
    const future = [];
    let checkpoint = null;

    function snapshot() {
      return {
        points: points.map(cloneNode),
        selectedIds: Array.from(selectedIds),
        pan: { x: pan.x, y: pan.y },
        zoom,
        mirrorEnabled,
        nodeIdCounter,
        weightEnabled,
        perHopFalloff,
        maxHops,
      };
    }

    function restore(state) {
      suppressHistory = true;
      points = state.points.map(cloneNode);
      selectedIds = new Set(state.selectedIds);
      pan = { x: state.pan.x, y: state.pan.y };
      zoom = state.zoom;
      mirrorEnabled = state.mirrorEnabled;
      nodeIdCounter = state.nodeIdCounter;
      weightEnabled = state.weightEnabled;
      perHopFalloff = state.perHopFalloff;
      maxHops = state.maxHops;
      mirrorChk.checked = mirrorEnabled;
      weightChk.checked = weightEnabled;
      falloffInput.value = String(perHopFalloff);
      hopsInput.value = String(maxHops);
      rebuildIndex();
      updateOutputs();
      draw();
      suppressHistory = false;
    }

    return {
      begin(label) {
        if (suppressHistory) return;
        if (checkpoint) return;
        checkpoint = { label, state: snapshot() };
      },
      commit() {
        if (!checkpoint) return;
        past.push(checkpoint);
        future.length = 0;
        checkpoint = null;
      },
      cancel() {
        checkpoint = null;
      },
      record(label) {
        if (suppressHistory) return;
        past.push({ label, state: snapshot() });
        future.length = 0;
      },
      undo() {
        if (checkpoint) this.cancel();
        if (past.length === 0) return;
        const current = snapshot();
        const entry = past.pop();
        future.push({ label: entry.label, state: current });
        restore(entry.state);
      },
      redo() {
        if (future.length === 0) return;
        const current = snapshot();
        const entry = future.pop();
        past.push({ label: entry.label, state: current });
        restore(entry.state);
      },
      clear() {
        past.length = 0;
        future.length = 0;
        checkpoint = null;
      },
    };
  }

  // CSS var helper for canvas colors
  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  // Sizing / DPR
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);

  // Geometry helpers
  function makeRegularPolygon(N) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const R = Math.min(w, h) * 0.35; // in pixels
    const arr = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2 - Math.PI / 2; // start at top, CCW
      const x = R * Math.cos(t);
      const y = R * Math.sin(t);
      arr.push(createNode(x, y));
    }
    return arr;
  }

  function ringDistance(i, j, N) {
    const d = Math.abs(i - j);
    return Math.min(d, N - d);
  }

  function setN(N) {
    N = Math.max(3, Math.floor(N || 3));
    nInput.value = N;
    points = makeRegularPolygon(N);
    rebuildIndex();
    if (mirrorEnabled) rebuildMirrorPairs();
    else clearMirrorPairs();
    clearSelection();
    updateOutputs();
    draw();
  }

  // Coordinate transforms
  function worldToCanvas(p) {
    const cx = canvas.clientWidth / 2 + pan.x;
    const cy = canvas.clientHeight / 2 + pan.y;
    return { x: cx + p.x * zoom, y: cy - p.y * zoom };
  }
  function canvasToWorld(p) {
    const cx = canvas.clientWidth / 2 + pan.x;
    const cy = canvas.clientHeight / 2 + pan.y;
    return { x: (p.x - cx) / zoom, y: (cy - p.y) / zoom };
  }

  // Render
  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // axes (subtle)
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#eeeeee";
    const c0 = worldToCanvas({ x: 0, y: 0 });
    ctx.beginPath();
    ctx.moveTo(0, c0.y + 0.5);
    ctx.lineTo(canvas.clientWidth, c0.y + 0.5);
    ctx.moveTo(c0.x + 0.5, 0);
    ctx.lineTo(c0.x + 0.5, canvas.clientHeight);
    ctx.stroke();

    if (points.length >= 3) {
      // fill polygon (black) — main shape
      ctx.beginPath();
      const p0 = worldToCanvas(points[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < points.length; i++) {
        const p = worldToCanvas(points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = "#000000";
      ctx.fill();

      // outline (thin for editing)
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
    }

    // handles
    const hoverPrimaryIdx = primaryIndexFor(hoverIdx);
    const hoverMirrorIdx = hoverPrimaryIdx >= 0 ? getMirrorIndex(hoverPrimaryIdx) : -1;
    for (let i = 0; i < points.length; i++) {
      const node = points[i];
      const p = worldToCanvas(node);
      const mirrorIdx = indexOfNodeId(node.mirrorId);
      const isSel =
        isIndexSelected(i) || (!node.primary && mirrorIdx >= 0 && isIndexSelected(mirrorIdx));
      const r = isSel ? 6 : 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      const isHover = i === hoverIdx || i === hoverPrimaryIdx || i === hoverMirrorIdx;
      ctx.fillStyle = isSel
        ? "#1a73e8"
        : isHover
        ? "#444444"
        : "#666666";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // selection box
    if (dragMode === "box" && boxStart && boxEnd) {
      const x = Math.min(boxStart.x, boxEnd.x);
      const y = Math.min(boxStart.y, boxEnd.y);
      const w = Math.abs(boxEnd.x - boxStart.x);
      const h = Math.abs(boxEnd.y - boxStart.y);
      ctx.fillStyle = cssVar("--marquee-fill") || "rgba(26,115,232,0.08)";
      ctx.strokeStyle = cssVar("--marquee-stroke") || "rgba(26,115,232,0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x + 0.5, y + 0.5, w, h);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  // Picking helpers
  function hitTest(pt) {
    const thresh = 8; // px
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = worldToCanvas(points[i]);
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < thresh && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  function nearestEdge(pt) {
    // return {i, t, dist, closest} for edge (i -> i+1)
    let best = { i: -1, t: 0, dist: Infinity, closest: { x: 0, y: 0 } };
    for (let i = 0; i < points.length; i++) {
      const a = worldToCanvas(points[i]);
      const b = worldToCanvas(points[(i + 1) % points.length]);
      const ax = a.x,
        ay = a.y,
        bx = b.x,
        by = b.y;
      const apx = pt.x - ax,
        apy = pt.y - ay;
      const abx = bx - ax,
        aby = by - ay;
      const ab2 = abx * abx + aby * aby || 1;
      let t = (apx * abx + apy * aby) / ab2;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + abx * t,
        cy = ay + aby * t;
      const d = Math.hypot(pt.x - cx, pt.y - cy);
      if (d < best.dist) {
        best = { i, t, dist: d, closest: { x: cx, y: cy } };
      }
    }
    return best;
  }

  function moveSelectedBy(dx, dy) {
    if (selectedIds.size === 0) return;

    const selectedIndices = getSelectedIndices();
    if (selectedIndices.length === 0) return;

    const N = points.length;
    const weights = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let best = Infinity;
      for (const s of selectedIndices) {
        best = Math.min(best, ringDistance(i, s, N));
      }
      if (best === 0) {
        weights[i] = 1;
      } else if (weightEnabled && best <= maxHops) {
        weights[i] = Math.pow(perHopFalloff, best);
      } else {
        weights[i] = 0;
      }
    }

    const affectedPrimaries = new Set();
    for (let i = 0; i < N; i++) {
      const w = weights[i];
      if (w === 0) continue;
      points[i].x += dx * w;
      points[i].y += dy * w;
      const primaryIdx = primaryIndexFor(i);
      if (primaryIdx >= 0) affectedPrimaries.add(primaryIdx);
    }

    if (mirrorEnabled && affectedPrimaries.size > 0) {
      applyMirrorConstraints(affectedPrimaries);
    }
  }

  function applyMirrorConstraints(affectedPrimaries) {
    const processed = new Set();
    affectedPrimaries.forEach((primaryIdx) => {
      const canonicalIdx = primaryIndexFor(primaryIdx);
      if (canonicalIdx < 0) return;
      const primary = points[canonicalIdx];
      if (!primary || processed.has(primary.id)) return;
      const partnerIdx = getMirrorIndex(canonicalIdx);
      if (partnerIdx < 0) return;
      const partner = points[partnerIdx];
      processed.add(primary.id);
      processed.add(partner.id);

  const primarySelected = isIndexSelected(canonicalIdx);
  const partnerSelected = isIndexSelected(partnerIdx);

      if (primarySelected && !partnerSelected) {
        partner.x = -primary.x;
        partner.y = primary.y;
      } else if (!primarySelected && partnerSelected) {
        primary.x = -partner.x;
        primary.y = partner.y;
      } else if (primarySelected && partnerSelected) {
        const avgY = (primary.y + partner.y) / 2;
        const magnitude = (Math.abs(primary.x) + Math.abs(partner.x)) / 2;
        const primarySign = primary.x >= 0 ? 1 : -1;
        primary.y = avgY;
        partner.y = avgY;
        primary.x = magnitude * primarySign;
        partner.x = -primary.x;
      } else {
        partner.x = -primary.x;
        partner.y = primary.y;
      }
    });
  }

  function insertVertexOnEdge(edgeIndex, worldPos) {
    if (points.length < 3) return -1;
    const beforeLength = points.length;
    const edgeStart = ((edgeIndex % beforeLength) + beforeLength) % beforeLength;
    const edgeEnd = (edgeStart + 1) % beforeLength;

  const endPrimaryIdx = primaryIndexFor(edgeEnd);
  const endMirrorIdx = getMirrorIndex(endPrimaryIdx);
  const endMirrorId = endMirrorIdx >= 0 ? points[endMirrorIdx].id : null;

    const newNode = createNode(worldPos.x, worldPos.y, { primary: true });
    points.splice(edgeStart + 1, 0, newNode);
    rebuildIndex();
    let newIdx = indexOfNodeId(newNode.id);

    if (mirrorEnabled && Math.abs(worldPos.x) > EPS) {
      let mirrorInsertIndex = -1;
      if (endMirrorId != null) {
        const endMirrorIdxNow = indexOfNodeId(endMirrorId);
        if (endMirrorIdxNow >= 0) {
          mirrorInsertIndex = endMirrorIdxNow + 1;
        }
      }

      const mirrorNode = createNode(-worldPos.x, worldPos.y, {
        primary: false,
        mirrorId: newNode.id,
      });
      newNode.mirrorId = mirrorNode.id;
      if (mirrorInsertIndex < 0 || mirrorInsertIndex > points.length) {
        mirrorInsertIndex = newIdx + 1;
      }
      points.splice(mirrorInsertIndex, 0, mirrorNode);
      rebuildIndex();
      newIdx = indexOfNodeId(newNode.id);
      const mirrorIdx = indexOfNodeId(mirrorNode.id);
      if (newIdx >= 0 && mirrorIdx >= 0) {
        linkMirrorPair(newIdx, mirrorIdx);
      }
    }

    return indexOfNodeId(newNode.id);
  }

  function clearMirrorPairs() {
    points.forEach((node) => {
      node.mirrorId = null;
      node.primary = true;
    });
  }

  function rebuildMirrorPairs() {
    clearMirrorPairs();
    if (!mirrorEnabled) return;
    const used = new Set();
    for (let i = 0; i < points.length; i++) {
      const node = points[i];
      if (used.has(node.id)) continue;
      if (Math.abs(node.x) <= EPS) continue;
      let bestIdx = -1;
      let bestScore = Infinity;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const other = points[j];
        if (used.has(other.id)) continue;
        if (Math.sign(node.x) === Math.sign(other.x)) continue;
        const symmetryError = Math.abs(node.x + other.x);
        if (symmetryError > 5) continue;
        const score = symmetryError + Math.abs(node.y - other.y);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = j;
        }
      }
      if (bestIdx >= 0) {
        linkMirrorPair(i, bestIdx);
        used.add(node.id);
        used.add(points[bestIdx].id);
      }
    }
  }

  // Selection rectangle logic
  function rectContainsPointScreen(rect, pt) {
    const x1 = Math.min(rect.x1, rect.x2);
    const y1 = Math.min(rect.y1, rect.y2);
    const x2 = Math.max(rect.x1, rect.x2);
    const y2 = Math.max(rect.y1, rect.y2);
    return pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2;
  }
  function selectInScreenRect(rect, mode) {
    // mode: 'replace' | 'add'
    const base = mode === "add" ? new Set(selectedIds) : new Set();
    for (let i = 0; i < points.length; i++) {
      const p = worldToCanvas(points[i]);
      if (rectContainsPointScreen(rect, p)) {
        const primaryIdx = primaryIndexFor(i);
        if (primaryIdx >= 0) base.add(points[primaryIdx].id);
      }
    }
    selectedIds = base;
  }

  // Interaction
  let lastMouse = { x: 0, y: 0 };

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (dragging && dragMode === "move") {
      const w = canvasToWorld(pt);
      const rawDx = w.x - dragAnchorWorld.x;
      const rawDy = w.y - dragAnchorWorld.y;
      dragAnchorWorld = w;
      const adjDx = activeDragIsMirror ? -rawDx : rawDx;
      moveSelectedBy(adjDx, rawDy);
      if (Math.abs(rawDx) > EPS || Math.abs(rawDy) > EPS) moveApplied = true;
      updateOutputs();
      draw();
    } else if (dragging && dragMode === "pan") {
      const dx = pt.x - lastMouse.x;
      const dy = pt.y - lastMouse.y;
      pan.x += dx;
      pan.y += dy;
      draw();
    } else if (dragging && dragMode === "box") {
      boxEnd = pt;
      const mode = boxAdditive ? "add" : "replace";
      selectInScreenRect(
        { x1: boxStart.x, y1: boxStart.y, x2: boxEnd.x, y2: boxEnd.y },
        mode
      );
      draw();
    } else {
      hoverIdx = hitTest(pt);
      draw();
    }
    lastMouse = pt;
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const idx = hitTest(pt);
    if (idx >= 0) {
      const canonicalIdx = primaryIndexFor(idx);
      const selectionIdx = canonicalIdx >= 0 ? canonicalIdx : idx;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        // toggle selection
        if (isIndexSelected(selectionIdx)) removeIndexFromSelection(selectionIdx);
        else addIndexToSelection(selectionIdx);
      } else {
        if (!isIndexSelected(selectionIdx)) {
          clearSelection();
          addIndexToSelection(selectionIdx);
        }
      }
      if (isIndexSelected(selectionIdx)) {
        dragging = true;
        dragMode = "move";
        dragAnchorWorld = canvasToWorld(pt);
        history.begin("Move Vertices");
        moveHistoryActive = true;
        moveApplied = false;
        activeDragCanonical = selectionIdx;
        activeDragIsMirror = idx !== selectionIdx;
      } else {
        dragging = false;
        dragMode = null;
        activeDragCanonical = -1;
        activeDragIsMirror = false;
      }
      draw();
    } else if (e.shiftKey) {
      // Add a point at nearest edge
      const ne = nearestEdge(pt);
      const world = canvasToWorld(ne.closest);
      if (!suppressHistory) history.record("Insert Vertex");
      const newIdx = insertVertexOnEdge(ne.i, world);
      if (newIdx >= 0) {
        clearSelection();
        addIndexToSelection(newIdx);
        updateOutputs();
        draw();
      }
    } else {
      // Decide between box-select (left) vs pan (right/middle)
      if (e.button === 0) {
        dragging = true;
        dragMode = "box";
        boxStart = pt;
        boxEnd = pt;
        boxAdditive = !!(e.shiftKey || e.metaKey || e.ctrlKey);
      } else {
        dragging = true;
        dragMode = "pan";
      }
    }
    lastMouse = pt;
  });

  canvas.addEventListener("mouseup", () => {
    if (moveHistoryActive) {
      if (moveApplied) history.commit();
      else history.cancel();
      moveHistoryActive = false;
      moveApplied = false;
    }
    dragging = false;
    dragMode = null;
    activeDragCanonical = -1;
    activeDragIsMirror = false;
    boxStart = null;
    boxEnd = null;
    draw();
  });
  canvas.addEventListener("mouseleave", () => {
    if (moveHistoryActive) {
      if (moveApplied) history.commit();
      else history.cancel();
      moveHistoryActive = false;
      moveApplied = false;
    }
    dragging = false;
    hoverIdx = -1;
    dragMode = null;
    activeDragCanonical = -1;
    activeDragIsMirror = false;
    boxStart = null;
    boxEnd = null;
    draw();
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const mouse = lastMouse;
      const before = canvasToWorld(mouse);
      const factor = Math.exp(-e.deltaY * 0.001);
      zoom = Math.max(0.2, Math.min(5, zoom * factor));
      const after = canvasToWorld(mouse);
      // zoom towards mouse: adjust pan so mouse stays put
      pan.x += (after.x - before.x) * zoom;
      pan.y -= (after.y - before.y) * zoom;
      draw();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const wantsUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && key === "z";
    const wantsRedo =
      ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "z") ||
      ((e.ctrlKey || e.metaKey) && key === "y");

    if (wantsUndo) {
      e.preventDefault();
      if (moveHistoryActive) {
        moveHistoryActive = false;
        moveApplied = false;
      }
      if (dragging) {
        dragging = false;
        dragMode = null;
        activeDragCanonical = -1;
        activeDragIsMirror = false;
      }
      history.undo();
      return;
    }
    if (wantsRedo) {
      e.preventDefault();
      if (moveHistoryActive) {
        moveHistoryActive = false;
        moveApplied = false;
      }
      if (dragging) {
        dragging = false;
        dragMode = null;
        activeDragCanonical = -1;
        activeDragIsMirror = false;
      }
      history.redo();
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
      const selectedIndices = getSelectedIndices();
      const removalSet = new Set(selectedIndices);
      selectedIndices.forEach((idx) => {
        const primaryIdx = primaryIndexFor(idx);
        const partnerIdx = getMirrorIndex(primaryIdx);
        if (partnerIdx >= 0) removalSet.add(partnerIdx);
      });
      if (points.length - removalSet.size >= 3) {
        if (!suppressHistory) history.record("Delete Vertices");
        Array.from(removalSet)
          .sort((a, b) => b - a)
          .forEach((i) => {
            removeIndexFromSelection(i);
            points.splice(i, 1);
          });
        clearSelection();
        rebuildIndex();
        if (mirrorEnabled) rebuildMirrorPairs();
        updateOutputs();
        draw();
      }
    }
  });

  // Buttons
  resetBtn.addEventListener("click", () => {
    if (suppressHistory) return;
    history.record("Reset Polygon");
    setN(parseInt(nInput.value, 10));
  });
  nInput.addEventListener("change", () => {
    if (suppressHistory) return;
    history.record("Change Sides");
    setN(parseInt(nInput.value, 10));
  });
  centerBtn.addEventListener("click", () => {
    if (suppressHistory) return;
    history.record("Center View");
    pan.x = 0;
    pan.y = 0;
    zoom = 1;
    draw();
  });
  mirrorChk.addEventListener("change", () => {
    if (suppressHistory) return;
    history.record("Toggle Mirror");
    mirrorEnabled = mirrorChk.checked;
    if (mirrorEnabled) {
      rebuildMirrorPairs();
      const primaries = new Set();
      points.forEach((node, idx) => {
        if (node.mirrorId != null && node.primary) primaries.add(idx);
      });
      if (primaries.size > 0) applyMirrorConstraints(primaries);
    } else {
      clearMirrorPairs();
    }
    updateOutputs();
    draw();
  });
  weightChk.addEventListener("change", () => {
    if (suppressHistory) return;
    history.record("Toggle Weights");
    weightEnabled = weightChk.checked;
  });
  falloffInput.addEventListener("input", () => {
    if (suppressHistory) return;
    history.record("Change Falloff");
    perHopFalloff = parseFloat(falloffInput.value);
  });
  hopsInput.addEventListener("change", () => {
    if (suppressHistory) return;
    history.record("Change Hops");
    maxHops = Math.max(1, Math.min(32, parseInt(hopsInput.value || "3", 10)));
    hopsInput.value = String(maxHops);
  });

  function trianglesFan() {
    const N = points.length;
    const tris = [];
    for (let i = 1; i < N - 1; i++) tris.push([0, i, i + 1]);
    return tris;
  }

  function round(v) {
    return Math.round(v * 1000) / 1000;
  }

  function updateOutputs() {
    const verts = points.map((p) => [round(p.x), round(p.y)]);
    const tris = trianglesFan();
    vertsOut.textContent = JSON.stringify(verts, null, 2);
    trisOut.textContent = JSON.stringify(tris, null, 2);
    canvas.dataset.n = String(points.length);
  }

  function copyText(txt) {
    navigator.clipboard.writeText(txt).catch(() => {
      // Fallback: create a temp textarea
      const ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
    });
  }

  exportBtn.addEventListener("click", () => {
    const data = {
      vertices: JSON.parse(vertsOut.textContent || "[]"),
      triangles: JSON.parse(trisOut.textContent || "[]"),
    };
    copyText(JSON.stringify(data, null, 2));
  });
  copyVertsBtn.addEventListener("click", () => copyText(vertsOut.textContent));
  copyTrisBtn.addEventListener("click", () => copyText(trisOut.textContent));

  // Self tests (basic invariants)
  function log(line) {
    testOut.textContent += (testOut.textContent ? "\n" : "") + line;
  }
  function clearTests() {
    testOut.textContent = "";
  }
  function assert(cond, msg) {
    if (cond) {
      log("✔ " + msg);
    } else {
      log("✘ " + msg);
    }
  }

  function approxEq(a, b, eps = 1e-6) {
    return Math.abs(a - b) <= eps;
  }

  function runSelfTests() {
    clearTests();
    // Triangles fan size & indices
    (function () {
      const N = 6;
      const tris = [];
      for (let i = 1; i < N - 1; i++) tris.push([0, i, i + 1]);
      assert(
        tris.length === N - 2,
        `triangles length == N-2 (${tris.length} == ${N - 2})`
      );
      assert(
        JSON.stringify(tris[0]) === JSON.stringify([0, 1, 2]),
        "first tri is [0,1,2]"
      );
      assert(
        JSON.stringify(tris[tris.length - 1]) ===
          JSON.stringify([0, N - 2, N - 1]),
        "last tri is [0,N-2,N-1]"
      );
    })();

    // world<->canvas roundtrip at default pan/zoom
    (function () {
      pan = { x: 0, y: 0 };
      zoom = 1;
      const p = { x: 123.456, y: -78.9 };
      const q = worldToCanvas(p);
      const r = canvasToWorld(q);
      assert(
        approxEq(p.x, r.x, 1e-9) && approxEq(p.y, r.y, 1e-9),
        "world/canvas transforms round-trip"
      );
    })();

    // Y-axis mirror: moving a point moves its partner with flipped X delta
    (function () {
      points = [createNode(100, 20), createNode(-100, 20, { primary: false }), createNode(0, -150)];
      linkMirrorPair(0, 1);
      rebuildIndex();
      clearSelection();
      addIndexToSelection(0);
      mirrorEnabled = true;
      weightEnabled = false;
      moveSelectedBy(30, -10);
      const a0 = points[0];
      const a1 = points[1];
      const cond1 = approxEq(a1.x, -a0.x) && approxEq(a1.y, a0.y);
      assert(cond1, "mirror Y-axis preserves symmetry after move");
    })();

    // Box selection picks expected indices
    (function () {
      setN(4); // square
      pan = { x: 0, y: 0 };
      zoom = 1;
      const p0 = worldToCanvas(points[0]);
      const p1 = worldToCanvas(points[1]);
      selectInScreenRect(
        {
          x1: Math.min(p0.x, p1.x) - 2,
          y1: Math.min(p0.y, p1.y) - 2,
          x2: Math.max(p0.x, p1.x) + 2,
          y2: Math.max(p0.y, p1.y) + 2,
        },
        "replace"
      );
      const ok = selectedIds.has(points[0].id) && selectedIds.has(points[1].id);
      assert(ok, "box select includes vertices inside rect");
      setN(parseInt(nInput.value, 10));
    })();

    // Weighted move falloff per hop
    (function () {
      setN(8);
      pan = { x: 0, y: 0 };
      zoom = 1; // regular octagon roughly symmetric
      clearSelection();
      addIndexToSelection(0);
      weightEnabled = true;
      perHopFalloff = 0.5;
      maxHops = 2;
      const before = points.map((p) => ({ x: p.x, y: p.y }));
      moveSelectedBy(10, 0);
      const after = points;
      // neighbors at distance 1 should move by ~5, distance 2 by ~2.5, others ~0
      const d1 = Math.hypot(after[1].x - before[1].x, after[1].y - before[1].y);
      const d7 = Math.hypot(after[7].x - before[7].x, after[7].y - before[7].y);
      const d2 = Math.hypot(after[2].x - before[2].x, after[2].y - before[2].y);
      const d6 = Math.hypot(after[6].x - before[6].x, after[6].y - before[6].y);
      const d3 = Math.hypot(after[3].x - before[3].x, after[3].y - before[3].y);
      const ok1 = Math.abs(d1 - 5) < 0.6 && Math.abs(d7 - 5) < 0.6;
      const ok2 = Math.abs(d2 - 2.5) < 0.6 && Math.abs(d6 - 2.5) < 0.6;
      const ok3 = d3 < 0.6; // beyond max hops
      assert(ok1 && ok2 && ok3, "weighted falloff per hop works");
    })();

    log("Self-tests complete.");
  }
  runTestsBtn.addEventListener("click", runSelfTests);

  // Init
  setN(parseInt(nInput.value, 10));
  centerBtn.click();
  history.clear();

  // Ensure full-bleed canvas sizing works on load
  function fitCanvasToParent() {
    const parent = canvas.parentElement;
    canvas.style.height =
      parent.clientHeight -
      parent.querySelector(".toolbar").clientHeight +
      "px";
  }
  window.addEventListener("resize", () => {
    fitCanvasToParent();
    resize();
  });
  setTimeout(() => {
    fitCanvasToParent();
    resize();
  }, 0);
})();
