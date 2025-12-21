// Tool manager for handling different editing tools
export class ToolManager {
  constructor(app) {
    this.app = app;
    this.currentTool = 'select';
    this.tools = {};
    this.toolState = {};
    
    this.initTools();
    this.setupEventListeners();
  }

  initTools() {
    // Select tool
    this.tools.select = {
      name: 'Select',
      cursor: 'default',
      onMouseDown: (data) => this.selectMouseDown(data),
      onMouseDrag: (data) => this.selectMouseDrag(data),
      onMouseUp: (data) => this.selectMouseUp(data),
      onMouseMove: (data) => this.selectMouseMove(data)
    };

    // Pen tool (draw polygons)
    this.tools.pen = {
      name: 'Pen',
      cursor: 'crosshair',
      onMouseDown: (data) => this.penMouseDown(data),
      onMouseMove: (data) => this.penMouseMove(data),
      onDoubleClick: (data) => this.penDoubleClick(data)
    };

    // Brush tool (freehand drawing)
    this.tools.brush = {
      name: 'Brush',
      cursor: 'crosshair',
      onMouseDown: (data) => this.brushMouseDown(data),
      onMouseDrag: (data) => this.brushMouseDrag(data),
      onMouseUp: (data) => this.brushMouseUp(data)
    };

    // Move tool
    this.tools.move = {
      name: 'Move',
      cursor: 'move',
      onMouseDown: (data) => this.moveMouseDown(data),
      onMouseDrag: (data) => this.moveMouseDrag(data),
      onMouseUp: (data) => this.moveMouseUp(data)
    };

    // Rotate tool
    this.tools.rotate = {
      name: 'Rotate',
      cursor: 'crosshair',
      onMouseDown: (data) => this.rotateMouseDown(data),
      onMouseDrag: (data) => this.rotateMouseDrag(data),
      onMouseUp: (data) => this.rotateMouseUp(data)
    };

    // Scale tool
    this.tools.scale = {
      name: 'Scale',
      cursor: 'nwse-resize',
      onMouseDown: (data) => this.scaleMouseDown(data),
      onMouseDrag: (data) => this.scaleMouseDrag(data),
      onMouseUp: (data) => this.scaleMouseUp(data)
    };

    // Shape tools
    this.tools.rectangle = {
      name: 'Rectangle',
      cursor: 'crosshair',
      onMouseDown: (data) => this.shapeMouseDown(data, 'rectangle'),
      onMouseDrag: (data) => this.shapeMouseDrag(data, 'rectangle'),
      onMouseUp: (data) => this.shapeMouseUp(data, 'rectangle')
    };

    this.tools.circle = {
      name: 'Circle',
      cursor: 'crosshair',
      onMouseDown: (data) => this.shapeMouseDown(data, 'circle'),
      onMouseDrag: (data) => this.shapeMouseDrag(data, 'circle'),
      onMouseUp: (data) => this.shapeMouseUp(data, 'circle')
    };

    this.tools.polygon = {
      name: 'Polygon',
      cursor: 'crosshair',
      onMouseDown: (data) => this.shapeMouseDown(data, 'polygon'),
      onMouseDrag: (data) => this.shapeMouseDrag(data, 'polygon'),
      onMouseUp: (data) => this.shapeMouseUp(data, 'polygon')
    };
  }

  setupEventListeners() {
    this.app.events.on('input:mousedown', (data) => this.handleMouseDown(data));
    this.app.events.on('input:mousemove', (data) => this.handleMouseMove(data));
    this.app.events.on('input:mousedrag', (data) => this.handleMouseDrag(data));
    this.app.events.on('input:mouseup', (data) => this.handleMouseUp(data));
    this.app.events.on('input:dblclick', (data) => this.handleDoubleClick(data));
  }

  setTool(toolName) {
    if (!this.tools[toolName]) return;
    
    // Clean up current tool
    this.finishCurrentAction();
    
    this.currentTool = toolName;
    this.toolState = {};
    
    // Update cursor
    const canvas = this.app.canvas;
    if (canvas) {
      canvas.style.cursor = this.tools[toolName].cursor || 'default';
    }

    // Update UI
    this.app.events.emit('tool:changed', { tool: toolName });
    this.updateToolUI();
  }

  updateToolUI() {
    // Update tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tool === this.currentTool) {
        btn.classList.add('active');
      }
    });
  }

  finishCurrentAction() {
    // Cancel any in-progress actions
    if (this.toolState.pendingShape) {
      this.toolState.pendingShape = null;
    }
    if (this.toolState.currentPath) {
      // Finish pen path if it has enough points
      if (this.toolState.currentPath.length >= 3) {
        this.app.shapes.createFromPath(this.toolState.currentPath);
        this.app.saveHistory();
      }
      this.toolState.currentPath = null;
    }
    this.app.render();
  }

  handleMouseDown(data) {
    const tool = this.tools[this.currentTool];
    if (tool && tool.onMouseDown) {
      tool.onMouseDown(data);
    }
  }

  handleMouseMove(data) {
    const tool = this.tools[this.currentTool];
    if (tool && tool.onMouseMove) {
      tool.onMouseMove(data);
    }
  }

  handleMouseDrag(data) {
    const tool = this.tools[this.currentTool];
    if (tool && tool.onMouseDrag) {
      tool.onMouseDrag(data);
    }
  }

  handleMouseUp(data) {
    const tool = this.tools[this.currentTool];
    if (tool && tool.onMouseUp) {
      tool.onMouseUp(data);
    }
  }

  handleDoubleClick(data) {
    const tool = this.tools[this.currentTool];
    if (tool && tool.onDoubleClick) {
      tool.onDoubleClick(data);
    }
  }

  // Select tool handlers
  selectMouseDown(data) {
    const hit = this.app.shapes.hitTest(data.pos);

    if (hit) {
      if (hit.type === 'vertex') {
        // Start vertex drag
        this.toolState.draggingVertex = {
          shapeId: hit.shapeId,
          vertexIndex: hit.vertexIndex,
          startPos: { ...data.pos }
        };
        this.app.shapes.selectVertex(hit.shapeId, hit.vertexIndex, data.shiftKey);
      } else if (hit.type === 'shape') {
        // Select shape
        if (!data.shiftKey && !this.app.state.selectedShapes.includes(hit.shapeId)) {
          this.app.shapes.clearSelection();
        }
        this.app.shapes.selectShape(hit.shapeId, true);
        this.toolState.draggingShape = {
          startPos: { ...data.pos },
          shapes: [...this.app.state.selectedShapes]
        };
      }
    } else {
      // Start selection box
      if (!data.shiftKey) {
        this.app.shapes.clearSelection();
      }
      this.toolState.selectionBox = {
        start: { ...data.pos },
        end: { ...data.pos }
      };
    }
    this.app.render();
  }

  selectMouseDrag(data) {
    if (this.toolState.draggingVertex) {
      const { shapeId, vertexIndex, startPos } = this.toolState.draggingVertex;
      const dx = data.pos.x - startPos.x;
      const dy = data.pos.y - startPos.y;
      this.app.shapes.moveVertex(shapeId, vertexIndex, data.pos);
      this.app.render();
    } else if (this.toolState.draggingShape) {
      const { startPos, shapes } = this.toolState.draggingShape;
      const dx = data.pos.x - startPos.x;
      const dy = data.pos.y - startPos.y;
      // Use offset from drag start
      this.app.shapes.moveSelectedBy(dx, dy);
      this.toolState.draggingShape.startPos = { ...data.pos };
      this.app.render();
    } else if (this.toolState.selectionBox) {
      this.toolState.selectionBox.end = { ...data.pos };
      this.app.state.selectionBox = this.toolState.selectionBox;
      this.app.render();
    }
  }

  selectMouseUp(data) {
    if (this.toolState.draggingVertex || this.toolState.draggingShape) {
      this.app.saveHistory();
    }
    
    if (this.toolState.selectionBox) {
      const box = this.toolState.selectionBox;
      const minX = Math.min(box.start.x, box.end.x);
      const maxX = Math.max(box.start.x, box.end.x);
      const minY = Math.min(box.start.y, box.end.y);
      const maxY = Math.max(box.start.y, box.end.y);
      
      // Select shapes in box
      this.app.shapes.selectInBox(minX, minY, maxX, maxY);
      this.app.state.selectionBox = null;
    }
    
    this.toolState = {};
    this.app.render();
  }

  selectMouseMove(data) {
    // Update cursor based on what's under it
    const hit = this.app.shapes.hitTest(data.pos);
    const canvas = this.app.canvas;
    
    if (hit) {
      if (hit.type === 'vertex') {
        canvas.style.cursor = 'pointer';
      } else if (hit.type === 'edge') {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'move';
      }
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // Pen tool handlers
  penMouseDown(data) {
    if (!this.toolState.currentPath) {
      this.toolState.currentPath = [];
    }
    
    const path = this.toolState.currentPath;
    
    // Check if clicking near the first vertex to close the shape
    if (path.length >= 3) {
      const firstPoint = path[0];
      const threshold = 15 / this.app.state.zoom;
      const dist = Math.hypot(data.pos.x - firstPoint.x, data.pos.y - firstPoint.y);
      
      if (dist < threshold) {
        // Close the shape - don't add the point, just create the shape
        this.app.shapes.createFromPath(path);
        this.app.saveHistory();
        this.toolState.currentPath = null;
        this.app.state.previewPath = null;
        this.app.state.previewPoint = null;
        this.app.state.snapIndicator = null;
        this.app.render();
        return;
      }
    }
    
    // Add the new point
    path.push({ ...data.pos });
    this.app.state.previewPath = path;
    this.app.render();
  }

  penMouseMove(data) {
    if (this.toolState.currentPath && this.toolState.currentPath.length > 0) {
      const path = this.toolState.currentPath;
      const firstPoint = path[0];
      const threshold = 15 / this.app.state.zoom;
      const dist = Math.hypot(data.pos.x - firstPoint.x, data.pos.y - firstPoint.y);
      
      // Show snap indicator when near first point
      if (path.length >= 3 && dist < threshold) {
        this.app.state.previewPoint = { ...firstPoint };
        this.app.state.snapIndicator = { ...firstPoint };
        this.app.canvas.style.cursor = 'pointer';
      } else {
        this.app.state.previewPoint = { ...data.pos };
        this.app.state.snapIndicator = null;
        this.app.canvas.style.cursor = 'crosshair';
      }
      this.app.render();
    }
  }

  penDoubleClick(data) {
    if (this.toolState.currentPath && this.toolState.currentPath.length >= 3) {
      this.app.shapes.createFromPath(this.toolState.currentPath);
      this.app.saveHistory();
    }
    this.toolState.currentPath = null;
    this.app.state.previewPath = null;
    this.app.state.previewPoint = null;
    this.app.render();
  }

  // Brush tool handlers (freehand)
  brushMouseDown(data) {
    this.toolState.brushPath = [{ ...data.pos }];
    this.app.state.previewPath = this.toolState.brushPath;
    this.app.render();
  }

  brushMouseDrag(data) {
    if (this.toolState.brushPath) {
      const lastPoint = this.toolState.brushPath[this.toolState.brushPath.length - 1];
      const dist = Math.hypot(data.pos.x - lastPoint.x, data.pos.y - lastPoint.y);
      
      // Only add point if it's far enough from last point
      if (dist > 3) {
        this.toolState.brushPath.push({ ...data.pos });
        this.app.state.previewPath = this.toolState.brushPath;
        this.app.render();
      }
    }
  }

  brushMouseUp(data) {
    if (this.toolState.brushPath && this.toolState.brushPath.length >= 3) {
      // Simplify path
      const simplified = this.simplifyPath(this.toolState.brushPath, 2);
      this.app.shapes.createFreehand(simplified);
      this.app.saveHistory();
    }
    this.toolState.brushPath = null;
    this.app.state.previewPath = null;
    this.app.render();
  }

  simplifyPath(points, tolerance) {
    if (points.length < 3) return points;
    
    // Douglas-Peucker simplification
    const sqTolerance = tolerance * tolerance;
    
    function getSqDist(p1, p2) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return dx * dx + dy * dy;
    }
    
    function getSqDistToSegment(p, p1, p2) {
      let x = p1.x, y = p1.y;
      let dx = p2.x - x, dy = p2.y - y;
      
      if (dx !== 0 || dy !== 0) {
        const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = p2.x;
          y = p2.y;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }
      
      dx = p.x - x;
      dy = p.y - y;
      return dx * dx + dy * dy;
    }
    
    function simplifyDPStep(points, first, last, sqTolerance, simplified) {
      let maxSqDist = sqTolerance;
      let index;
      
      for (let i = first + 1; i < last; i++) {
        const sqDist = getSqDistToSegment(points[i], points[first], points[last]);
        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }
      
      if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
      }
    }
    
    const last = points.length - 1;
    const simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);
    
    return simplified;
  }

  // Move tool handlers
  moveMouseDown(data) {
    const hit = this.app.shapes.hitTest(data.pos);
    
    if (hit && hit.type === 'shape') {
      if (!this.app.state.selectedShapes.includes(hit.shapeId)) {
        this.app.shapes.clearSelection();
        this.app.shapes.selectShape(hit.shapeId, true);
      }
    }
    
    if (this.app.state.selectedShapes.length > 0) {
      this.toolState.moveStart = { ...data.pos };
      this.toolState.originalPositions = this.app.shapes.getSelectedPositions();
    }
    this.app.render();
  }

  moveMouseDrag(data) {
    if (this.toolState.moveStart && this.app.state.selectedShapes.length > 0) {
      const dx = data.pos.x - this.toolState.moveStart.x;
      const dy = data.pos.y - this.toolState.moveStart.y;
      this.app.shapes.moveSelectedBy(dx, dy);
      this.toolState.moveStart = { ...data.pos };
      this.app.render();
    }
  }

  moveMouseUp(data) {
    if (this.toolState.moveStart) {
      this.app.saveHistory();
    }
    this.toolState = {};
  }

  // Rotate tool handlers
  rotateMouseDown(data) {
    if (this.app.state.selectedShapes.length > 0) {
      this.toolState.rotateCenter = this.app.shapes.getSelectionCenter();
      this.toolState.rotateStartAngle = Math.atan2(
        data.pos.y - this.toolState.rotateCenter.y,
        data.pos.x - this.toolState.rotateCenter.x
      );
      this.toolState.originalRotations = this.app.shapes.getSelectedRotations();
    }
  }

  rotateMouseDrag(data) {
    if (this.toolState.rotateCenter) {
      const currentAngle = Math.atan2(
        data.pos.y - this.toolState.rotateCenter.y,
        data.pos.x - this.toolState.rotateCenter.x
      );
      let deltaAngle = currentAngle - this.toolState.rotateStartAngle;
      
      // Snap to 15-degree increments when shift is held
      if (data.shiftKey) {
        deltaAngle = Math.round(deltaAngle / (Math.PI / 12)) * (Math.PI / 12);
      }
      
      this.app.shapes.rotateSelectedBy(deltaAngle, this.toolState.rotateCenter);
      this.toolState.rotateStartAngle = currentAngle;
      this.app.render();
    }
  }

  rotateMouseUp(data) {
    if (this.toolState.rotateCenter) {
      this.app.saveHistory();
    }
    this.toolState = {};
  }

  // Scale tool handlers
  scaleMouseDown(data) {
    if (this.app.state.selectedShapes.length > 0) {
      this.toolState.scaleCenter = this.app.shapes.getSelectionCenter();
      this.toolState.scaleStartDist = Math.hypot(
        data.pos.x - this.toolState.scaleCenter.x,
        data.pos.y - this.toolState.scaleCenter.y
      );
      this.toolState.originalScales = this.app.shapes.getSelectedScales();
    }
  }

  scaleMouseDrag(data) {
    if (this.toolState.scaleCenter && this.toolState.scaleStartDist > 0) {
      const currentDist = Math.hypot(
        data.pos.x - this.toolState.scaleCenter.x,
        data.pos.y - this.toolState.scaleCenter.y
      );
      let scaleFactor = currentDist / this.toolState.scaleStartDist;
      
      // Clamp scale factor
      scaleFactor = Math.max(0.1, Math.min(10, scaleFactor));
      
      this.app.shapes.scaleSelectedBy(scaleFactor, this.toolState.scaleCenter);
      this.toolState.scaleStartDist = currentDist;
      this.app.render();
    }
  }

  scaleMouseUp(data) {
    if (this.toolState.scaleCenter) {
      this.app.saveHistory();
    }
    this.toolState = {};
  }

  // Shape creation handlers
  shapeMouseDown(data, shapeType) {
    this.toolState.shapeStart = { ...data.pos };
    this.toolState.shapeType = shapeType;
  }

  shapeMouseDrag(data, shapeType) {
    if (this.toolState.shapeStart) {
      const start = this.toolState.shapeStart;
      const end = data.pos;
      
      // Create preview shape
      let previewVertices;
      const width = end.x - start.x;
      const height = end.y - start.y;
      
      if (shapeType === 'rectangle') {
        previewVertices = [
          { x: start.x, y: start.y },
          { x: end.x, y: start.y },
          { x: end.x, y: end.y },
          { x: start.x, y: end.y }
        ];
      } else if (shapeType === 'circle') {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rx = Math.abs(width) / 2;
        const ry = Math.abs(height) / 2;
        const segments = this.app.state.polygonSides || 32;
        previewVertices = [];
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          previewVertices.push({
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle)
          });
        }
      } else if (shapeType === 'polygon') {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const radius = Math.hypot(width, height) / 2;
        const sides = this.app.state.polygonSides || 6;
        previewVertices = [];
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
          previewVertices.push({
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
          });
        }
      }
      
      this.app.state.previewShape = { vertices: previewVertices };
      this.app.render();
    }
  }

  shapeMouseUp(data, shapeType) {
    if (this.toolState.shapeStart) {
      const start = this.toolState.shapeStart;
      const end = data.pos;
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      
      // Only create if dragged enough
      if (width > 5 || height > 5) {
        if (shapeType === 'rectangle') {
          this.app.shapes.createRectangle(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (shapeType === 'circle') {
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          this.app.shapes.createCircle(cx, cy, width / 2, height / 2);
        } else if (shapeType === 'polygon') {
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
          this.app.shapes.createPolygon(cx, cy, radius, this.app.state.polygonSides || 6);
        }
        this.app.saveHistory();
      }
    }
    
    this.toolState = {};
    this.app.state.previewShape = null;
    this.app.render();
  }
}
