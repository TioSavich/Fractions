/**
 * Modern state management system for Fraction Bars
 * Handles undo/redo, persistence, and real-time state updates
 */

// Core state types
interface FractionBarState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isSelected: boolean;
  isUnitBar: boolean;
  label?: string;
  fraction?: string;
  splits: SplitState[];
}

interface SplitState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isSelected: boolean;
}

interface AppState {
  version: string;
  bars: FractionBarState[];
  currentTool: string;
  selectedBarIds: string[];
  unitBarId?: string;
  settings: AppSettings;
}

interface AppSettings {
  defaultBarColor: string;
  defaultBarHeight: number;
  showLabels: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

type StateChangeCallback = (state: AppState) => void;
type ActionType = 
  | 'ADD_BAR' 
  | 'REMOVE_BAR' 
  | 'MODIFY_BAR' 
  | 'SPLIT_BAR' 
  | 'JOIN_BARS'
  | 'SET_UNIT_BAR'
  | 'CHANGE_TOOL'
  | 'UPDATE_SETTINGS';

interface Action {
  type: ActionType;
  payload: any;
  timestamp: number;
}

export class StateManager {
  private state: AppState;
  private history: Action[] = [];
  private future: Action[] = [];
  private subscribers: Set<StateChangeCallback> = new Set();
  private maxHistorySize: number = 100;
  private batchOperation: boolean = false;
  private batchedActions: Action[] = [];
  private autoSaveInterval?: number;

  constructor(initialState?: Partial<AppState>) {
    this.state = this.createInitialState(initialState);
    this.setupAutoSave();
  }

  /**
   * Initialize the state with defaults and any provided initial state
   */
  private createInitialState(initialState?: Partial<AppState>): AppState {
    const defaultState: AppState = {
      version: '1.0.0',
      bars: [],
      currentTool: 'bar',
      selectedBarIds: [],
      settings: {
        defaultBarColor: '#FFFF66',
        defaultBarHeight: 60,
        showLabels: true,
        snapToGrid: false,
        gridSize: 10
      }
    };

    return { ...defaultState, ...initialState };
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(callback: StateChangeCallback): () => void {
    this.subscribers.add(callback);
    callback(this.state); // Initial state notification
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Dispatch an action to modify state
   */
  public dispatch(action: Omit<Action, 'timestamp'>): void {
    const timestampedAction = {
      ...action,
      timestamp: Date.now()
    };

    if (this.batchOperation) {
      this.batchedActions.push(timestampedAction);
      return;
    }

    this.executeAction(timestampedAction);
  }

  /**
   * Execute a single action
   */
  private executeAction(action: Action): void {
    // Clear future history when new action is performed
    if (this.future.length > 0) {
      this.future = [];
    }

    // Add action to history
    this.history.push(action);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Update state based on action
    const newState = this.reducer(this.state, action);
    this.updateState(newState);
  }

  /**
   * Main reducer function
   */
  private reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
      case 'ADD_BAR':
        return {
          ...state,
          bars: [...state.bars, this.createBar(action.payload)]
        };

      case 'REMOVE_BAR':
        return {
          ...state,
          bars: state.bars.filter(bar => bar.id !== action.payload.id),
          selectedBarIds: state.selectedBarIds.filter(id => id !== action.payload.id),
          unitBarId: state.unitBarId === action.payload.id ? undefined : state.unitBarId
        };

      case 'MODIFY_BAR':
        return {
          ...state,
          bars: state.bars.map(bar => 
            bar.id === action.payload.id ? { ...bar, ...action.payload.changes } : bar
          )
        };

      case 'SPLIT_BAR':
        return this.handleSplitBar(state, action.payload);

      case 'JOIN_BARS':
        return this.handleJoinBars(state, action.payload);

      case 'SET_UNIT_BAR':
        return {
          ...state,
          unitBarId: action.payload.id,
          bars: state.bars.map(bar => ({
            ...bar,
            isUnitBar: bar.id === action.payload.id
          }))
        };

      case 'CHANGE_TOOL':
        return {
          ...state,
          currentTool: action.payload.tool
        };

      case 'UPDATE_SETTINGS':
        return {
          ...state,
          settings: {
            ...state.settings,
            ...action.payload
          }
        };

      default:
        return state;
    }
  }

  /**
   * Handle splitting a bar
   */
  private handleSplitBar(state: AppState, payload: {
    barId: string,
    splits: SplitState[]
  }): AppState {
    return {
      ...state,
      bars: state.bars.map(bar => 
        bar.id === payload.barId
          ? { ...bar, splits: payload.splits }
          : bar
      )
    };
  }

  /**
   * Handle joining bars
   */
  private handleJoinBars(state: AppState, payload: {
    sourceIds: string[],
    resultBar: FractionBarState
  }): AppState {
    const { sourceIds, resultBar } = payload;
    return {
      ...state,
      bars: [
        ...state.bars.filter(bar => !sourceIds.includes(bar.id)),
        resultBar
      ],
      selectedBarIds: state.selectedBarIds.filter(id => !sourceIds.includes(id))
    };
  }

  /**
   * Create a new bar with defaults
   */
  private createBar(barData: Partial<FractionBarState>): FractionBarState {
    return {
      id: this.generateId(),
      x: 0,
      y: 0,
      width: 100,
      height: this.state.settings.defaultBarHeight,
      color: this.state.settings.defaultBarColor,
      isSelected: false,
      isUnitBar: false,
      splits: [],
      ...barData
    };
  }

  /**
   * Batch multiple actions together
   */
  public batch(callback: () => void): void {
    this.batchOperation = true;
    this.batchedActions = [];
    
    callback();
    
    if (this.batchedActions.length > 0) {
      this.batchedActions.forEach(action => this.executeAction(action));
    }
    
    this.batchOperation = false;
    this.batchedActions = [];
  }

  /**
   * Undo the last action
   */
  public undo(): void {
    if (this.history.length === 0) return;

    const action = this.history.pop()!;
    this.future.push(action);

    // Rebuild state from initial state + remaining history
    let newState = this.createInitialState();
    this.history.forEach(action => {
      newState = this.reducer(newState, action);
    });

    this.updateState(newState);
  }

  /**
   * Redo the last undone action
   */
  public redo(): void {
    if (this.future.length === 0) return;

    const action = this.future.pop()!;
    this.executeAction(action);
  }

  /**
   * Save state to local storage
   */
  public async saveState(): Promise<void> {
    try {
      const serializedState = JSON.stringify({
        state: this.state,
        timestamp: Date.now()
      });
      
      localStorage.setItem('fractionBarsState', serializedState);
      
      // Also save to IndexedDB for larger states
      await this.saveToIndexedDB(serializedState);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  /**
   * Load state from storage
   */
  public async loadState(): Promise<void> {
    try {
      // Try IndexedDB first
      const state = await this.loadFromIndexedDB();
      if (state) {
        this.updateState(state);
        return;
      }

      // Fall back to localStorage
      const savedState = localStorage.getItem('fractionBarsState');
      if (savedState) {
        const { state } = JSON.parse(savedState);
        this.updateState(state);
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  /**
   * Save state to IndexedDB
   */
  private async saveToIndexedDB(serializedState: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction('states', 'readwrite');
    const store = tx.objectStore('states');
    await store.put({
      id: 'current',
      state: serializedState,
      timestamp: Date.now()
    });
  }

  /**
   * Load state from IndexedDB
   */
  private async loadFromIndexedDB(): Promise<AppState | null> {
    const db = await this.openDB();
    const tx = db.transaction('states', 'readonly');
    const store = tx.objectStore('states');
    const result = await store.get('current');
    
    if (result && result.state) {
      return JSON.parse(result.state).state;
    }
    return null;
  }

  /**
   * Open IndexedDB connection
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FractionBarsDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;
        db.createObjectStore('states', { keyPath: 'id' });
      };
    });
  }

  /**
   * Update state and notify subscribers
   */
  private updateState(newState: AppState): void {
    this.state = newState;
    this.notifySubscribers();
    this.scheduleSave();
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.state));
  }

  /**
   * Set up automatic state saving
   */
  private setupAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = window.setInterval(() => {
      this.saveState();
    }, 30000); // Save every 30 seconds
  }

  /**
   * Schedule a save operation
   */
  private scheduleSave = debounce(() => {
    this.saveState();
  }, 1000);

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.subscribers.clear();
  }
}

// Utility function for debouncing
function debounce(func: Function, wait: number): (...args: any[]) => void {
  let timeout: number | undefined;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func.apply(this, args), wait);
  };
}

// Example usage:
export class FractionBarsApp {
  private stateManager: StateManager;
  private renderer: SVGRenderer;
  
  constructor(container: HTMLElement) {
    this.stateManager = new StateManager();
    this.renderer = new SVGRenderer(container);
    
    // Subscribe to state changes
    this.stateManager.subscribe(state => {
      this.renderer.update(state.bars);
    });
  }

  public addBar(x: number, y: number, width: number): void {
    this.stateManager.dispatch({
      type: 'ADD_BAR',
      payload: { x, y, width }
    });
  }

  public splitBar(barId: string, splits: SplitState[]): void {
    this.stateManager.dispatch({
      type: 'SPLIT_BAR',
      payload: { barId, splits }
    });
  }

  public undo(): void {
    this.stateManager.undo();
  }

  public redo(): void {
    this.stateManager.redo();
  }
}
