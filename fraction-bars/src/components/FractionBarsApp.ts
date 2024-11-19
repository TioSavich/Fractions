/**
 * Complete Modern Fraction Bars Application
 */
// Change class name to match what we're importing
export class FractionBarsApp {  // Changed from ModernFractionBarsApp
  private container: HTMLElement;
  private stateManager: StateManager;
  private renderer: SVGRenderer;
  private touchManager: TouchInteractionManager;
  private accessibility: AccessibilityManager;
  private exporter: FractionBarsExporter;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.initializeComponents();
    this.wireComponents();
    this.setupUI();
  }
 

  private initializeComponents(): void {
    // Initialize core components
    this.stateManager = new StateManager();
    this.renderer = new SVGRenderer(this.container);
    this.touchManager = new TouchInteractionManager(this.container);
    this.accessibility = new AccessibilityManager(this.container, this.stateManager);
    this.exporter = new FractionBarsExporter(this.renderer, this.container);

    // Load saved state if available
    this.stateManager.loadState().catch(error => {
      console.warn('Failed to load saved state:', error);
    });
  }

  private wireComponents(): void {
    // Connect touch interactions to state changes
    this.touchManager.setCallbacks({
      onBarSelect: this.handleBarSelect.bind(this),
      onBarSplit: this.handleBarSplit.bind(this),
      onBarDrag: this.handleBarDrag.bind(this),
      onBarJoin: this.handleBarJoin.bind(this)
    });

    // Connect state changes to rendering and accessibility
    this.stateManager.subscribe(this.handleStateChange.bind(this));

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private setupUI(): void {
    // Create toolbar
    const toolbar = this.createToolbar();
    this.container.insertBefore(toolbar, this.container.firstChild);

    // Create status bar
    const statusBar = this.createStatusBar();
    this.container.appendChild(statusBar);

    // Initialize tooltips
    this.initializeTooltips();
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'fraction-bars-toolbar';
    
    const tools = [
      { id: 'bar', icon: '◻️', label: 'Create Bar' },
      { id: 'split', icon: '✂️', label: 'Split Bar' },
      { id: 'join', icon: '🔗', label: 'Join Bars' },
      { id: 'measure', icon: '📏', label: 'Measure Bar' },
      { separator: true },
      { id: 'undo', icon: '↩️', label: 'Undo' },
      { id: 'redo', icon: '↪️', label: 'Redo' },
      { separator: true },
      { id: 'export', icon: '💾', label: 'Export' },
      { id: 'print', icon: '🖨️', label: 'Print' }
    ];

    tools.forEach(tool => {
      if (tool.separator) {
        const separator = document.createElement('div');
        separator.className = 'toolbar-separator';
        toolbar.appendChild(separator);
      } else {
        const button = document.createElement('button');
        button.className = 'toolbar-button';
        button.setAttribute('data-tool', tool.id);
        button.setAttribute('aria-label', tool.label);
        button.innerHTML = `${tool.icon}<span>${tool.label}</span>`;
        button.addEventListener('click', () => this.handleToolClick(tool.id));
        toolbar.appendChild(button);
      }
    });

    return toolbar;
  }

  private createStatusBar(): HTMLElement {
    const statusBar = document.createElement('div');
    statusBar.className = 'fraction-bars-status';
    
    // Create status sections
    const elements = [
      { id: 'tool', label: 'Current Tool: ' },
      { id: 'selection', label: 'Selection: ' },
      { id: 'measurement', label: 'Measurement: ' }
    ];

    elements.forEach(element => {
      const section = document.createElement('div');
      section.className = 'status-section';
      section.innerHTML = `
        <span class="status-label">${element.label}</span>
        <span id="status-${element.id}" class="status-value"></span>
      `;
      statusBar.appendChild(section);
    });

    return statusBar;
  }

  // Event Handlers
  private handleBarSelect(x: number, y: number): void {
    const bar = this.findBarAt(x, y);
    if (bar) {
      this.stateManager.dispatch({
        type: 'MODIFY_BAR',
        payload: {
          id: bar.id,
          changes: { isSelected: !bar.isSelected }
        }
      });
    }
  }

  private handleBarSplit(x: number, y: number, isVertical: boolean): void {
    const bar = this.findBarAt(x, y);
    if (bar) {
      const splits = this.calculateSplits(bar, x, y, isVertical);
      this.stateManager.dispatch({
        type: 'SPLIT_BAR',
        payload: { barId: bar.id, splits }
      });
    }
  }

  private handleBarDrag(deltaX: number, deltaY: number): void {
    this.stateManager.batch(() => {
      const selectedBars = this.getSelectedBars();
      selectedBars.forEach(bar => {
        this.stateManager.dispatch({
          type: 'MODIFY_BAR',
          payload: {
            id: bar.id,
            changes: {
              x: bar.x + deltaX,
              y: bar.y + deltaY
            }
          }
        });
      });
    });
  }

  private handleBarJoin(bar1: FractionBar, bar2: FractionBar): void {
    if (this.canBarsJoin(bar1, bar2)) {
      const joinedBar = this.createJoinedBar(bar1, bar2);
      this.stateManager.dispatch({
        type: 'JOIN_BARS',
        payload: {
          sourceIds: [bar1.id, bar2.id],
          resultBar: joinedBar
        }
      });
    }
  }

  private handleStateChange(state: AppState): void {
    // Update rendering
    this.renderer.update(state.bars);

    // Update accessibility
    state.bars.forEach(bar => {
      this.accessibility.updateBarAria(bar);
    });

    // Update status bar
    this.updateStatusBar(state);

    // Update toolbar state
    this.updateToolbarState(state);
  }

  private handleToolClick(toolId: string): void {
    switch (toolId) {
      case 'undo':
        this.stateManager.undo();
        break;
      case 'redo':
        this.stateManager.redo();
        break;
      case 'export':
        this.showExportDialog();
        break;
      case 'print':
        this.exporter.print();
        break;
      default:
        this.setTool(toolId);
    }
  }

  // Utility Methods
  private findBarAt(x: number, y: number): FractionBar | null {
    const state = this.stateManager.getState();
    return state.bars.find(bar => 
      x >= bar.x && x <= bar.x + bar.width &&
      y >= bar.y && y <= bar.y + bar.height
    ) || null;
  }

  private getSelectedBars(): FractionBar[] {
    const state = this.stateManager.getState();
    return state.bars.filter(bar => bar.isSelected);
  }

  private calculateSplits(bar: FractionBar, x: number, y: number, isVertical: boolean): SplitState[] {
    // Calculate split positions based on click coordinates
    const relativeX = x - bar.x;
    const relativeY = y - bar.y;
    
    if (isVertical) {
      const ratio = relativeX / bar.width;
      return [
        { x: 0, y: 0, width: relativeX, height: bar.height, color: bar.color },
        { x: relativeX, y: 0, width: bar.width - relativeX, height: bar.height, color: bar.color }
      ];
    } else {
      return [
        { x: 0, y: 0, width: bar.width, height: relativeY, color: bar.color },
        { x: 0, y: relativeY, width: bar.width, height: bar.height - relativeY, color: bar.color }
      ];
    }
  }

  private canBarsJoin(bar1: FractionBar, bar2: FractionBar): boolean {
    // Check if bars are adjacent and have matching dimensions
    const gap = 5; // Maximum gap allowed for joining
    const dimensionsMatch = bar1.width === bar2.width || bar1.height === bar2.height;
    
    const adjacent = (
      Math.abs(bar1.x + bar1.width - bar2.x) < gap ||
      Math.abs(bar2.x + bar2.width - bar1.x) < gap ||
      Math.abs(bar1.y + bar1.height - bar2.y) < gap ||
      Math.abs(bar2.y + bar2.height - bar1.y) < gap
    );

    return dimensionsMatch && adjacent;
  }

  private createJoinedBar(bar1: FractionBar, bar2: FractionBar): FractionBar {
    // Create a new bar that represents the joined bars
    const x = Math.min(bar1.x, bar2.x);
    const y = Math.min(bar1.y, bar2.y);
    const width = Math.max(bar1.x + bar1.width, bar2.x + bar2.width) - x;
    const height = Math.max(bar1.y + bar1.height, bar2.y + bar2.height) - y;

    return {
      id: this.generateId(),
      x,
      y,
      width,
      height,
      color: bar1.color,
      isSelected: true,
      isUnitBar: false,
      splits: []
    };
  }

  // Public API
  public setTool(tool: string): void {
    this.stateManager.dispatch({
      type: 'CHANGE_TOOL',
      payload: { tool }
    });
  }

  public exportToFormat(format: 'svg' | 'png' | 'pdf'): void {
    this.exporter.export(format);
  }

  public destroy(): void {
    this.stateManager.destroy();
    this.touchManager.destroy();
    this.accessibility.destroy();
  }

  // Helper methods
  private generateId(): string {
    return `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage example:
document.addEventListener('DOMContentLoaded', () => {
  const app = new ModernFractionBarsApp('fraction-bars-container');
  
  // Optional: Add to window for debugging
  (window as any).fractionBarsApp = app;
});
