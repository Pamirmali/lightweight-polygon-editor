/**
 * TimelineUI - Interactive canvas-based timeline for keyframe animation.
 *
 * Features:
 *  - Zoomable/scrollable ruler with adaptive tick marks
 *  - Draggable keyframe diamonds with snap-to-grid
 *  - Clickable/hoverable transition segments for easing selection
 *  - Playhead scrubbing and real-time position display
 *  - Context-menu and double-click easing picker per transition
 */
export class TimelineUI {
  constructor(app) {
    this.app = app;
    this.canvas = null;
    this.ctx = null;
    this.container = null;

    // Layout constants
    this.rulerHeight = 24;
    this.trackHeight = 40;
    this.keyframeSize = 10;
    this.playheadWidth = 2;

    // Interaction state
    this.dragging = null;       // { type: 'keyframe'|'playhead', index, startX, startTime }
    this.hoveredKeyframe = -1;
    this.selectedKeyframe = -1;
    this.hoveredTransition = -1;   // index of the starting keyframe of hovered transition
    this.selectedTransition = -1;  // index of the starting keyframe of selected transition
    this.isMouseDown = false;

    // Timeline view state (managed on app.state)
    // timelineZoom: pixels per second
    // timelineScrollX: scroll offset in pixels
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'timeline-canvas';
    this.container.appendChild(this.canvas);

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Context menu for keyframe easing
    this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
  }

  resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  get width() {
    return this.canvas ? this.canvas.width / (window.devicePixelRatio || 1) : 0;
  }

  get height() {
    return this.canvas ? this.canvas.height / (window.devicePixelRatio || 1) : 0;
  }

  get state() {
    return this.app.state;
  }

  get frames() {
    return this.app.frames;
  }

  // ====== Coordinate helpers ======

  timeToX(time) {
    return time * this.state.timelineZoom - this.state.timelineScrollX;
  }

  xToTime(x) {
    return (x + this.state.timelineScrollX) / this.state.timelineZoom;
  }

  snapTime(time) {
    // Adaptive snap: finer increments at higher zoom levels
    const zoom = this.state.timelineZoom;
    let snap;
    if (zoom >= 800) snap = 0.01;
    else if (zoom >= 400) snap = 0.02;
    else if (zoom >= 200) snap = 0.05;
    else snap = 0.1;
    return Math.round(time / snap) * snap;
  }

  // ====== Rendering ======

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#16162a';
    ctx.fillRect(0, 0, w, h);

    this.renderRuler(ctx, w);
    this.renderTrack(ctx, w, h);
    this.renderTransitions(ctx, w, h);
    this.renderKeyframes(ctx, w, h);
    this.renderPlayhead(ctx, h);
  }

  renderRuler(ctx, w) {
    const zoom = this.state.timelineZoom;
    const scrollX = this.state.timelineScrollX;
    const duration = this.state.timelineDuration;

    ctx.fillStyle = '#1e1e3a';
    ctx.fillRect(0, 0, w, this.rulerHeight);

    // Bottom border
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.rulerHeight);
    ctx.lineTo(w, this.rulerHeight);
    ctx.stroke();

    // Determine tick spacing based on zoom
    let majorInterval, minorInterval;
    if (zoom >= 800) {
      majorInterval = 0.1;
      minorInterval = 0.02;
    } else if (zoom >= 400) {
      majorInterval = 0.25;
      minorInterval = 0.05;
    } else if (zoom >= 200) {
      majorInterval = 0.5;
      minorInterval = 0.1;
    } else if (zoom >= 100) {
      majorInterval = 1;
      minorInterval = 0.25;
    } else if (zoom >= 50) {
      majorInterval = 2;
      minorInterval = 0.5;
    } else {
      majorInterval = 5;
      minorInterval = 1;
    }

    const startTime = Math.floor(this.xToTime(0) / minorInterval) * minorInterval;
    const endTime = Math.ceil(this.xToTime(w) / minorInterval) * minorInterval;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let t = startTime; t <= Math.min(endTime, duration); t += minorInterval) {
      t = Math.round(t * 1000) / 1000; // avoid float artifacts
      const x = this.timeToX(t);
      if (x < -10 || x > w + 10) continue;

      const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs(t % majorInterval - majorInterval) < 0.001;

      ctx.strokeStyle = isMajor ? '#555577' : '#333355';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 4 : 12);
      ctx.lineTo(x, this.rulerHeight);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#888899';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        const label = t >= 1 ? t.toFixed(1) + 's' : (t * 1000).toFixed(0) + 'ms';
        ctx.fillText(label, x, 2);
      }
    }

    // Duration end marker
    const endX = this.timeToX(duration);
    if (endX > 0 && endX < w) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, this.rulerHeight);
      ctx.stroke();
    }
  }

  renderTrack(ctx, w, h) {
    const trackY = this.rulerHeight;
    const trackH = h - this.rulerHeight;

    // Track background
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(0, trackY, w, trackH);

    // Horizontal center line
    const centerY = trackY + trackH / 2;
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
  }

  renderTransitions(ctx, w, h) {
    const keyframes = this.frames.frames;
    const trackY = this.rulerHeight;
    const trackH = h - this.rulerHeight;
    const centerY = trackY + trackH / 2;

    for (let i = 0; i < keyframes.length - 1; i++) {
      const kf = keyframes[i];
      const nextKf = keyframes[i + 1];
      const x1 = this.timeToX(kf.time || 0);
      const x2 = this.timeToX(nextKf.time || 0);
      const easing = kf.easing || 'linear';
      const isSelected = i === this.selectedTransition;
      const isHovered = i === this.hoveredTransition;

      // Highlight background for selected/hovered transition
      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? 'rgba(74, 158, 255, 0.12)' : 'rgba(74, 158, 255, 0.06)';
        ctx.fillRect(x1, trackY, x2 - x1, trackH);
      }

      // Draw easing curve
      this.renderEasingSegment(ctx, x1, x2, centerY, trackH * 0.3, easing, isSelected, isHovered);
    }
  }

  renderKeyframes(ctx, w, h) {
    const keyframes = this.frames.frames;
    const trackY = this.rulerHeight;
    const trackH = h - this.rulerHeight;
    const centerY = trackY + trackH / 2;
    const currentIndex = this.frames.currentFrameIndex;

    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];
      const time = kf.time || 0;
      const x = this.timeToX(time);

      if (x < -20 || x > w + 20) continue;

      // Diamond shape for keyframe
      const size = this.keyframeSize;
      const isActive = i === currentIndex;
      const isHovered = i === this.hoveredKeyframe;
      const isSelected = i === this.selectedKeyframe;

      ctx.save();
      ctx.translate(x, centerY);
      ctx.rotate(Math.PI / 4);

      // Shadow for selected
      if (isSelected) {
        ctx.shadowColor = '#4a9eff';
        ctx.shadowBlur = 8;
      }

      ctx.fillStyle = isActive ? '#4a9eff'
        : isSelected ? '#6ab4ff'
        : isHovered ? '#3d8ae0'
        : '#2d5a8a';
      ctx.fillRect(-size / 2, -size / 2, size, size);

      ctx.strokeStyle = isActive || isSelected ? '#ffffff' : '#4a9eff';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(-size / 2, -size / 2, size, size);

      ctx.restore();

      // Frame number label
      ctx.fillStyle = isActive ? '#ffffff' : '#888899';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), x, centerY + size / 2 + 6);
    }
  }

  renderEasingSegment(ctx, x1, x2, centerY, amplitude, easing, isSelected = false, isHovered = false) {
    const easingFn = this.frames.constructor.easing[easing] || this.frames.constructor.easing.linear;
    const steps = Math.max(20, Math.floor(Math.abs(x2 - x1) / 3));

    ctx.beginPath();
    ctx.moveTo(x1, centerY);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const easedT = easingFn(t);
      const y = centerY - amplitude * easedT;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = isSelected ? 'rgba(74, 158, 255, 0.8)'
      : isHovered ? 'rgba(74, 158, 255, 0.5)'
      : 'rgba(74, 158, 255, 0.3)';
    ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
    ctx.stroke();

    // Draw easing label
    const midX = (x1 + x2) / 2;
    const showLabel = isSelected || isHovered || (x2 - x1 > 60 && easing !== 'linear');
    if (showLabel) {
      ctx.fillStyle = isSelected ? 'rgba(74, 158, 255, 0.9)'
        : isHovered ? 'rgba(136, 136, 153, 0.8)'
        : 'rgba(136, 136, 153, 0.6)';
      ctx.font = (isSelected ? 'bold ' : '') + '9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const shortName = this.getEasingShortName(easing);
      ctx.fillText(shortName, midX, centerY - amplitude - 2);
    }
  }

  getEasingShortName(easing) {
    const names = {
      linear: 'Lin',
      easeInQuad: 'EaseIn',
      easeOutQuad: 'EaseOut',
      easeInOutQuad: 'EaseIO',
      easeInCubic: 'CubicIn',
      easeOutCubic: 'CubicOut',
      easeInOutCubic: 'CubicIO',
      easeInQuart: 'QuartIn',
      easeOutQuart: 'QuartOut',
      easeInOutQuart: 'QuartIO',
      easeInElastic: 'ElasticIn',
      easeOutElastic: 'ElasticOut',
      easeOutBounce: 'Bounce'
    };
    return names[easing] || easing;
  }

  renderPlayhead(ctx, h) {
    const time = this.state.playheadTime;
    const x = this.timeToX(time);

    if (x < -10 || x > this.width + 10) return;

    // Playhead line
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = this.playheadWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    // Playhead handle (triangle at top)
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(x - 6, 0);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x, 8);
    ctx.closePath();
    ctx.fill();

    // Time label near playhead
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = time.toFixed(2) + 's';
    ctx.fillText(label, x, h - 2);
  }

  // ====== Interaction ======

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  hitTestKeyframe(mx, my) {
    const keyframes = this.frames.frames;
    const trackY = this.rulerHeight;
    const trackH = this.height - this.rulerHeight;
    const centerY = trackY + trackH / 2;
    const hitRadius = this.keyframeSize + 4;

    for (let i = keyframes.length - 1; i >= 0; i--) {
      const kf = keyframes[i];
      const x = this.timeToX(kf.time || 0);
      const dx = mx - x;
      const dy = my - centerY;
      if (Math.abs(dx) < hitRadius && Math.abs(dy) < hitRadius) {
        return i;
      }
    }
    return -1;
  }

  hitTestPlayhead(mx) {
    const x = this.timeToX(this.state.playheadTime);
    return Math.abs(mx - x) < 8;
  }

  hitTestTransition(mx, my) {
    const keyframes = this.frames.frames;
    const trackY = this.rulerHeight;
    const trackH = this.height - this.rulerHeight;
    if (my < trackY || my > trackY + trackH) return -1;

    for (let i = 0; i < keyframes.length - 1; i++) {
      const x1 = this.timeToX(keyframes[i].time || 0);
      const x2 = this.timeToX(keyframes[i + 1].time || 0);
      // Must be between the two keyframes (with a small margin past the diamond)
      const margin = this.keyframeSize + 4;
      if (mx > x1 + margin && mx < x2 - margin) {
        return i;
      }
    }
    return -1;
  }

  onMouseDown(e) {
    e.preventDefault();
    const { x, y } = this.getMousePos(e);
    this.isMouseDown = true;

    // Check if clicking on playhead
    if (this.hitTestPlayhead(x) && y < this.rulerHeight + 10) {
      this.dragging = { type: 'playhead', startX: x, startTime: this.state.playheadTime };
      return;
    }

    // Check if clicking on a keyframe
    const kfIndex = this.hitTestKeyframe(x, y);
    if (kfIndex >= 0) {
      this.selectedKeyframe = kfIndex;
      this.selectedTransition = -1;
      this.frames.goToFrame(kfIndex);
      this.dragging = {
        type: 'keyframe',
        index: kfIndex,
        startX: x,
        startTime: this.frames.frames[kfIndex].time || 0
      };
      this.render();
      return;
    }

    // Check if clicking on a transition segment
    const trIndex = this.hitTestTransition(x, y);
    if (trIndex >= 0) {
      this.selectedTransition = trIndex;
      this.selectedKeyframe = -1;
      this.render();
      return;
    }

    // Clicking on ruler or empty area -> move playhead
    if (y <= this.rulerHeight + 5) {
      const time = Math.max(0, Math.min(this.xToTime(x), this.state.timelineDuration));
      this.state.playheadTime = time;
      this.dragging = { type: 'playhead', startX: x, startTime: time };
      this.updatePlayheadFrame();
      this.render();
      return;
    }

    // Clicked empty track area -> deselect
    this.selectedKeyframe = -1;
    this.selectedTransition = -1;
    this.render();
  }

  onMouseMove(e) {
    const { x, y } = this.getMousePos(e);

    if (this.dragging) {
      if (this.dragging.type === 'playhead') {
        const time = Math.max(0, Math.min(this.xToTime(x), this.state.timelineDuration));
        this.state.playheadTime = time;
        this.updatePlayheadFrame();
        this.render();
      } else if (this.dragging.type === 'keyframe') {
        const dx = x - this.dragging.startX;
        let newTime = this.dragging.startTime + dx / this.state.timelineZoom;
        newTime = Math.max(0, Math.min(this.snapTime(newTime), this.state.timelineDuration));

        const kf = this.frames.frames[this.dragging.index];
        kf.time = newTime;
        this.sortKeyframes();
        // Update dragging index after sort
        this.dragging.index = this.frames.frames.indexOf(kf);
        this.selectedKeyframe = this.dragging.index;
        this.frames.currentFrameIndex = this.dragging.index;
        this.render();
      }
      return;
    }

    // Hover detection for keyframes
    const prevHoverKf = this.hoveredKeyframe;
    this.hoveredKeyframe = this.hitTestKeyframe(x, y);

    // Hover detection for transitions
    const prevHoverTr = this.hoveredTransition;
    this.hoveredTransition = this.hoveredKeyframe < 0 ? this.hitTestTransition(x, y) : -1;

    if (this.hoveredKeyframe !== prevHoverKf || this.hoveredTransition !== prevHoverTr) {
      this.canvas.style.cursor = (this.hoveredKeyframe >= 0 || this.hoveredTransition >= 0) ? 'pointer' : 'default';
      this.render();
    }

    // Change cursor for playhead area
    if (this.hitTestPlayhead(x) && y < this.rulerHeight + 10) {
      this.canvas.style.cursor = 'col-resize';
    } else if (y <= this.rulerHeight) {
      this.canvas.style.cursor = 'pointer';
    }
  }

  onMouseUp(e) {
    if (this.dragging && this.dragging.type === 'keyframe') {
      this.sortKeyframes();
      this.frames.updateUI();
      this.app.saveHistory();
    }
    this.dragging = null;
    this.isMouseDown = false;
  }

  onDoubleClick(e) {
    const { x, y } = this.getMousePos(e);

    // Double-click on track to add keyframe at that time
    if (y > this.rulerHeight) {
      const kfIndex = this.hitTestKeyframe(x, y);
      if (kfIndex >= 0) {
        // Double-click on keyframe -> open easing picker for its outgoing transition
        if (kfIndex < this.frames.frames.length - 1) {
          this.showTransitionEasingPicker(kfIndex, e.clientX, e.clientY);
        }
        return;
      }

      // Double-click on a transition -> open easing picker
      const trIndex = this.hitTestTransition(x, y);
      if (trIndex >= 0) {
        this.showTransitionEasingPicker(trIndex, e.clientX, e.clientY);
        return;
      }

      const time = Math.max(0, Math.min(this.snapTime(this.xToTime(x)), this.state.timelineDuration));
      this.addKeyframeAtTime(time);
    }
  }

  onWheel(e) {
    e.preventDefault();
    const { x } = this.getMousePos(e);

    if (e.ctrlKey || e.metaKey) {
      // Zoom timeline
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const timeAtMouse = this.xToTime(x);

      this.state.timelineZoom = Math.max(20, Math.min(2000, this.state.timelineZoom * zoomFactor));

      // Keep the time at mouse position stable
      this.state.timelineScrollX = timeAtMouse * this.state.timelineZoom - x;
      this.state.timelineScrollX = Math.max(0, this.state.timelineScrollX);
    } else {
      // Scroll timeline
      this.state.timelineScrollX = Math.max(0, this.state.timelineScrollX + e.deltaY);
    }

    this.render();
  }

  onContextMenu(e) {
    e.preventDefault();
    const { x, y } = this.getMousePos(e);

    // Right-click on a transition -> easing picker
    const trIndex = this.hitTestTransition(x, y);
    if (trIndex >= 0) {
      this.selectedTransition = trIndex;
      this.selectedKeyframe = -1;
      this.showTransitionEasingPicker(trIndex, e.clientX, e.clientY);
      return;
    }

    // Right-click on a keyframe -> easing picker for its outgoing transition
    const kfIndex = this.hitTestKeyframe(x, y);
    if (kfIndex >= 0 && kfIndex < this.frames.frames.length - 1) {
      this.selectedTransition = kfIndex;
      this.selectedKeyframe = -1;
      this.showTransitionEasingPicker(kfIndex, e.clientX, e.clientY);
    }
  }

  // ====== Keyframe operations ======

  addKeyframeAtTime(time) {
    // Check if there's already a keyframe very close
    const existing = this.frames.frames.find(kf => Math.abs((kf.time || 0) - time) < 0.02);
    if (existing) return;

    // Create a new frame at this time (duplicate from nearest keyframe or create empty)
    const nearestIndex = this.findNearestKeyframeIndex(time);
    let newFrame;
    if (nearestIndex >= 0) {
      const src = this.frames.frames[nearestIndex];
      newFrame = {
        id: this.frames.generateId(),
        time: time,
        easing: 'easeInOutQuad',
        layers: JSON.parse(JSON.stringify(src.layers)).map(layer => ({
          ...layer,
          id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        }))
      };
    } else {
      newFrame = this.frames.createEmptyFrame();
      newFrame.time = time;
      newFrame.easing = 'easeInOutQuad';
    }

    this.frames.frames.push(newFrame);
    this.sortKeyframes();

    const newIndex = this.frames.frames.indexOf(newFrame);
    this.frames.currentFrameIndex = newIndex;
    this.selectedKeyframe = newIndex;
    this.app.layers.activeLayerId = newFrame.layers[0]?.id;

    this.frames.updateUI();
    this.app.saveHistory();
    this.app.render();
    this.render();
  }

  findNearestKeyframeIndex(time) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.frames.frames.length; i++) {
      const dist = Math.abs((this.frames.frames[i].time || 0) - time);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  sortKeyframes() {
    const currentFrame = this.frames.getCurrentFrame();
    this.frames.frames.sort((a, b) => (a.time || 0) - (b.time || 0));
    if (currentFrame) {
      this.frames.currentFrameIndex = this.frames.frames.indexOf(currentFrame);
    }
  }

  updatePlayheadFrame() {
    // During scrubbing, show the interpolated frame at playhead position
    const time = this.state.playheadTime;
    const keyframes = this.frames.frames;
    if (keyframes.length === 0) return;

    // Find surrounding keyframes
    let prevIndex = -1;
    let nextIndex = -1;

    for (let i = 0; i < keyframes.length; i++) {
      const kfTime = keyframes[i].time || 0;
      if (kfTime <= time) prevIndex = i;
      if (kfTime >= time && nextIndex < 0) nextIndex = i;
    }

    if (prevIndex < 0) prevIndex = 0;
    if (nextIndex < 0) nextIndex = keyframes.length - 1;

    if (prevIndex === nextIndex) {
      // Exactly at a keyframe
      this.frames.currentFrameIndex = prevIndex;
      this.state.interpolatedFrame = null;
    } else {
      // Between keyframes - interpolate
      const prevKf = keyframes[prevIndex];
      const nextKf = keyframes[nextIndex];
      const prevTime = prevKf.time || 0;
      const nextTime = nextKf.time || 0;
      const t = (time - prevTime) / (nextTime - prevTime);

      const easingName = prevKf.easing || 'linear';
      const easingFn = this.frames.constructor.easing[easingName] || this.frames.constructor.easing.linear;
      const easedT = easingFn(t);

      this.state.interpolatedFrame = this.frames.createInterpolatedFrame(prevKf, nextKf, easedT);
      this.frames.currentFrameIndex = prevIndex;
    }

    this.app.render();
    this.frames.updateUI();
  }

  // ====== Easing Picker ======

  showTransitionEasingPicker(transitionIndex, clientX, clientY) {
    // Remove existing picker
    this.hideEasingPicker();

    const kf = this.frames.frames[transitionIndex];
    if (!kf) return;
    const nextKf = this.frames.frames[transitionIndex + 1];
    const currentEasing = kf.easing || 'linear';
    const fromLabel = `KF ${transitionIndex + 1}`;
    const toLabel = nextKf ? `KF ${transitionIndex + 2}` : '';

    const picker = document.createElement('div');
    picker.className = 'easing-picker';
    picker.id = 'easingPicker';
    picker.style.left = clientX + 'px';
    picker.style.top = clientY + 'px';

    // Header showing which transition
    const header = document.createElement('div');
    header.className = 'easing-picker-header';
    header.textContent = toLabel ? `${fromLabel} → ${toLabel}` : fromLabel;
    picker.appendChild(header);

    const easings = [
      { value: 'linear', label: 'Linear' },
      { value: 'easeInQuad', label: 'Ease In' },
      { value: 'easeOutQuad', label: 'Ease Out' },
      { value: 'easeInOutQuad', label: 'Ease In-Out' },
      { value: 'easeInCubic', label: 'Cubic In' },
      { value: 'easeOutCubic', label: 'Cubic Out' },
      { value: 'easeInOutCubic', label: 'Cubic In-Out' },
      { value: 'easeInQuart', label: 'Quart In' },
      { value: 'easeOutQuart', label: 'Quart Out' },
      { value: 'easeInOutQuart', label: 'Quart In-Out' },
      { value: 'easeInElastic', label: 'Elastic In' },
      { value: 'easeOutElastic', label: 'Elastic Out' },
      { value: 'easeOutBounce', label: 'Bounce' }
    ];

    for (const easing of easings) {
      const item = document.createElement('div');
      item.className = 'easing-picker-item' + (easing.value === currentEasing ? ' active' : '');
      item.textContent = easing.label;

      // Mini easing preview canvas
      const miniCanvas = document.createElement('canvas');
      miniCanvas.width = 30;
      miniCanvas.height = 20;
      miniCanvas.className = 'easing-mini-preview';
      this.drawMiniEasing(miniCanvas, easing.value);
      item.prepend(miniCanvas);

      item.addEventListener('click', () => {
        kf.easing = easing.value;
        this.selectedTransition = transitionIndex;
        this.hideEasingPicker();
        this.app.saveHistory();
        this.render();
      });
      picker.appendChild(item);
    }

    document.body.appendChild(picker);

    // Reposition to keep within viewport
    requestAnimationFrame(() => {
      const rect = picker.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (rect.right > vw) {
        picker.style.left = Math.max(4, vw - rect.width - 8) + 'px';
      }
      if (rect.bottom > vh) {
        picker.style.top = Math.max(4, vh - rect.height - 8) + 'px';
      }
      if (rect.left < 0) {
        picker.style.left = '4px';
      }
      if (rect.top < 0) {
        picker.style.top = '4px';
      }
    });

    // Close on outside click
    const closeHandler = (e) => {
      if (!picker.contains(e.target)) {
        this.hideEasingPicker();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 10);
  }

  hideEasingPicker() {
    const existing = document.getElementById('easingPicker');
    if (existing) existing.remove();
  }

  drawMiniEasing(canvas, easingName) {
    const ctx = canvas.getContext('2d');
    const fn = this.frames.constructor.easing[easingName] || this.frames.constructor.easing.linear;
    const w = canvas.width;
    const h = canvas.height;
    const padding = 2;

    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i <= w - padding * 2; i++) {
      const t = i / (w - padding * 2);
      const y = fn(t);
      const px = padding + i;
      const py = h - padding - y * (h - padding * 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}
