/**
 * Comprehensive accessibility system for Fraction Bars
 */
export class AccessibilityManager {
  private container: HTMLElement;
  private liveRegion: HTMLDivElement;
  private keyboardManager: KeyboardNavigationManager;
  private currentFocus: string | null = null;
  
  constructor(container: HTMLElement, stateManager: StateManager) {
    this.container = container;
    this.liveRegion = this.createLiveRegion();
    this.keyboardManager = new KeyboardNavigationManager(stateManager);
    this.setupAccessibility();
  }

  private setupAccessibility(): void {
    this.setupContainerAttributes();
    this.setupKeyboardNavigation();
    this.setupScreenReaderAnnouncements();
    this.setupHighContrast();
    this.setupReducedMotion();
  }

  private createLiveRegion(): HTMLDivElement {
    const region = document.createElement('div');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
    return region;
  }

  private setupContainerAttributes(): void {
    this.container.setAttribute('role', 'application');
    this.container.setAttribute('aria-label', 'Fraction Bars Workspace');
    this.container.setAttribute('tabindex', '0');
    
    // Add instructions for screen reader users
    const instructions = document.createElement('div');
    instructions.className = 'sr-only';
    instructions.textContent = 'Use arrow keys to navigate between bars. ' +
      'Press Space to select a bar. ' +
      'Press Enter to activate the current tool.';
    this.container.appendChild(instructions);
  }

  /**
   * Announce changes to screen readers
   */
  public announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;
    
    // Clear after a delay to ensure unique announcements
    setTimeout(() => {
      this.liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Handle fraction bar updates
   */
  public updateBarAria(bar: FractionBar): void {
    const barElement = document.getElementById(bar.id);
    if (!barElement) return;

    const description = this.createBarDescription(bar);
    barElement.setAttribute('role', 'graphics-symbol');
    barElement.setAttribute('aria-label', description);
    barElement.setAttribute('aria-selected', bar.isSelected.toString());
    
    if (bar.isUnitBar) {
      barElement.setAttribute('aria-description', 'Unit bar - other bars are measured relative to this bar');
    }
  }

  /**
   * Create descriptive text for a bar
   */
  private createBarDescription(bar: FractionBar): string {
    let description = bar.label || 'Fraction bar';
    
    if (bar.fraction) {
      description += `, value ${bar.fraction}`;
    }

    if (bar.splits.length > 0) {
      description += `, split into ${bar.splits.length} parts`;
    }

    return description;
  }
}

/**
 * Keyboard navigation system
 */
class KeyboardNavigationManager {
  private stateManager: StateManager;
  private focusedBarIndex: number = -1;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.setupKeyboardHandlers();
  }

  private setupKeyboardHandlers(): void {
    document.addEventListener('keydown', (e) => {
      if (!this.shouldHandleKeyboard(e)) return;

      switch (e.key) {
        case 'ArrowRight':
          this.moveFocus('next');
          break;
        case 'ArrowLeft':
          this.moveFocus('previous');
          break;
        case 'Home':
          this.moveFocus('first');
          break;
        case 'End':
          this.moveFocus('last');
          break;
        case ' ': // Space
          this.toggleSelection();
          e.preventDefault();
          break;
        case 'Enter':
          this.activateCurrentTool();
          e.preventDefault();
          break;
        case 'Delete':
        case 'Backspace':
          this.deleteSelectedBars();
          e.preventDefault();
          break;
      }
    });
  }

  private shouldHandleKeyboard(e: KeyboardEvent): boolean {
    // Don't handle if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return false;
    }
    return true;
  }

  private moveFocus(direction: 'next' | 'previous' | 'first' | 'last'): void {
    const bars = this.stateManager.getState().bars;
    if (bars.length === 0) return;

    switch (direction) {
      case 'next':
        this.focusedBarIndex = Math.min(this.focusedBarIndex + 1, bars.length - 1);
        break;
      case 'previous':
        this.focusedBarIndex = Math.max(this.focusedBarIndex - 1, 0);
        break;
      case 'first':
        this.focusedBarIndex = 0;
        break;
      case 'last':
        this.focusedBarIndex = bars.length - 1;
        break;
    }

    const bar = bars[this.focusedBarIndex];
    this.focusBar(bar);
  }

  private focusBar(bar: FractionBar): void {
    const element = document.getElementById(bar.id);
    if (element) {
      element.focus();
      this.announceBar(bar);
    }
  }

  private announceBar(bar: FractionBar): void {
    const description = `${bar.isSelected ? 'Selected ' : ''}${bar.label || 'Fraction bar'}`;
    const value = bar.fraction ? `, value ${bar.fraction}` : '';
    const position = `, ${this.focusedBarIndex + 1} of ${this.stateManager.getState().bars.length}`;
    
    this.announce(`${description}${value}${position}`);
  }

  private announce(message: string): void {
    const liveRegion = document.querySelector('[role="status"]');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  private toggleSelection(): void {
    const bars = this.stateManager.getState().bars;
    if (this.focusedBarIndex >= 0 && this.focusedBarIndex < bars.length) {
      const bar = bars[this.focusedBarIndex];
      this.stateManager.dispatch({
        type: 'MODIFY_BAR',
        payload: {
          id: bar.id,
          changes: { isSelected: !bar.isSelected }
        }
      });
    }
  }

  private activateCurrentTool(): void {
    const state = this.stateManager.getState();
    const tool = state.currentTool;
    const bar = state.bars[this.focusedBarIndex];
    
    if (!bar) return;

    switch (tool) {
      case 'split':
        this.announceTool('Splitting bar');
        // Trigger split dialog
        break;
      case 'join':
        this.announceTool('Joining bars');
        // Trigger join operation
        break;
      case 'measure':
        this.announceTool('Measuring bar');
        // Trigger measure operation
        break;
    }
  }

  private announceTool(action: string): void {
    this.announce(`${action}. Use arrow keys to adjust, Enter to confirm, Escape to cancel.`);
  }
}

/**
 * High contrast mode support
 */
class HighContrastMode {
  private enabled: boolean = false;

  constructor() {
    this.detectPreference();
    this.setupMediaQueryListener();
  }

  private detectPreference(): void {
    const query = window.matchMedia('(prefers-contrast: more)');
    this.enabled = query.matches;
    this.applyHighContrast();
  }

  private setupMediaQueryListener(): void {
    const query = window.matchMedia('(prefers-contrast: more)');
    query.addEventListener('change', (e) => {
      this.enabled = e.matches;
      this.applyHighContrast();
    });
  }

  private applyHighContrast(): void {
    document.documentElement.classList.toggle('high-contrast', this.enabled);
  }

  public getContrastColor(color: string): string {
    if (!this.enabled) return color;
    
    // Convert to grayscale if high contrast is enabled
    const rgb = this.parseColor(color);
    const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    return luminance > 128 ? '#000000' : '#FFFFFF';
  }

  private parseColor(color: string): { r: number, g: number, b: number } {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = color;
    return {
      r: parseInt(ctx.fillStyle.slice(1, 3), 16),
      g: parseInt(ctx.fillStyle.slice(3, 5), 16),
      b: parseInt(ctx.fillStyle.slice(5, 7), 16)
    };
  }
}

/**
 * Integration with main application
 */
export class AccessibleFractionBars {
  private stateManager: StateManager;
  private renderer: SVGRenderer;
  private accessibility: AccessibilityManager;
  private highContrast: HighContrastMode;

  constructor(container: HTMLElement) {
    this.stateManager = new StateManager();
    this.renderer = new SVGRenderer(container);
    this.accessibility = new AccessibilityManager(container, this.stateManager);
    this.highContrast = new HighContrastMode();

    this.setupIntegration();
  }

  private setupIntegration(): void {
    // Subscribe to state changes
    this.stateManager.subscribe((state) => {
      // Update visual rendering
      this.renderer.update(state.bars);

      // Update accessibility info
      state.bars.forEach(bar => {
        this.accessibility.updateBarAria(bar);
      });
    });

    // Handle tool changes
    this.stateManager.subscribe((state) => {
      const tool = state.currentTool;
      this.accessibility.announce(`Selected tool: ${tool}`);
    });
  }

  public addBar(bar: FractionBar): void {
    this.stateManager.dispatch({
      type: 'ADD_BAR',
      payload: bar
    });
    this.accessibility.announce(`Added new fraction bar${bar.label ? ` labeled ${bar.label}` : ''}`);
  }

  public splitBar(barId: string, splits: number): void {
    this.stateManager.dispatch({
      type: 'SPLIT_BAR',
      payload: { barId, splits }
    });
    this.accessibility.announce(`Split bar into ${splits} parts`);
  }
}
