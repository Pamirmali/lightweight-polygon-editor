// Frame management for animation
export class FrameManager {
  constructor(app) {
    this.app = app;
    this.frames = [];
    this.currentFrameIndex = 0;
  }

  createEmptyFrame() {
    return {
      id: this.generateId(),
      layers: [{
        id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: 'Layer 1',
        visible: true,
        locked: false,
        shapes: []
      }]
    };
  }

  generateId() {
    return 'frame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getCurrentFrame() {
    return this.frames[this.currentFrameIndex];
  }

  getPreviousFrame() {
    if (this.currentFrameIndex > 0) {
      return this.frames[this.currentFrameIndex - 1];
    }
    return null;
  }

  addFrame() {
    const frame = this.createEmptyFrame();
    this.frames.push(frame);
    this.currentFrameIndex = this.frames.length - 1;
    
    if (this.app.layers) {
      this.app.layers.activeLayerId = frame.layers[0].id;
    }
    
    this.updateUI();
    this.app.render();
    return frame;
  }

  duplicateFrame() {
    if (this.frames.length === 0) return this.addFrame();

    const currentFrame = this.getCurrentFrame();
    const newFrame = {
      id: this.generateId(),
      layers: currentFrame.layers.map(layer => ({
        id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        shapes: JSON.parse(JSON.stringify(layer.shapes))
      }))
    };

    this.frames.splice(this.currentFrameIndex + 1, 0, newFrame);
    this.currentFrameIndex++;
    this.app.layers.activeLayerId = newFrame.layers[0].id;
    
    this.updateUI();
    this.app.render();
    return newFrame;
  }

  deleteFrame() {
    if (this.frames.length <= 1) return;

    this.frames.splice(this.currentFrameIndex, 1);
    if (this.currentFrameIndex >= this.frames.length) {
      this.currentFrameIndex = this.frames.length - 1;
    }
    
    const frame = this.getCurrentFrame();
    if (this.app.layers) {
      this.app.layers.activeLayerId = frame.layers[0]?.id;
    }
    
    this.updateUI();
    this.app.render();
  }

  goToFrame(index) {
    if (index < 0 || index >= this.frames.length) return;
    
    this.currentFrameIndex = index;
    const frame = this.getCurrentFrame();
    
    // Keep active layer if it exists in new frame, otherwise use first
    if (this.app.layers) {
      const currentActiveId = this.app.layers.activeLayerId;
      const layerExists = frame.layers.some(l => l.id === currentActiveId);
      if (!layerExists) {
        this.app.layers.activeLayerId = frame.layers[0]?.id;
      }
    }
    
    this.updateUI();
    this.app.render();
  }

  nextFrame(loop = true) {
    if (this.currentFrameIndex < this.frames.length - 1) {
      this.goToFrame(this.currentFrameIndex + 1);
    } else if (loop) {
      this.goToFrame(0);
    }
  }

  previousFrame() {
    if (this.currentFrameIndex > 0) {
      this.goToFrame(this.currentFrameIndex - 1);
    }
  }

  updateUI() {
    // Update frame display
    const frameDisplay = document.getElementById('frameDisplay');
    if (frameDisplay) {
      frameDisplay.textContent = `Frame: ${this.currentFrameIndex + 1} / ${this.frames.length}`;
    }

    // Update timeline thumbnails
    const container = document.getElementById('timelineFrames');
    if (!container) return;
    
    container.innerHTML = '';

    this.frames.forEach((frame, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'frame-thumb' + (index === this.currentFrameIndex ? ' active' : '');
      thumb.textContent = index + 1;
      thumb.addEventListener('click', () => this.goToFrame(index));
      container.appendChild(thumb);
    });
    
    // Update layers UI
    if (this.app.layers) {
      this.app.layers.updateUI();
    }
  }
}
