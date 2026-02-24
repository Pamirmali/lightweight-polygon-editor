// Interactive canvas-based Timeline UI for keyframe animation
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
    // Snap to 0.05s increments
    const snap = 0.05;
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

  hitTestKeyframe(mx, my) {
    const keyframes = this.frames.frames;
    const trackY = this.rulerHeight;
    const trackH = this.height - this.rulerHeight;
    const centerY = trackY + trackH / 2;
    for (let i = 0; i < keyframes.length; i++) {
      const x = this.timeToX(keyframes[i].time || 0);
      const dx = mx - x;
      const dy = my - centerY;
      if (Math.abs(dx) + Math.abs(dy) < this.keyframeSize + 4) return i;
    }
    return -1;
  }

  hitTestPlayhead(mx) {
    const x = this.timeToX(this.state.playheadTime);
    return Math.abs(mx - x) < 8;
  }

  getEasingShortName(easing) {
    const names = {
      'linear': 'Lin',
      'easeInQuad': 'In',
      'easeOutQuad': 'Out',
      'easeInOutQuad': 'InOut',
      'easeInCubic': 'CubIn',
      'easeOutCubic': 'CubOut',
      'easeInOutCubic': 'CubIO',
      'easeInQuart': 'QIn',
      'easeOutQuart': 'QOut',
      'easeInOutQuart': 'QIO',
      'easeInElastic': 'ElIn',
      'easeOutElastic': 'ElOut',
      'easeOutBounce': 'Bnc'
    };
    return names[easing] || easing;
  }

  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      this.canvas.removeEventListener('mousemove', this._onMouseMove);
      this.canvas.removeEventListener('mouseup', this._onMouseUp);
      this.canvas.removeEventListener('dblclick', this._onDoubleClick);
      this.canvas.removeEventListener('wheel', this._onWheel);
      this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
  }
}
