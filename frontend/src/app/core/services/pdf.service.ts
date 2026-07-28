import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuoteSummary } from '@shared/models/quote.model';
import { formatCurrency } from '../utils/text-utils';

@Injectable({ providedIn: 'root' })
export class PdfService {
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
    const pdf = new jsPDF('p', 'mm', 'a4');
    let yPos = 20;

    // --- Logo ---
    try {
      const logoBase64 = await this.imageToBase64(logoUrl);
      if (logoBase64) {
        pdf.addImage(logoBase64, 'PNG', 14, yPos, 45, 10.5);
        yPos += 16;
      }
    } catch {
      // Logo is optional; continue without it
    }

    // --- Title ---
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('COTIZACION', 14, yPos);
    yPos += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, yPos);
    if (summary.distanceKm > 0) {
      pdf.text(`Distancia de envio: ${summary.distanceKm} km`, 14, yPos + 5);
    }
    yPos += 12;

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
      startY: yPos,
      head: [['#', 'Producto', 'Variantes', 'Cant.', 'Precio Unit.', 'Subtotal']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [180, 130, 70],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 50 },
        2: { cellWidth: 45 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
    });

    // --- Summary Section ---
    const finalY = (pdf as any).lastAutoTable.finalY + 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const summaryLines = [
      { label: 'Subtotal:', value: formatCurrency(summary.subtotal) },
      { label: 'IVA (16%):', value: formatCurrency(summary.iva) },
      { label: 'Costo de envio:', value: formatCurrency(summary.totalShipping) },
    ];

    let lineY = finalY;
    for (const line of summaryLines) {
      pdf.text(line.label, 120, lineY);
      pdf.text(line.value, 170, lineY, { align: 'right' });
      lineY += 7;
    }

    // Grand total
    lineY += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('TOTAL:', 120, lineY);
    pdf.text(formatCurrency(summary.grandTotal), 170, lineY, { align: 'right' });

    // --- Contact & Terms ---
    lineY += 15;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Terminos y Condiciones', 14, lineY);
    lineY += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const terms = [
      'Los precios mostrados son en Pesos Mexicanos (MXN) e incluyen IVA.',
      'El costo de envio es una estimacion basada en la distancia y categoria del producto.',
      'Esta cotizacion tiene una validez de 15 dias habiles.',
      'Para confirmar su pedido, contactenos por los medios indicados.',
    ];
    for (const term of terms) {
      pdf.text(term, 14, lineY);
      lineY += 4;
    }

    // Contact info
    lineY += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Contacto:', 14, lineY);
    lineY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    if (contactInfo.phone) pdf.text(`Tel: ${contactInfo.phone}`, 14, lineY);
    lineY += 4;
    if (contactInfo.email) pdf.text(`Email: ${contactInfo.email}`, 14, lineY);
    lineY += 4;
    if (contactInfo.whatsapp) pdf.text(`WhatsApp: ${contactInfo.whatsapp}`, 14, lineY);

    return pdf.output('blob');
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
