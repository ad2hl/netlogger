import { Radiogram, UserProfile } from '@/types';

const WORDS_PER_PAGE = 25;
const WORDS_PER_LINE = 5;

function field(value: string | undefined, fallback = ''): string {
  return value?.trim() || fallback;
}

function formatPrintDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  // dateStr from <input type="date"> is "YYYY-MM-DD"
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return dateStr;
}

function formatPrintTime(timeStr: string | undefined): string {
  if (!timeStr) return '';
  // timeStr from <input type="time"> is "HH:MM"
  return timeStr.replace(':', '');
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPreamble(r: Radiogram): string {
  return `
    <div class="section preamble-section">
      <div class="title">AMATEUR RADIO RADIOGRAM</div>
      <table class="preamble-table">
        <tr>
          <td class="preamble-cell"><span class="label">NR</span><span class="value">${esc(field(r.number))}</span></td>
          <td class="preamble-cell"><span class="label">PREC</span><span class="value">${esc(field(r.precedence))}</span></td>
          <td class="preamble-cell"><span class="label">HX</span><span class="value">${esc(field(r.handlingInstructions))}</span></td>
          <td class="preamble-cell wide"><span class="label">STA OF ORIGIN</span><span class="value">${esc(field(r.stationOfOrigin))}</span></td>
          <td class="preamble-cell"><span class="label">CHECK</span><span class="value">${esc(field(r.check))}</span></td>
        </tr>
        <tr>
          <td class="preamble-cell wide" colspan="3"><span class="label">PLACE OF ORIGIN</span><span class="value">${esc(field(r.placeOfOrigin))}</span></td>
          <td class="preamble-cell"><span class="label">TIME</span><span class="value">${esc(field(r.timeFiled))}</span></td>
          <td class="preamble-cell"><span class="label">DATE</span><span class="value">${esc(field(r.date))}</span></td>
        </tr>
      </table>
    </div>
    <div class="section address-section">
      <div class="to-label">TO:</div>
      <div class="address-lines">
        ${r.address.split('\n').filter(l => l.trim()).map(l => `<div class="address-line">${esc(l)}</div>`).join('')}
      </div>
    </div>
  `;
}

function renderWordGrid(pageWords: string[], startIndex: number): string {
  let rows = '';
  for (let line = 0; line < 5; line++) {
    let cells = '';
    for (let col = 0; col < WORDS_PER_LINE; col++) {
      const idx = line * WORDS_PER_LINE + col;
      const wordNum = startIndex + idx + 1;
      const word = pageWords[idx] || '';
      cells += `<td class="word-cell"><span class="word-num">${wordNum}</span><span class="word-val">${esc(word)}</span></td>`;
    }
    rows += `<tr>${cells}</tr>`;
  }
  return `<table class="word-table"><tbody>${rows}</tbody></table>`;
}

function renderSignature(r: Radiogram): string {
  return `
    <div class="section sig-section">
      <span class="label">SIG</span>
      <span class="sig-value">${esc(field(r.signature))}</span>
      ${r.signatureOpNote ? `<span class="sig-opnote">${esc(r.signatureOpNote)}</span>` : ''}
    </div>
  `;
}

function renderReceivedAt(r: Radiogram, profile: UserProfile | undefined): string {
  const callsign = field(profile?.callsign);
  const phone = field(profile?.phone);
  const street = field(profile?.streetAddress);
  const city = field(profile?.city);
  const state = field(profile?.state);
  const zip = field(profile?.zip);
  const date = formatPrintDate(r.receivedDate);
  const time = formatPrintTime(r.receivedTime);
  const from = field(r.receivedDestination);

  return `
    <div class="received-at">
      <div class="received-at-title">REC&apos;D AT</div>
      <table class="received-table">
        <tr>
          <td><span class="label">PHONE</span><span class="recv-value">${esc(phone)}</span></td>
          <td colspan="2"><span class="label">STREET ADDRESS</span><span class="recv-value">${esc(street)}</span></td>
        </tr>
        <tr>
          <td><span class="label">CITY</span><span class="recv-value">${esc(city)}</span></td>
          <td><span class="label">STATE</span><span class="recv-value">${esc(state)}</span></td>
          <td><span class="label">ZIP</span><span class="recv-value">${esc(zip)}</span></td>
        </tr>
        <tr>
          <td><span class="label">BY (CALL)</span><span class="recv-value">${esc(callsign)}</span></td>
          <td><span class="label">DATE</span><span class="recv-value">${esc(date)}</span></td>
          <td><span class="label">TIME</span><span class="recv-value">${esc(time)}</span></td>
        </tr>
        ${from ? `<tr><td colspan="3"><span class="label">RECEIVED FROM</span><span class="recv-value">${esc(from)}</span></td></tr>` : ''}
      </table>
    </div>
  `;
}

function getStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 0.5in; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 9pt; color: #000; background: #fff; }
    .page { width: 100%; }
    .page-break { page-break-after: always; }
    .section { margin-bottom: 6pt; }
    .title {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 2px;
      border: 2px solid #000;
      padding: 4pt;
      margin-bottom: 4pt;
    }
    .preamble-table {
      width: 100%;
      border-collapse: collapse;
    }
    .preamble-cell {
      border: 1px solid #000;
      padding: 2pt 4pt;
      vertical-align: top;
      white-space: nowrap;
    }
    .preamble-cell.wide { width: auto; }
    .label {
      display: block;
      font-size: 7pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #444;
    }
    .value {
      display: block;
      font-size: 10pt;
      font-weight: bold;
      min-height: 14pt;
    }
    .address-section {
      border: 1px solid #000;
      padding: 4pt;
      display: flex;
      gap: 8pt;
      align-items: flex-start;
    }
    .to-label { font-weight: bold; font-size: 11pt; white-space: nowrap; }
    .address-line { font-size: 10pt; min-height: 13pt; }
    .word-table {
      width: 100%;
      border-collapse: collapse;
    }
    .word-cell {
      border: 1px solid #000;
      padding: 1pt 2pt;
      width: 20%;
    }
    .word-num {
      display: block;
      font-size: 7pt;
      color: #666;
      line-height: 1;
    }
    .word-val {
      display: block;
      font-size: 10pt;
      font-weight: bold;
      min-height: 13pt;
    }
    .sig-section {
      border: 1px solid #000;
      padding: 4pt;
      display: flex;
      gap: 8pt;
      align-items: baseline;
    }
    .sig-value {
      font-size: 10pt;
      font-weight: bold;
      flex: 1;
    }
    .sig-opnote {
      font-size: 9pt;
      color: #333;
    }
    .continuation {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      border: 1px solid #000;
      padding: 4pt;
      margin-bottom: 6pt;
    }
    .continued {
      text-align: center;
      font-size: 9pt;
      font-style: italic;
      margin-top: 4pt;
    }
    .received-at {
      border: 2px solid #000;
      margin-top: 10pt;
      padding: 4pt;
    }
    .received-at-title {
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      letter-spacing: 2px;
      margin-bottom: 4pt;
      border-bottom: 1px solid #000;
      padding-bottom: 2pt;
    }
    .received-table {
      width: 100%;
      border-collapse: collapse;
    }
    .received-table td {
      border: 1px solid #000;
      padding: 2pt 4pt;
    }
    .recv-value {
      display: block;
      font-size: 10pt;
      font-weight: bold;
      min-height: 13pt;
    }
    .no-print { display: none; }
    @media screen {
      body { background: #f0f0f0; }
      .page { background: #fff; max-width: 7.5in; margin: 0.25in auto; padding: 0.5in; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
      .no-print { display: block; }
      .print-btn {
        display: block;
        margin: 0.5in auto;
        padding: 8pt 24pt;
        font-size: 12pt;
        background: #0e7490;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .print-btn:hover { background: #0c5f75; }
    }
  `;
}

export function printRadiogram(radiogram: Radiogram, userProfile?: UserProfile): void {
  const words = radiogram.textWords.filter(w => w.length > 0);

  // Build pages: each page holds up to 25 words
  const pageWordChunks: string[][] = [];
  if (words.length === 0) {
    pageWordChunks.push([]);
  } else {
    for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
      pageWordChunks.push(words.slice(i, i + WORDS_PER_PAGE));
    }
  }

  let pagesHtml = '';
  pageWordChunks.forEach((pageWords, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast = pageIdx === pageWordChunks.length - 1;
    const wordStartIdx = pageIdx * WORDS_PER_PAGE;
    const hasMore = !isLast;

    pagesHtml += `
      <div class="${hasMore ? 'page page-break' : 'page'}">
        ${isFirst ? renderPreamble(radiogram) : `<div class="continuation">NR ${esc(field(radiogram.number))} (CONTINUATION ${pageIdx + 1})</div>`}
        ${renderWordGrid(pageWords, wordStartIdx)}
        ${isLast ? renderSignature(radiogram) : '<div class="continued">&mdash; continued on next page &mdash;</div>'}
        ${isFirst ? renderReceivedAt(radiogram, userProfile) : ''}
      </div>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Radiogram Nr ${esc(field(radiogram.number, '?'))}</title>
  <style>${getStyles()}</style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">Print / Save as PDF</button>
  ${pagesHtml}
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
