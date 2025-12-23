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

  // ============= EASING FUNCTIONS =============
  // t is the progress from 0 to 1
  
  static easing = {
    linear: (t) => t,
    
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    
    easeInQuart: (t) => t * t * t * t,
    easeOutQuart: (t) => 1 - (--t) * t * t * t,
    easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
    
    easeInElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    },
    
    easeOutElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    },
    
    easeOutBounce: (t) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    }
  };

  // ============= INTERPOLATION METHODS =============
  
  /**
   * Interpolate between the current frame and the next frame
   * @param {number} numFrames - Number of in-between frames to create
   * @param {string} easingType - The easing function to use
   * @returns {boolean} - Whether interpolation was successful
   */
  interpolateToNextFrame(numFrames, easingType = 'linear') {
    const currentIndex = this.currentFrameIndex;
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= this.frames.length) {
      console.warn('No next frame to interpolate to');
      return false;
    }
    
    const startFrame = this.frames[currentIndex];
    const endFrame = this.frames[nextIndex];
    
    return this.interpolateBetweenFrames(startFrame, endFrame, numFrames, easingType, currentIndex + 1);
  }

  /**
   * Interpolate between two specific frames
   * @param {Object} startFrame - The starting frame
   * @param {Object} endFrame - The ending frame
   * @param {number} numFrames - Number of in-between frames to create
   * @param {string} easingType - The easing function to use
   * @param {number} insertIndex - Where to insert the new frames
   * @returns {boolean} - Whether interpolation was successful
   */
  interpolateBetweenFrames(startFrame, endFrame, numFrames, easingType, insertIndex) {
    const easingFn = FrameManager.easing[easingType] || FrameManager.easing.linear;
    
    // Validate that frames have matching structure
    if (startFrame.layers.length !== endFrame.layers.length) {
      console.warn('Frames have different number of layers');
      return false;
    }
    
    const newFrames = [];
    
    for (let i = 1; i <= numFrames; i++) {
      // Calculate progress (0 to 1) for this in-between frame
      const t = i / (numFrames + 1);
      const easedT = easingFn(t);
      
      const interpolatedFrame = this.createInterpolatedFrame(startFrame, endFrame, easedT);
      newFrames.push(interpolatedFrame);
    }
    
    // Insert all new frames at the specified position
    this.frames.splice(insertIndex, 0, ...newFrames);
    
    this.updateUI();
    return true;
  }

  /**
   * Create a single interpolated frame between two frames
   * @param {Object} startFrame - The starting frame
   * @param {Object} endFrame - The ending frame
   * @param {number} t - Interpolation factor (0 = start, 1 = end)
   * @returns {Object} - The interpolated frame
   */
  createInterpolatedFrame(startFrame, endFrame, t) {
    const interpolatedFrame = {
      id: this.generateId(),
      layers: []
    };
    
    for (let layerIndex = 0; layerIndex < startFrame.layers.length; layerIndex++) {
      const startLayer = startFrame.layers[layerIndex];
      const endLayer = endFrame.layers[layerIndex];
      
      const interpolatedLayer = {
        id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: startLayer.name,
        visible: startLayer.visible,
        locked: startLayer.locked,
        shapes: []
      };
      
      // Interpolate shapes
      const maxShapes = Math.max(startLayer.shapes.length, endLayer.shapes.length);
      
      for (let shapeIndex = 0; shapeIndex < maxShapes; shapeIndex++) {
        const startShape = startLayer.shapes[shapeIndex];
        const endShape = endLayer.shapes[shapeIndex];
        
        if (startShape && endShape) {
          // Both shapes exist - interpolate between them
          const interpolatedShape = this.interpolateShape(startShape, endShape, t);
          interpolatedLayer.shapes.push(interpolatedShape);
        } else if (startShape && !endShape) {
          // Shape only exists in start frame - fade out (scale down)
          const interpolatedShape = this.interpolateShapeToNothing(startShape, 1 - t);
          interpolatedLayer.shapes.push(interpolatedShape);
        } else if (!startShape && endShape) {
          // Shape only exists in end frame - fade in (scale up)
          const interpolatedShape = this.interpolateShapeToNothing(endShape, t);
          interpolatedLayer.shapes.push(interpolatedShape);
        }
      }
      
      interpolatedFrame.layers.push(interpolatedLayer);
    }
    
    return interpolatedFrame;
  }

  /**
   * Interpolate a single shape between two states
   * @param {Object} startShape - Starting shape state
   * @param {Object} endShape - Ending shape state
   * @param {number} t - Interpolation factor (0 = start, 1 = end)
   * @returns {Object} - Interpolated shape
   */
  interpolateShape(startShape, endShape, t) {
    const interpolatedVertices = [];
    
    // Handle different vertex counts by resampling
    const startVerts = startShape.vertices;
    const endVerts = endShape.vertices;
    
    if (startVerts.length === endVerts.length) {
      // Same vertex count - simple interpolation
      for (let i = 0; i < startVerts.length; i++) {
        interpolatedVertices.push({
          x: startVerts[i].x + (endVerts[i].x - startVerts[i].x) * t,
          y: startVerts[i].y + (endVerts[i].y - startVerts[i].y) * t
        });
      }
    } else {
      // Different vertex counts - resample to match
      const targetCount = Math.max(startVerts.length, endVerts.length);
      const resampledStart = this.resampleVertices(startVerts, targetCount);
      const resampledEnd = this.resampleVertices(endVerts, targetCount);
      
      for (let i = 0; i < targetCount; i++) {
        interpolatedVertices.push({
          x: resampledStart[i].x + (resampledEnd[i].x - resampledStart[i].x) * t,
          y: resampledStart[i].y + (resampledEnd[i].y - resampledStart[i].y) * t
        });
      }
    }
    
    return {
      id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: startShape.type,
      vertices: interpolatedVertices,
      closed: startShape.closed
    };
  }

  /**
   * Interpolate a shape to/from nothing (scale toward center)
   * @param {Object} shape - The shape to interpolate
   * @param {number} scale - Scale factor (0 = nothing, 1 = full shape)
   * @returns {Object} - Scaled shape
   */
  interpolateShapeToNothing(shape, scale) {
    // Find center of shape
    let cx = 0, cy = 0;
    for (const v of shape.vertices) {
      cx += v.x;
      cy += v.y;
    }
    cx /= shape.vertices.length;
    cy /= shape.vertices.length;
    
    // Scale vertices toward/from center
    const scaledVertices = shape.vertices.map(v => ({
      x: cx + (v.x - cx) * scale,
      y: cy + (v.y - cy) * scale
    }));
    
    return {
      id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: shape.type,
      vertices: scaledVertices,
      closed: shape.closed
    };
  }

  /**
   * Resample vertices to a target count
   * @param {Array} vertices - Original vertices
   * @param {number} targetCount - Desired number of vertices
   * @returns {Array} - Resampled vertices
   */
  resampleVertices(vertices, targetCount) {
    if (vertices.length === targetCount) return vertices;
    
    const result = [];
    
    for (let i = 0; i < targetCount; i++) {
      const t = i / targetCount;
      const index = t * vertices.length;
      const lowerIndex = Math.floor(index) % vertices.length;
      const upperIndex = (lowerIndex + 1) % vertices.length;
      const fraction = index - Math.floor(index);
      
      result.push({
        x: vertices[lowerIndex].x + (vertices[upperIndex].x - vertices[lowerIndex].x) * fraction,
        y: vertices[lowerIndex].y + (vertices[upperIndex].y - vertices[lowerIndex].y) * fraction
      });
    }
    
    return result;
  }
}
