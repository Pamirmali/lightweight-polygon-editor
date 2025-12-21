// History management for undo/redo
export class HistoryManager {
  constructor(app) {
    this.app = app;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 100;
  }

  // Push current state to history
  pushState(state) {
    this.undoStack.push(JSON.stringify(state));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  // Undo last action
  undo() {
    if (this.undoStack.length <= 1) return; // Keep at least one state

    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);

    const previousState = this.undoStack[this.undoStack.length - 1];
    if (previousState) {
      this.app.restoreState(JSON.parse(previousState));
    }
  }

  // Redo last undone action
  redo() {
    if (this.redoStack.length === 0) return;

    const stateToRestore = this.redoStack.pop();
    this.undoStack.push(stateToRestore);
    this.app.restoreState(JSON.parse(stateToRestore));
  }

  // Clear all history
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Check if undo is available
  canUndo() {
    return this.undoStack.length > 1;
  }

  // Check if redo is available
  canRedo() {
    return this.redoStack.length > 0;
  }
}
