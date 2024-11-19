// Export and print functionality for Fraction Bars
export class FractionBarsExporter {
  private renderer: SVGRenderer;
  private container: HTMLElement;

  constructor(renderer: SVGRenderer, container: HTMLElement) {
    this.renderer = renderer;
    this.container = container;
  }

  /**
   * Main export handler with format selection
   */
  public async export(format: 'svg' | 'png' | 'pdf' = 'png', options: ExportOptions = {}): Promise<void> {
    try {
      switch (format) {
        case 'svg':
          await this.exportSVG(options);
          break;
        case 'png':
          await this.exportPNG(options);
          break;
        case 'pdf':
          await this.exportPDF(options);
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export fraction bars');
    }
  }

  /**
   * Print the current fraction bars state
   */
  public async print(options: PrintOptions = {}): Promise<void> {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Failed to open print window');
      }

      // Set up print document
      const printDoc = this.createPrintDocument(options);
      printWindow.document.write(printDoc);

      // Wait for images to load before printing
      await this.waitForImages(printWindow);

      printWindow.document.close();
      printWindow.print();
      
      // Close window after print dialog closes
      setTimeout(() => printWindow.close(), 1000);
    } catch (error) {
      console.error('Print failed:', error);
      throw new Error('Failed to print fraction bars');
    }
  }

  /**
   * Export as SVG
   */
  private async exportSVG(options: ExportOptions): Promise<void> {
    const svgData = this.getSVGData(options);
    
    try {
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const handle = await window.showSaveFilePicker({
        suggestedName: 'fraction-bars.svg',
        types: [{
          description: 'SVG Image',
          accept: { 'image/svg+xml': ['.svg'] }
        }]
      });

      const writableStream = await handle.createWritable();
      await writableStream.write(blob);
      await writableStream.close();
    } catch (error) {
      if (error.name !== 'AbortError') {
        // Provide fallback for browsers that don't support File System Access API
        this.downloadFile(svgData, 'fraction-bars.svg', 'image/svg+xml');
      }
    }
  }

  /**
   * Export as PNG
   */
  private async exportPNG(options: ExportOptions): Promise<void> {
    const canvas = await this.createExportCanvas(options);
    
    try {
      const blob = await new Promise<Blob>(resolve => {
        canvas.toBlob(blob => {
          resolve(blob!);
        }, 'image/png');
      });

      const handle = await window.showSaveFilePicker({
        suggestedName: 'fraction-bars.png',
        types: [{
          description: 'PNG Image',
          accept: { 'image/png': ['.png'] }
        }]
      });

      const writableStream = await handle.createWritable();
      await writableStream.write(blob);
      await writableStream.close();
    } catch (error) {
      if (error.name !== 'AbortError') {
        canvas.toBlob(blob => {
          this.downloadFile(blob!, 'fraction-bars.png', 'image/png');
        }, 'image/png');
      }
    }
  }

  /**
   * Export as PDF
   */
  private async exportPDF(options: ExportOptions): Promise<void> {
    // Create PDF document using jsPDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'px',
      format: options.paperSize || 'a4'
    });

    // Add metadata
    pdf.setProperties({
      title: 'Fraction Bars Activity',
      subject: 'Mathematics Learning Tool',
      creator: 'Fraction Bars Application',
      author: options.author || 'Teacher'
    });

    // Convert SVG to canvas, then to image for PDF
    const canvas = await this.createExportCanvas(options);
    const imageData = canvas.toDataURL('image/jpeg', 0.95);

    // Add the image to PDF
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const aspectRatio = canvas.width / canvas.height;

    let imgWidth = pdfWidth - 40; // 20px margins
    let imgHeight = imgWidth / aspectRatio;

    // Ensure image fits on page
    if (imgHeight > pdfHeight - 40) {
      imgHeight = pdfHeight - 40;
      imgWidth = imgHeight * aspectRatio;
    }

    // Center image on page
    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;

    pdf.addImage(imageData, 'JPEG', x, y, imgWidth, imgHeight);

    // Add optional title
    if (options.title) {
      pdf.setFontSize(16);
      pdf.text(options.title, pdfWidth / 2, 20, { align: 'center' });
    }

    try {
      const blob = pdf.output('blob');
      const handle = await window.showSaveFilePicker({
        suggestedName: 'fraction-bars.pdf',
        types: [{
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] }
        }]
      });

      const writableStream = await handle.createWritable();
      await writableStream.write(blob);
      await writableStream.close();
    } catch (error) {
      if (error.name !== 'AbortError') {
        const pdfData = pdf.output('blob');
        this.downloadFile(pdfData, 'fraction-bars.pdf', 'application/pdf');
      }
    }
  }

  /**
   * Create canvas for export
   */
  private async createExportCanvas(options: ExportOptions): Promise<HTMLCanvasElement> {
    const svgData = this.getSVGData(options);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const scale = options.scale || (options.highQuality ? 2 : 1);

    // Set canvas size
    canvas.width = this.container.clientWidth * scale;
    canvas.height = this.container.clientHeight * scale;

    // Convert SVG to image
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    });

    return canvas;
  }

  /**
   * Get SVG data with applied options
   */
  private getSVGData(options: ExportOptions): string {
    const svgElement = this.renderer.getSVGElement();
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    
    // Apply export-specific styling
    if (options.theme === 'print') {
      this.applyPrintTheme(clonedSvg);
    }

    // Add metadata
    if (options.title) {
      const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleElement.textContent = options.title;
      clonedSvg.insertBefore(titleElement, clonedSvg.firstChild);
    }

    return new XMLSerializer().serializeToString(clonedSvg);
  }

  /**
   * Create print-friendly document
   */
  private createPrintDocument(options: PrintOptions): string {
    const title = options.title || 'Fraction Bars Activity';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @media print {
              @page {
                size: ${options.paperSize || 'landscape'};
                margin: 2cm;
              }
              body {
                margin: 0;
                color: #000;
                background: #fff;
              }
              .fraction-bars {
                page-break-inside: avoid;
                max-width: 100%;
                height: auto;
              }
              .header {
                margin-bottom: 2em;
              }
              .footer {
                margin-top: 2em;
                font-size: 0.8em;
                text-align: center;
                color: #666;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            ${options.subtitle ? `<h2>${options.subtitle}</h2>` : ''}
            ${options.description ? `<p>${options.description}</p>` : ''}
          </div>
          <div class="fraction-bars">
            ${this.getSVGData({ theme: 'print', ...options })}
          </div>
          ${options.showFooter ? `
            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()}</p>
              ${options.footerText ? `<p>${options.footerText}</p>` : ''}
            </div>
          ` : ''}
        </body>
      </html>
    `;
  }

  /**
   * Apply print-friendly theme to SVG
   */
  private applyPrintTheme(svg: SVGElement): void {
    // Remove unnecessary visual elements
    svg.querySelectorAll('.highlight, .animation').forEach(el => el.remove());

    // Ensure good contrast for printing
    svg.querySelectorAll('.fraction-bar').forEach(bar => {
      const color = bar.getAttribute('fill');
      if (color) {
        // Convert to grayscale if needed
        const rgb = this.parseColor(color);
        const gray = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
        bar.setAttribute('fill', `rgb(${gray}, ${gray}, ${gray})`);
      }
    });
  }

  /**
   * Utility function to parse color strings
   */
  private parseColor(color: string): { r: number, g: number, b: number } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    return {
      r: parseInt(ctx.fillStyle.slice(1, 3), 16),
      g: parseInt(ctx.fillStyle.slice(3, 5), 16),
      b: parseInt(ctx.fillStyle.slice(5, 7), 16)
    };
  }

  /**
   * Fallback download helper
   */
  private downloadFile(data: Blob | string, filename: string, type: string): void {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Wait for images to load in print window
   */
  private async waitForImages(window: Window): Promise<void> {
    const images = Array.from(window.document.images);
    if (images.length === 0) return;

    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );
  }
}

// Types
interface ExportOptions {
  scale?: number;
  highQuality?: boolean;
  theme?: 'default' | 'print';
  title?: string;
  author?: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: string;
}

interface PrintOptions {
  title?: string;
  subtitle?: string;
  description?: string;
  showFooter?: boolean;
  footerText?: string;
  paperSize?: string;
  orientation?: 'portrait' | 'landscape';
}
