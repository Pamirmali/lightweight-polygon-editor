// Input handler for mouse, touch, and keyboard events
export class InputHandler {
  constructor(app) {
    this.app = app;
    this.canvas = null;
    this.isDrawing = false;
    this.isDragging = false;
    this.isPanning = false;
    this.isDraggingRefImage = false;
    this.refImageDragStart = null;
    this.lastMousePos = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };
    this.selectionStart = null;
    this.touchPoints = new Map();
    this.pinchStartDistance = 0;
    this.pinchStartZoom = 1;
  }

  init(canvas) {
    this.canvas = canvas;
    this.setupMouseEvents();
    this.setupTouchEvents();
    this.setupKeyboardEvents();
    this.setupWheelEvents();
  }

  setupMouseEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleContextMenu(e);
    });
  }

  setupTouchEvents() {
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
  }

  setupKeyboardEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  setupWheelEvents() {
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
  }

  getCanvasPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const state = this.app.state;
    return {
      x: (clientX - rect.left - state.panX) / state.zoom,
      y: (clientY - rect.top - state.panY) / state.zoom
    };
  }

  snapToGrid(pos) {
    if (this.app.state.snapToGrid) {
      return this.app.grid.snapToGrid(pos);
    }
    return pos;
  }

  // Mouse events
  handleMouseDown(e) {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const snappedPos = this.snapToGrid(pos);

    // Middle mouse or Space + Left for panning
    if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
      this.isPanning = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Right click - context menu handled separately
    if (e.button === 2) return;

    // Left click
    if (e.button === 0) {
      // Check if clicking on reference image (when not locked and select tool is active)
      if (this.isClickOnRefImage(pos) && !this.app.state.referenceImage.locked) {
        this.isDraggingRefImage = true;
        this.refImageDragStart = {
          mouseX: pos.x,
          mouseY: pos.y,
          imageX: this.app.state.referenceImage.x,
          imageY: this.app.state.referenceImage.y
        };
        this.canvas.style.cursor = 'move';
        return;
      }

      this.isDrawing = true;
      this.dragStart = { ...snappedPos };
      this.app.events.emit('input:mousedown', {
        pos: snappedPos,
        rawPos: pos,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey
      });
    }
  }

  isClickOnRefImage(pos) {
    const ref = this.app.state.referenceImage;
    if (!ref || !ref.image || !ref.visible) return false;
    
    return pos.x >= ref.x && 
           pos.x <= ref.x + ref.width &&
           pos.y >= ref.y && 
           pos.y <= ref.y + ref.height;
  }

  handleMouseMove(e) {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const snappedPos = this.snapToGrid(pos);

    // Update cursor position display
    this.app.events.emit('input:cursormove', { pos: snappedPos });

    // Panning
    if (this.isPanning) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.app.state.panX += dx;
      this.app.state.panY += dy;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.app.render();
      return;
    }

    // Dragging reference image
    if (this.isDraggingRefImage && this.refImageDragStart) {
      const dx = pos.x - this.refImageDragStart.mouseX;
      const dy = pos.y - this.refImageDragStart.mouseY;
      this.app.state.referenceImage.x = this.refImageDragStart.imageX + dx;
      this.app.state.referenceImage.y = this.refImageDragStart.imageY + dy;
      // Update position inputs in UI
      const refImageX = document.getElementById('refImageX');
      const refImageY = document.getElementById('refImageY');
      if (refImageX) refImageX.value = Math.round(this.app.state.referenceImage.x);
      if (refImageY) refImageY.value = Math.round(this.app.state.referenceImage.y);
      this.app.render();
      return;
    }

    // Drawing/dragging
    if (this.isDrawing) {
      this.app.events.emit('input:mousedrag', {
        pos: snappedPos,
        rawPos: pos,
        startPos: this.dragStart,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey
      });
    } else {
      this.app.events.emit('input:mousemove', {
        pos: snappedPos,
        rawPos: pos,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey
      });
    }
  }

  handleMouseUp(e) {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const snappedPos = this.snapToGrid(pos);

    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
      return;
    }

    if (this.isDraggingRefImage) {
      this.isDraggingRefImage = false;
      this.refImageDragStart = null;
      this.canvas.style.cursor = 'default';
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      this.app.events.emit('input:mouseup', {
        pos: snappedPos,
        rawPos: pos,
        startPos: this.dragStart,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey
      });
    }
  }

  handleMouseLeave(e) {
    if (this.isDrawing) {
      this.handleMouseUp(e);
    }
    if (this.isDraggingRefImage) {
      this.isDraggingRefImage = false;
      this.refImageDragStart = null;
      this.canvas.style.cursor = 'default';
    }
    this.isPanning = false;
  }

  handleDoubleClick(e) {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const snappedPos = this.snapToGrid(pos);
    this.app.events.emit('input:dblclick', {
      pos: snappedPos,
      rawPos: pos,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey
    });
  }

  handleContextMenu(e) {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.app.events.emit('input:contextmenu', {
      pos,
      clientX: e.clientX,
      clientY: e.clientY
    });
  }

  // Touch events
  handleTouchStart(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      this.touchPoints.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY
      });
    }

    if (this.touchPoints.size === 2) {
      // Pinch zoom start
      const points = Array.from(this.touchPoints.values());
      this.pinchStartDistance = this.getTouchDistance(points[0], points[1]);
      this.pinchStartZoom = this.app.state.zoom;
      return;
    }

    if (this.touchPoints.size === 1) {
      const touch = e.changedTouches[0];
      const pos = this.getCanvasPos(touch.clientX, touch.clientY);
      const snappedPos = this.snapToGrid(pos);
      this.isDrawing = true;
      this.dragStart = { ...snappedPos };
      this.app.events.emit('input:mousedown', {
        pos: snappedPos,
        rawPos: pos,
        shiftKey: false,
        ctrlKey: false,
        altKey: false
      });
    }
  }

  handleTouchMove(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      this.touchPoints.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY
      });
    }

    if (this.touchPoints.size === 2) {
      // Pinch zoom
      const points = Array.from(this.touchPoints.values());
      const currentDistance = this.getTouchDistance(points[0], points[1]);
      const scale = currentDistance / this.pinchStartDistance;
      this.app.state.zoom = Math.max(0.1, Math.min(10, this.pinchStartZoom * scale));
      this.app.render();
      return;
    }

    if (this.touchPoints.size === 1 && this.isDrawing) {
      const touch = e.changedTouches[0];
      const pos = this.getCanvasPos(touch.clientX, touch.clientY);
      const snappedPos = this.snapToGrid(pos);
      this.app.events.emit('input:mousedrag', {
        pos: snappedPos,
        rawPos: pos,
        startPos: this.dragStart,
        shiftKey: false,
        ctrlKey: false,
        altKey: false
      });
    }
  }

  handleTouchEnd(e) {
    for (const touch of e.changedTouches) {
      this.touchPoints.delete(touch.identifier);
    }

    if (this.touchPoints.size === 0 && this.isDrawing) {
      this.isDrawing = false;
      const touch = e.changedTouches[0];
      const pos = this.getCanvasPos(touch.clientX, touch.clientY);
      const snappedPos = this.snapToGrid(pos);
      this.app.events.emit('input:mouseup', {
        pos: snappedPos,
        rawPos: pos,
        startPos: this.dragStart,
        shiftKey: false,
        ctrlKey: false,
        altKey: false
      });
    }
  }

  getTouchDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  // Wheel events
  handleWheel(e) {
    e.preventDefault();

    const pos = this.getCanvasPos(e.clientX, e.clientY);

    if (e.ctrlKey) {
      // Zoom centered on cursor
      const oldZoom = this.app.state.zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, oldZoom * delta));

      // Adjust pan to zoom toward cursor
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.app.state.panX = mouseX - (mouseX - this.app.state.panX) * (newZoom / oldZoom);
      this.app.state.panY = mouseY - (mouseY - this.app.state.panY) * (newZoom / oldZoom);
      this.app.state.zoom = newZoom;
    } else if (e.shiftKey) {
      // Horizontal scroll
      this.app.state.panX -= e.deltaY;
    } else {
      // Vertical scroll / pan
      this.app.state.panX -= e.deltaX;
      this.app.state.panY -= e.deltaY;
    }

    this.app.render();
  }

  // Keyboard events
  handleKeyDown(e) {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();

    // Tool shortcuts
    const toolShortcuts = {
      'v': 'select',
      's': 'select',
      'g': 'move',
      'm': 'move',
      'r': 'rotate',
      'e': 'scale',
      'p': 'pen',
      'b': 'brush',
      'f': 'fill'
    };

    if (!e.ctrlKey && !e.metaKey && toolShortcuts[key]) {
      e.preventDefault();
      this.app.setTool(toolShortcuts[key]);
      return;
    }

    // Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (key) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            this.app.history.redo();
          } else {
            this.app.history.undo();
          }
          break;
        case 'y':
          e.preventDefault();
          this.app.history.redo();
          break;
        case 'a':
          e.preventDefault();
          this.app.selectAll();
          break;
        case 'd':
          e.preventDefault();
          this.app.duplicateSelected();
          break;
        case 'c':
          e.preventDefault();
          this.app.copy();
          break;
        case 'v':
          e.preventDefault();
          this.app.paste();
          break;
        case 'x':
          e.preventDefault();
          this.app.cut();
          break;
        case 'g':
          e.preventDefault();
          this.app.groupSelected();
          break;
        case 's':
          e.preventDefault();
          this.app.save();
          break;
      }
      return;
    }

    // Other shortcuts
    switch (key) {
      case 'delete':
      case 'backspace':
        e.preventDefault();
        this.app.deleteSelected();
        break;
      case 'escape':
        e.preventDefault();
        this.app.cancelCurrentAction();
        break;
      case ' ':
        e.preventDefault();
        // Space for temporary pan mode
        this.canvas.style.cursor = 'grab';
        break;
      case 'h':
        this.app.toggleMirror();
        break;
      case 'tab':
        e.preventDefault();
        this.app.cycleSelection(e.shiftKey ? -1 : 1);
        break;
      case '[':
        this.app.sendBackward();
        break;
      case ']':
        this.app.bringForward();
        break;
      case '0':
        // Reset view
        this.app.resetView();
        break;
      case '1':
        // Fit to screen
        this.app.fitToScreen();
        break;
    }

    // Number keys for quick tool access
    if (/^[1-9]$/.test(key) && !e.ctrlKey) {
      const toolIndex = parseInt(key) - 1;
      const tools = ['select', 'pen', 'brush', 'move', 'rotate', 'scale', 'fill'];
      if (toolIndex < tools.length) {
        this.app.setTool(tools[toolIndex]);
      }
    }
  }

  handleKeyUp(e) {
    if (e.key === ' ') {
      this.canvas.style.cursor = 'default';
    }
  }
}
