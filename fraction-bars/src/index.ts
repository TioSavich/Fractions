// Import components
import { AccessibilityManager } from './components/AccessibilityManager';
import { FractionBarsApp } from './components/FractionBarsApp';
import { StateManager } from './components/StateManager';
import { SVGRenderer } from './components/SVGRenderer';
import { TouchManager } from './components/TouchManager';
import { ExportManager } from './components/ExportManager';

// Import styles
import './styles/main.css';

// Export for use in HTML
export { FractionBarsApp };

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new FractionBarsApp('fraction-bars-container');
});