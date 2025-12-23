// Folder/Project management - works with all browsers
// Uses File System Access API when available, falls back to file input/download
export class FolderManager {
  constructor(app) {
    this.app = app;
    this.directoryHandle = null;  // For File System Access API (Chrome/Edge)
    this.files = [];
    this.currentFileName = null;
    this.useFallback = !('showDirectoryPicker' in window);
    this.fallbackModeActive = false;
  }

  isSupported() {
    return 'showDirectoryPicker' in window;
  }

  isLinked() {
    return this.directoryHandle !== null;
  }

  getFolderName() {
    return this.directoryHandle ? this.directoryHandle.name : null;
  }

  async linkFolder() {
    if (this.useFallback) {
      // For Firefox and other browsers, show the fallback UI immediately
      this.showFallbackMode();
      return true;
    }

    try {
      this.directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      await this.refreshFiles();
      this.updateUI();
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error linking folder:', err);
        alert('Failed to link folder: ' + err.message);
      }
      return false;
    }
  }

  showFallbackMode() {
    // Update UI to show fallback mode (load file / download)
    const statusEl = document.getElementById('folderStatus');
    const filesListContainer = document.getElementById('folderFilesList');
    const saveRow = document.getElementById('folderSaveRow');
    const actionsRow = document.getElementById('folderActionsRow');
    const linkBtn = document.getElementById('linkFolderBtn');
    const unlinkBtn = document.getElementById('unlinkFolderBtn');

    if (statusEl) {
      statusEl.innerHTML = '⚠️ <em>Firefox mode</em> - Files save to Downloads folder';
      statusEl.classList.add('linked');
    }
    if (filesListContainer) filesListContainer.style.display = 'none';
    if (saveRow) saveRow.style.display = 'flex';
    if (actionsRow) actionsRow.style.display = 'flex';
    if (linkBtn) linkBtn.style.display = 'none';
    if (unlinkBtn) {
      unlinkBtn.style.display = '';
      unlinkBtn.textContent = 'Close';
    }

    this.fallbackModeActive = true;
  }

  unlinkFolder() {
    this.directoryHandle = null;
    this.files = [];
    this.currentFileName = null;
    this.fallbackModeActive = false;
    
    const linkBtn = document.getElementById('linkFolderBtn');
    const unlinkBtn = document.getElementById('unlinkFolderBtn');
    if (linkBtn) linkBtn.textContent = this.useFallback ? '📂 Open Project' : '📁 Link Folder';
    if (unlinkBtn) unlinkBtn.textContent = 'Unlink';
    
    this.updateUI();
  }

  async refreshFiles() {
    if (!this.directoryHandle) return;

    this.files = [];
    
    try {
      for await (const entry of this.directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          const file = await entry.getFile();
          const text = await file.text();
          let fileType = 'unknown';
          
          try {
            const data = JSON.parse(text);
            if (data.frames && Array.isArray(data.frames)) {
              fileType = 'animation';
            } else if (data.layers && Array.isArray(data.layers)) {
              fileType = 'frame';
            } else if (data.shapes && Array.isArray(data.shapes)) {
              fileType = 'shapes';
            } else if (data.vertices || data.verts) {
              fileType = 'shape';
            }
          } catch (e) {
            fileType = 'invalid';
          }

          this.files.push({
            name: entry.name,
            handle: entry,
            type: fileType,
            size: file.size,
            lastModified: file.lastModified
          });
        }
      }

      this.files.sort((a, b) => b.lastModified - a.lastModified);
      this.updateFilesListUI();
    } catch (err) {
      console.error('Error reading folder:', err);
    }
  }

  async loadFile(fileName) {
    if (!this.directoryHandle) return null;

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      
      this.currentFileName = fileName.replace('.json', '');
      this.updateUI();
      
      return data;
    } catch (err) {
      console.error('Error loading file:', err);
      alert('Failed to load file: ' + err.message);
      return null;
    }
  }

  // Fallback: Load file using file input (works in all browsers)
  loadFileFallback() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          this.currentFileName = file.name.replace('.json', '');
          
          const fileNameInput = document.getElementById('saveFileName');
          if (fileNameInput) fileNameInput.value = this.currentFileName;
          
          resolve(data);
        } catch (err) {
          console.error('Error loading file:', err);
          alert('Failed to load file: ' + err.message);
          resolve(null);
        }
      };
      
      input.click();
    });
  }

  async saveFile(fileName, data) {
    // Ensure .json extension
    if (!fileName.endsWith('.json')) {
      fileName += '.json';
    }

    if (this.useFallback || !this.directoryHandle) {
      // Fallback: Download file
      return this.saveFileFallback(fileName, data);
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      
      this.currentFileName = fileName.replace('.json', '');
      await this.refreshFiles();
      
      return true;
    } catch (err) {
      console.error('Error saving file:', err);
      alert('Failed to save file: ' + err.message);
      return false;
    }
  }

  // Fallback: Save file using download (works in all browsers)
  saveFileFallback(fileName, data) {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.currentFileName = fileName.replace('.json', '');
      return true;
    } catch (err) {
      console.error('Error saving file:', err);
      alert('Failed to save file: ' + err.message);
      return false;
    }
  }

  async deleteFile(fileName) {
    if (!this.directoryHandle) return false;

    try {
      await this.directoryHandle.removeEntry(fileName);
      await this.refreshFiles();
      return true;
    } catch (err) {
      console.error('Error deleting file:', err);
      return false;
    }
  }

  updateUI() {
    const linkBtn = document.getElementById('linkFolderBtn');
    const unlinkBtn = document.getElementById('unlinkFolderBtn');
    const statusEl = document.getElementById('folderStatus');
    const filesListContainer = document.getElementById('folderFilesList');
    const saveRow = document.getElementById('folderSaveRow');
    const actionsRow = document.getElementById('folderActionsRow');
    const fileNameInput = document.getElementById('saveFileName');

    // Update button text based on browser support
    if (linkBtn && !this.isLinked() && !this.fallbackModeActive) {
      linkBtn.textContent = this.useFallback ? '📂 Open Project' : '📁 Link Folder';
    }

    if (this.isLinked()) {
      // Full folder mode (Chrome/Edge)
      if (linkBtn) linkBtn.style.display = 'none';
      if (unlinkBtn) unlinkBtn.style.display = '';
      if (statusEl) {
        statusEl.textContent = `📁 ${this.getFolderName()}`;
        statusEl.classList.add('linked');
      }
      if (filesListContainer) filesListContainer.style.display = '';
      if (saveRow) saveRow.style.display = 'flex';
      if (actionsRow) actionsRow.style.display = 'flex';
      if (fileNameInput && this.currentFileName) {
        fileNameInput.value = this.currentFileName;
      }
    } else if (this.fallbackModeActive) {
      // Fallback mode already set up in showFallbackMode
    } else {
      // Not linked / initial state
      if (linkBtn) linkBtn.style.display = '';
      if (unlinkBtn) unlinkBtn.style.display = 'none';
      if (statusEl) {
        if (this.useFallback) {
          statusEl.innerHTML = '⚠️ Firefox: saves to Downloads folder<br><small>Use Chrome/Edge to save to a specific folder</small>';
        } else {
          statusEl.textContent = 'Link a folder to save/load projects';
        }
        statusEl.classList.remove('linked');
      }
      if (filesListContainer) filesListContainer.style.display = 'none';
      // For Firefox, show save row by default and hide link button
      if (saveRow) saveRow.style.display = this.useFallback ? 'flex' : 'none';
      if (actionsRow) actionsRow.style.display = this.useFallback ? 'flex' : 'none';
      if (linkBtn && this.useFallback) linkBtn.style.display = 'none';
    }
  }

  updateFilesListUI() {
    const container = document.getElementById('filesList');
    if (!container) return;

    container.innerHTML = '';

    if (this.files.length === 0) {
      container.innerHTML = '<div class="file-item" style="color: var(--fg-muted); cursor: default;">No JSON files found</div>';
      return;
    }

    for (const file of this.files) {
      const item = document.createElement('div');
      item.className = 'file-item';
      if (this.currentFileName && file.name === this.currentFileName + '.json') {
        item.classList.add('active');
      }

      const icon = this.getFileIcon(file.type);
      const typeBadge = this.getTypeBadge(file.type);

      item.innerHTML = `
        <span class="file-icon">${icon}</span>
        <span class="file-name" title="${file.name}">${file.name}</span>
        <span class="file-type">${typeBadge}</span>
      `;

      item.addEventListener('click', () => {
        this.onFileClick(file);
      });

      container.appendChild(item);
    }
  }

  getFileIcon(type) {
    switch (type) {
      case 'animation': return '🎬';
      case 'frame': return '🖼️';
      case 'shapes': return '📐';
      case 'shape': return '⬡';
      default: return '📄';
    }
  }

  getTypeBadge(type) {
    switch (type) {
      case 'animation': return 'anim';
      case 'frame': return 'frame';
      case 'shapes': return 'shapes';
      case 'shape': return 'shape';
      default: return 'json';
    }
  }

  async onFileClick(file) {
    const data = await this.loadFile(file.name);
    if (data) {
      this.app.loadProjectData(data);
    }
  }

  getProjectData() {
    return {
      version: 1,
      type: 'animation',
      canvasWidth: this.app.canvasWidth,
      canvasHeight: this.app.canvasHeight,
      frames: this.app.frames.frames.map(frame => ({
        id: frame.id,
        layers: frame.layers.map(layer => ({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked,
          shapes: layer.shapes
        }))
      })),
      currentFrameIndex: this.app.frames.currentFrameIndex,
      fps: this.app.state.fps
    };
  }
}
