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
import { FolderManager } from './core/FolderManager.js';
import { TimelineUI } from './core/TimelineUI.js';

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
      // Timeline settings
      timelineDuration: 5.0,      // Total timeline duration in seconds
      timelineZoom: 100,          // Pixels per second in timeline
      timelineScrollX: 0,         // Scroll offset in timeline
      playheadTime: 0,            // Current playhead position in seconds
      loopMode: 'loop',           // 'loop', 'pingpong', 'once'
      playbackSpeed: 1.0,         // Playback speed multiplier
      // Playback state
      isPlaying: false,
      playbackPosition: 0,  // Float: frame index + sub-frame progress (e.g., 0.5 = halfway between frame 0 and 1)
      interpolatedFrame: null,  // Cached interpolated frame for rendering during playback
      // Reference image
      referenceImage: {
        image: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        originalWidth: 0,
        originalHeight: 0,
        scale: 1,
        opacity: 0.5,
        visible: true,
        locked: false
      }
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
    this.folder = new FolderManager(this);
    this.timelineUI = new TimelineUI(this);

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
    this.frames.addFrame(0);  // First keyframe at time 0
    // Note: addFrame() already creates a frame with Layer 1, no need to add another
    // Set the active layer to the first layer of the first frame
    const firstFrame = this.frames.getCurrentFrame();
    if (firstFrame && firstFrame.layers.length > 0) {
      this.layers.activeLayerId = firstFrame.layers[0].id;
      this.layers.updateUI();
    }

    // Initial render
    this.centerView();
    this.saveHistory();

    // Initialize visual timeline
    this.timelineUI.init('timelineCanvasContainer');

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
        this.state.playheadTime = 0;
        this.frames.goToFrame(0);
        if (this.timelineUI) this.timelineUI.render();
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





    // Loop Mode
    const loopModeSelect = document.getElementById('loopMode');
    if (loopModeSelect) {
      loopModeSelect.addEventListener('change', (e) => {
        this.state.loopMode = e.target.value;
      });
    }

    // Playback Speed
    const speedInput = document.getElementById('playbackSpeed');
    if (speedInput) {
      speedInput.addEventListener('change', (e) => {
        this.state.playbackSpeed = parseFloat(e.target.value) || 1.0;
      });
      speedInput.addEventListener('input', (e) => {
        this.state.playbackSpeed = parseFloat(e.target.value) || 1.0;
      });
    }

    // Reference Image controls
    this.setupReferenceImagePanel();

    // Folder/Project controls
    this.setupFolderPanel();
  }

  setupReferenceImagePanel() {
    const refImageInput = document.getElementById('refImageInput');
    const loadRefImageBtn = document.getElementById('loadRefImageBtn');
    const clearRefImageBtn = document.getElementById('clearRefImageBtn');
    const refImageOpacity = document.getElementById('refImageOpacity');
    const refImageOpacityValue = document.getElementById('refImageOpacityValue');
    const refImageScale = document.getElementById('refImageScale');
    const refImageScaleValue = document.getElementById('refImageScaleValue');
    const refImageX = document.getElementById('refImageX');
    const refImageY = document.getElementById('refImageY');
    const refImageLocked = document.getElementById('refImageLocked');
    const refImageControls = document.getElementById('refImageControls');
    const refImageScaleRow = document.getElementById('refImageScaleRow');
    const refImagePositionRow = document.getElementById('refImagePositionRow');
    const refImageOptionsRow = document.getElementById('refImageOptionsRow');

    const showControls = () => {
      if (refImageControls) refImageControls.style.display = 'flex';
      if (refImageScaleRow) refImageScaleRow.style.display = 'flex';
      if (refImagePositionRow) refImagePositionRow.style.display = 'flex';
      if (refImageOptionsRow) refImageOptionsRow.style.display = 'flex';
    };

    const hideControls = () => {
      if (refImageControls) refImageControls.style.display = 'none';
      if (refImageScaleRow) refImageScaleRow.style.display = 'none';
      if (refImagePositionRow) refImagePositionRow.style.display = 'none';
      if (refImageOptionsRow) refImageOptionsRow.style.display = 'none';
    };

    // Load button triggers file input
    if (loadRefImageBtn && refImageInput) {
      loadRefImageBtn.addEventListener('click', () => {
        refImageInput.click();
      });
    }

    // File upload handler
    if (refImageInput) {
      refImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              this.state.referenceImage.image = img;
              this.state.referenceImage.originalWidth = img.width;
              this.state.referenceImage.originalHeight = img.height;
              this.state.referenceImage.scale = 1;
              this.state.referenceImage.width = img.width;
              this.state.referenceImage.height = img.height;
              // Center the image on canvas
              this.state.referenceImage.x = -img.width / 2;
              this.state.referenceImage.y = -img.height / 2;
              // Update position inputs
              if (refImageX) refImageX.value = Math.round(this.state.referenceImage.x);
              if (refImageY) refImageY.value = Math.round(this.state.referenceImage.y);
              // Show controls
              showControls();
              this.render();
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Opacity slider
    if (refImageOpacity) {
      refImageOpacity.addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value) / 100;
        this.state.referenceImage.opacity = opacity;
        if (refImageOpacityValue) refImageOpacityValue.textContent = e.target.value + '%';
        this.render();
      });
    }

    // Scale slider
    if (refImageScale) {
      refImageScale.addEventListener('input', (e) => {
        const scale = parseInt(e.target.value) / 100;
        this.state.referenceImage.scale = scale;
        this.state.referenceImage.width = this.state.referenceImage.originalWidth * scale;
        this.state.referenceImage.height = this.state.referenceImage.originalHeight * scale;
        if (refImageScaleValue) refImageScaleValue.textContent = e.target.value + '%';
        this.render();
      });
    }

    // Position X
    if (refImageX) {
      refImageX.addEventListener('change', (e) => {
        this.state.referenceImage.x = parseFloat(e.target.value) || 0;
        this.render();
      });
    }

    // Position Y
    if (refImageY) {
      refImageY.addEventListener('change', (e) => {
        this.state.referenceImage.y = parseFloat(e.target.value) || 0;
        this.render();
      });
    }

    // Lock toggle
    if (refImageLocked) {
      refImageLocked.addEventListener('change', (e) => {
        this.state.referenceImage.locked = e.target.checked;
      });
    }

    // Clear button
    if (clearRefImageBtn) {
      clearRefImageBtn.addEventListener('click', () => {
        this.state.referenceImage.image = null;
        this.state.referenceImage.width = 0;
        this.state.referenceImage.height = 0;
        if (refImageInput) refImageInput.value = '';
        hideControls();
        this.render();
      });
    }
  }

  setupFolderPanel() {
    const linkBtn = document.getElementById('linkFolderBtn');
    const unlinkBtn = document.getElementById('unlinkFolderBtn');
    const refreshBtn = document.getElementById('refreshFilesBtn');
    const loadProjectBtn = document.getElementById('loadProjectBtn');
    const loadIntoFrameBtn = document.getElementById('loadIntoFrameBtn');
    const saveBtn = document.getElementById('saveToFolderBtn');
    const fileNameInput = document.getElementById('saveFileName');

    if (linkBtn) {
      linkBtn.addEventListener('click', async () => {
        if (this.folder.useFallback) {
          // In fallback mode, "Link Folder" becomes "Load File"
          const data = await this.folder.loadFileFallback();
          if (data) {
            this.loadProjectData(data);
          }
        } else {
          await this.folder.linkFolder();
        }
      });
    }

    if (unlinkBtn) {
      unlinkBtn.addEventListener('click', () => {
        this.folder.unlinkFolder();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.folder.refreshFiles();
      });
    }

    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', async () => {
        const data = await this.folder.loadFileFallback();
        if (data) {
          this.loadProjectData(data);
        }
      });
    }

    if (loadIntoFrameBtn) {
      loadIntoFrameBtn.addEventListener('click', async () => {
        const data = await this.folder.loadFileFallback();
        if (data) {
          this.loadShapesIntoCurrentFrame(data);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const fileName = fileNameInput?.value?.trim() || 'project';
        const data = this.folder.getProjectData();
        const success = await this.folder.saveFile(fileName, data);
        if (success) {
          this.showNotification('Project saved!');
        }
      });
    }

    // Initialize folder UI state
    this.folder.updateUI();
  }

  loadProjectData(data) {
    // Load project data from file
    try {
      if (data.canvasWidth) this.canvasWidth = data.canvasWidth;
      if (data.canvasHeight) this.canvasHeight = data.canvasHeight;
      if (data.fps) this.state.fps = data.fps;
      if (data.timelineDuration) this.state.timelineDuration = data.timelineDuration;
      if (data.loopMode) this.state.loopMode = data.loopMode;
      if (data.playbackSpeed) this.state.playbackSpeed = data.playbackSpeed;

      if (data.frames && Array.isArray(data.frames)) {
        // Load animation with multiple frames
        this.frames.frames = data.frames.map((frame, index) => ({
          id: frame.id || this.frames.generateId(),
          time: frame.time != null ? frame.time : index * 1.0,
          easing: frame.easing || 'easeInOutQuad',
          layers: frame.layers.map(layer => ({
            id: layer.id || 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: layer.name || 'Layer 1',
            visible: layer.visible !== false,
            locked: layer.locked || false,
            shapes: layer.shapes || []
          }))
        }));
        this.frames.currentFrameIndex = data.currentFrameIndex || 0;
      } else if (data.layers && Array.isArray(data.layers)) {
        // Load single frame with layers
        this.frames.frames = [{
          id: this.frames.generateId(),
          time: 0,
          easing: 'easeInOutQuad',
          layers: data.layers.map(layer => ({
            id: layer.id || 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: layer.name || 'Layer 1',
            visible: layer.visible !== false,
            locked: layer.locked || false,
            shapes: layer.shapes || []
          }))
        }];
        this.frames.currentFrameIndex = 0;
      } else if (data.shapes && Array.isArray(data.shapes)) {
        // Load just shapes into a single layer
        this.frames.frames = [{
          id: this.frames.generateId(),
          time: 0,
          easing: 'easeInOutQuad',
          layers: [{
            id: 'layer_' + Date.now(),
            name: 'Layer 1',
            visible: true,
            locked: false,
            shapes: data.shapes
          }]
        }];
        this.frames.currentFrameIndex = 0;
      }

      // Reset active layer to first layer of current frame
      const currentFrame = this.frames.getCurrentFrame();
      if (currentFrame && currentFrame.layers.length > 0) {
        this.layers.activeLayerId = currentFrame.layers[0].id;
      }

      // Update UI
      this.frames.updateTimelineDuration();
      this.frames.updateUI();
      this.layers.updateUI();
      if (this.timelineUI) this.timelineUI.render();
      this.saveHistory();
      this.render();

      this.showNotification('Project loaded!');
    } catch (err) {
      console.error('Error loading project data:', err);
      alert('Failed to load project: ' + err.message);
    }
  }

  loadShapesIntoCurrentFrame(data) {
    // Load shapes from a file into the current frame's active layer
    try {
      const currentFrame = this.frames.getCurrentFrame();
      if (!currentFrame) {
        alert('No frame available');
        return;
      }

      const activeLayer = this.layers.getActiveLayer();
      if (!activeLayer) {
        alert('No layer available');
        return;
      }

      let shapesToAdd = [];

      // Extract shapes from various data formats
      if (data.frames && Array.isArray(data.frames) && data.frames.length > 0) {
        // Animation file - get shapes from first frame's first layer
        const firstFrame = data.frames[0];
        if (firstFrame.layers && firstFrame.layers.length > 0) {
          for (const layer of firstFrame.layers) {
            if (layer.shapes && Array.isArray(layer.shapes)) {
              shapesToAdd.push(...layer.shapes);
            }
          }
        }
      } else if (data.layers && Array.isArray(data.layers)) {
        // Frame file with layers
        for (const layer of data.layers) {
          if (layer.shapes && Array.isArray(layer.shapes)) {
            shapesToAdd.push(...layer.shapes);
          }
        }
      } else if (data.shapes && Array.isArray(data.shapes)) {
        // Direct shapes array
        shapesToAdd = data.shapes;
      } else if (data.vertices || data.verts) {
        // Single shape with vertices
        shapesToAdd = [{
          id: 'shape_' + Date.now(),
          type: 'polygon',
          vertices: data.vertices || data.verts,
          closed: data.closed !== false,
          selected: false,
          fill: data.fill || 'rgba(74, 158, 255, 0.2)',
          stroke: data.stroke || '#4a9eff'
        }];
      }

      if (shapesToAdd.length === 0) {
        alert('No shapes found in file');
        return;
      }

      // Clone shapes with new IDs to avoid conflicts
      const clonedShapes = shapesToAdd.map(shape => ({
        ...JSON.parse(JSON.stringify(shape)),
        id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        selected: false
      }));

      // Add shapes to active layer
      activeLayer.shapes.push(...clonedShapes);

      this.saveHistory();
      this.layers.updateUI();
      this.render();

      this.showNotification(`Loaded ${clonedShapes.length} shape(s) into current frame`);
    } catch (err) {
      console.error('Error loading shapes into frame:', err);
      alert('Failed to load shapes: ' + err.message);
    }
  }

  showNotification(message) {
    // Simple notification - could be enhanced with a toast UI
    console.log(message);
    // For now, we'll just log it. Could add a toast notification later.
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
      selectedVertices: [...this.state.selectedVertices],
      timelineDuration: this.state.timelineDuration,
      playheadTime: this.state.playheadTime
    };
  }

  restoreState(state) {
    this.frames.frames = state.frames;
    this.frames.currentFrameIndex = state.currentFrameIndex;
    this.layers.activeLayerId = state.activeLayerId;
    this.state.selectedShapes = state.selectedShapes || [];
    this.state.selectedVertices = state.selectedVertices || [];
    if (state.timelineDuration) this.state.timelineDuration = state.timelineDuration;
    if (state.playheadTime != null) this.state.playheadTime = state.playheadTime;
    
    this.frames.updateUI();
    this.layers.updateUI();
    if (this.timelineUI) this.timelineUI.render();
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
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.frames.frames.length < 2) return;

    this.state.isPlaying = true;
    this._lastPlaybackTimestamp = null;
    this._playbackDirection = 1; // 1 = forward, -1 = reverse (for pingpong)
    this._fpsAccumulator = 0; // Accumulated time for FPS throttling

    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.classList.add('playing');

    const animate = (timestamp) => {
      if (!this.state.isPlaying) return;

      if (this._lastPlaybackTimestamp === null) {
        this._lastPlaybackTimestamp = timestamp;
      }

      const elapsed = (timestamp - this._lastPlaybackTimestamp) / 1000; // seconds
      this._lastPlaybackTimestamp = timestamp;

      // Advance playhead time continuously
      const speed = this.state.playbackSpeed * this._playbackDirection;
      let newTime = this.state.playheadTime + elapsed * speed;
      const { minTime, maxTime } = this.getPlayableRange();
      const duration = maxTime - minTime;

      if (duration < 0.001) {
        this.stopPlayback();
        return;
      }

      // Handle loop modes
      if (this.state.loopMode === 'loop') {
        if (newTime > maxTime) newTime = minTime + ((newTime - minTime) % duration);
        if (newTime < minTime) newTime = maxTime - ((minTime - newTime) % duration);
      } else if (this.state.loopMode === 'pingpong') {
        if (newTime > maxTime) {
          newTime = maxTime - (newTime - maxTime);
          this._playbackDirection = -1;
        } else if (newTime < minTime) {
          newTime = minTime + (minTime - newTime);
          this._playbackDirection = 1;
        }
      } else { // 'once'
        if (newTime > maxTime) {
          newTime = maxTime;
          this.stopPlayback();
        } else if (newTime < minTime) {
          newTime = minTime;
          this.stopPlayback();
        }
      }

      this.state.playheadTime = Math.max(minTime, Math.min(newTime, maxTime));

      // FPS throttling: only update visuals at the configured frame rate
      const fpsInterval = 1.0 / (this.state.fps || 12);
      this._fpsAccumulator += elapsed;
      if (this._fpsAccumulator >= fpsInterval) {
        this._fpsAccumulator -= fpsInterval;
        // Avoid accumulator drift
        if (this._fpsAccumulator > fpsInterval) this._fpsAccumulator = 0;

        this.updateInterpolatedFrame();
        this.render();

        // Update timeline UI
        if (this.timelineUI) this.timelineUI.render();

        // Update frame display
        this.updatePlaybackDisplay();
      }

      if (this.state.isPlaying) {
        this._animFrameId = requestAnimationFrame(animate);
      }
    };

    this._animFrameId = requestAnimationFrame(animate);
  }

  stopPlayback() {
    this.state.isPlaying = false;
    this.state.interpolatedFrame = null;

    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this._lastPlaybackTimestamp = null;

    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.classList.remove('playing');

    // Snap to nearest keyframe
    const nearest = this.findNearestKeyframeToTime(this.state.playheadTime);
    if (nearest >= 0) {
      this.frames.goToFrame(nearest);
    }
    this.frames.updateUI();
    this.render();
  }

  getPlayableRange() {
    const times = this.frames.frames.map(f => f.time || 0);
    if (times.length < 2) return { minTime: 0, maxTime: 1 };
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }

  findNearestKeyframeToTime(time) {
    let best = 0;
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

  updatePlaybackDisplay() {
    const frameDisplay = document.getElementById('frameDisplay');
    if (!frameDisplay) return;
    const time = this.state.playheadTime;
    const kfIndex = this.findNearestKeyframeToTime(time);
    frameDisplay.textContent = `KF: ${kfIndex + 1} / ${this.frames.frames.length}  ${time.toFixed(2)}s`;
  }

  updateInterpolatedFrame() {
    const time = this.state.playheadTime;
    const keyframes = this.frames.frames;
    if (keyframes.length === 0) return;

    // Find surrounding keyframes based on time
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
      // Exactly at or near a keyframe
      this.state.interpolatedFrame = null;
      this.frames.currentFrameIndex = prevIndex;
      return;
    }

    const prevKf = keyframes[prevIndex];
    const nextKf = keyframes[nextIndex];
    const prevTime = prevKf.time || 0;
    const nextTime = nextKf.time || 0;

    if (nextTime - prevTime < 0.001) {
      this.state.interpolatedFrame = null;
      this.frames.currentFrameIndex = prevIndex;
      return;
    }

    const t = (time - prevTime) / (nextTime - prevTime);

    // Use the per-keyframe easing from the prev keyframe
    const easingName = prevKf.easing || 'linear';
    const easingFn = this.frames.constructor.easing[easingName] ||
                     this.frames.constructor.easing.linear;
    const easedT = easingFn(t);
    this.state.interpolatedFrame = this.frames.createInterpolatedFrame(prevKf, nextKf, easedT);

    this.frames.currentFrameIndex = prevIndex;
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
