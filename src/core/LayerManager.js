// Layer management
export class LayerManager {
  constructor(app) {
    this.app = app;
    this.activeLayerId = null;
  }

  createEmptyLayer(name = null) {
    const layerCount = this.getCurrentLayers().length;
    return {
      id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: name || `Layer ${layerCount + 1}`,
      visible: true,
      locked: false,
      shapes: []
    };
  }

  getCurrentLayers() {
    const frame = this.app.frames.getCurrentFrame();
    return frame ? frame.layers : [];
  }

  getActiveLayer() {
    const layers = this.getCurrentLayers();
    return layers.find(l => l.id === this.activeLayerId) || layers[0];
  }

  addLayer(name = null) {
    const frame = this.app.frames.getCurrentFrame();
    if (!frame) return;

    const layer = this.createEmptyLayer(name);
    frame.layers.push(layer);
    this.activeLayerId = layer.id;

    this.updateUI();
    this.app.render();
    return layer;
  }

  deleteActiveLayer() {
    const frame = this.app.frames.getCurrentFrame();
    if (!frame || frame.layers.length <= 1) return;

    const index = frame.layers.findIndex(l => l.id === this.activeLayerId);
    if (index === -1) return;

    frame.layers.splice(index, 1);
    
    // Select adjacent layer
    const newIndex = Math.min(index, frame.layers.length - 1);
    this.activeLayerId = frame.layers[newIndex].id;

    this.updateUI();
    this.app.render();
  }

  deleteLayer() {
    this.deleteActiveLayer();
  }

  mergeLayers() {
    const frame = this.app.frames.getCurrentFrame();
    if (!frame || frame.layers.length <= 1) return;

    this.app.history.record('Merge Layers');

    // Merge all shapes into first layer
    const allShapes = [];
    for (const layer of frame.layers) {
      allShapes.push(...layer.shapes);
    }

    frame.layers = [{
      id: frame.layers[0].id,
      name: 'Merged Layer',
      visible: true,
      locked: false,
      shapes: allShapes
    }];

    this.activeLayerId = frame.layers[0].id;

    this.app.emit('layersChanged');
    this.app.emit('stateChanged');
    this.app.render();
  }

  setLayerVisibility(layerId, visible) {
    const layers = this.getCurrentLayers();
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      layer.visible = visible;
      this.app.render();
    }
  }

  setLayerLocked(layerId, locked) {
    const layers = this.getCurrentLayers();
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      layer.locked = locked;
    }
  }

  renameLayer(layerId, name) {
    const layers = this.getCurrentLayers();
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      layer.name = name;
      this.app.emit('layersChanged');
    }
  }

  moveLayer(layerId, direction) {
    const frame = this.app.frames.getCurrentFrame();
    if (!frame) return;

    const index = frame.layers.findIndex(l => l.id === layerId);
    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= frame.layers.length) return;

    this.app.history.record('Reorder Layer');

    const [layer] = frame.layers.splice(index, 1);
    frame.layers.splice(newIndex, 0, layer);

    this.app.emit('layersChanged');
    this.app.render();
  }

  updateUI() {
    const container = document.getElementById('layersList');
    if (!container) return;
    
    const layers = this.getCurrentLayers();
    container.innerHTML = '';

    // Render in reverse order (top layer first)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const item = document.createElement('div');
      item.className = 'layer-item' + (layer.id === this.activeLayerId ? ' active' : '');
      
      item.innerHTML = `
        <span class="layer-visibility" title="Toggle Visibility">
          ${layer.visible ? '👁' : '○'}
        </span>
        <span class="layer-name">${layer.name}</span>
        <span class="layer-lock" title="Toggle Lock">
          ${layer.locked ? '🔒' : ''}
        </span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('layer-visibility')) {
          this.setLayerVisibility(layer.id, !layer.visible);
          this.updateUI();
        } else if (e.target.classList.contains('layer-lock')) {
          this.setLayerLocked(layer.id, !layer.locked);
          this.updateUI();
        } else {
          this.activeLayerId = layer.id;
          this.updateUI();
        }
      });

      container.appendChild(item);
    }
  }

  renderLayersList() {
    this.updateUI();
  }
}
