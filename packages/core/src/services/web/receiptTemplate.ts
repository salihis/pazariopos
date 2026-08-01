// packages/core/src/services/web/receiptTemplate.ts
// ─────────────────────────────────────────────────────────────
// Generates a self-contained HTML receipt page for browser printing.
// No external dependencies — pure string interpolation so it works
// in a detached window.open() context with no bundler.
// ─────────────────────────────────────────────────────────────

import type { Sale } from '../../types/domain'

function formatCurrency(amount: number): string {
  return (amount / 100).toFixed(2)   // stored as integer cents/kuruş
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function buildReceiptHTML(sale: Sale): string {
  const linesHTML = sale.lines.map(line => `
    <tr>
      <td>${line.product.name}</td>
      <td style="text-align:right">${line.quantity}</td>
      <td style="text-align:right">${formatCurrency(line.unitPrice)}</td>
      <td style="text-align:right">${formatCurrency(line.total)}</td>
    </tr>`).join('')

  const paymentsHTML = sale.payments.map(p => `
    <tr>
      <td>${p.method.toUpperCase()}</td>
      <td style="text-align:right">${formatCurrency(p.amount)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Fiş #${sale.localId.slice(0, 8)}</title>
  <style>
    /* ── Reset ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* ── Receipt layout (58mm / 80mm thermal roll) ── */
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      width: 72mm;                /* fits both 58mm and 80mm rolls */
      margin: 0 auto;
      padding: 4mm;
      color: #000;
      background: #fff;
    }

    h1  { font-size: 12pt; text-align: center; margin-bottom: 4mm; }
    .meta { font-size: 8pt; margin-bottom: 3mm; }
    hr  { border: none; border-top: 1px dashed #000; margin: 2mm 0; }

    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5mm 0; font-size: 9pt; }
    th { border-bottom: 1px solid #000; }

    .totals td { font-size: 10pt; }
    .totals .grand { font-weight: bold; font-size: 12pt; }

    .footer { text-align: center; font-size: 8pt; margin-top: 4mm; }

    /* ── Print-only rules ── */
    @media print {
      html, body { width: 72mm; }
      @page { margin: 0; size: 72mm auto; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>SATIŞ FİŞİ</h1>

  <div class="meta">
    <div>Tarih : ${formatDate(sale.createdAt)}</div>
    <div>Satış : ${sale.localId.slice(0, 8).toUpperCase()}</div>
    <div>Kasa  : ${sale.registerId}</div>
    ${sale.customerId ? `<div>Müşteri: ${sale.customerId}</div>` : ''}
  </div>

  <hr/>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Ürün</th>
        <th style="text-align:right">Adet</th>
        <th style="text-align:right">Fiyat</th>
        <th style="text-align:right">Toplam</th>
      </tr>
    </thead>
    <tbody>${linesHTML}</tbody>
  </table>

  <hr/>

  <table class="totals">
    <tr><td>Ara Toplam</td><td style="text-align:right">${formatCurrency(sale.subtotal)}</td></tr>
    <tr><td>İndirim</td><td style="text-align:right">-${formatCurrency(sale.discountTotal)}</td></tr>
    <tr><td>KDV</td><td style="text-align:right">${formatCurrency(sale.taxTotal)}</td></tr>
    <tr class="grand"><td>TOPLAM</td><td style="text-align:right">${formatCurrency(sale.grandTotal)}</td></tr>
  </table>

  <hr/>

  <table>
    <thead><tr><th style="text-align:left">Ödeme</th><th style="text-align:right">Tutar</th></tr></thead>
    <tbody>${paymentsHTML}</tbody>
  </table>

  ${sale.changeGiven > 0 ? `<p style="text-align:right;margin-top:1mm">Para Üstü: ${formatCurrency(sale.changeGiven)}</p>` : ''}

  <hr/>
  <div class="footer">
    <p>Bizi tercih ettiğiniz için teşekkür ederiz!</p>
    <p style="margin-top:2mm;font-size:7pt">Yazdırıldı ${new Date().toLocaleString('tr-TR')}</p>
  </div>

  <!-- Auto-print and close when opened via window.open() -->
  <script>
    window.onload = function() {
      window.print();
      // Give the print dialog time to open before closing the tab
      setTimeout(function() { window.close(); }, 1000);
    };
  </script>
</body>
</html>`
}

export function buildReportHTML(title: string, rows: Record<string, unknown>[]): string {
  const firstRow = rows[0]
  if (!firstRow) return `<html><body><h2>${title}</h2><p>Veri yok.</p></body></html>`

  const headers = Object.keys(firstRow)
  const headerHTML = headers.map(h => `<th>${h}</th>`).join('')
  const rowsHTML = rows.map(row =>
    `<tr>${headers.map(h => `<td>${String(row[h] ?? '')}</td>`).join('')}</tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; margin: 10mm; }
    h2   { margin-bottom: 4mm; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 2mm 3mm; text-align: left; }
    th { background: #f0f0f0; }
    @media print { @page { margin: 10mm; } }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p style="font-size:8pt;margin-bottom:3mm">Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
  <table>
    <thead><tr>${headerHTML}</tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <script>
    window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 1000); };
  </script>
</body>
</html>`
}
