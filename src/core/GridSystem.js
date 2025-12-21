// Grid system with configurable size and snapping
export class GridSystem {
  constructor(app) {
    this.app = app;
  }

  // Render the grid
  render(ctx, width, height) {
    const state = this.app.state;
    const gridSize = state.gridSize;
    const zoom = state.zoom;
    const panX = state.panX;
    const panY = state.panY;

    const scaledSize = gridSize * zoom;
    
    // Don't render grid if too small
    if (scaledSize < 5) return;

    ctx.save();

    // Minor grid lines
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
    ctx.lineWidth = 1;

    ctx.beginPath();

    // Vertical lines
    const startX = panX % scaledSize;
    for (let x = startX; x < width; x += scaledSize) {
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, height);
    }

    // Horizontal lines
    const startY = panY % scaledSize;
    for (let y = startY; y < height; y += scaledSize) {
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(width, Math.floor(y) + 0.5);
    }

    ctx.stroke();

    // Major grid lines (every 5 cells)
    const majorSize = scaledSize * 5;
    if (majorSize >= 25) {
      ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
      ctx.lineWidth = 1;

      ctx.beginPath();

      // Vertical major lines
      const majorStartX = panX % majorSize;
      for (let x = majorStartX; x < width; x += majorSize) {
        ctx.moveTo(Math.floor(x) + 0.5, 0);
        ctx.lineTo(Math.floor(x) + 0.5, height);
      }

      // Horizontal major lines
      const majorStartY = panY % majorSize;
      for (let y = majorStartY; y < height; y += majorSize) {
        ctx.moveTo(0, Math.floor(y) + 0.5);
        ctx.lineTo(width, Math.floor(y) + 0.5);
      }

      ctx.stroke();
    }

    // Origin axes
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // X axis (horizontal line at y=0)
    if (panY >= 0 && panY <= height) {
      ctx.moveTo(0, panY);
      ctx.lineTo(width, panY);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)';
    ctx.beginPath();
    
    // Y axis (vertical line at x=0)
    if (panX >= 0 && panX <= width) {
      ctx.moveTo(panX, 0);
      ctx.lineTo(panX, height);
    }
    ctx.stroke();

    ctx.restore();
  }

  // Snap a point to the grid
  snapToGrid(point) {
    const gridSize = this.app.state.gridSize;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  }

  // Get the nearest grid intersection
  getNearestGridPoint(worldX, worldY) {
    const gridSize = this.app.state.gridSize;
    return {
      x: Math.round(worldX / gridSize) * gridSize,
      y: Math.round(worldY / gridSize) * gridSize
    };
  }
}
