import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuoteSummary } from '@shared/models/quote.model';
import { formatCurrency } from '../utils/text-utils';
import { CONTACT_CONFIG } from '../data/contact.config';

@Injectable({ providedIn: 'root' })
export class PdfService {
  // Corporate palette (Verde Naturaleza y Gris Elegante)
  private readonly COLOR_PRIMARIO = '#1b9b4d'; // Vibrant green
  private readonly COLOR_SECUNDARIO = '#115e2e'; // Dark green for contrasts
  private readonly COLOR_TEXTO = '#333333'; // Dark gray for readability
  private readonly COLOR_MUTED = '#777777'; // Light gray for secondary data
  private readonly COLOR_DIVISOR = '#E0E0E0'; // Light divider line

  /**
   * Generates a PDF quote from the given summary and returns a Blob.
   */
  async generateQuotePdf(
    summary: QuoteSummary,
    logoUrl: string = 'assets/img/Logo_Aak_para-App-01.png',
    contactInfo: {
      phone?: string;
      email?: string;
      whatsapp?: string;
    } = {}
  ): Promise<Blob> {
    // US Letter size in millimeters (215.9 x 279.4 mm)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // --- Logo (optional) ---
    let logoBase64: string | null = null;
    try {
      logoBase64 = await this.imageToBase64(logoUrl);
    } catch {
      // Logo is optional; continue without it
    }

    // --- Letterhead (header + footer), drawn once. Pagination is NOT included yet. ---
    this.drawLetterhead(pdf, pageWidth, pageHeight, logoBase64, contactInfo);

    // --- Date / distance info line below the letterhead divider ---
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(this.COLOR_MUTED);
    pdf.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 20, 61);
    if (summary.distanceKm > 0) {
      pdf.text(`Distancia de envio: ${summary.distanceKm} km`, pageWidth - 20, 61, {
        align: 'right',
      });
    }

    // --- Items Table ---
    const tableBody = summary.items.map((item, index) => [
      index + 1,
      item.productName,
      item.selectedVariants
        .map(v => `${v.variantLabel}: ${v.optionName}`)
        .join(', ') || '-',
      item.qty,
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotal),
    ]);

    autoTable(pdf, {
      startY: 65,
      margin: { top: 65, bottom: 35, left: 20, right: 20 },
      head: [['#', 'Producto', 'Variantes', 'Cant.', 'Precio Unit.', 'Subtotal']],
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: this.COLOR_PRIMARIO,
        textColor: '#FFFFFF',
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 8, textColor: this.COLOR_TEXTO },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 48 },
        2: { cellWidth: 45 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 29.9, halign: 'right' },
      },
    });

    // --- Summary Section ---
    const posXTotal = pageWidth - 80;
    const posXValue = pageWidth - 20;
    let lineY = (pdf as any).lastAutoTable.finalY + 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(this.COLOR_TEXTO);

    const summaryLines = [
      { label: 'Subtotal:', value: formatCurrency(summary.subtotal) },
      { label: 'IVA (16%):', value: formatCurrency(summary.iva) },
      { label: 'Costo de envio:', value: formatCurrency(summary.totalShipping) },
    ];

    for (const line of summaryLines) {
      pdf.text(line.label, posXTotal, lineY);
      pdf.text(line.value, posXValue, lineY, { align: 'right' });
      lineY += 7;
    }

    // Divider line above grand total
    pdf.setDrawColor(this.COLOR_DIVISOR);
    pdf.setLineWidth(0.5);
    pdf.line(posXTotal, lineY - 1, posXValue, lineY - 1);

    // Grand total
    lineY += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(this.COLOR_SECUNDARIO);
    pdf.text('TOTAL:', posXTotal, lineY);
    pdf.text(formatCurrency(summary.grandTotal), posXValue, lineY, { align: 'right' });

    // --- Products to quote (no price yet) ---
    if (summary.unpricedItems.length > 0) {
      const start = lineY + 10;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(this.COLOR_PRIMARIO);
      pdf.text('Productos por Cotizar', 20, start);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(this.COLOR_MUTED);
      pdf.text(
        'Los siguientes productos no tienen precio aun y quedan registrados para cotizacion futura.',
        20,
        start + 5
      );

      const unpricedBody = summary.unpricedItems.map((item, index) => [
        index + 1,
        item.productName,
        item.selectedVariants
          .map(v => `${v.variantLabel}: ${v.optionName}`)
          .join(', ') || '-',
        item.qty,
      ]);

      autoTable(pdf, {
        startY: start + 9,
        margin: { top: 65, bottom: 35, left: 20, right: 20 },
        head: [['#', 'Producto', 'Variantes', 'Cant.']],
        body: unpricedBody,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_PRIMARIO,
          textColor: '#FFFFFF',
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8, textColor: this.COLOR_TEXTO },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 80 },
          2: { cellWidth: 70 },
          3: { cellWidth: 15, halign: 'center' },
        },
      });

      lineY = (pdf as any).lastAutoTable.finalY + 10;
    }

    // --- Terms ---
    lineY += 15;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(this.COLOR_TEXTO);
    pdf.text('Terminos y Condiciones', 20, lineY);
    lineY += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(this.COLOR_MUTED);
    const terms = [
      'Los precios mostrados son en Pesos Mexicanos (MXN) e incluyen IVA.',
      'El costo de envio es una estimacion basada en la distancia y categoria del producto.',
      'Esta cotizacion tiene una validez de 15 dias habiles.',
      'Para confirmar su pedido, contactenos por los medios indicados.',
    ];
    for (const term of terms) {
      pdf.text(term, 20, lineY);
      lineY += 4;
    }

    return pdf.output('blob');
  }

  /**
   * Draws the letterhead (header + footer) once on a single page.
   * Pagination is intentionally NOT implemented at this stage.
   */
  private drawLetterhead(
    pdf: jsPDF,
    pageWidth: number,
    pageHeight: number,
    logoBase64: string | null,
    contactInfo: { phone?: string; email?: string; whatsapp?: string }
  ): void {
    // ----------------------------------------------------
    // HEADER (top green block)
    // ----------------------------------------------------
    // Full-width top rectangle
    pdf.setFillColor(this.COLOR_PRIMARIO);
    pdf.rect(0, 0, pageWidth, 25, 'F');

    // Decorative triangle (organic style)
    pdf.setFillColor(this.COLOR_SECUNDARIO);
    pdf.triangle(0, 25, pageWidth, 25, 0, 35, 'F');

    // White circle for the logo
    pdf.setFillColor('#FFFFFF');
    pdf.circle(30, 25, 14, 'F');

    // Aak logo inside the white circle (keep the source image aspect ratio)
    if (logoBase64) {
      try {
        const logoWidth = 22;
        const logoHeight = logoWidth * (23.4 / 45);
        pdf.addImage(
          logoBase64,
          'PNG',
          30 - logoWidth / 2,
          25 - logoHeight / 2,
          logoWidth,
          logoHeight
        );
      } catch {
        // Logo is optional; continue without it
      }
    }

    // Contact strip (right-aligned in the header)
    pdf.setTextColor('#FFFFFF');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const phone = contactInfo.phone || CONTACT_CONFIG.phone;
    const email = contactInfo.email || CONTACT_CONFIG.email;
    const whatsapp = contactInfo.whatsapp || CONTACT_CONFIG.whatsapp.number;
    pdf.text(`Tel: ${phone}`, pageWidth - 20, 8, { align: 'right' });
    pdf.text(`Email: ${email}`, pageWidth - 20, 13, { align: 'right' });
    pdf.text(`WhatsApp: ${whatsapp}`, pageWidth - 20, 18, { align: 'right' });

    // Document title (sub-header)
    pdf.setTextColor(this.COLOR_PRIMARIO);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('COTIZACION', 20, 52);

    // Thin decorative gray line
    pdf.setDrawColor(this.COLOR_DIVISOR);
    pdf.setLineWidth(0.5);
    pdf.line(20, 56, pageWidth - 20, 56);

    // ----------------------------------------------------
    // FOOTER (bottom curves)
    // ----------------------------------------------------
    // Bottom green block
    pdf.setFillColor(this.COLOR_PRIMARIO);
    pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');

    // Decorative wave triangle
    pdf.setFillColor(this.COLOR_SECUNDARIO);
    pdf.triangle(
      pageWidth,
      pageHeight - 15,
      pageWidth,
      pageHeight - 22,
      pageWidth - 80,
      pageHeight - 15,
      'F'
    );

    // Footer text
    pdf.setTextColor('#FFFFFF');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Gracias por elegir Aak Artesanias.', 20, pageHeight - 6);
    pdf.text('Pagina 1', pageWidth - 20, pageHeight - 6, { align: 'right' });
  }

  /**
   * Generate and trigger download of a quote PDF.
   */
  async downloadQuote(
    summary: QuoteSummary,
    filename: string = `cotizacion-aak-${Date.now()}.pdf`
  ): Promise<void> {
    const blob = await this.generateQuotePdf(summary);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Generate and open quote PDF in a new tab for preview.
   */
  async previewQuote(summary: QuoteSummary): Promise<void> {
    const blob = await this.generateQuotePdf(summary);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  private async imageToBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}
