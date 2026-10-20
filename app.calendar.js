/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.calendar.js  (YENİ)
   İçerik : Tarih yardımcıları · Metinden tarih/aralık ayrıştırma ·
            Resmî tatil verisi · Takvim seçici bileşeni (DatePicker)
   Not    : app.ui.js'ten sonra, app.extras.js'ten ÖNCE yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── TARİH YARDIMCILARI (ISO "YYYY-AA-GG" metinleri üzerinden) ── */
const CAL_MONTHS = {ocak:1,şubat:2,subat:2,mart:3,nisan:4,mayıs:5,mayis:5,haziran:6,temmuz:7,
  ağustos:8,agustos:8,eylül:9,eylul:9,ekim:10,kasım:11,kasim:11,aralık:12,aralik:12};
const CAL_MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const CAL_DOW_MON = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];   // Pazartesi başlangıçlı

function isoFromParts(y,m,d){
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d) return null;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function isoToDate(iso){ const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d); }
function dateToIso(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function addDaysIso(iso,n){ const d=isoToDate(iso); d.setDate(d.getDate()+n); return dateToIso(d); }
function diffDaysIso(a,b){ return Math.round((isoToDate(b)-isoToDate(a))/86400000); }
function isWeekendIso(iso){ const g=isoToDate(iso).getDay(); return g===0||g===6; }
function isoDisplay(iso){ const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}`; }
function todayIso(){ return dateToIso(new Date()); }

// a..b arası (dahil) tüm günler; ters girilirse yer değiştirir; en fazla 400 gün
function expandRange(a,b,opts={}){
  if(a>b){ const t=a; a=b; b=t; }
  const out=[]; let cur=a, guard=0;
  while(cur<=b && guard++<400){
    if(!(opts.skipWeekends && isWeekendIso(cur))) out.push(cur);
    cur=addDaysIso(cur,1);
  }
  return out;
}

// Ardışık günleri gruplar. bridge=true ise aradaki hafta sonu boşluğu (Cum→Pzt) kopukluk sayılmaz.
function groupRuns(sorted,bridge=true){
  const runs=[]; let cur=null;
  sorted.forEach(iso=>{
    if(cur){
      const gap=diffDaysIso(cur.end,iso);
      let ok=gap===1;
      if(!ok && bridge && gap>1 && gap<=3){
        ok=true;
        for(let k=1;k<gap;k++){ if(!isWeekendIso(addDaysIso(cur.end,k))){ ok=false; break; } }
      }
      if(ok){ cur.end=iso; cur.dates.push(iso); return; }
    }
    cur={start:iso,end:iso,dates:[iso]}; runs.push(cur);
  });
  return runs;
}

// "Başlangıç + N gün" hesabı. workdays=true: hafta sonu ve tatiller sayılmaz.
// Dönen: {end, dates(takvim günleri), counted, weekendDays}
function spanFromCount(startIso,n,workdays,holidaySet){
  const hol=holidaySet||new Set();
  n=Math.max(0,Math.min(400,Math.floor(n)));
  if(!startIso||n<1) return {end:null,dates:[],counted:0,weekendDays:0};
  const dates=[]; let cur=startIso, counted=0, guard=0, extra=0;
  while(counted<n && guard++<800){
    const off = workdays && (isWeekendIso(cur)||hol.has(cur));
    if(!off) counted++; else extra++;
    dates.push(cur);
    if(counted<n) cur=addDaysIso(cur,1);
  }
  // başlangıç gününden önce/sonra boşta kalan hafta sonu yok: son gün her zaman sayılan gündür
  return {end:dates[dates.length-1]||null, dates, counted, weekendDays:extra};
}

/* ── METİNDEN TARİH / ARALIK AYRIŞTIRMA ───────────────────── */
function _monthNo(name){
  return CAL_MONTHS[String(name||'').toLocaleLowerCase('tr-TR')]||null;
}
function parseSingleDate(tok,defYear){
  tok=String(tok||'').trim();
  let m;
  if((m=tok.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return isoFromParts(+m[1],+m[2],+m[3]);
  if((m=tok.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) return isoFromParts(+m[3],+m[2],+m[1]);
  if((m=tok.match(/^(\d{1,2})[./](\d{1,2})$/))) return defYear?isoFromParts(defYear,+m[2],+m[1]):null;
  if((m=tok.match(/^(\d{1,2})\s+([A-Za-zÇĞİIÖŞÜçğıöşü]+)\s*(\d{4})?$/))){
    const mo=_monthNo(m[2]); const y=m[3]?+m[3]:defYear;
    return (mo&&y)?isoFromParts(y,mo,+m[1]):null;
  }
  return null;
}
function _rangeIso(a,b){ return (a&&b)?expandRange(a,b):null; }

function _parseToken(tok,defYear){
  tok=tok.replace(/\s+/g,' ').trim();
  let m;
  // 05-15.10.2026
  if((m=tok.match(/^(\d{1,2})\s*-\s*(\d{1,2})[./](\d{1,2})[./](\d{4})$/)))
    return _rangeIso(isoFromParts(+m[4],+m[3],+m[1]),isoFromParts(+m[4],+m[3],+m[2]));
  // 05.10-15.11.2026
  if((m=tok.match(/^(\d{1,2})[./](\d{1,2})\s*-\s*(\d{1,2})[./](\d{1,2})[./](\d{4})$/)))
    return _rangeIso(isoFromParts(+m[5],+m[2],+m[1]),isoFromParts(+m[5],+m[4],+m[3]));
  // 5-15 Ekim 2026
  if((m=tok.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-zÇĞİIÖŞÜçğıöşü]+)\s*(\d{4})?$/))){
    const mo=_monthNo(m[3]), y=m[4]?+m[4]:defYear;
    return (mo&&y)?_rangeIso(isoFromParts(y,mo,+m[1]),isoFromParts(y,mo,+m[2])):null;
  }
  // 28 Ekim - 2 Kasım 2026   |   28 Ekim 2026 - 2 Kasım 2026
  if((m=tok.match(/^(\d{1,2})\s+([A-Za-zÇĞİIÖŞÜçğıöşü]+)\s*(\d{4})?\s*-\s*(\d{1,2})\s+([A-Za-zÇĞİIÖŞÜçğıöşü]+)\s*(\d{4})?$/))){
    const m1=_monthNo(m[2]), m2=_monthNo(m[5]);
    const y2=m[6]?+m[6]:(m[3]?+m[3]:defYear), y1=m[3]?+m[3]:y2;
    return (m1&&m2&&y1&&y2)?_rangeIso(isoFromParts(y1,m1,+m[1]),isoFromParts(y2,m2,+m[4])):null;
  }
  // iki tam tarih: ayırıcı –, —, " - ", "ile", ".." veya bitişik "-"
  let parts=null;
  if((m=tok.match(/^(\d{4}-\d{1,2}-\d{1,2})\s*(?:-|–|—|\.\.|\s+ile\s+)\s*(\d{4}-\d{1,2}-\d{1,2})$/i))) parts=[m[1],m[2]];
  else if((m=tok.match(/^(\d{1,2}[./]\d{1,2}(?:[./]\d{4})?)\s*(?:-|–|—|\.\.|\s+ile\s+)\s*(\d{1,2}[./]\d{1,2}[./]\d{4})$/i))) parts=[m[1],m[2]];
  if(parts){
    const yHint=(parts[1].match(/(\d{4})/)||[])[1];
    const a=parseSingleDate(parts[0],yHint?+yHint:defYear), b=parseSingleDate(parts[1],defYear);
    return _rangeIso(a,b);
  }
  const one=parseSingleDate(tok,defYear);
  return one?[one]:null;
}

// Satır/;/, ile ayrılmış çoklu tarih ve aralık. {dates:[sıralı ISO], errors:[anlaşılamayan parçalar]}
function parseDateText(text,defYear){
  const dates=[], errors=[];
  String(text||'').split(/[\n;,]+/).map(s=>s.trim()).filter(Boolean).forEach(tok=>{
    const r=_parseToken(tok,defYear);
    if(r&&r.length) r.forEach(x=>dates.push(x)); else errors.push(tok);
  });
  return {dates:[...new Set(dates)].sort(), errors};
}

/* ── RESMÎ TATİL VERİSİ (Türkiye) ─────────────────────────── */
const TR_FIXED_HOLIDAYS = [
  ['01-01','Yılbaşı'],
  ['04-23','23 Nisan Ulusal Egemenlik ve Çocuk Bayramı'],
  ['05-01','1 Mayıs Emek ve Dayanışma Günü'],
  ['05-19',"19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ['07-15','15 Temmuz Demokrasi ve Millî Birlik Günü'],
  ['08-30','30 Ağustos Zafer Bayramı'],
  ['10-29','29 Ekim Cumhuriyet Bayramı']
];
const TR_FIXED_ARIFE = [['10-28','Cumhuriyet Bayramı Arifesi (yarım gün)']];
// Dinî bayramların 1. günü (Diyanet takvimi). Yeni yıl yayımlanınca buraya bir satır ekleyin:
//   rb = Ramazan Bayramı 1. gün (3 gün sürer) · kb = Kurban Bayramı 1. gün (4 gün sürer)
const TR_RELIGIOUS = {
  2024:{rb:'2024-04-10', kb:'2024-06-16'},
  2025:{rb:'2025-03-30', kb:'2025-06-06'},
  2026:{rb:'2026-03-20', kb:'2026-05-27'},
  2027:{rb:'2027-03-09', kb:'2027-05-16'}
};

// {list:[{iso,name,half}], religiousKnown}
function trHolidaysForYear(year,opts={}){
  const out=[];
  TR_FIXED_HOLIDAYS.forEach(([md,name])=>{ const iso=`${year}-${md}`; if(isoFromParts(year,+md.slice(0,2),+md.slice(3))) out.push({iso,name,half:false}); });
  const rel=TR_RELIGIOUS[year];
  if(rel){
    for(let i=0;i<3;i++) out.push({iso:addDaysIso(rel.rb,i),name:`Ramazan Bayramı ${i+1}. Gün`,half:false});
    for(let i=0;i<4;i++) out.push({iso:addDaysIso(rel.kb,i),name:`Kurban Bayramı ${i+1}. Gün`,half:false});
  }
  if(opts.arife){
    TR_FIXED_ARIFE.forEach(([md,name])=>out.push({iso:`${year}-${md}`,name,half:true}));
    if(rel){
      out.push({iso:addDaysIso(rel.rb,-1),name:'Ramazan Bayramı Arifesi (yarım gün)',half:true});
      out.push({iso:addDaysIso(rel.kb,-1),name:'Kurban Bayramı Arifesi (yarım gün)',half:true});
    }
  }
  out.sort((a,b)=>a.iso<b.iso?-1:a.iso>b.iso?1:0);
  return {list:out, religiousKnown:!!rel};
}

/* ── TAKVİM SEÇİCİ (DatePicker) ───────────────────────────── */
const DP_CSS = `
.dp{display:flex;flex-direction:column;gap:.9rem}
.dp-tabs{display:flex;gap:.35rem;flex-wrap:wrap}
.dp-tab{padding:.42rem .85rem;border:1px solid var(--border);border-radius:99px;background:transparent;color:var(--text-muted);font-size:.8rem;cursor:pointer;font-family:var(--font-b);transition:var(--transition)}
.dp-tab:hover{border-color:var(--border-bright);color:var(--text-bright)}
.dp-tab.active{background:rgba(212,168,64,.16);border-color:var(--border-bright);color:var(--gold-bright);font-weight:600}
.dp-panel{display:flex;flex-wrap:wrap;gap:.6rem .8rem;align-items:flex-end;padding:.8rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input)}
.dp-panel[hidden]{display:none}
.dp-field{display:flex;flex-direction:column;gap:.25rem;font-size:.74rem;color:var(--text-muted);letter-spacing:.04em}
.dp-field input[type=date],.dp-field input[type=number]{background:var(--bg-card);border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:.5rem .6rem;color:var(--text-input);font-family:var(--font-m);font-size:.86rem;min-width:9.5rem}
.dp-field input[type=number]{min-width:5.5rem;width:6rem}
.dp-chk{display:flex;align-items:center;gap:.4rem;font-size:.8rem;color:var(--text-primary);cursor:pointer;padding-bottom:.5rem}
.dp-chk input{accent-color:var(--gold-bright)}
.dp-btn{padding:.52rem 1rem;border-radius:8px;border:1px solid var(--border-bright);background:rgba(212,168,64,.14);color:var(--gold-bright);font-weight:700;font-size:.82rem;cursor:pointer;font-family:var(--font-b);transition:var(--transition)}
.dp-btn:hover{background:rgba(212,168,64,.26)}
.dp-btn.ghost{background:transparent;color:var(--text-muted);border-color:var(--border);font-weight:500}
.dp-btn.ghost:hover{color:var(--text-bright);border-color:var(--border-bright)}
.dp-preview{flex:1 1 100%;font-size:.82rem;color:var(--text-muted);font-family:var(--font-m)}
.dp-text{width:100%;min-height:72px;background:var(--bg-card);border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:.6rem;color:var(--text-input);font-family:var(--font-m);font-size:.84rem;resize:vertical}
.dp-err{flex:1 1 100%;font-size:.78rem;color:#E05050}
.dp-err:empty{display:none}
.dp-hint{font-size:.74rem;color:var(--text-dim);flex:1 1 100%}
.dp-cal{border:1px solid var(--border);border-radius:var(--radius-sm);padding:.8rem;background:var(--bg-card);user-select:none;-webkit-user-select:none}
.dp-nav{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;margin-bottom:.7rem}
.dp-nav .dp-spacer{flex:1}
.dp-navbtn{width:32px;height:32px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-primary);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center}
.dp-navbtn:hover{border-color:var(--border-bright);color:var(--gold-bright)}
.dp-seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.dp-seg button{padding:.34rem .65rem;border:none;background:transparent;color:var(--text-muted);font-size:.76rem;cursor:pointer;font-family:var(--font-b)}
.dp-seg button.active{background:rgba(212,168,64,.2);color:var(--gold-bright);font-weight:700}
.dp-months{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1rem}
.dp-month-title{text-align:center;font-family:var(--font-d);font-size:.82rem;letter-spacing:.08em;color:var(--gold-light);margin-bottom:.4rem}
.dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.dp-dow{font-size:.66rem;text-align:center;color:var(--text-dim);padding:.15rem 0}
.dp-day{aspect-ratio:1/1;min-height:30px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text-primary);font-size:.82rem;cursor:pointer;font-family:var(--font-m);padding:0;transition:background .12s,border-color .12s}
.dp-day:hover{border-color:var(--border-bright);background:rgba(212,168,64,.08)}
.dp-day.dp-we{color:#C0505A}
.dp-day.dp-today{border-color:var(--border-bright);font-weight:700}
.dp-day.dp-mark{background:repeating-linear-gradient(135deg,rgba(128,128,128,.22) 0 4px,transparent 4px 8px);color:var(--text-muted);cursor:not-allowed}
.dp-day.dp-sel{background:var(--gold);color:#120D00;font-weight:700;border-color:var(--gold)}
.dp-day.dp-drag-add{background:rgba(212,168,64,.45);color:var(--text-bright)}
.dp-day.dp-drag-rem{background:rgba(224,80,80,.35);color:var(--text-bright)}
.dp-day.dp-anchor{outline:2px dashed var(--gold-bright);outline-offset:1px}
.dp-blank{visibility:hidden}
.dp-summary{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap}
.dp-total{font-size:.86rem;color:var(--text-primary);font-weight:600}
.dp-chips{display:flex;flex-wrap:wrap;gap:.45rem;max-height:150px;overflow:auto}
.dp-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .35rem .28rem .75rem;border-radius:99px;border:1px solid var(--border-bright);background:rgba(212,168,64,.1);font-size:.78rem;color:var(--text-primary);font-family:var(--font-m)}
.dp-chip b{font-family:var(--font-b);font-weight:600;color:var(--gold-bright)}
.dp-chip button{width:20px;height:20px;border:none;border-radius:50%;background:rgba(128,128,128,.2);color:var(--text-muted);cursor:pointer;font-size:.7rem;line-height:1}
.dp-chip button:hover{background:rgba(224,80,80,.4);color:#fff}
.dp-empty{font-size:.8rem;color:var(--text-dim)}
@media(max-width:520px){.dp-field input[type=date]{min-width:8rem}.dp-months{grid-template-columns:1fr}}
`;
function _ensureDpStyles(){
  if(document.getElementById('dpStyles')) return;
  const st=document.createElement('style'); st.id='dpStyles'; st.textContent=DP_CSS; document.head.appendChild(st);
}
function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/**
 * createDatePicker(root, opts)
 *  opts.title        : 'leave' | 'holiday'  (varsayılanları etkiler)
 *  opts.marks        : {iso: 'etiket'}  salt-okunur işaretli günler (ör. tatiller; seçilemez)
 *  opts.nameOf       : iso => ad   (çipte gösterilecek ad)
 *  opts.summary      : dates => html metin  (toplam satırı)
 *  opts.onChange     : (dates, {added, removed}) => void
 *  opts.viewIso      : ilk görüntülenecek ay
 * Dönen API: getDates, setDates, addDates, removeDates, clear, setMarks, goto, refresh
 */
function createDatePicker(root,opts={}){
  _ensureDpStyles();
  const sel=new Set();
  let marks=opts.marks||{};
  let view=(opts.viewIso||todayIso()).slice(0,7)+'-01';
  let mode='free';                 // 'free' (tıkla/sürükle) | 'range' (2 tık)
  let anchor=null, lastClicked=null;
  let drag=null;                   // {start,end,remove}
  const isLeave=opts.title==='leave';

  root.classList.add('dp');
  root.innerHTML=`
    <div class="dp-tabs" role="tablist">
      <button type="button" class="dp-tab active" data-tab="range">📆 Tarih aralığı</button>
      ${isLeave?'<button type="button" class="dp-tab" data-tab="count">🔢 Gün sayısıyla</button>':''}
      <button type="button" class="dp-tab" data-tab="text">✍️ Yaz / yapıştır</button>
    </div>
    <div class="dp-panel" data-panel="range">
      <label class="dp-field">Başlangıç<input type="date" class="dp-from"></label>
      <label class="dp-field">Bitiş<input type="date" class="dp-to"></label>
      <label class="dp-chk"><input type="checkbox" class="dp-skipwe"> Hafta sonlarını atla</label>
      <button type="button" class="dp-btn dp-add-range">＋ Ekle</button>
      <div class="dp-hint">Tek gün için bitişi boş bırakın. 15 günlük izin = iki tarih seçip bir kez “Ekle”.</div>
    </div>
    ${isLeave?`<div class="dp-panel" data-panel="count" hidden>
      <label class="dp-field">Başlangıç<input type="date" class="dp-c-from"></label>
      <label class="dp-field">Gün sayısı<input type="number" class="dp-c-n" min="1" max="365" value="10"></label>
      <label class="dp-chk"><input type="checkbox" class="dp-c-work" checked> Hafta sonu ve tatilleri sayma</label>
      <button type="button" class="dp-btn dp-add-count">＋ Ekle</button>
      <div class="dp-preview dp-c-prev"></div>
    </div>`:''}
    <div class="dp-panel" data-panel="text" hidden>
      <textarea class="dp-text" placeholder="05.10.2026 - 15.10.2026&#10;20.10.2026&#10;5-9 Kasım 2026" aria-label="Tarihler"></textarea>
      <button type="button" class="dp-btn dp-add-text">＋ Ekle</button>
      <div class="dp-err"></div>
      <div class="dp-hint">Her satıra bir tarih veya aralık. Örnekler: <code>05.10.2026</code> · <code>05.10.2026-15.10.2026</code> · <code>5-15 Ekim 2026</code></div>
    </div>
    <div class="dp-cal">
      <div class="dp-nav">
        <button type="button" class="dp-navbtn dp-prev" aria-label="Önceki ay">‹</button>
        <button type="button" class="dp-navbtn dp-next" aria-label="Sonraki ay">›</button>
        <button type="button" class="dp-btn ghost dp-today-btn">Bugün</button>
        <span class="dp-spacer"></span>
        <span class="dp-seg" role="group" aria-label="Seçim biçimi">
          <button type="button" class="active" data-mode="free" title="Tıkla = tek gün, sürükle = aralık">Tıkla / sürükle</button>
          <button type="button" data-mode="range" title="Önce ilk günü, sonra son günü tıkla">Başlangıç-bitiş</button>
        </span>
      </div>
      <div class="dp-months"></div>
    </div>
    <div class="dp-summary"><span class="dp-total"></span><button type="button" class="dp-btn ghost dp-clear">Tümünü temizle</button></div>
    <div class="dp-chips"></div>`;

  const q=s=>root.querySelector(s);
  const monthsEl=q('.dp-months');

  /* — ay ızgarası — */
  function monthHtml(y,m){
    const first=new Date(y,m-1,1), lead=(first.getDay()+6)%7, days=new Date(y,m,0).getDate();
    let h=`<div><div class="dp-month-title">${CAL_MONTH_NAMES[m-1].toUpperCase()} ${y}</div><div class="dp-grid">`;
    CAL_DOW_MON.forEach(d=>{ h+=`<div class="dp-dow">${d}</div>`; });
    for(let i=0;i<lead;i++) h+='<div class="dp-blank"></div>';
    const t=todayIso();
    for(let d=1;d<=days;d++){
      const iso=isoFromParts(y,m,d), g=new Date(y,m-1,d).getDay();
      const cls=['dp-day']; if(g===0||g===6) cls.push('dp-we'); if(iso===t) cls.push('dp-today');
      const mk=marks[iso];
      if(mk) cls.push('dp-mark');
      h+=`<button type="button" class="${cls.join(' ')}" data-iso="${iso}"${mk?` title="${_esc(mk)}"`:''}>${d}</button>`;
    }
    return h+'</div></div>';
  }
  function renderMonths(){
    const [y,m]=view.split('-').map(Number);
    const y2=m===12?y+1:y, m2=m===12?1:m+1;
    monthsEl.innerHTML=monthHtml(y,m)+monthHtml(y2,m2);
    paint();
  }
  function dragSet(){
    if(!drag) return null;
    const lst=expandRange(drag.start,drag.end).filter(i=>!marks[i]);
    return new Set(lst);
  }
  function paint(){
    const ds=dragSet();
    monthsEl.querySelectorAll('.dp-day').forEach(b=>{
      const iso=b.dataset.iso;
      b.classList.toggle('dp-sel',sel.has(iso));
      b.classList.toggle('dp-drag-add',!!(ds&&ds.has(iso)&&!drag.remove));
      b.classList.toggle('dp-drag-rem',!!(ds&&ds.has(iso)&&drag.remove));
      b.classList.toggle('dp-anchor',anchor===iso);
    });
  }

  /* — özet ve çipler — */
  function renderChips(){
    const dates=[...sel].sort();
    const runs=groupRuns(dates,isLeave);
    const chips=q('.dp-chips');
    if(!runs.length){ chips.innerHTML='<span class="dp-empty">Henüz tarih seçilmedi.</span>'; }
    else chips.innerHTML=runs.map((r,i)=>{
      const txt=r.start===r.end?isoDisplay(r.start):`${isoDisplay(r.start)} – ${isoDisplay(r.end)}`;
      let name='';
      if(opts.nameOf){ const ns=[...new Set(r.dates.map(opts.nameOf).filter(Boolean))]; if(ns.length===1) name=` <b>${_esc(ns[0])}</b>`; }
      const cnt=r.dates.length>1?` · ${r.dates.length} gün`:'';
      return `<span class="dp-chip" data-run="${i}">${txt}${cnt}${name}<button type="button" aria-label="Sil" data-del="${i}">✕</button></span>`;
    }).join('');
    chips._runs=runs;
    q('.dp-total').innerHTML=opts.summary?opts.summary(dates):`Toplam: <b>${dates.length}</b> gün`;
  }
  function changed(added,removed){
    paint();
    if(opts.onChange) opts.onChange([...sel].sort(),{added:added||[],removed:removed||[]});
    renderChips();
  }
  const usable=iso=>!marks[iso];
  function add(list){ const a=[]; list.forEach(i=>{ if(usable(i)&&!sel.has(i)){ sel.add(i); a.push(i);} }); if(a.length) changed(a,[]); return a.length; }
  function remove(list){ const r=[]; list.forEach(i=>{ if(sel.has(i)){ sel.delete(i); r.push(i);} }); if(r.length) changed([],r); return r.length; }

  /* — etkileşim — */
  function commitSingle(iso,shift){
    if(marks[iso]) return;
    if(mode==='range'){
      if(!anchor){ anchor=iso; paint(); return; }
      const a=anchor; anchor=null; add(expandRange(a,iso)); lastClicked=iso; return;
    }
    if(shift&&lastClicked){ add(expandRange(lastClicked,iso)); lastClicked=iso; return; }
    if(sel.has(iso)) remove([iso]); else add([iso]);
    lastClicked=iso;
  }
  monthsEl.addEventListener('mousedown',e=>{
    const b=e.target.closest('.dp-day'); if(!b||e.button!==0) return;
    e.preventDefault();
    drag={start:b.dataset.iso,end:b.dataset.iso,remove:sel.has(b.dataset.iso),shift:e.shiftKey};
    paint();
  });
  monthsEl.addEventListener('mouseover',e=>{
    if(!drag) return; const b=e.target.closest('.dp-day'); if(!b) return;
    if(drag.end!==b.dataset.iso){ drag.end=b.dataset.iso; paint(); }
  });
  document.addEventListener('mouseup',function up(){
    if(!root.isConnected){ document.removeEventListener('mouseup',up); return; }
    if(!drag) return;
    const d=drag; drag=null;
    if(d.start===d.end){ paint(); commitSingle(d.start,d.shift); return; }
    const lst=expandRange(d.start,d.end);
    anchor=null;
    if(d.remove) remove(lst); else add(lst);
    lastClicked=d.end;
  });
  monthsEl.addEventListener('click',e=>{                 // klavye (Enter/Boşluk) ile seçim
    const b=e.target.closest('.dp-day'); if(!b||e.detail!==0) return;
    commitSingle(b.dataset.iso,e.shiftKey);
  });
  q('.dp-prev').onclick=()=>{ view=addDaysIso(view,-1).slice(0,7)+'-01'; renderMonths(); };
  q('.dp-next').onclick=()=>{ view=addDaysIso(view.slice(0,7)+'-28',7).slice(0,7)+'-01'; renderMonths(); };
  q('.dp-today-btn').onclick=()=>{ view=todayIso().slice(0,7)+'-01'; renderMonths(); };
  root.querySelectorAll('.dp-seg button').forEach(b=>b.onclick=()=>{
    mode=b.dataset.mode; anchor=null;
    root.querySelectorAll('.dp-seg button').forEach(x=>x.classList.toggle('active',x===b)); paint();
  });
  root.querySelectorAll('.dp-tab').forEach(t=>t.onclick=()=>{
    root.querySelectorAll('.dp-tab').forEach(x=>x.classList.toggle('active',x===t));
    root.querySelectorAll('.dp-panel').forEach(p=>p.hidden=p.dataset.panel!==t.dataset.tab);
  });
  q('.dp-chips').addEventListener('click',e=>{
    const b=e.target.closest('[data-del]'); if(!b) return;
    const runs=q('.dp-chips')._runs||[]; const r=runs[+b.dataset.del]; if(r) remove(r.dates);
  });
  q('.dp-clear').onclick=()=>{ remove([...sel]); };

  /* — hızlı ekleme panelleri — */
  const from=q('.dp-from'), to=q('.dp-to');
  from.addEventListener('change',()=>{ if(!to.value||to.value<from.value) to.value=from.value; goto(from.value); });
  to.addEventListener('change',()=>{ if(from.value&&to.value<from.value) from.value=to.value; });
  function addRangeFromInputs(){
    if(!from.value){ from.focus(); return; }
    const lst=expandRange(from.value,to.value||from.value,{skipWeekends:q('.dp-skipwe').checked});
    add(lst); goto(from.value);
    from.value=''; to.value='';
  }
  q('.dp-add-range').onclick=addRangeFromInputs;
  [from,to].forEach(i=>i.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addRangeFromInputs(); } }));

  if(isLeave){
    const cf=q('.dp-c-from'), cn=q('.dp-c-n'), cw=q('.dp-c-work');
    const calc=()=>{
      const hol=new Set(Object.keys(marks));
      return spanFromCount(cf.value,+cn.value,cw.checked,hol);
    };
    const prev=()=>{
      const r=calc(), el=q('.dp-c-prev');
      if(!cf.value||!r.dates.length){ el.textContent='Başlangıç tarihini seçin.'; return; }
      const extra=r.weekendDays?` (+${r.weekendDays} hafta sonu/tatil günü araya giriyor)`:'';
      el.textContent=`${isoDisplay(cf.value)} → ${isoDisplay(r.end)} · ${r.counted} gün sayıldı${extra}`;
    };
    [cf,cn,cw].forEach(i=>i.addEventListener('input',prev)); cw.addEventListener('change',prev);
    q('.dp-add-count').onclick=()=>{
      if(!cf.value){ cf.focus(); return; }
      const r=calc(); add(r.dates.filter(i=>!(cw.checked&&marks[i])));
      goto(cf.value); cf.value=''; prev();
    };
    cn.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); q('.dp-add-count').click(); } });
    prev();
  }
  q('.dp-add-text').onclick=()=>{
    const ta=q('.dp-text'), er=q('.dp-err');
    const defY=+view.slice(0,4);
    const res=parseDateText(ta.value,defY);
    add(res.dates);
    er.textContent=res.errors.length?`Anlaşılamadı: ${res.errors.join(' · ')}`:'';
    ta.value=res.errors.join('\n');
    if(res.dates.length) goto(res.dates[0]);
  };

  function goto(iso){ if(!iso) return; view=iso.slice(0,7)+'-01'; renderMonths(); }

  renderMonths(); renderChips();
  return {
    getDates:()=>[...sel].sort(),
    setDates(arr){ sel.clear(); (arr||[]).forEach(i=>{ if(i) sel.add(i); }); paint(); renderChips(); const f=[...sel].sort()[0]; if(f&&!opts.viewIso) goto(f); },
    addDates:add, removeDates:remove, clear:()=>remove([...sel]),
    setMarks(m){ marks=m||{}; renderMonths(); renderChips(); },
    goto, refresh(){ renderMonths(); renderChips(); }
  };
}
