// Modern SVG-based rendering system for Fraction Bars
export class SVGRenderer {
  private svg: SVGSVGElement;
  private barGroup: SVGGElement;
  private splitGroup: SVGGElement;
  private defs: SVGDefsElement;

  // Configuration
  private readonly ANIMATION_DURATION = 300; // ms
  private readonly DEFAULT_BAR_HEIGHT = 60;
  
  constructor(container: HTMLElement, width: number, height: number) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.setupSVG(container, width, height);
    this.initializeGroups();
    this.createGradients();
  }

  private setupSVG(container: HTMLElement, width: number, height: number): void {
    this.svg.setAttribute('width', width.toString());
    this.svg.setAttribute('height', height.toString());
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.style.touchAction = 'none'; // Prevent default touch actions
    container.appendChild(this.svg);
  }

  private initializeGroups(): void {
    // Create defs for gradients and patterns
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svg.appendChild(this.defs);

    // Create groups for different layers
    this.barGroup = this.createGroup('bar-group');
    this.splitGroup = this.createGroup('split-group');
  }

  private createGroup(id: string): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = id;
    this.svg.appendChild(group);
    return group;
  }

  private createGradients(): void {
    // Create gradient for bar highlights
    const highlightGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    highlightGradient.id = 'bar-highlight';
    highlightGradient.setAttribute('gradientTransform', 'rotate(90)');
    
    const stops = [
      { offset: '0%', color: 'rgba(255,255,255,0.2)' },
      { offset: '100%', color: 'rgba(255,255,255,0)' }
    ];

    stops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      highlightGradient.appendChild(stopEl);
    });

    this.defs.appendChild(highlightGradient);
  }

  public renderBar(bar: FractionBar, animate: boolean = false): SVGElement {
    const barElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    barElement.setAttribute('class', 'fraction-bar');
    barElement.setAttribute('data-id', bar.id);

    // Create main rectangle
    const rect = this.createBarRect(bar);
    
    // Add highlight effect
    const highlight = this.createBarHighlight(bar);
    
    // Add selection indicator if bar is selected
    if (bar.isSelected) {
      const selectionBorder = this.createSelectionBorder(bar);
      barElement.appendChild(selectionBorder);
    }

    // Add splits if any
    if (bar.splits && bar.splits.length > 0) {
      const splitsGroup = this.createSplitsGroup(bar);
      barElement.appendChild(splitsGroup);
    }

    // Add label if present
    if (bar.label) {
      const label = this.createLabel(bar);
      barElement.appendChild(label);
    }

    barElement.appendChild(rect);
    barElement.appendChild(highlight);

    if (animate) {
      this.animateBarCreation(barElement);
    }

    return barElement;
  }

  private createBarRect(bar: FractionBar): SVGRectElement {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', bar.x.toString());
    rect.setAttribute('y', bar.y.toString());
    rect.setAttribute('width', bar.width.toString());
    rect.setAttribute('height', bar.height.toString());
    rect.setAttribute('fill', bar.color);
    rect.setAttribute('rx', '2'); // Rounded corners
    rect.setAttribute('ry', '2');
    return rect;
  }

  private createBarHighlight(bar: FractionBar): SVGRectElement {
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    highlight.setAttribute('x', bar.x.toString());
    highlight.setAttribute('y', bar.y.toString());
    highlight.setAttribute('width', bar.width.toString());
    highlight.setAttribute('height', bar.height.toString());
    highlight.setAttribute('fill', 'url(#bar-highlight)');
    highlight.setAttribute('rx', '2');
    highlight.setAttribute('ry', '2');
    return highlight;
  }

  private createSelectionBorder(bar: FractionBar): SVGRectElement {
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    border.setAttribute('x', (bar.x - 2).toString());
    border.setAttribute('y', (bar.y - 2).toString());
    border.setAttribute('width', (bar.width + 4).toString());
    border.setAttribute('height', (bar.height + 4).toString());
    border.setAttribute('stroke', '#007AFF');
    border.setAttribute('stroke-width', '2');
    border.setAttribute('fill', 'none');
    border.setAttribute('rx', '3');
    border.setAttribute('ry', '3');
    return border;
  }

  private createSplitsGroup(bar: FractionBar): SVGGElement {
    const splitsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    splitsGroup.setAttribute('class', 'splits');

    bar.splits.forEach((split, index) => {
      const splitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      splitRect.setAttribute('x', (bar.x + split.x).toString());
      splitRect.setAttribute('y', (bar.y + split.y).toString());
      splitRect.setAttribute('width', split.width.toString());
      splitRect.setAttribute('height', split.height.toString());
      splitRect.setAttribute('fill', split.color);
      splitRect.setAttribute('data-split-index', index.toString());

      if (split.isSelected) {
        splitRect.setAttribute('stroke', '#007AFF');
        splitRect.setAttribute('stroke-width', '2');
      }

      splitsGroup.appendChild(splitRect);
    });

    return splitsGroup;
  }

  private createLabel(bar: FractionBar): SVGTextElement {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', (bar.x + 5).toString());
    text.setAttribute('y', (bar.y + bar.height - 5).toString());
    text.setAttribute('fill', '#000000');
    text.setAttribute('font-size', '12px');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.textContent = bar.label;
    return text;
  }

  private animateBarCreation(element: SVGElement): void {
    element.setAttribute('opacity', '0');
    element.setAttribute('transform', 'scale(0.95)');

    // Create and configure animation
    const animation = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animation.setAttribute('attributeName', 'opacity');
    animation.setAttribute('from', '0');
    animation.setAttribute('to', '1');
    animation.setAttribute('dur', `${this.ANIMATION_DURATION}ms`);
    animation.setAttribute('fill', 'freeze');
    element.appendChild(animation);

    // Scale animation
    const scaleAnimation = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    scaleAnimation.setAttribute('attributeName', 'transform');
    scaleAnimation.setAttribute('type', 'scale');
    scaleAnimation.setAttribute('from', '0.95');
    scaleAnimation.setAttribute('to', '1');
    scaleAnimation.setAttribute('dur', `${this.ANIMATION_DURATION}ms`);
    scaleAnimation.setAttribute('fill', 'freeze');
    element.appendChild(scaleAnimation);

    // Start animations
    animation.beginElement();
    scaleAnimation.beginElement();
  }

  public clear(): void {
    while (this.barGroup.firstChild) {
      this.barGroup.removeChild(this.barGroup.firstChild);
    }
    while (this.splitGroup.firstChild) {
      this.splitGroup.removeChild(this.splitGroup.firstChild);
    }
  }

  public renderSplit(split: SplitLine): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', split.x1.toString());
    line.setAttribute('y1', split.y1.toString());
    line.setAttribute('x2', split.x2.toString());
    line.setAttribute('y2', split.y2.toString());
    line.setAttribute('stroke', '#FF3333');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4,4');
    
    this.splitGroup.appendChild(line);
  }

  public update(bars: FractionBar[]): void {
    requestAnimationFrame(() => {
      this.clear();
      bars.forEach(bar => {
        const barElement = this.renderBar(bar);
        this.barGroup.appendChild(barElement);
      });
    });
  }
}

// Implementation example
export class ModernFractionBars {
  private renderer: SVGRenderer;
  private touchManager: TouchInteractionManager;
  private bars: FractionBar[] = [];

  constructor(container: HTMLElement) {
    this.renderer = new SVGRenderer(container, 800, 600);
    this.touchManager = new TouchInteractionManager(container);
    
    this.touchManager.setCallbacks({
      onSelect: this.handleBarSelect.bind(this),
      onSplit: this.handleBarSplit.bind(this),
      onDrag: this.handleBarDrag.bind(this),
      onJoin: this.handleBarJoin.bind(this)
    });
  }

  private handleBarSelect(x: number, y: number): void {
    const selectedBar = this.findBarAt(x, y);
    if (selectedBar) {
      selectedBar.isSelected = !selectedBar.isSelected;
      this.renderer.update(this.bars);
    }
  }

  private handleBarSplit(x: number, y: number, isVertical: boolean): void {
    const bar = this.findBarAt(x, y);
    if (bar) {
      const splits = this.calculateSplits(bar, x, y, isVertical);
      bar.splits = splits;
      this.renderer.update(this.bars);
    }
  }

  private findBarAt(x: number, y: number): FractionBar | undefined {
    return this.bars.find(bar => 
      x >= bar.x && x <= bar.x + bar.width &&
      y >= bar.y && y <= bar.y + bar.height
    );
  }
}
