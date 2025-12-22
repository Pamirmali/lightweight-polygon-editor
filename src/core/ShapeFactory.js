// Shape creation and manipulation
export class ShapeFactory {
  constructor(app) {
    this.app = app;
    this.idCounter = 1;
  }

  generateId() {
    return 'shape_' + Date.now() + '_' + (this.idCounter++);
  }

  // Get current layer's shapes
  getShapes() {
    const layer = this.app.getCurrentLayer();
    return layer ? layer.shapes : [];
  }

  // Create a regular polygon at position
  createPolygon(cx, cy, radius, sides = 6) {
    const vertices = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      vertices.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      });
    }

    const shape = {
      id: this.generateId(),
      type: 'polygon',
      vertices,
      closed: true
    };

    this.addShape(shape);
    return shape;
  }

  // Create a rectangle
  createRectangle(x, y, width, height) {
    const vertices = [
      { x: x, y: y },
      { x: x + width, y: y },
      { x: x + width, y: y + height },
      { x: x, y: y + height }
    ];

    const shape = {
      id: this.generateId(),
      type: 'rectangle',
      vertices,
      closed: true
    };

    this.addShape(shape);
    return shape;
  }

  // Create a circle/ellipse
  createCircle(cx, cy, rx, ry, segments = 32) {
    const vertices = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      vertices.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * (ry || rx)
      });
    }

    const shape = {
      id: this.generateId(),
      type: 'circle',
      vertices,
      closed: true
    };

    this.addShape(shape);
    return shape;
  }

  // Create a rounded square/rectangle with specified number of vertices
  createRoundedSquare(cx, cy, size, cornerRadius, totalVertices = 100) {
    const vertices = [];
    const halfSize = size / 2;
    
    // Clamp corner radius to max possible (half of size)
    const r = Math.min(cornerRadius, halfSize);
    
    // We have 4 corners, each needs vertices for the arc
    // and 4 straight edges
    // Distribute vertices: corners get more due to curvature
    const verticesPerCorner = Math.floor(totalVertices / 4);
    const verticesPerStraightEdge = Math.floor((totalVertices - verticesPerCorner * 4) / 4);
    
    // Actually, let's distribute evenly along the perimeter for smoothness
    // Total perimeter = 4 * (size - 2*r) + 2 * PI * r (4 quarter circles = 1 full circle)
    const straightLength = (halfSize - r) * 2;
    const cornerLength = (Math.PI * r) / 2; // quarter circle arc length
    const totalLength = 4 * straightLength + 4 * cornerLength;
    
    // Define the 4 corners (center points of corner arcs)
    const corners = [
      { x: cx + halfSize - r, y: cy - halfSize + r, startAngle: -Math.PI / 2, endAngle: 0 },        // top-right
      { x: cx + halfSize - r, y: cy + halfSize - r, startAngle: 0, endAngle: Math.PI / 2 },          // bottom-right
      { x: cx - halfSize + r, y: cy + halfSize - r, startAngle: Math.PI / 2, endAngle: Math.PI },    // bottom-left
      { x: cx - halfSize + r, y: cy - halfSize + r, startAngle: Math.PI, endAngle: 3 * Math.PI / 2 } // top-left
    ];
    
    // Generate vertices by walking along the perimeter
    for (let i = 0; i < totalVertices; i++) {
      const t = i / totalVertices; // 0 to 1 around the shape
      const perimeterPos = t * totalLength;
      
      let accumulated = 0;
      let point = null;
      
      for (let side = 0; side < 4 && !point; side++) {
        // Straight edge before corner
        const edgeStart = accumulated;
        const edgeEnd = accumulated + straightLength;
        
        if (perimeterPos >= edgeStart && perimeterPos < edgeEnd) {
          const edgeT = (perimeterPos - edgeStart) / straightLength;
          
          if (side === 0) { // top edge (left to right)
            point = { 
              x: cx - halfSize + r + edgeT * straightLength, 
              y: cy - halfSize 
            };
          } else if (side === 1) { // right edge (top to bottom)
            point = { 
              x: cx + halfSize, 
              y: cy - halfSize + r + edgeT * straightLength 
            };
          } else if (side === 2) { // bottom edge (right to left)
            point = { 
              x: cx + halfSize - r - edgeT * straightLength, 
              y: cy + halfSize 
            };
          } else { // left edge (bottom to top)
            point = { 
              x: cx - halfSize, 
              y: cy + halfSize - r - edgeT * straightLength 
            };
          }
        }
        accumulated = edgeEnd;
        
        // Corner arc
        const cornerStart = accumulated;
        const cornerEnd = accumulated + cornerLength;
        
        if (perimeterPos >= cornerStart && perimeterPos < cornerEnd && !point) {
          const cornerT = (perimeterPos - cornerStart) / cornerLength;
          const corner = corners[side];
          const angle = corner.startAngle + cornerT * (corner.endAngle - corner.startAngle);
          point = {
            x: corner.x + Math.cos(angle) * r,
            y: corner.y + Math.sin(angle) * r
          };
        }
        accumulated = cornerEnd;
      }
      
      if (point) {
        vertices.push(point);
      }
    }

    const shape = {
      id: this.generateId(),
      type: 'roundedSquare',
      vertices,
      closed: true
    };

    this.addShape(shape);
    return shape;
  }

  // Create from freehand path
  createFreehand(points) {
    if (points.length < 3) return null;

    const vertices = points.map(p => ({ x: p.x, y: p.y }));

    const shape = {
      id: this.generateId(),
      type: 'freehand',
      vertices,
      closed: true
    };

    this.addShape(shape);
    return shape;
  }

  // Create from pen path
  createFromPath(points) {
    if (points.length < 3) return null;

    const vertices = points.map(p => ({ x: p.x, y: p.y }));

    const shape = {
      id: this.generateId(),
      type: 'path',
      vertices,
      closed: true
    };

    this.addShape(shape);
    return shape;
  }

  // Add shape to current layer
  addShape(shape) {
    const layer = this.app.getCurrentLayer();
    if (layer) {
      layer.shapes.push(shape);
      this.app.state.selectedShapes = [shape.id];
    }
  }

  // Hit testing
  hitTest(pos) {
    const shapes = this.getShapes();
    const threshold = 10 / this.app.state.zoom;

    // Check vertices first
    for (const shape of shapes) {
      for (let i = 0; i < shape.vertices.length; i++) {
        const v = shape.vertices[i];
        const dist = Math.hypot(pos.x - v.x, pos.y - v.y);
        if (dist < threshold) {
          return { type: 'vertex', shapeId: shape.id, vertexIndex: i };
        }
      }
    }

    // Check edges
    for (const shape of shapes) {
      const n = shape.vertices.length;
      for (let i = 0; i < n; i++) {
        const a = shape.vertices[i];
        const b = shape.vertices[(i + 1) % n];
        const dist = this.pointToSegmentDist(pos, a, b);
        if (dist < threshold) {
          return { type: 'edge', shapeId: shape.id, edgeIndex: i };
        }
      }
    }

    // Check shape interior
    for (const shape of shapes) {
      if (this.pointInPolygon(pos, shape.vertices)) {
        return { type: 'shape', shapeId: shape.id };
      }
    }

    return null;
  }

  pointToSegmentDist(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    
    return Math.hypot(p.x - px, p.y - py);
  }

  pointInPolygon(point, vertices) {
    let inside = false;
    const n = vertices.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  // Selection methods
  clearSelection() {
    this.app.state.selectedShapes = [];
    this.app.state.selectedVertices = [];
  }

  selectShape(shapeId, additive = false) {
    if (!additive) {
      this.app.state.selectedShapes = [shapeId];
    } else if (!this.app.state.selectedShapes.includes(shapeId)) {
      this.app.state.selectedShapes.push(shapeId);
    }
  }

  selectVertex(shapeId, vertexIndex, additive = false) {
    const key = `${shapeId}:${vertexIndex}`;
    if (!additive) {
      this.app.state.selectedVertices = [key];
    } else if (!this.app.state.selectedVertices.includes(key)) {
      this.app.state.selectedVertices.push(key);
    }
  }

  selectInBox(minX, minY, maxX, maxY) {
    const shapes = this.getShapes();
    // Select individual vertices within the box
    for (const shape of shapes) {
      for (let i = 0; i < shape.vertices.length; i++) {
        const v = shape.vertices[i];
        if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY) {
          const key = `${shape.id}:${i}`;
          if (!this.app.state.selectedVertices.includes(key)) {
            this.app.state.selectedVertices.push(key);
          }
          // Also add the shape to selectedShapes for visual feedback
          if (!this.app.state.selectedShapes.includes(shape.id)) {
            this.app.state.selectedShapes.push(shape.id);
          }
        }
      }
    }
  }

  // Movement and transforms
  moveVertex(shapeId, vertexIndex, newPos) {
    const shapes = this.getShapes();
    const shape = shapes.find(s => s.id === shapeId);
    if (shape && shape.vertices[vertexIndex]) {
      shape.vertices[vertexIndex].x = newPos.x;
      shape.vertices[vertexIndex].y = newPos.y;
    }
  }

  // Move all selected vertices by a delta
  moveSelectedVerticesBy(dx, dy) {
    const shapes = this.getShapes();
    for (const key of this.app.state.selectedVertices) {
      const [shapeId, indexStr] = key.split(':');
      const index = parseInt(indexStr);
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && shape.vertices[index]) {
        shape.vertices[index].x += dx;
        shape.vertices[index].y += dy;
      }
    }
  }

  moveSelectedBy(dx, dy) {
    const shapes = this.getShapes();
    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        for (const v of shape.vertices) {
          v.x += dx;
          v.y += dy;
        }
      }
    }
  }

  getSelectedPositions() {
    const positions = [];
    const shapes = this.getShapes();
    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        positions.push({
          id: shapeId,
          vertices: shape.vertices.map(v => ({ x: v.x, y: v.y }))
        });
      }
    }
    return positions;
  }

  getSelectionCenter() {
    const shapes = this.getShapes();
    let sumX = 0, sumY = 0, count = 0;

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        for (const v of shape.vertices) {
          sumX += v.x;
          sumY += v.y;
          count++;
        }
      }
    }

    if (count === 0) return { x: 0, y: 0 };
    return { x: sumX / count, y: sumY / count };
  }

  getSelectedRotations() {
    return []; // Placeholder for rotation state
  }

  getSelectedScales() {
    return []; // Placeholder for scale state
  }

  rotateSelectedBy(angle, center) {
    const shapes = this.getShapes();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        for (const v of shape.vertices) {
          const dx = v.x - center.x;
          const dy = v.y - center.y;
          v.x = center.x + dx * cos - dy * sin;
          v.y = center.y + dx * sin + dy * cos;
        }
      }
    }
  }

  scaleSelectedBy(factor, center) {
    const shapes = this.getShapes();

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        for (const v of shape.vertices) {
          v.x = center.x + (v.x - center.x) * factor;
          v.y = center.y + (v.y - center.y) * factor;
        }
      }
    }
  }

  // Delete operations
  deleteSelectedShapes() {
    const layer = this.app.getCurrentLayer();
    if (!layer) return;

    layer.shapes = layer.shapes.filter(s => !this.app.state.selectedShapes.includes(s.id));
    this.app.state.selectedShapes = [];
  }

  deleteSelectedVertices() {
    // Delete specific vertices from shapes
    const shapes = this.getShapes();
    for (const key of this.app.state.selectedVertices) {
      const [shapeId, indexStr] = key.split(':');
      const index = parseInt(indexStr);
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && shape.vertices.length > 3) {
        shape.vertices.splice(index, 1);
      }
    }
    this.app.state.selectedVertices = [];
  }

  // Duplicate selected shapes
  duplicateSelected() {
    const layer = this.app.getCurrentLayer();
    if (!layer) return;

    const shapes = this.getShapes();
    const newIds = [];

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        const newShape = JSON.parse(JSON.stringify(shape));
        newShape.id = this.generateId();
        // Offset the duplicate
        for (const v of newShape.vertices) {
          v.x += 20;
          v.y += 20;
        }
        layer.shapes.push(newShape);
        newIds.push(newShape.id);
      }
    }

    this.app.state.selectedShapes = newIds;
  }

  // Reorder shapes
  reorderSelected(direction) {
    const layer = this.app.getCurrentLayer();
    if (!layer || this.app.state.selectedShapes.length === 0) return;

    for (const shapeId of this.app.state.selectedShapes) {
      const index = layer.shapes.findIndex(s => s.id === shapeId);
      if (index === -1) continue;

      const newIndex = index + direction;
      if (newIndex >= 0 && newIndex < layer.shapes.length) {
        const shape = layer.shapes.splice(index, 1)[0];
        layer.shapes.splice(newIndex, 0, shape);
      }
    }
  }

  // Subdivide selected shapes
  subdivideSelected() {
    const shapes = this.getShapes();

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (!shape) continue;

      const newVertices = [];
      const n = shape.vertices.length;
      
      for (let i = 0; i < n; i++) {
        const curr = shape.vertices[i];
        const next = shape.vertices[(i + 1) % n];
        
        newVertices.push({ x: curr.x, y: curr.y });
        newVertices.push({
          x: (curr.x + next.x) / 2,
          y: (curr.y + next.y) / 2
        });
      }

      shape.vertices = newVertices;
    }
  }

  // Simplify selected shapes (Douglas-Peucker)
  simplifySelected(tolerance = 2) {
    const shapes = this.getShapes();

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (!shape || shape.vertices.length < 4) continue;

      shape.vertices = this.simplifyPath(shape.vertices, tolerance);
    }
  }

  simplifyPath(points, tolerance) {
    if (points.length < 3) return points;

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
        if (t > 1) { x = p2.x; y = p2.y; }
        else if (t > 0) { x += dx * t; y += dy * t; }
      }

      dx = p.x - x; dy = p.y - y;
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

  // Flip operations
  flipSelectedH() {
    const center = this.getSelectionCenter();
    const shapes = this.getShapes();

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        for (const v of shape.vertices) {
          v.x = center.x - (v.x - center.x);
        }
      }
    }
  }

  flipSelectedV() {
    const center = this.getSelectionCenter();
    const shapes = this.getShapes();

    for (const shapeId of this.app.state.selectedShapes) {
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        for (const v of shape.vertices) {
          v.y = center.y - (v.y - center.y);
        }
      }
    }
  }

  // Mirror shapes from left side to right side (around x=0 axis)
  // Creates a mirrored copy of each shape on the opposite side
  mirrorLeftToRight() {
    const layer = this.app.getCurrentLayer();
    if (!layer) return;

    const shapes = this.getShapes();
    const newShapes = [];

    for (const shape of shapes) {
      // Create a mirrored copy of the shape
      const mirroredVertices = shape.vertices.map(v => ({
        x: -v.x,  // Mirror around x=0
        y: v.y
      }));

      // Reverse the vertex order to maintain correct winding
      mirroredVertices.reverse();

      const mirroredShape = {
        id: this.generateId(),
        type: shape.type,
        vertices: mirroredVertices,
        closed: shape.closed
      };

      newShapes.push(mirroredShape);
    }

    // Add all mirrored shapes to the layer
    for (const shape of newShapes) {
      layer.shapes.push(shape);
    }
  }
}
