/**
 * Universal Undo/Redo Engine for Flora Personnel & Org Chart Management
 * Manages action snapshots, Firestore & Local State rollback, keyboard shortcuts, and UI updates.
 */

(function(global) {
  'use strict';

  const MAX_HISTORY = 50;
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();
  let isExecuting = false;

  /**
   * Notify all listeners and update UI buttons
   */
  function notifyChange() {
    const state = {
      canUndo: undoStack.length > 0 && !isExecuting,
      canRedo: redoStack.length > 0 && !isExecuting,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      lastUndo: undoStack[undoStack.length - 1]?.desc || null,
      lastRedo: redoStack[redoStack.length - 1]?.desc || null
    };

    // Update DOM Buttons dynamically
    updateUIButtons(state);

    // Call registered listeners
    listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.warn("UndoRedo listener error:", e); }
    });

    // Dispatch global CustomEvent
    try {
      window.dispatchEvent(new CustomEvent('flora-undoredo-changed', { detail: state }));
    } catch (_) {}
  }

  /**
   * Update visual states of all Undo/Redo buttons
   */
  function updateUIButtons(state) {
    const undoButtons = document.querySelectorAll('#btnToolbarUndo, #btnFloatingUndo, [data-action="undo"]');
    const redoButtons = document.querySelectorAll('#btnToolbarRedo, #btnFloatingRedo, [data-action="redo"]');

    undoButtons.forEach(btn => {
      if (!btn) return;
      btn.disabled = !state.canUndo;
      if (state.canUndo) {
        btn.classList.remove('opacity-50', 'disabled');
        btn.removeAttribute('aria-disabled');
        if (state.lastUndo) {
          btn.title = `เลิกทำ (Undo): ${state.lastUndo} [Ctrl+Z]`;
        } else {
          btn.title = `เลิกทำ (Undo) [Ctrl+Z]`;
        }
      } else {
        btn.classList.add('opacity-50');
        btn.setAttribute('aria-disabled', 'true');
        btn.title = `ไม่มีรายการให้เลิกทำ [Ctrl+Z]`;
      }
    });

    redoButtons.forEach(btn => {
      if (!btn) return;
      btn.disabled = !state.canRedo;
      if (state.canRedo) {
        btn.classList.remove('opacity-50', 'disabled');
        btn.removeAttribute('aria-disabled');
        if (state.lastRedo) {
          btn.title = `ทำซ้ำ (Redo): ${state.lastRedo} [Ctrl+Y หรือ Ctrl+Shift+Z]`;
        } else {
          btn.title = `ทำซ้ำ (Redo) [Ctrl+Y]`;
        }
      } else {
        btn.classList.add('opacity-50');
        btn.setAttribute('aria-disabled', 'true');
        btn.title = `ไม่มีรายการให้ทำซ้ำ [Ctrl+Y]`;
      }
    });
  }

  /**
   * Core UndoRedoManager Object
   */
  const UndoRedoManager = {
    /**
     * Push a new snapshot action
     * @param {Object} action - { desc: string, undo: async Function, redo: async Function }
     */
    pushAction(action) {
      if (!action || typeof action.undo !== 'function' || typeof action.redo !== 'function') {
        console.warn("UndoRedoManager.pushAction: Invalid action object provided", action);
        return;
      }
      if (isExecuting) {
        // Prevent recording actions triggered during an undo/redo step
        return;
      }

      undoStack.push({
        desc: action.desc || 'การกระทำ',
        undo: action.undo,
        redo: action.redo,
        timestamp: Date.now()
      });

      if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
      }

      // Clear redo stack upon new user action
      redoStack.length = 0;

      notifyChange();
    },

    /**
     * Perform Undo
     */
    async undo() {
      if (isExecuting || undoStack.length === 0) return false;

      const action = undoStack.pop();
      if (!action) return false;

      isExecuting = true;
      notifyChange();

      try {
        await action.undo();
        redoStack.push(action);
        if (typeof window.showToast === 'function') {
          window.showToast(`↩ เลิกทำ: ${action.desc}`);
        }
        return true;
      } catch (err) {
        console.error("UndoRedoManager.undo execution error:", err);
        undoStack.push(action); // Restore if failed
        if (typeof window.showToast === 'function') {
          window.showToast(`⚠️ ไม่สามารถเลิกทำได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
        }
        return false;
      } finally {
        isExecuting = false;
        notifyChange();
      }
    },

    /**
     * Perform Redo
     */
    async redo() {
      if (isExecuting || redoStack.length === 0) return false;

      const action = redoStack.pop();
      if (!action) return false;

      isExecuting = true;
      notifyChange();

      try {
        await action.redo();
        undoStack.push(action);
        if (typeof window.showToast === 'function') {
          window.showToast(`↪ ทำซ้ำ: ${action.desc}`);
        }
        return true;
      } catch (err) {
        console.error("UndoRedoManager.redo execution error:", err);
        redoStack.push(action); // Restore if failed
        if (typeof window.showToast === 'function') {
          window.showToast(`⚠️ ไม่สามารถทำซ้ำได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
        }
        return false;
      } finally {
        isExecuting = false;
        notifyChange();
      }
    },

    canUndo() {
      return undoStack.length > 0 && !isExecuting;
    },

    canRedo() {
      return redoStack.length > 0 && !isExecuting;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      notifyChange();
    },

    getStats() {
      return {
        undoCount: undoStack.length,
        redoCount: redoStack.length,
        canUndo: undoStack.length > 0 && !isExecuting,
        canRedo: redoStack.length > 0 && !isExecuting,
        lastUndo: undoStack[undoStack.length - 1]?.desc || null,
        lastRedo: redoStack[redoStack.length - 1]?.desc || null
      };
    },

    addListener(fn) {
      if (typeof fn === 'function') {
        listeners.add(fn);
        fn(this.getStats());
      }
      return () => listeners.delete(fn);
    },

    /**
     * Manually trigger a UI refresh of button states
     */
    refreshUI() {
      notifyChange();
    }
  };

  /**
   * Helper to construct a standard Personnel Movement Undo/Redo Action
   * @param {string|number} empId - The employee ID or Code
   * @param {Object} prevSnapshot - State before move { department, departmentNodeId, position, positionNodeId, role }
   * @param {Object} nextSnapshot - State after move { department, departmentNodeId, position, positionNodeId, role }
   * @param {string} desc - Action description
   */
  function createPersonnelMoveAction(empId, prevSnapshot, nextSnapshot, desc) {
    const targetEmpIdStr = String(empId);

    const applySnapshot = async function(snapshot) {
      if (!window.employees || !Array.isArray(window.employees)) return false;

      // Always compare IDs as String
      const emp = window.employees.find(e => String(e.id || e.code) === targetEmpIdStr);
      if (!emp) {
        console.warn(`UndoRedo: Employee with ID ${targetEmpIdStr} not found`);
        return false;
      }

      // 1. Update in-memory state
      emp.department = snapshot.department || '';
      emp.departmentNodeId = snapshot.departmentNodeId || '';
      emp.position = snapshot.position || 'พนักงาน';
      emp.positionNodeId = snapshot.positionNodeId || '';
      emp.role = snapshot.role || 'WORKER';
      emp.updatedAt = new Date().toISOString();

      // 2. Mark dirty and sync local storage
      window.orgChartDirty = true;
      if (typeof window.syncToLocalStorage === 'function') {
        window.syncToLocalStorage();
      }

      // 3. Refresh Org Chart / Tree / Directory views immediately
      if (typeof window.renderOrgChart === 'function') {
        window.renderOrgChart(true);
      }
      if (typeof window.renderUnassignedDrawer === 'function') {
        window.renderUnassignedDrawer();
      }
      if (typeof window.renderPersonnelDirectory === 'function' && window.currentWorkspaceTab === 'directory') {
        window.renderPersonnelDirectory();
      }

      // Dispatch change event for tree sync
      try {
        window.dispatchEvent(new CustomEvent('flora-org-tree-changed'));
      } catch (_) {}

      // 4. Asynchronous Cloud Firestore Persistence
      if (typeof window.persistEmployeeChanges === 'function') {
        await window.persistEmployeeChanges(emp);
      } else if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, {
            role: emp.role,
            department: emp.department,
            position: emp.position,
            departmentNodeId: emp.departmentNodeId,
            positionNodeId: emp.positionNodeId,
            updatedAt: emp.updatedAt
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Firestore undo/redo sync:", dbErr);
        }
      }

      return true;
    };

    return {
      desc: desc || `ย้ายบุคลากร [${targetEmpIdStr}]`,
      undo: async () => applySnapshot(prevSnapshot),
      redo: async () => applySnapshot(nextSnapshot)
    };
  }

  // Keyboard Shortcuts (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z for Redo)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.tagName === 'SELECT'
    )) {
      return; // Do not intercept native undo in text fields
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    if (e.key === 'z' || e.key === 'Z') {
      if (e.shiftKey) {
        // Redo via Ctrl+Shift+Z or Cmd+Shift+Z
        e.preventDefault();
        UndoRedoManager.redo();
      } else {
        // Undo via Ctrl+Z or Cmd+Z
        e.preventDefault();
        UndoRedoManager.undo();
      }
    } else if (e.key === 'y' || e.key === 'Y') {
      // Redo via Ctrl+Y or Cmd+Y
      e.preventDefault();
      UndoRedoManager.redo();
    }
  });

  // Attach to window / global
  global.UndoRedoManager = UndoRedoManager;
  global.undoFloraAction = () => UndoRedoManager.undo();
  global.redoFloraAction = () => UndoRedoManager.redo();
  global.pushFloraUndoAction = (action) => UndoRedoManager.pushAction(action);
  global.createPersonnelMoveAction = createPersonnelMoveAction;

  // Initialize UI button states on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UndoRedoManager.refreshUI());
  } else {
    setTimeout(() => UndoRedoManager.refreshUI(), 100);
  }

})(typeof window !== 'undefined' ? window : this);
