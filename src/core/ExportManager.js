// Export manager for vertices, triangles, and animations
export class ExportManager {
  constructor(app) {
    this.app = app;
  }

  // Get data for current frame
  getCurrentFrameData() {
    const frame = this.app.frames.getCurrentFrame();
    if (!frame) return { vertices: [], triangles: [] };

    const allVertices = [];
    const allTriangles = [];
    let vertexOffset = 0;

    for (const layer of frame.layers) {
      if (!layer.visible) continue;

      for (const shape of layer.shapes) {
        const n = shape.vertices.length;
        if (n < 3) continue;

        // Add vertices
        for (const vertex of shape.vertices) {
          allVertices.push([
            this.round(vertex.x),
            this.round(vertex.y)
          ]);
        }

        // Triangulate using fan method
        for (let i = 1; i < n - 1; i++) {
          allTriangles.push([
            vertexOffset,
            vertexOffset + i,
            vertexOffset + i + 1
          ]);
        }

        vertexOffset += n;
      }
    }

    return {
      vertices: allVertices,
      triangles: allTriangles
    };
  }

  // Get data for all frames (animation)
  getAllFramesData() {
    return this.app.frames.frames.map((frame, index) => {
      const frameData = { frameIndex: index, layers: [] };

      for (const layer of frame.layers) {
        const layerData = {
          name: layer.name,
          shapes: []
        };

        for (const shape of layer.shapes) {
          const n = shape.vertices.length;
          if (n < 3) continue;

          const vertices = shape.vertices.map(v => [
            this.round(v.x),
            this.round(v.y)
          ]);

          const triangles = [];
          for (let i = 1; i < n - 1; i++) {
            triangles.push([0, i, i + 1]);
          }

          layerData.shapes.push({ vertices, triangles });
        }

        frameData.layers.push(layerData);
      }

      return frameData;
    });
  }

  round(value, precision = 3) {
    const mult = Math.pow(10, precision);
    return Math.round(value * mult) / mult;
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textarea);
    });
  }

  copyVertices() {
    const data = this.getCurrentFrameData();
    this.copyToClipboard(JSON.stringify(data.vertices, null, 2));
  }

  copyTriangles() {
    const data = this.getCurrentFrameData();
    this.copyToClipboard(JSON.stringify(data.triangles, null, 2));
  }

  exportJSON() {
    const data = this.getCurrentFrameData();
    const json = JSON.stringify(data, null, 2);
    this.copyToClipboard(json);
    this.downloadFile('shape.json', json, 'application/json');
  }

  exportAnimation() {
    const data = {
      fps: this.app.state.fps,
      frames: this.getAllFramesData()
    };
    const json = JSON.stringify(data, null, 2);
    this.copyToClipboard(json);
    this.downloadFile('animation.json', json, 'application/json');
  }

  downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
