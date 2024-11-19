// Core touch interaction system for Fraction Bars
import { Point } from './Point';

interface TouchPoint {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

interface GestureState {
  isActive: boolean;
  startDistance?: number;
  startAngle?: number;
  scale: number;
  rotation: number;
}

export class TouchInteractionManager {
  private element: HTMLElement;
  private activeTouches: Map<number, TouchPoint>;
  private gestureState: GestureState;
  
  // Configuration
  private readonly LONG_PRESS_THRESHOLD = 500; // ms
  private readonly DRAG_THRESHOLD = 10; // pixels
  private readonly SPLIT_GESTURE_THRESHOLD = 50; // pixels
  
  // Callbacks
  private onBarSelect?: (x: number, y: number) => void;
  private onBarSplit?: (x: number, y: number, isVertical: boolean) => void;
  private onBarJoin?: (bar1: any, bar2: any) => void;
  private onBarDrag?: (deltaX: number, deltaY: number) => void;

  constructor(element: HTMLElement) {
    this.element = element;
    this.activeTouches = new Map();
    this.gestureState = {
      isActive: false,
      scale: 1,
      rotation: 0
    };
    
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.element.addEventListener('touchcancel', this.handleTouchEnd.bind(this));

    // Mouse events for backward compatibility
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault(); // Prevent scrolling while interacting with the fraction bars

    // Store each new touch point
    Array.from(event.changedTouches).forEach(touch => {
      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now()
      });
    });

    // Initialize gesture detection if we have multiple touches
    if (this.activeTouches.size === 2) {
      this.initializeMultiTouchGesture();
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();

    // Update positions for all changed touches
    Array.from(event.changedTouches).forEach(touch => {
      const activeTouch = this.activeTouches.get(touch.identifier);
      if (activeTouch) {
        activeTouch.currentX = touch.clientX;
        activeTouch.currentY = touch.clientY;
      }
    });

    // Handle different gestures based on touch count
    if (this.activeTouches.size === 1) {
      this.handleSingleTouchMove();
    } else if (this.activeTouches.size === 2) {
      this.handleMultiTouchMove();
    }
  }

  private handleSingleTouchMove(): void {
    const touch = Array.from(this.activeTouches.values())[0];
    const deltaX = touch.currentX - touch.startX;
    const deltaY = touch.currentY - touch.startY;

    // Determine if this is a drag or split gesture
    if (Math.abs(deltaX) > this.DRAG_THRESHOLD || Math.abs(deltaY) > this.DRAG_THRESHOLD) {
      // Check if it's a vertical or horizontal movement
      if (Math.abs(deltaY) / Math.abs(deltaX) > 2) {
        // Vertical split gesture
        this.onBarSplit?.(touch.currentX, touch.currentY, true);
      } else if (Math.abs(deltaX) / Math.abs(deltaY) > 2) {
        // Horizontal split gesture
        this.onBarSplit?.(touch.currentX, touch.currentY, false);
      } else {
        // Regular drag
        this.onBarDrag?.(deltaX, deltaY);
      }
    }
  }

  private handleMultiTouchMove(): void {
    const touches = Array.from(this.activeTouches.values());
    const currentDistance = this.getDistanceBetweenPoints(
      touches[0].currentX, touches[0].currentY,
      touches[1].currentX, touches[1].currentY
    );
    
    if (this.gestureState.startDistance) {
      // Calculate new scale based on pinch gesture
      const newScale = currentDistance / this.gestureState.startDistance;
      this.gestureState.scale = Math.max(0.5, Math.min(2, newScale));

      // Calculate rotation if needed
      const currentAngle = this.getAngleBetweenPoints(
        touches[0].currentX, touches[0].currentY,
        touches[1].currentX, touches[1].currentY
      );
      
      if (this.gestureState.startAngle !== undefined) {
        this.gestureState.rotation = currentAngle - this.gestureState.startAngle;
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    // Remove ended touches
    Array.from(event.changedTouches).forEach(touch => {
      const activeTouch = this.activeTouches.get(touch.identifier);
      if (activeTouch) {
        // Check for tap (quick touch with minimal movement)
        const duration = Date.now() - activeTouch.startTime;
        const distance = Math.sqrt(
          Math.pow(activeTouch.currentX - activeTouch.startX, 2) +
          Math.pow(activeTouch.currentY - activeTouch.startY, 2)
        );

        if (duration < 300 && distance < 10) {
          this.onBarSelect?.(touch.clientX, touch.clientY);
        }

        this.activeTouches.delete(touch.identifier);
      }
    });

    // Reset gesture state if no touches remain
    if (this.activeTouches.size === 0) {
      this.gestureState.isActive = false;
    }
  }

  // Mouse event handlers for backward compatibility
  private handleMouseDown(event: MouseEvent): void {
    if (this.activeTouches.size > 0) return; // Ignore if touch interaction is active
    
    this.activeTouches.set(-1, {
      id: -1,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startTime: Date.now()
    });
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.activeTouches.size === 0) return;
    
    const touch = this.activeTouches.get(-1);
    if (touch) {
      touch.currentX = event.clientX;
      touch.currentY = event.clientY;
      this.handleSingleTouchMove();
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.activeTouches.has(-1)) {
      const touch = this.activeTouches.get(-1)!;
      const duration = Date.now() - touch.startTime;
      const distance = Math.sqrt(
        Math.pow(event.clientX - touch.startX, 2) +
        Math.pow(event.clientY - touch.startY, 2)
      );

      if (duration < 300 && distance < 10) {
        this.onBarSelect?.(event.clientX, event.clientY);
      }

      this.activeTouches.delete(-1);
    }
  }

  // Utility methods
  private getDistanceBetweenPoints(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  private getAngleBetweenPoints(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  private initializeMultiTouchGesture(): void {
    const touches = Array.from(this.activeTouches.values());
    this.gestureState = {
      isActive: true,
      startDistance: this.getDistanceBetweenPoints(
        touches[0].currentX, touches[0].currentY,
        touches[1].currentX, touches[1].currentY
      ),
      startAngle: this.getAngleBetweenPoints(
        touches[0].currentX, touches[0].currentY,
        touches[1].currentX, touches[1].currentY
      ),
      scale: 1,
      rotation: 0
    };
  }

  // Public methods for setting up callbacks
  public setCallbacks({
    onSelect,
    onSplit,
    onJoin,
    onDrag
  }: {
    onSelect?: (x: number, y: number) => void;
    onSplit?: (x: number, y: number, isVertical: boolean) => void;
    onJoin?: (bar1: any, bar2: any) => void;
    onDrag?: (deltaX: number, deltaY: number) => void;
  }): void {
    this.onBarSelect = onSelect;
    this.onBarSplit = onSplit;
    this.onBarJoin = onJoin;
    this.onBarDrag = onDrag;
  }
}
