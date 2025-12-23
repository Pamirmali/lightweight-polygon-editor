// Canvas rendering system
export class CanvasRenderer {
  constructor(app) {
    this.app = app;
  }

  render(frame, prevFrame = null) {
    const ctx = this.app.ctx;
    const canvas = this.app.canvas;
    const state = this.app.state;
    
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Clear canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, width, height);

    // Render canvas bounds (the working area)
    this.renderCanvasBounds(ctx, width, height);

    // Render grid
    if (state.showGrid) {
      this.app.grid.render(ctx, width, height);
    }

    // Render mirror line
    if (state.mirrorEnabled) {
      this.renderMirrorLine(ctx, width, height);
    }

    // Render reference image (behind everything else)
    if (state.referenceImage && state.referenceImage.image && state.referenceImage.visible) {
      this.renderReferenceImage(ctx, state.referenceImage);
    }

    // Render onion skin (previous frame)
    if (prevFrame) {
      this.renderFrame(ctx, prevFrame, 0.3, '#ff6b6b');
    }

    // Render current frame
    if (frame) {
      this.renderFrame(ctx, frame, 1.0);
    }

    // Render preview path (for pen/brush tools)
    if (state.previewPath) {
      this.renderPreviewPath(ctx, state.previewPath, state.previewPoint);
    }

    // Render preview shape (for shape tools)
    if (state.previewShape) {
      this.renderPreviewShape(ctx, state.previewShape);
    }

    // Render selection box
    if (state.selectionBox) {
      this.renderSelectionBox(ctx, state.selectionBox);
    }

    // Render brush cursor for sculpt tools
    if (state.brushPosition && this.isSculptToolActive()) {
      this.renderBrushCursor(ctx, state.brushPosition, state.brushRadius);
    }
    ctx.restore();
  }

  renderCanvasBounds(ctx, viewWidth, viewHeight) {
    const state = this.app.state;
    const canvasW = this.app.canvasWidth;
    const canvasH = this.app.canvasHeight;
    
    // Canvas bounds in world coordinates are centered at 0,0
    const left = -canvasW / 2;
    const top = -canvasH / 2;
    
    // Convert to screen coordinates
    const screenLeft = left * state.zoom + state.panX;
    const screenTop = top * state.zoom + state.panY;
    const screenWidth = canvasW * state.zoom;
    const screenHeight = canvasH * state.zoom;
    
    // Draw canvas background (lighter than the area outside)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(screenLeft, screenTop, screenWidth, screenHeight);
    
    // Draw canvas border
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenLeft, screenTop, screenWidth, screenHeight);
  }

  renderMirrorLine(ctx, width, height) {
    const state = this.app.state;
    // Mirror line at x=0 in world coordinates
    const x = state.panX;  // x=0 transformed to screen space
    
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  renderFrame(ctx, frame, alpha = 1.0, tintColor = null) {
    ctx.globalAlpha = alpha;

    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      
      for (const shape of layer.shapes) {
        this.renderShape(ctx, shape, tintColor);
      }
    }

    ctx.globalAlpha = 1;
  }

  renderShape(ctx, shape, tintColor = null) {
    if (!shape.vertices || shape.vertices.length < 2) return;

    const state = this.app.state;
    const isSelected = state.selectedShapes.includes(shape.id);

    // Transform vertices to screen space
    const screenVerts = shape.vertices.map(v => this.worldToScreen(v));

    // Draw fill
    if (shape.vertices.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
      for (let i = 1; i < screenVerts.length; i++) {
        ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
      }
      ctx.closePath();
      
      if (tintColor) {
        ctx.fillStyle = tintColor.replace(')', ', 0.1)').replace('rgb', 'rgba');
      } else if (isSelected) {
        ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
      } else {
        ctx.fillStyle = 'rgba(74, 158, 255, 0.15)';
      }
      ctx.fill();
    }

    // Draw stroke
    ctx.beginPath();
    ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
    for (let i = 1; i < screenVerts.length; i++) {
      ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
    }
    if (shape.closed !== false) {
      ctx.closePath();
    }
    
    ctx.strokeStyle = tintColor || (isSelected ? '#ff6b6b' : '#4a9eff');
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw vertex handles (only for current frame, not onion skin)
    if (!tintColor) {
      for (let i = 0; i < screenVerts.length; i++) {
        const pt = screenVerts[i];
        const vertKey = `${shape.id}:${i}`;
        const isVertSelected = state.selectedVertices.includes(vertKey);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isVertSelected ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isVertSelected ? '#ff6b6b' : (isSelected ? '#ffffff' : '#4a9eff');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  renderPreviewPath(ctx, path, previewPoint) {
    if (path.length === 0) return;

    const state = this.app.state;
    const screenPath = path.map(p => this.worldToScreen(p));

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x, screenPath[0].y);
    for (let i = 1; i < screenPath.length; i++) {
      ctx.lineTo(screenPath[i].x, screenPath[i].y);
    }
    
    // Line to preview point
    if (previewPoint) {
      const pp = this.worldToScreen(previewPoint);
      ctx.lineTo(pp.x, pp.y);
    }

    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw points
    for (let i = 0; i < screenPath.length; i++) {
      const pt = screenPath[i];
      const isFirst = i === 0;
      const isSnapping = isFirst && state.snapIndicator;
      
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSnapping ? 10 : 5, 0, Math.PI * 2);
      
      if (isSnapping) {
        // Highlight the first point when snapping
        ctx.fillStyle = '#00ff88';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw a ring around it
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = isFirst ? '#00ff88' : '#4a9eff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  renderPreviewShape(ctx, previewShape) {
    if (!previewShape.vertices || previewShape.vertices.length < 2) return;

    const screenVerts = previewShape.vertices.map(v => this.worldToScreen(v));

    ctx.beginPath();
    ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
    for (let i = 1; i < screenVerts.length; i++) {
      ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  renderSelectionBox(ctx, box) {
    const start = this.worldToScreen(box.start);
    const end = this.worldToScreen(box.end);
    
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  worldToScreen(point) {
    const state = this.app.state;
    return {
      x: point.x * state.zoom + state.panX,
      y: point.y * state.zoom + state.panY
    };
  }

  isSculptToolActive() {
    const tool = this.app.state.currentTool;
    return tool === 'sculpt-grab' || tool === 'sculpt-push' || tool === 'sculpt-smooth';
  }

  renderBrushCursor(ctx, position, radius) {
    const screenPos = this.worldToScreen(position);
    const state = this.app.state;
    
    // Draw brush circle
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    
    // Outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner fill with falloff visualization
    const gradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, radius
    );
    
    const toolColor = this.getBrushColor();
    gradient.addColorStop(0, toolColor.replace(')', ', 0.3)').replace('rgb', 'rgba'));
    gradient.addColorStop(0.7, toolColor.replace(')', ', 0.1)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Center dot
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
  }

  getBrushColor() {
    const tool = this.app.state.currentTool;
    switch (tool) {
      case 'sculpt-grab':
        return 'rgb(74, 158, 255)';  // Blue
      case 'sculpt-push':
        return 'rgb(255, 107, 107)'; // Red
      case 'sculpt-smooth':
        return 'rgb(0, 255, 136)';   // Green
      default:
        return 'rgb(255, 255, 255)'; // White
    }
  }

  renderReferenceImage(ctx, refImage) {
    const state = this.app.state;
    
    // Convert world coordinates to screen coordinates
    const screenX = refImage.x * state.zoom + state.panX;
    const screenY = refImage.y * state.zoom + state.panY;
    const screenWidth = refImage.width * state.zoom;
    const screenHeight = refImage.height * state.zoom;
    
    // Save context and apply opacity
    ctx.save();
    ctx.globalAlpha = refImage.opacity;
    
    // Draw the image
    ctx.drawImage(refImage.image, screenX, screenY, screenWidth, screenHeight);
    
    // Draw a subtle border when not locked (indicating it can be moved)
    if (!refImage.locked) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(screenX, screenY, screenWidth, screenHeight);
      ctx.setLineDash([]);
    }
    
    ctx.restore();
  }
}
