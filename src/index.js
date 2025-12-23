// Lightweight Polygon Editor - Main Entry Point
import { EventEmitter } from './core/EventEmitter.js';
import { HistoryManager } from './core/HistoryManager.js';
import { GridSystem } from './core/GridSystem.js';
import { CanvasRenderer } from './core/CanvasRenderer.js';
import { FrameManager } from './core/FrameManager.js';
import { LayerManager } from './core/LayerManager.js';
import { ShapeFactory } from './core/ShapeFactory.js';
import { InputHandler } from './core/InputHandler.js';
import { ToolManager } from './core/ToolManager.js';
import { ExportManager } from './core/ExportManager.js';

class PolygonEditor {
  constructor() {
    // Default canvas size in grid units
    this.canvasWidth = 800;
    this.canvasHeight = 600;
    
    // Initialize state
    this.state = {
      zoom: 1,
      panX: 0,  // Will be set to center in resizeCanvas
      panY: 0,
      showGrid: true,
      snapToGrid: true,
      gridSize: 20,
      canvasSizePreset: '800x600',
      mirrorEnabled: false,
      mirrorX: 0,  // Mirror at x=0 (center)
      onionSkinning: false,
      selectedShapes: [],
      selectedVertices: [],
      fps: 12,
      currentTool: 'select',
      polygonSides: 6,
      previewPath: null,
      previewPoint: null,
      previewShape: null,
      selectionBox: null,
      snapIndicator: null,
      clipboard: null,
      // Sculpt settings
      brushRadius: 50,
      brushStrength: 0.5,
      brushFalloff: 'smooth',  // 'smooth', 'linear', 'sharp', 'constant'
      softSelectEnabled: false,
      brushPosition: null,  // Current brush position for visualization
      // Tweening settings
      tweenEnabled: true,
      tweenSteps: 10,  // Number of interpolation steps between keyframes
      tweenEasing: 'easeInOutQuad',
      // Playback state
      isPlaying: false,
      playbackPosition: 0,  // Float: frame index + sub-frame progress (e.g., 0.5 = halfway between frame 0 and 1)
      interpolatedFrame: null  // Cached interpolated frame for rendering during playback
    };

    // Create core systems
    this.events = new EventEmitter();
    
    // Initialize after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    // Get canvas
    this.canvas = document.getElementById('editor-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Create managers
    this.history = new HistoryManager(this);
    this.grid = new GridSystem(this);
    this.renderer = new CanvasRenderer(this);
    this.frames = new FrameManager(this);
    this.layers = new LayerManager(this);
    this.shapes = new ShapeFactory(this);
    this.input = new InputHandler(this);
    this.tools = new ToolManager(this);
    this.exporter = new ExportManager(this);

    // Initialize input
    this.input.init(this.canvas);

    // Setup canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Setup UI
    this.setupToolbar();
    this.setupPanels();

    // Setup cursor coordinate display
    this.events.on('input:cursormove', ({ pos }) => {
      const display = document.getElementById('coordDisplay');
      if (display) {
        display.textContent = `X: ${Math.round(pos.x)}  Y: ${Math.round(pos.y)}`;
      }
    });

    // Create initial frame and layer
    this.frames.addFrame();
    this.layers.addLayer('Layer 1');

    // Initial render
    this.centerView();
    this.saveHistory();

    console.log('Polygon Editor initialized');
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    
    this.ctx.scale(dpr, dpr);
    
    // Center the origin (0,0) in the middle of the canvas
    if (this.state.panX === 0 && this.state.panY === 0) {
      this.state.panX = container.clientWidth / 2;
      this.state.panY = container.clientHeight / 2;
    }
    
    this.render();
  }

  // Center view on origin with default zoom
  centerView() {
    const container = this.canvas.parentElement;
    this.state.zoom = 1;
    this.state.panX = container.clientWidth / 2;
    this.state.panY = container.clientHeight / 2;
    this.updateZoomDisplay();
    this.render();
  }

  // Fit canvas bounds in view
  fitCanvasInView() {
    const container = this.canvas.parentElement;
    const padding = 50;
    
    // Calculate zoom to fit canvas size
    const zoomX = (container.clientWidth - padding * 2) / this.canvasWidth;
    const zoomY = (container.clientHeight - padding * 2) / this.canvasHeight;
    this.state.zoom = Math.min(zoomX, zoomY, 2);
    
    // Center origin
    this.state.panX = container.clientWidth / 2;
    this.state.panY = container.clientHeight / 2;
    
    this.updateZoomDisplay();
    this.render();
  }

  updateZoomDisplay() {
    const zoomDisplay = document.getElementById('zoomDisplay');
    if (zoomDisplay) {
      zoomDisplay.textContent = Math.round(this.state.zoom * 100) + '%';
    }
  }

  setCanvasSize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.state.canvasSizePreset = `${width}x${height}`;
    this.fitCanvasInView();
  }

  setupToolbar() {
    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool) {
          this.setTool(tool);
        }
      });
    });

    // Grid toggle
    const gridToggle = document.getElementById('gridToggle');
    if (gridToggle) {
      gridToggle.addEventListener('change', (e) => {
        this.state.showGrid = e.target.checked;
        this.render();
      });
    }

    // Snap toggle
    const snapToggle = document.getElementById('snapToggle');
    if (snapToggle) {
      snapToggle.addEventListener('change', (e) => {
        this.state.snapToGrid = e.target.checked;
      });
    }

    // Grid size
    const gridSizeInput = document.getElementById('gridSize');
    if (gridSizeInput) {
      const updateGridSize = (e) => {
        this.state.gridSize = parseInt(e.target.value) || 20;
        this.render();
      };
      gridSizeInput.addEventListener('change', updateGridSize);
      gridSizeInput.addEventListener('input', updateGridSize);
    }

    // Mirror toggle
    const mirrorToggle = document.getElementById('mirrorToggle');
    if (mirrorToggle) {
      mirrorToggle.addEventListener('change', (e) => {
        this.state.mirrorEnabled = e.target.checked;
        this.render();
      });
    }

    // Canvas size selector
    const canvasSizeSelect = document.getElementById('canvasSizeSelect');
    if (canvasSizeSelect) {
      canvasSizeSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'custom') {
          const widthStr = prompt('Enter canvas width:', this.canvasWidth);
          const heightStr = prompt('Enter canvas height:', this.canvasHeight);
          if (widthStr && heightStr) {
            const width = parseInt(widthStr) || 800;
            const height = parseInt(heightStr) || 600;
            this.setCanvasSize(width, height);
          }
        } else {
          const [width, height] = value.split('x').map(Number);
          this.setCanvasSize(width, height);
        }
      });
    }

    // Polygon sides / vertex count
    const sidesInput = document.getElementById('vertexCount');
    if (sidesInput) {
      const updateSides = (e) => {
        this.state.polygonSides = parseInt(e.target.value) || 6;
      };
      sidesInput.addEventListener('change', updateSides);
      sidesInput.addEventListener('input', updateSides);
    }

    // View controls
    const centerBtn = document.getElementById('centerViewBtn');
    const fitCanvasBtn = document.getElementById('fitCanvasBtn');
    const fitBtn = document.getElementById('fitViewBtn');
    
    if (centerBtn) centerBtn.addEventListener('click', () => this.centerView());
    if (fitCanvasBtn) fitCanvasBtn.addEventListener('click', () => this.fitCanvasInView());
    if (fitBtn) fitBtn.addEventListener('click', () => this.fitToScreen());

    // Export buttons
    const copyVertices = document.getElementById('copyVertsBtn');
    const copyTriangles = document.getElementById('copyTrisBtn');
    const exportJSON = document.getElementById('exportJsonBtn');
    const exportAnimation = document.getElementById('exportAnimBtn');

    if (copyVertices) copyVertices.addEventListener('click', () => this.exporter.copyVertices());
    if (copyTriangles) copyTriangles.addEventListener('click', () => this.exporter.copyTriangles());
    if (exportJSON) exportJSON.addEventListener('click', () => this.exporter.exportJSON());
    if (exportAnimation) exportAnimation.addEventListener('click', () => this.exporter.exportAnimation());

    // Undo/Redo buttons
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) undoBtn.addEventListener('click', () => this.history.undo());
    if (redoBtn) redoBtn.addEventListener('click', () => this.history.redo());

    // Create polygon button
    const createPolygonBtn = document.getElementById('createPolygonBtn');
    if (createPolygonBtn) {
      createPolygonBtn.addEventListener('click', () => {
        const sides = this.state.polygonSides;
        const rect = this.canvas.getBoundingClientRect();
        const cx = (rect.width / 2 - this.state.panX) / this.state.zoom;
        const cy = (rect.height / 2 - this.state.panY) / this.state.zoom;
        this.shapes.createPolygon(cx, cy, 100, sides);
        this.saveHistory();
        this.render();
      });
    }

    // Load default shape button (rounded square with 100 vertices)
    const loadDefaultShapeBtn = document.getElementById('loadDefaultShapeBtn');
    if (loadDefaultShapeBtn) {
      loadDefaultShapeBtn.addEventListener('click', () => {
        const rect = this.canvas.getBoundingClientRect();
        const cx = (rect.width / 2 - this.state.panX) / this.state.zoom;
        const cy = (rect.height / 2 - this.state.panY) / this.state.zoom;
        // Create a rounded square with 100 vertices, size 200, corner radius 30
        this.shapes.createRoundedSquare(cx, cy, 200, 30, 100);
        this.saveHistory();
        this.render();
      });
    }

    // Shape modification buttons
    const subdivideBtn = document.getElementById('subdivideBtn');
    const simplifyBtn = document.getElementById('simplifyBtn');
    
    if (subdivideBtn) {
      subdivideBtn.addEventListener('click', () => {
        this.shapes.subdivideSelected();
        this.saveHistory();
        this.render();
      });
    }
    
    if (simplifyBtn) {
      simplifyBtn.addEventListener('click', () => {
        const tolerance = parseFloat(document.getElementById('simplifyTolerance')?.value) || 2;
        this.shapes.simplifySelected(tolerance);
        this.saveHistory();
        this.render();
      });
    }

    // Transform buttons
    const flipHBtn = document.getElementById('flipHBtn');
    const flipVBtn = document.getElementById('flipVBtn');
    
    if (flipHBtn) {
      flipHBtn.addEventListener('click', () => {
        this.shapes.flipSelectedH();
        this.saveHistory();
        this.render();
      });
    }
    
    if (flipVBtn) {
      flipVBtn.addEventListener('click', () => {
        this.shapes.flipSelectedV();
        this.saveHistory();
        this.render();
      });
    }

    // Mirror left to right button
    const mirrorLeftToRightBtn = document.getElementById('mirrorLeftToRightBtn');
    if (mirrorLeftToRightBtn) {
      mirrorLeftToRightBtn.addEventListener('click', () => {
        this.shapes.mirrorLeftToRight();
        this.saveHistory();
        this.render();
      });
    }

    // Sculpt panel controls
    this.setupSculptPanel();
  }

  setupSculptPanel() {
    // Brush radius slider
    const brushRadiusInput = document.getElementById('brushRadius');
    const brushRadiusValue = document.getElementById('brushRadiusValue');
    if (brushRadiusInput) {
      brushRadiusInput.addEventListener('input', (e) => {
        this.state.brushRadius = parseInt(e.target.value);
        if (brushRadiusValue) brushRadiusValue.textContent = e.target.value;
        this.render();
      });
    }

    // Brush strength slider
    const brushStrengthInput = document.getElementById('brushStrength');
    const brushStrengthValue = document.getElementById('brushStrengthValue');
    if (brushStrengthInput) {
      brushStrengthInput.addEventListener('input', (e) => {
        this.state.brushStrength = parseInt(e.target.value) / 100;
        if (brushStrengthValue) brushStrengthValue.textContent = e.target.value + '%';
      });
    }

    // Brush falloff dropdown
    const brushFalloffSelect = document.getElementById('brushFalloff');
    if (brushFalloffSelect) {
      brushFalloffSelect.addEventListener('change', (e) => {
        this.state.brushFalloff = e.target.value;
      });
    }

    // Soft selection toggle
    const softSelectToggle = document.getElementById('softSelectToggle');
    if (softSelectToggle) {
      softSelectToggle.addEventListener('change', (e) => {
        this.state.softSelectEnabled = e.target.checked;
      });
    }

    // Smooth/Relax button
    const smoothVerticesBtn = document.getElementById('smoothVerticesBtn');
    if (smoothVerticesBtn) {
      smoothVerticesBtn.addEventListener('click', () => {
        this.shapes.smoothSelected();
        this.saveHistory();
        this.render();
      });
    }
  }

  setupPanels() {
    // Layer panel
    const addLayerBtn = document.getElementById('addLayerBtn');
    const delLayerBtn = document.getElementById('delLayerBtn');
    
    if (addLayerBtn) {
      addLayerBtn.addEventListener('click', () => {
        const name = `Layer ${this.getCurrentLayers().length + 1}`;
        this.layers.addLayer(name);
        this.saveHistory();
      });
    }
    
    if (delLayerBtn) {
      delLayerBtn.addEventListener('click', () => {
        this.layers.deleteActiveLayer();
        this.saveHistory();
        this.render();
      });
    }

    // Frame/Timeline panel
    const addFrameBtn = document.getElementById('addFrameBtn');
    const dupFrameBtn = document.getElementById('dupFrameBtn');
    const delFrameBtn = document.getElementById('delFrameBtn');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const prevFrameBtn = document.getElementById('prevFrameBtn');
    const nextFrameBtn = document.getElementById('nextFrameBtn');
    const fpsInput = document.getElementById('fpsInput');

    if (addFrameBtn) {
      addFrameBtn.addEventListener('click', () => {
        this.frames.addFrame();
        this.saveHistory();
      });
    }
    
    if (dupFrameBtn) {
      dupFrameBtn.addEventListener('click', () => {
        this.frames.duplicateFrame();
        this.saveHistory();
      });
    }
    
    if (delFrameBtn) {
      delFrameBtn.addEventListener('click', () => {
        this.frames.deleteFrame();
        this.saveHistory();
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlayback());
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopPlayback();
        this.state.playbackPosition = 0;
        this.frames.goToFrame(0);
      });
    }
    
    if (prevFrameBtn) {
      prevFrameBtn.addEventListener('click', () => {
        if (this.state.isPlaying) this.stopPlayback();
        this.frames.previousFrame();
      });
    }
    
    if (nextFrameBtn) {
      nextFrameBtn.addEventListener('click', () => {
        if (this.state.isPlaying) this.stopPlayback();
        this.frames.nextFrame();
      });
    }

    if (fpsInput) {
      const updateFps = (e) => {
        this.state.fps = parseInt(e.target.value) || 12;
      };
      fpsInput.addEventListener('change', updateFps);
      fpsInput.addEventListener('input', updateFps);
    }

    // Onion skinning toggle
    const onionToggle = document.getElementById('onionSkinToggle');
    if (onionToggle) {
      onionToggle.addEventListener('change', (e) => {
        this.state.onionSkinning = e.target.checked;
        this.render();
      });
    }

    // Tweening controls
    const tweenToggle = document.getElementById('tweenToggle');
    if (tweenToggle) {
      tweenToggle.addEventListener('change', (e) => {
        this.state.tweenEnabled = e.target.checked;
      });
    }

    const tweenStepsInput = document.getElementById('tweenSteps');
    if (tweenStepsInput) {
      tweenStepsInput.addEventListener('change', (e) => {
        this.state.tweenSteps = parseInt(e.target.value) || 10;
      });
      tweenStepsInput.addEventListener('input', (e) => {
        this.state.tweenSteps = parseInt(e.target.value) || 10;
      });
    }

    const tweenEasingSelect = document.getElementById('tweenEasing');
    if (tweenEasingSelect) {
      tweenEasingSelect.addEventListener('change', (e) => {
        this.state.tweenEasing = e.target.value;
      });
    }
  }

  setTool(toolName) {
    this.state.currentTool = toolName;
    this.tools.setTool(toolName);
  }

  zoomBy(factor) {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const oldZoom = this.state.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom * factor));
    
    this.state.panX = centerX - (centerX - this.state.panX) * (newZoom / oldZoom);
    this.state.panY = centerY - (centerY - this.state.panY) * (newZoom / oldZoom);
    this.state.zoom = newZoom;
    
    this.updateZoomDisplay();
    this.render();
  }

  resetView() {
    this.centerView();
  }

  fitToScreen() {
    const shapes = this.getCurrentShapes();
    if (shapes.length === 0) {
      this.fitCanvasInView();
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const shape of shapes) {
      for (const v of shape.vertices) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      }
    }

    const padding = 50;
    const rect = this.canvas.getBoundingClientRect();
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width === 0 || height === 0) {
      this.fitCanvasInView();
      return;
    }
    
    const scaleX = (rect.width - padding * 2) / width;
    const scaleY = (rect.height - padding * 2) / height;
    const zoom = Math.min(scaleX, scaleY, 2);
    
    // Center on the shapes' center point
    const shapeCenterX = (minX + maxX) / 2;
    const shapeCenterY = (minY + maxY) / 2;
    
    this.state.zoom = zoom;
    this.state.panX = rect.width / 2 - shapeCenterX * zoom;
    this.state.panY = rect.height / 2 - shapeCenterY * zoom;
    
    this.updateZoomDisplay();
    this.render();
  }

  getCurrentFrame() {
    return this.frames.getCurrentFrame();
  }

  getCurrentLayers() {
    const frame = this.getCurrentFrame();
    return frame ? frame.layers : [];
  }

  getCurrentLayer() {
    const layers = this.getCurrentLayers();
    const activeId = this.layers.activeLayerId;
    return layers.find(l => l.id === activeId) || layers[0];
  }

  getCurrentShapes() {
    const layer = this.getCurrentLayer();
    return layer ? layer.shapes : [];
  }

  render() {
    // During playback with tweening, use the interpolated frame if available
    const frame = this.state.interpolatedFrame || this.getCurrentFrame();
    const prevFrame = this.state.onionSkinning ? this.frames.getPreviousFrame() : null;
    
    this.renderer.render(frame, prevFrame);
  }

  saveHistory() {
    const state = this.getState();
    this.history.pushState(state);
  }

  getState() {
    return {
      frames: JSON.parse(JSON.stringify(this.frames.frames)),
      currentFrameIndex: this.frames.currentFrameIndex,
      activeLayerId: this.layers.activeLayerId,
      selectedShapes: [...this.state.selectedShapes],
      selectedVertices: [...this.state.selectedVertices]
    };
  }

  restoreState(state) {
    this.frames.frames = state.frames;
    this.frames.currentFrameIndex = state.currentFrameIndex;
    this.layers.activeLayerId = state.activeLayerId;
    this.state.selectedShapes = state.selectedShapes || [];
    this.state.selectedVertices = state.selectedVertices || [];
    
    this.frames.updateUI();
    this.layers.updateUI();
    this.render();
  }

  toggleMirror() {
    this.state.mirrorEnabled = !this.state.mirrorEnabled;
    const toggle = document.getElementById('mirror-toggle');
    if (toggle) toggle.checked = this.state.mirrorEnabled;
    this.render();
  }

  togglePlayback() {
    if (this.state.isPlaying) {
      // Stop playback
      this.stopPlayback();
    } else {
      // Start playback
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.frames.frames.length < 2) {
      // Need at least 2 frames for animation
      return;
    }

    this.state.isPlaying = true;
    this.state.playbackPosition = this.frames.currentFrameIndex;
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.classList.add('playing');

    // Calculate timing
    // If tweening is enabled, we interpolate between frames
    // Total steps per keyframe transition = tweenSteps
    // FPS controls overall speed
    
    const updatePlayback = () => {
      if (!this.state.isPlaying) return;

      const totalFrames = this.frames.frames.length;
      const tweenEnabled = this.state.tweenEnabled;
      const tweenSteps = this.state.tweenSteps;
      
      // Calculate increment per tick
      // With tweening: move 1/tweenSteps of a frame per tick
      // Without tweening: move 1 frame per tick
      const increment = tweenEnabled ? (1 / tweenSteps) : 1;
      
      this.state.playbackPosition += increment;
      
      // Loop back to start
      if (this.state.playbackPosition >= totalFrames) {
        this.state.playbackPosition = 0;
      }

      // Update the interpolated frame for rendering
      if (tweenEnabled && totalFrames >= 2) {
        this.updateInterpolatedFrame();
      } else {
        // No tweening - just show the current keyframe
        this.frames.currentFrameIndex = Math.floor(this.state.playbackPosition);
        this.state.interpolatedFrame = null;
      }

      this.render();
      
      // Update frame display
      const frameDisplay = document.getElementById('frameDisplay');
      if (frameDisplay) {
        const currentFrame = Math.floor(this.state.playbackPosition) + 1;
        const subFrame = this.state.playbackPosition % 1;
        if (tweenEnabled && subFrame > 0.01) {
          frameDisplay.textContent = `Frame: ${currentFrame}.${Math.round(subFrame * 10)} / ${totalFrames}`;
        } else {
          frameDisplay.textContent = `Frame: ${currentFrame} / ${totalFrames}`;
        }
      }
    };

    // Use requestAnimationFrame for smoother animation, but control speed with fps
    const delay = 1000 / this.state.fps;
    this.playbackInterval = setInterval(updatePlayback, delay);
  }

  stopPlayback() {
    this.state.isPlaying = false;
    this.state.interpolatedFrame = null;
    
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }

    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.classList.remove('playing');

    // Snap to nearest keyframe
    this.frames.currentFrameIndex = Math.floor(this.state.playbackPosition);
    this.frames.updateUI();
    this.render();
  }

  updateInterpolatedFrame() {
    const position = this.state.playbackPosition;
    const currentIndex = Math.floor(position);
    const nextIndex = (currentIndex + 1) % this.frames.frames.length;
    const t = position - currentIndex; // Progress between frames (0 to 1)

    if (t < 0.001) {
      // At a keyframe, no interpolation needed
      this.state.interpolatedFrame = null;
      this.frames.currentFrameIndex = currentIndex;
      return;
    }

    const startFrame = this.frames.frames[currentIndex];
    const endFrame = this.frames.frames[nextIndex];
    
    // Apply easing to the interpolation factor
    const easingFn = this.frames.constructor.easing[this.state.tweenEasing] || 
                     this.frames.constructor.easing.linear;
    const easedT = easingFn(t);

    // Create interpolated frame
    this.state.interpolatedFrame = this.frames.createInterpolatedFrame(startFrame, endFrame, easedT);
    this.frames.currentFrameIndex = currentIndex;
  }

  selectAll() {
    const shapes = this.getCurrentShapes();
    this.state.selectedShapes = shapes.map(s => s.id);
    this.render();
  }

  deleteSelected() {
    if (this.state.selectedVertices.length > 0) {
      this.shapes.deleteSelectedVertices();
    } else if (this.state.selectedShapes.length > 0) {
      this.shapes.deleteSelectedShapes();
    }
    this.saveHistory();
    this.render();
  }

  duplicateSelected() {
    if (this.state.selectedShapes.length > 0) {
      this.shapes.duplicateSelected();
      this.saveHistory();
      this.render();
    }
  }

  copy() {
    if (this.state.selectedShapes.length > 0) {
      const shapes = this.getCurrentShapes()
        .filter(s => this.state.selectedShapes.includes(s.id));
      this.state.clipboard = JSON.parse(JSON.stringify(shapes));
    }
  }

  paste() {
    if (this.state.clipboard && this.state.clipboard.length > 0) {
      const layer = this.getCurrentLayer();
      if (!layer) return;

      const newIds = [];
      for (const shape of this.state.clipboard) {
        const newShape = JSON.parse(JSON.stringify(shape));
        newShape.id = this.shapes.generateId();
        // Offset pasted shapes
        for (const v of newShape.vertices) {
          v.x += 20;
          v.y += 20;
        }
        layer.shapes.push(newShape);
        newIds.push(newShape.id);
      }
      
      this.state.selectedShapes = newIds;
      this.saveHistory();
      this.render();
    }
  }

  cut() {
    this.copy();
    this.deleteSelected();
  }

  groupSelected() {
    // For now, just mark as group - could be extended
    console.log('Group functionality placeholder');
  }

  save() {
    const data = {
      version: 1,
      state: this.getState()
    };
    localStorage.setItem('polygon-editor-save', JSON.stringify(data));
    console.log('Project saved');
  }

  load() {
    const saved = localStorage.getItem('polygon-editor-save');
    if (saved) {
      const data = JSON.parse(saved);
      this.restoreState(data.state);
      console.log('Project loaded');
    }
  }

  cancelCurrentAction() {
    // If pen tool has a path, close and create the shape
    if (this.tools.toolState.currentPath && this.tools.toolState.currentPath.length >= 3) {
      this.shapes.createFromPath(this.tools.toolState.currentPath);
      this.saveHistory();
    }
    
    // Clear tool state
    this.tools.toolState = {};
    this.state.previewPath = null;
    this.state.previewPoint = null;
    this.state.previewShape = null;
    this.state.selectionBox = null;
    
    // Switch to select tool
    this.setTool('select');
    this.render();
  }

  cycleSelection(direction) {
    const shapes = this.getCurrentShapes();
    if (shapes.length === 0) return;

    if (this.state.selectedShapes.length === 0) {
      this.state.selectedShapes = [shapes[0].id];
    } else {
      const currentId = this.state.selectedShapes[0];
      const currentIndex = shapes.findIndex(s => s.id === currentId);
      let newIndex = (currentIndex + direction + shapes.length) % shapes.length;
      this.state.selectedShapes = [shapes[newIndex].id];
    }
    this.render();
  }

  sendBackward() {
    this.shapes.reorderSelected(-1);
    this.saveHistory();
    this.render();
  }

  bringForward() {
    this.shapes.reorderSelected(1);
    this.saveHistory();
    this.render();
  }
}

// Create global instance
window.polygonEditor = new PolygonEditor();
