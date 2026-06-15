import PDFDocument from 'pdfkit';

interface InvoicePdfData {
  id: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  description: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  paymentSchedule: string;
  retainerLabel?: string;
  status: string;
  stripePaymentLink?: string;
  createdAt: string;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks as any)));
    doc.on('error', reject);

    // ── Header ──
    doc.fontSize(26).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`# ${data.id.slice(0, 8).toUpperCase()}`, { align: 'right' })
      .text(`Date: ${data.createdAt?.slice(0, 10) || '—'}`, { align: 'right' })
      .text(`Status: ${data.status.toUpperCase()}`, { align: 'right' });

    doc.moveDown(1.5);

    // ── Studio info ──
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('StudioSage', { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text('Photography Studio Management')
      .text('AI-powered assistant for photographers');

    doc.moveDown(1);

    // ── Client info ──
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Bill To:');
    doc.fontSize(10).font('Helvetica').fillColor('#333')
      .text(data.clientName)
      .text(data.clientEmail);

    doc.moveDown(1.5);

    // ── Line items table ──
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 300;
    const col3 = 400;
    const col4 = 500;

    // Table header
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff');
    doc.rect(col1 - 5, tableTop - 3, 510, 18).fill('#333');
    doc.fillColor('#fff')
      .text('Description', col1, tableTop)
      .text('Qty', col2, tableTop)
      .text('Unit Price', col3, tableTop)
      .text('Amount', col4, tableTop);

    // Table rows
    let y = tableTop + 22;
    let total = 0;
    doc.font('Helvetica').fontSize(9).fillColor('#333');

    for (const item of data.items) {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;
      doc.text(item.description, col1, y, { width: 240 });
      doc.text(String(item.quantity), col2, y);
      doc.text(`$${item.unitPrice.toLocaleString()}`, col3, y);
      doc.text(`$${lineTotal.toLocaleString()}`, col4, y);
      y += 18;
      // Draw line separator
      doc.moveTo(col1 - 5, y - 6).lineTo(col4 + 55, y - 6).stroke('#e5e5e7');
    }

    // Total line
    y += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
    doc.text('Total', col1, y);
    doc.text(`$${total.toLocaleString()} ${data.currency}`, col4, y);

    // ── Payment schedule ──
    y += 30;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Payment Schedule', col1, y);
    y += 16;
    doc.fontSize(10).font('Helvetica').fillColor('#333');
    const scheduleLabel = data.paymentSchedule === 'three-phase'
      ? `50% retainer upon booking, 25% on shoot day, 25% before delivery`
      : 'Full payment due upon receipt';
    doc.text(scheduleLabel, col1, y);

    if (data.retainerLabel) {
      y += 16;
      const retainer = total * 0.5;
      doc.text(`${data.retainerLabel} (retainer): $${retainer.toLocaleString()}`, col1, y);
    }

    // ── Payment link ──
    if (data.stripePaymentLink) {
      y += 30;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Pay Online:', col1, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#007AFF').text(data.stripePaymentLink, col1, y);
    }

    // ── Footer ──
    doc.fontSize(8).font('Helvetica').fillColor('#999')
      .text('Thank you for choosing StudioSage.', 50, doc.page.height - 60, { align: 'center' })
      .text('studio sage — AI photography studio assistant', { align: 'center' });

    doc.end();
  });
}
