/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.export.js  (5/6)
   İçerik : XLSX dışa aktarım (renkli Excel şablonu) · loadScript
   Not    : app.distribution.js'ten sonra, app.calendar.js'ten
            önce yüklenmelidir. (Başka dosyaya bağımlı değildir;
            state, buildWeeks, weekendEnd, addMin vb. çağrı anında
            kullanılır.)
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── Harici script yükleyici (importExcel de bunu kullanır) ── */
const _scriptCache = {};
function loadScript(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  return _scriptCache[src] = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => { delete _scriptCache[src]; s.remove(); no(new Error('Script yüklenemedi: ' + src)); };
    document.head.appendChild(s);
  });
}
async function loadFirst(urls) {
  let err;
  for (const u of urls) { try { await loadScript(u); return; } catch (e) { err = e; } }
  throw err || new Error('Script yüklenemedi');
}

/* ── Dosyayı indir (mobil Chrome uyumlu) ─────────────────── */
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // revoke hemen çağrılırsa mobilde indirme iptal olur → gecikmeli
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 10000);
}

/* ── XLSX ÇIKTISI ────────────────────────────────────────── */
const XLS_COLORS = {
  title:'865757', lhdr:'529D46', dayname:'A9D08E', date:'FFE699', sub:'F2F2F2',
  wktotalh:'9CC3E5', wkoverh:'FFC7CE', monthly:'00B0F0', sigh:'FFE699',
  weOt:'FFD966', wdOt:'C6EFCE', holiday:'D9D9D9', wktotal:'D9EAF7', wkover:'F8CBAD',
  dash:'F0F0F0', white:'FFFFFF', weText:'8B0000'
};

let _exporting = false;
async function exportExcel() {
  if (_exporting) return;
  const result = state.lastResult;
  if (!result || !result.assigned || !result.assigned.length) {
    notify('Önce Dağıtım sekmesinden mesai dağıtımı yapın.', 'warning');
    try { Sounds.error(); } catch (e) {}
    return;
  }
  _exporting = true;
  try {
    notify('Excel dosyası hazırlanıyor…', 'info', 2000);
    await loadFirst([
      'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
      'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
    ]);
    if (!window.ExcelJS) throw new Error('ExcelJS kütüphanesi yüklenemedi');

    const { assigned, allDates, holidays, year, month, grup, weOK } = result;
    const weeks = buildWeeks(allDates);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Emvalis';
    const ws = wb.addWorksheet(`${TR_MONTHS[month-1]} ${year}`.slice(0, 31), {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
    });

    const thin = { style: 'thin', color: { argb: 'FF999999' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const style = (cell, bg, o = {}) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
      cell.font = { name: 'Calibri', size: o.size || 10, bold: !!o.bold, color: { argb: 'FF' + (o.color || '000000') } };
      cell.alignment = { horizontal: o.left ? 'left' : 'center', vertical: 'middle', wrapText: !!o.wrap };
      cell.border = border;
    };
    const merge = (r1, c1, r2, c2) => { if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2); };
    const put = (r, c, v, bg, o) => { const cell = ws.getCell(r, c); cell.value = v; style(cell, bg, o); return cell; };
    const TF = '[h]:mm:ss';
    const tv = min => min / 1440;               // dakika → Excel zaman değeri

    // sütun planı
    const totalCols = 3 + weeks.reduce((a, wk) => a + wk.length * 2 + 2, 0) + 2;
    const monthlyCol = totalCols - 1, sigCol = totalCols;

    // satır 1: başlık
    ws.mergeCells(1, 1, 1, totalCols);
    put(1, 1, `FAZLA MESAİ — ${String(grup).toUpperCase()} — ${TR_MONTHS[month-1].toUpperCase()} ${year}`, XLS_COLORS.title,
        { bold: true, size: 13, color: 'FFFFFF', left: true });
    ws.getRow(1).height = 26;

    // sol başlıklar (satır 2-5 birleşik)
    [['SİCİL', 1, 9], ['ADI SOYADI', 2, 26], ['ÜNVAN', 3, 20]].forEach(([t, c, w]) => {
      merge(2, c, 5, c);
      put(2, c, t, XLS_COLORS.lhdr, { bold: true, color: 'FFFFFF' });
      for (let r = 3; r <= 5; r++) style(ws.getCell(r, c), XLS_COLORS.lhdr);
      ws.getColumn(c).width = w;
    });

    // hafta / gün başlıkları
    let col = 4;
    const weekCols = [];                         // her hafta için sütun bilgisi
    weeks.forEach((wk, wi) => {
      const start = col;
      wk.forEach(d => {
        const we = isWeekend(d), fc = we ? XLS_COLORS.weText : '000000';
        merge(3, col, 3, col + 1);
        put(3, col, DAY_TR_ABB[d.getDay()], XLS_COLORS.dayname, { bold: true, color: fc });
        style(ws.getCell(3, col + 1), XLS_COLORS.dayname);
        merge(4, col, 4, col + 1);
        put(4, col, d.getDate(), XLS_COLORS.date, { bold: true, color: fc });
        style(ws.getCell(4, col + 1), XLS_COLORS.date);
        put(5, col, 'GİR', XLS_COLORS.sub, { size: 8 });
        put(5, col + 1, 'ÇIK', XLS_COLORS.sub, { size: 8 });
        ws.getColumn(col).width = 6.5; ws.getColumn(col + 1).width = 6.5;
        col += 2;
      });
      const end = col - 1;
      merge(2, start, 2, end);
      put(2, start, `Hafta ${wi + 1} (${dateToDisplay(wk[0])} – ${dateToDisplay(wk[wk.length - 1])})`, XLS_COLORS.wktotalh, { bold: true, size: 9 });
      for (let c = start + 1; c <= end; c++) style(ws.getCell(2, c), XLS_COLORS.wktotalh);
      const tc = col, oc = col + 1;
      [[tc, 'Hftlk\nToplam', XLS_COLORS.wktotalh], [oc, 'Hftlk\nFazla', XLS_COLORS.wkoverh]].forEach(([c, t, bg]) => {
        merge(2, c, 5, c);
        put(2, c, t, bg, { bold: true, wrap: true, size: 9 });
        for (let r = 3; r <= 5; r++) style(ws.getCell(r, c), bg);
        ws.getColumn(c).width = 10;
      });
      weekCols.push({ tc, oc });
      col += 2;
    });
    [[monthlyCol, 'Aylık\nFazla', XLS_COLORS.monthly, 11], [sigCol, 'İmza', XLS_COLORS.sigh, 14]].forEach(([c, t, bg, w]) => {
      merge(2, c, 5, c);
      put(2, c, t, bg, { bold: true, wrap: true });
      for (let r = 3; r <= 5; r++) style(ws.getCell(r, c), bg);
      ws.getColumn(c).width = w;
    });
    ws.getRow(2).height = 30;

    // personel satırları
    let r = 6;
    assigned.forEach(({ person: p, dayMap, leavesSet }) => {
      put(r, 1, p.sicil, XLS_COLORS.white, { size: 9 });
      put(r, 2, p.ad, XLS_COLORS.white, { left: true });
      put(r, 3, p.unvan || '', XLS_COLORS.white, { left: true, size: 9 });
      let c = 4, monthlyOT = 0;
      weeks.forEach((wk, wi) => {
        let wkT = 0, wkOT = 0;
        wk.forEach(d => {
          const dk = dateKey(d);
          const isHol = isHolidayDate(d, holidays), isLv = leavesSet.has(dk), we = isWeekend(d);
          const ot = dayMap[dk] || 0;
          if (isHol || isLv) {
            merge(r, c, r, c + 1);
            put(r, c, isHol ? 'Tatil' : 'İzin', XLS_COLORS.holiday, { size: 8, color: '555555' });
            style(ws.getCell(r, c + 1), XLS_COLORS.holiday);
          } else if (we) {
            if (ot > 0 && weOK) {
              put(r, c, '09:00', XLS_COLORS.weOt, { size: 9 });
              put(r, c + 1, weekendEnd(ot), XLS_COLORS.weOt, { size: 9 });
              wkT += ot; wkOT += ot;
            } else {
              put(r, c, '—', XLS_COLORS.dash, { color: 'BBBBBB' });
              put(r, c + 1, '—', XLS_COLORS.dash, { color: 'BBBBBB' });
            }
          } else {
            const bg = ot > 0 ? XLS_COLORS.wdOt : XLS_COLORS.white;
            put(r, c, '08:00', bg, { size: 9 });
            put(r, c + 1, ot > 0 ? addMin('17:00', ot) : '17:00', bg, { size: 9 });
            wkT += NORMAL_DAY_MIN + ot; wkOT += ot;
          }
          c += 2;
        });
        monthlyOT += wkOT;
        const { tc, oc } = weekCols[wi];
        const a = put(r, tc, tv(wkT), XLS_COLORS.wktotal, { bold: true, color: '1F497D', size: 9 }); a.numFmt = TF;
        const b = put(r, oc, tv(wkOT), wkOT > 0 ? XLS_COLORS.wkover : XLS_COLORS.white,
                      { bold: wkOT > 0, color: wkOT > 0 ? '843C0C' : '333333', size: 9 }); b.numFmt = TF;
        c += 2;
      });
      const m = put(r, monthlyCol, tv(monthlyOT), monthlyOT > 0 ? XLS_COLORS.monthly : XLS_COLORS.white,
                    { bold: true, color: monthlyOT > 0 ? 'FFFFFF' : '333333' });
      m.numFmt = TF;
      put(r, sigCol, '', XLS_COLORS.white);
      ws.getRow(r).height = 20;
      r++;
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveBlob(blob, `fazla-mesai_${grup}_${year}-${String(month).padStart(2, '0')}.xlsx`);
    try { Sounds.excel(); } catch (e) {}
    notify('XLSX dosyası indirildi.', 'success');
  } catch (e) {
    console.error(e);
    try { Sounds.error(); } catch (_) {}
    notify('XLSX oluşturulamadı: ' + e.message + ' (İnternet bağlantınızı kontrol edin.)', 'error', 7000);
  } finally {
    _exporting = false;
  }
}
