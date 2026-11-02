/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.extras.js  (YENİ)
   İçerik : Gelişmiş Resmî Tatil editörü (hazır liste + takvim) ·
            Gelişmiş İzin editörü (aralık / gün sayısı / takvim) ·
            Kişi Bazlı Ayarlar · Algoritma Mantığı penceresi ·
            Yardım & Geri Bildirim butonu
   Not    : app.personel.js ve app.distribution.js'ten SONRA,
            app.calendar.js'ten SONRA, app.init.js'ten ÖNCE yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── AYARLAR (burayı düzenleyin) ─────────────────────────── */
const APP_VERSION  = '3.2';
// Geri bildirim sitenizin adresi. Alt ismi belirleyince sadece bu satırı değiştirin:
const FEEDBACK_URL = 'https://emvalis.github.io/geri-bildirim/';

(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  /* ── Tatil adları: state içinde saklanır (saveState ile birlikte kaydolur) ── */
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const d = JSON.parse(raw); if (d && d.holidayNames) state.holidayNames = d.holidayNames; }
  } catch(e){}
  const holNames = () => state.holidayNames || (state.holidayNames = {});
  const normIso  = v => { const d = parseDate(v); return d ? dateToISO(d) : null; };
  const holIsos  = () => [...new Set((state.holidays||[]).map(normIso).filter(Boolean))].sort();
  const holMarks = () => { const m={}; holIsos().forEach(i=>{ m[i] = holNames()[i] || 'Resmî tatil'; }); return m; };

  /* ── CSS ─────────────────────────────────────────────────── */
  const EX_CSS = `
  .modal-card.modal-wide{width:min(880px,100%);max-height:92vh;display:flex;flex-direction:column}
  .modal-card.modal-wide .modal-body{overflow:auto;display:flex;flex-direction:column;gap:.9rem}
  .ex-preset{display:flex;flex-wrap:wrap;gap:.6rem .9rem;align-items:flex-end;padding:.8rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:rgba(212,168,64,.06)}
  .ex-preset select,.ex-name input{background:var(--bg-card);border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:.5rem .6rem;color:var(--text-input);font-family:var(--font-m);font-size:.86rem}
  .ex-name{display:flex;flex-direction:column;gap:.25rem;font-size:.74rem;color:var(--text-muted)}
  .ex-name input{width:100%}
  .ex-msg{flex:1 1 100%;font-size:.8rem;color:var(--text-muted)}
  .ex-msg.warn{color:#D08A00}
  .ex-footer-left{margin-right:auto}
  .ex-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.38rem .7rem;border-radius:8px;border:1px solid var(--border-bright);background:rgba(212,168,64,.10);color:var(--text-primary);font-size:.78rem;font-weight:600;cursor:pointer;font-family:var(--font-b);transition:var(--transition);white-space:nowrap}
  .ex-btn:hover{background:rgba(212,168,64,.22);color:var(--gold-bright)}
  .ex-btn.has{border-color:var(--gold);background:rgba(212,168,64,.2)}
  .ex-badge{background:var(--gold);color:#120D00;border-radius:99px;padding:0 .4rem;font-size:.7rem;font-weight:800}
  .ex-dot{width:7px;height:7px;border-radius:50%;background:var(--gold)}
  .ex-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.8rem}
  .hol-quick{display:flex;gap:.5rem;align-items:center;margin-top:.6rem;flex-wrap:wrap}
  .hol-quick select{background:var(--bg-input);border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:.4rem .5rem;color:var(--text-input);font-family:var(--font-m);font-size:.82rem}
  .hol-year{width:100%;font-size:.7rem;letter-spacing:.1em;color:var(--text-dim);margin:.3rem 0 .1rem}
  .holiday-chip .hc-x{margin-left:.45rem;border:none;background:transparent;color:inherit;cursor:pointer;opacity:.7;font-size:.75rem}
  .holiday-chip .hc-x:hover{opacity:1}
  /* kişi bazlı ayarlar */
  .po-tools{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
  .po-tools input[type=search]{flex:1 1 200px;background:var(--bg-input);border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:.5rem .7rem;color:var(--text-input);font-size:.86rem}
  .po-bulk{display:none;flex-wrap:wrap;gap:.6rem;align-items:flex-end;padding:.7rem;border:1px dashed var(--border-bright);border-radius:var(--radius-sm);background:rgba(212,168,64,.07)}
  .po-bulk.show{display:flex}
  .po-wrap{overflow:auto;border:1px solid var(--border);border-radius:var(--radius-sm);max-height:48vh}
  .po-table{width:100%;border-collapse:collapse;font-size:.84rem}
  .po-table th{position:sticky;top:0;background:var(--bg-mid);color:var(--gold-light);font-family:var(--font-d);font-size:.7rem;letter-spacing:.06em;padding:.5rem;text-align:left;z-index:1}
  .po-table td{padding:.45rem .5rem;border-top:1px solid var(--border);vertical-align:middle;color:var(--text-primary)}
  .po-table tr.flash td{animation:poFlash 1.6s}
  @keyframes poFlash{0%,60%{background:rgba(212,168,64,.3)}100%{background:transparent}}
  .po-table small{color:var(--text-muted)}
  .po-table input[type=number]{width:5.2rem;background:var(--bg-input);border:1px solid rgba(128,128,128,.28);border-radius:7px;padding:.35rem .4rem;color:var(--text-input);font-family:var(--font-m)}
  .po-table select,.po-bulk select,.po-bulk input[type=number]{background:var(--bg-input);border:1px solid rgba(128,128,128,.28);border-radius:7px;padding:.35rem .4rem;color:var(--text-input);font-size:.82rem}
  .po-bulk input[type=number]{width:5.2rem}
  .po-days{display:flex;gap:2px}
  .po-days button{width:28px;height:26px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);font-size:.68rem;cursor:pointer;padding:0}
  .po-days button.off{background:rgba(224,80,80,.28);border-color:rgba(224,80,80,.6);color:var(--text-bright);font-weight:700}
  .po-reset{border:1px solid var(--border);background:transparent;color:var(--text-muted);border-radius:6px;cursor:pointer;width:26px;height:26px}
  .po-reset:hover{color:var(--gold-bright);border-color:var(--border-bright)}
  .po-hint{font-size:.78rem;color:var(--text-muted);line-height:1.5}
  /* algoritma penceresi */
  .al-steps{display:flex;flex-direction:column;gap:.7rem;counter-reset:al}
  .al-step{display:flex;gap:.8rem;padding:.8rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input)}
  .al-step::before{counter-increment:al;content:counter(al);flex:0 0 28px;height:28px;border-radius:50%;background:var(--gold);color:#120D00;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:var(--font-m)}
  .al-step strong{display:block;color:var(--text-bright);margin-bottom:.2rem}
  .al-step span{font-size:.86rem;color:var(--text-muted);line-height:1.55}
  .al-rules{width:100%;border-collapse:collapse;font-size:.84rem}
  .al-rules td{padding:.45rem .6rem;border-top:1px solid var(--border);color:var(--text-primary)}
  .al-rules td:last-child{font-family:var(--font-m);color:var(--gold-bright);text-align:right;white-space:nowrap}
  /* yardım / geri bildirim */
  .fab{position:fixed;right:1rem;bottom:1rem;z-index:300;display:flex;flex-direction:column;align-items:flex-end;gap:.5rem}
  .fab-btn{display:flex;align-items:center;gap:.5rem;padding:.7rem 1.1rem;border-radius:99px;border:1px solid var(--border-bright);background:var(--gold);color:#120D00;font-weight:800;font-size:.86rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:var(--font-b);transition:var(--transition)}
  .fab-btn:hover{transform:translateY(-2px)}
  .fab-menu{display:none;flex-direction:column;min-width:240px;border:1px solid var(--border-bright);border-radius:var(--radius-sm);background:var(--bg-modal);box-shadow:0 18px 50px rgba(0,0,0,.5);overflow:hidden}
  .fab-menu.open{display:flex}
  .fab-menu a,.fab-menu button{display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border:none;border-bottom:1px solid var(--border);background:transparent;color:var(--text-primary);font-size:.86rem;cursor:pointer;text-decoration:none;text-align:left;font-family:var(--font-b)}
  .fab-menu a:hover,.fab-menu button:hover{background:rgba(212,168,64,.14);color:var(--gold-bright)}
  .fab-menu .fab-ver{padding:.45rem 1rem;font-size:.7rem;color:var(--text-dim);font-family:var(--font-m)}
  /* geri bildirim QR */
  .fb-qr{width:208px;height:208px;margin:0 auto 1rem;padding:12px;background:#fff;border-radius:var(--radius);border:1px solid var(--border-bright);display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.25);animation:fbIn .5s cubic-bezier(.34,1.56,.64,1) both}
  .fb-qr svg{width:100%;height:100%;display:block}
  .fb-fail{font-size:.8rem;color:#5E6C80;text-align:center;line-height:1.5}
  @keyframes fbIn{from{opacity:0;transform:scale(.85)}}
  .fb-note{display:flex;gap:.6rem;align-items:flex-start;padding:.7rem .85rem;margin-bottom:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);font-size:.84rem;line-height:1.5;color:var(--text-muted)}
  .fb-note b{color:var(--text-bright)}
  .fb-go{text-decoration:none}

  .hdr-help{display:flex;align-items:center;gap:.4rem;height:38px;padding:0 .8rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-primary);font-size:.8rem;font-weight:600;cursor:pointer;font-family:var(--font-b)}
  .hdr-help:hover{border-color:var(--border-bright);color:var(--gold-bright)}
  @media(max-width:768px){.hdr-help span{display:none}.fab-btn span{display:none}.fab-btn{padding:.8rem}}
  @media(max-width:520px){.ex-btn .lbl{display:none}}
  `;
  const st = document.createElement('style'); st.id = 'exStyles'; st.textContent = EX_CSS; document.head.appendChild(st);

  /* ── Modal yardımcıları ─────────────────────────────────── */
  function modalShell(ovId, title, bodyHtml, footerHtml){
    let ov = $(ovId);
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'modal-overlay'; ov.id = ovId;
      ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
      ov.innerHTML = '<div class="modal-card"></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    }
    const card = ov.querySelector('.modal-card');
    card.classList.add('modal-wide');
    card.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="closeModal('${ovId}')" aria-label="Kapat">✕</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml?`<div class="modal-footer">${footerHtml}</div>`:''}`;
    return card;
  }

  /* ══════════════════════════════════════════════════════════
     1) RESMÎ TATİL EDİTÖRÜ
     ══════════════════════════════════════════════════════════ */
  let holPicker = null, holDraftNames = {};

  window.openHolidayModal = function(){
    holDraftNames = Object.assign({}, holNames());
    const y0 = +($('set-yil') && $('set-yil').value) || new Date().getFullYear();
    const cy = new Date().getFullYear();
    let yearOpts = '';
    for (let y=cy-1; y<=cy+4; y++) yearOpts += `<option value="${y}"${y===y0?' selected':''}>${y}</option>`;
    const card = modalShell('holidayModal','⊛ Resmî Tatil Günleri',`
      <div class="ex-preset">
        <label class="dp-field">Yıl<select id="holYear">${yearOpts}</select></label>
        <label class="dp-chk"><input type="checkbox" id="holArife"> Arife (yarım gün) günlerini de ekle</label>
        <button type="button" class="dp-btn" id="holPreset">🇹🇷 Resmî tatilleri ekle</button>
        <button type="button" class="dp-btn ghost" id="holYearClear">Bu yılın tatillerini sil</button>
        <div class="ex-msg" id="holMsg">Hazır liste: sabit tatiller + Ramazan/Kurban bayramı (Diyanet takvimi). Sonra takvimden elle ekleyip çıkarabilirsiniz.</div>
      </div>
      <label class="ex-name">Elle eklenecek tatilin adı (isteğe bağlı)
        <input type="text" id="holName" maxlength="60" placeholder="Örn: İdari izin, Yerel tatil..."></label>
      <div id="holPicker"></div>`,
      `<button class="btn-secondary" onclick="closeModal('holidayModal')">İptal</button>
       <button class="btn-primary btn-inline" id="holSave">Kaydet</button>`);
    holPicker = createDatePicker(card.querySelector('#holPicker'), {
      title:'holiday',
      nameOf: iso => holDraftNames[iso],
      onChange: (dates,{added,removed}) => {
        const nm = ($('holName') && $('holName').value.trim()) || 'Resmî tatil';
        added.forEach(i => { if (!holDraftNames[i]) holDraftNames[i] = nm; });
        removed.forEach(i => { delete holDraftNames[i]; });
      },
      summary: d => `Toplam: <b>${d.length}</b> tatil günü`
    });
    holPicker.setDates(holIsos());

    $('holPreset').onclick = () => {
      const y = +$('holYear').value;
      const r = trHolidaysForYear(y, {arife: $('holArife').checked});
      r.list.forEach(h => { holDraftNames[h.iso] = h.name; });
      const n = holPicker.addDates(r.list.map(h => h.iso));
      holPicker.refresh();
      const msg = $('holMsg');
      msg.className = 'ex-msg' + (r.religiousKnown ? '' : ' warn');
      msg.textContent = `${y}: ${n} gün eklendi${r.list.length-n ? ` (${r.list.length-n} tanesi zaten vardı)` : ''}.` +
        (r.religiousKnown ? '' : ` ⚠ ${y} için dinî bayram tarihleri henüz tanımlı değil; yalnızca sabit tatiller eklendi. Bayramları “Tarih aralığı” sekmesiyle ekleyin.`);
      if (r.list.length) holPicker.goto(r.list[0].iso);
    };
    $('holYearClear').onclick = () => {
      const y = $('holYear').value;
      const n = holPicker.removeDates(holPicker.getDates().filter(i => i.startsWith(y+'-')));
      holPicker.refresh();
      $('holMsg').className = 'ex-msg'; $('holMsg').textContent = `${y}: ${n} tatil günü silindi.`;
    };
    $('holSave').onclick = saveHolidays;
    openModal('holidayModal');
  };

  window.saveHolidays = function(){
    if (!holPicker) return;
    const dates = holPicker.getDates();
    state.holidays = dates;
    const keep = {}; dates.forEach(i => { if (holDraftNames[i]) keep[i] = holDraftNames[i]; });
    state.holidayNames = keep;
    saveState(); closeModal('holidayModal'); renderHolidayChips(); updateStats();
    Sounds.success(); notify(`${dates.length} tatil günü kaydedildi.`,'success');
  };

  window.renderHolidayChips = function(){
    const box = $('holidayChips'); if (!box) return;
    const dates = holIsos();
    if (!dates.length) { box.innerHTML = '<span style="color:var(--text-dim);font-size:.82rem">Tanımlı tatil yok. “Hazır listeyi ekle” ile başlayın.</span>'; return; }
    const names = holNames();
    const runs = groupRuns(dates,false);
    let html = '', lastY = '';
    runs.forEach((r,i) => {
      const y = r.start.slice(0,4);
      if (y !== lastY) { html += `<div class="hol-year">${y}</div>`; lastY = y; }
      const nm = [...new Set(r.dates.map(d => names[d]).filter(Boolean))];
      const label = r.start===r.end ? isoDisplay(r.start) : `${isoDisplay(r.start)} – ${isoDisplay(r.end)}`;
      html += `<span class="holiday-chip" title="${esc(nm.join(', '))}">${label}${nm.length===1?` · ${esc(nm[0])}`:''}<button class="hc-x" data-run="${i}" aria-label="Sil">✕</button></span>`;
    });
    box.innerHTML = html; box._runs = runs;
    if (!box._wired) {
      box._wired = true;
      box.addEventListener('click', e => {
        const b = e.target.closest('.hc-x'); if (!b) return;
        const r = (box._runs||[])[+b.dataset.run]; if (!r) return;
        const del = new Set(r.dates);
        state.holidays = holIsos().filter(i => !del.has(i));
        r.dates.forEach(i => delete holNames()[i]);
        saveState(); renderHolidayChips(); updateStats(); Sounds.delete();
      });
    }
  };

  function injectHolidayQuick(){
    const btn = document.querySelector('button[onclick="openHolidayModal()"]');
    if (!btn || $('holQuickYear')) return;
    const cy = new Date().getFullYear();
    let o = ''; for (let y=cy-1; y<=cy+4; y++) o += `<option value="${y}"${y===cy?' selected':''}>${y}</option>`;
    const row = document.createElement('div'); row.className = 'hol-quick';
    row.innerHTML = `<select id="holQuickYear" aria-label="Yıl">${o}</select>
      <button type="button" class="ex-btn" id="holQuickBtn">🇹🇷 Hazır listeyi ekle</button>`;
    btn.insertAdjacentElement('afterend', row);
    $('holQuickBtn').onclick = () => {
      const y = +$('holQuickYear').value;
      const r = trHolidaysForYear(y,{arife:false});
      const have = new Set(holIsos()); let n = 0;
      r.list.forEach(h => { if (!have.has(h.iso)) { state.holidays.push(h.iso); n++; } holNames()[h.iso] = h.name; });
      state.holidays = holIsos();
      saveState(); renderHolidayChips(); updateStats(); Sounds.success();
      notify(`${y}: ${n} tatil günü eklendi.` + (r.religiousKnown ? '' : ' ⚠ Dinî bayram tarihleri bu yıl için henüz tanımlı değil, onları elle ekleyin.'), r.religiousKnown?'success':'warning', 6500);
    };
  }

  /* ══════════════════════════════════════════════════════════
     2) İZİN EDİTÖRÜ
     ══════════════════════════════════════════════════════════ */
  let leavePicker = null;

  window.openLeaveModal = function(group, idx){
    currentLeaveGroup = group; currentLeaveIdx = idx;
    const p = state[group].people[idx];
    const marks = holMarks();
    const card = modalShell('leaveModal', `📅 İzin Günleri — ${esc(p.ad)}`,
      `<p class="modal-hint" style="margin:0">Tek tek tarih yazmaya gerek yok: <b>aralık</b> seçin, <b>gün sayısı</b> girin veya takvimde <b>sürükleyin</b>. Çizgili günler resmî tatildir.</p>
       <div id="leavePicker"></div>`,
      `<button class="btn-secondary ex-footer-left" id="leaveClear">Tümünü temizle</button>
       <button class="btn-secondary" onclick="closeModal('leaveModal')">İptal</button>
       <button class="btn-primary btn-inline" id="leaveSave">Kaydet</button>`);
    leavePicker = createDatePicker(card.querySelector('#leavePicker'), {
      title:'leave', marks, skipMarked:true,
      summary: d => {
        const wd = d.filter(i => !isWeekendIso(i) && !marks[i]).length;
        return `Toplam: <b>${d.length}</b> gün · <b>${wd}</b> iş günü`;
      }
    });
    leavePicker.setDates((p.leaves||[]).map(normIso).filter(Boolean));
    $('leaveClear').onclick = () => leavePicker.clear();
    $('leaveSave').onclick  = saveLeave;
    openModal('leaveModal');
  };

  window.saveLeave = function(){
    if (!leavePicker || currentLeaveGroup==null) return;
    const p = state[currentLeaveGroup].people[currentLeaveIdx];
    p.leaves = leavePicker.getDates();
    saveState(); closeModal('leaveModal'); Sounds.success();
    notify(`${p.ad}: ${p.leaves.length} izin günü kaydedildi.`,'success');
    renderPersonelList();
  };

  /* ══════════════════════════════════════════════════════════
     3) KİŞİ BAZLI AYARLAR
     ══════════════════════════════════════════════════════════ */
  const FOCUS_LABELS = [
    ['auto','Genel ayar'], ['weekday','Sadece hafta içi'], ['weekend','Sadece hafta sonu'],
    ['wd70','Hafta içi ağırlıklı (30/70)'], ['bal','Dengeli (50/50)'], ['we70','Hafta sonu ağırlıklı (70/30)']
  ];
  const DOW_BTN = [['Pt',1],['Sa',2],['Ça',3],['Pe',4],['Cu',5],['Ct',6],['Pz',0]];
  let PO = null;

  function optSummary(o){
    if (!o) return '';
    const parts = [];
    if (typeof o.targetH==='number') parts.push(`${o.targetH} sa`);
    if (o.focus && o.focus!=='auto') parts.push((FOCUS_LABELS.find(f=>f[0]===o.focus)||[])[1]||'');
    if (o.blocked && o.blocked.length) parts.push('Yok: ' + DOW_BTN.filter(d=>o.blocked.includes(d[1])).map(d=>d[0]).join(','));
    return parts.join(' · ');
  }
  const cleanOpts = o => {
    const r = {};
    if (typeof o.targetH==='number' && Number.isFinite(o.targetH) && o.targetH>=0) r.targetH = o.targetH;
    if (o.focus && o.focus!=='auto') r.focus = o.focus;
    if (o.blocked && o.blocked.length) r.blocked = [...new Set(o.blocked)].sort();
    return Object.keys(r).length ? r : null;
  };
  const focusSelect = (cls,val,withKeep) => `<select class="${cls}">${withKeep?'<option value="__keep">— değiştirme —</option>':''}${
    FOCUS_LABELS.map(f=>`<option value="${f[0]}"${f[0]===val?' selected':''}>${f[1]}</option>`).join('')}</select>`;
  const dayBtns = (blocked,cls) => `<div class="po-days ${cls||''}">${DOW_BTN.map(d=>
    `<button type="button" data-d="${d[1]}" class="${blocked.includes(d[1])?'off':''}" title="Bu gün çalışamaz">${d[0]}</button>`).join('')}</div>`;

  window.openPersonOpts = function(group, focusIdx){
    group = group || ($('set-grup') && $('set-grup').value) || 'kadrolu';
    const people = state[group].people;
    if (!people.length) { notify('Önce personel ekleyin.','warning'); return; }
    PO = { group, draft: people.map(p => JSON.parse(JSON.stringify(p.opts||{}))), sel:new Set(), bulkDays:[] };
    const gh = ($('set-hedef') && $('set-hedef').value) || '50';
    const card = modalShell('personOptModal', `⚙️ Kişi Bazlı Ayarlar — ${group==='kadrolu'?'Kadrolu':'Sözleşmeli'}`, `
      <p class="po-hint">Boş bıraktığınız alanlar <b>genel ayarı</b> kullanır (hedef: ${esc(gh)} saat). Örnek: bir personele 30 saat, başka birine sadece hafta sonu, bir diğerine Cuma günleri hariç.</p>
      <div class="po-tools">
        <input type="search" id="poSearch" placeholder="Ad veya sicil ara..." aria-label="Ara">
        <button type="button" class="ex-btn" id="poAll">Tümünü seç</button>
        <button type="button" class="ex-btn" id="poNone">Seçimi kaldır</button>
        <button type="button" class="ex-btn" id="poResetAll">↺ Hepsini sıfırla</button>
      </div>
      <div class="po-bulk" id="poBulk">
        <strong id="poBulkCount" style="width:100%;font-size:.82rem"></strong>
        <label class="dp-field">Hedef (saat)<input type="number" id="poBulkTarget" min="0" max="200" placeholder="değiştirme"></label>
        <label class="dp-field">Odak ${focusSelect('','__keep',true).replace('<select class="">','<select id="poBulkFocus">')}</label>
        <div class="dp-field">Çalışamayacağı günler${dayBtns([], 'po-bulkdays')}</div>
        <label class="dp-chk"><input type="checkbox" id="poBulkDaysOn"> Günleri de uygula</label>
        <button type="button" class="dp-btn" id="poBulkApply">Seçililere uygula</button>
        <button type="button" class="dp-btn ghost" id="poBulkClear">Seçililerin ayarını sıfırla</button>
      </div>
      <div class="po-wrap"><table class="po-table"><thead><tr>
        <th style="width:34px"><input type="checkbox" id="poChkAll" aria-label="Tümünü seç"></th><th>Personel</th><th>Hedef (sa)</th><th>Odak</th><th>Çalışamayacağı günler</th><th></th>
        </tr></thead><tbody id="poBody"></tbody></table></div>`,
      `<button class="btn-secondary" onclick="closeModal('personOptModal')">İptal</button>
       <button class="btn-primary btn-inline" id="poSave">Kaydet</button>`);

    const body = card.querySelector('#poBody');
    function rowHtml(p,i){
      const o = PO.draft[i];
      return `<tr data-i="${i}"><td><input type="checkbox" class="po-chk"${PO.sel.has(i)?' checked':''}></td>
        <td><b>${esc(p.ad)}</b><br><small>${esc(p.sicil)}${p.unvan?' · '+esc(p.unvan):''}</small></td>
        <td><input type="number" class="po-target" min="0" max="200" step="1" placeholder="genel" value="${typeof o.targetH==='number'?o.targetH:''}"></td>
        <td>${focusSelect('po-focus',o.focus||'auto')}</td>
        <td>${dayBtns(o.blocked||[])}</td>
        <td><button type="button" class="po-reset" title="Bu kişiyi sıfırla">↺</button></td></tr>`;
    }
    function render(){
      const q = ($('poSearch').value||'').toLocaleLowerCase('tr-TR');
      body.innerHTML = people.map((p,i)=>(!q || `${p.ad} ${p.sicil}`.toLocaleLowerCase('tr-TR').includes(q)) ? rowHtml(p,i) : '').join('');
      updBulk();
    }
    function updBulk(){
      const n = PO.sel.size;
      $('poBulk').classList.toggle('show', n>0);
      $('poBulkCount').textContent = `${n} kişi seçili`;
    }
    render();

    $('poSearch').oninput = render;
    $('poAll').onclick  = () => { people.forEach((p,i)=>PO.sel.add(i)); render(); };
    $('poNone').onclick = () => { PO.sel.clear(); render(); };
    $('poChkAll').onchange = e => { PO.sel.clear(); if (e.target.checked) people.forEach((p,i)=>PO.sel.add(i)); render(); };
    $('poResetAll').onclick = () => { PO.draft = people.map(()=>({})); render(); };

    body.addEventListener('change', e => {
      const tr = e.target.closest('tr'); if (!tr) return; const i = +tr.dataset.i;
      if (e.target.classList.contains('po-chk')) { e.target.checked ? PO.sel.add(i) : PO.sel.delete(i); updBulk(); }
      else if (e.target.classList.contains('po-target')) {
        const v = e.target.value.trim();
        if (v==='') delete PO.draft[i].targetH; else PO.draft[i].targetH = Math.max(0,Math.min(200,+v));
      }
      else if (e.target.classList.contains('po-focus')) PO.draft[i].focus = e.target.value;
    });
    body.addEventListener('click', e => {
      const tr = e.target.closest('tr'); if (!tr) return; const i = +tr.dataset.i;
      const d = e.target.closest('.po-days button');
      if (d) {
        const n = +d.dataset.d, b = PO.draft[i].blocked || (PO.draft[i].blocked = []);
        const k = b.indexOf(n); k>=0 ? b.splice(k,1) : b.push(n);
        d.classList.toggle('off'); return;
      }
      if (e.target.closest('.po-reset')) { PO.draft[i] = {}; render(); }
    });
    // toplu işlemler
    card.querySelector('.po-bulkdays').addEventListener('click', e => {
      const d = e.target.closest('button'); if (!d) return;
      const n = +d.dataset.d, k = PO.bulkDays.indexOf(n); k>=0 ? PO.bulkDays.splice(k,1) : PO.bulkDays.push(n);
      d.classList.toggle('off');
    });
    $('poBulkApply').onclick = () => {
      const t = $('poBulkTarget').value.trim(), f = $('poBulkFocus').value, days = $('poBulkDaysOn').checked;
      PO.sel.forEach(i => {
        if (t!=='') PO.draft[i].targetH = Math.max(0,Math.min(200,+t));
        if (f!=='__keep') PO.draft[i].focus = f;
        if (days) PO.draft[i].blocked = [...PO.bulkDays];
      });
      render(); notify(`${PO.sel.size} kişiye uygulandı (Kaydet ile onaylayın).`,'info',2500);
    };
    $('poBulkClear').onclick = () => { PO.sel.forEach(i => { PO.draft[i] = {}; }); render(); };
    $('poSave').onclick = () => {
      let n = 0;
      people.forEach((p,i) => { const c = cleanOpts(PO.draft[i]); if (c) { p.opts = c; n++; } else delete p.opts; });
      saveState(); closeModal('personOptModal'); renderPersonelList(); refreshDagitimInfo();
      Sounds.success(); notify(n ? `${n} kişide özel ayar kayıtlı.` : 'Tüm kişiler genel ayarı kullanıyor.','success');
    };
    openModal('personOptModal');
    if (focusIdx!=null) {
      const tr = body.querySelector(`tr[data-i="${focusIdx}"]`);
      if (tr) { tr.scrollIntoView({block:'center'}); tr.classList.add('flash'); }
    }
  };

  /* ── Personel listesine görünür butonlar ── */
  function decoratePersonelList(){
    const list = $('personelList'); if (!list) return;
    const grp = state[activePersonelGroup]; if (!grp) return;
    list.querySelectorAll('.personel-item').forEach((it,i) => {
      const p = grp.people[i]; if (!p) return;
      const acts = it.querySelector('.item-actions'); if (!acts) return;
      const lv = (p.leaves||[]).length, hasOpt = !!(p.opts && Object.keys(p.opts).length);
      acts.innerHTML = `
        <button class="ex-btn${lv?' has':''}" onclick="openLeaveModal('${activePersonelGroup}',${i})" title="İzin günlerini düzenle">📅 <span class="lbl">İzin</span>${lv?` <span class="ex-badge">${lv}</span>`:''}</button>
        <button class="ex-btn${hasOpt?' has':''}" onclick="openPersonOpts('${activePersonelGroup}',${i})" title="Kişiye özel mesai ayarı">⚙️ <span class="lbl">Ayar</span>${hasOpt?' <span class="ex-dot"></span>':''}</button>
        <button class="item-btn danger" title="Sil" onclick="removePerson('${activePersonelGroup}',${i})" aria-label="Sil">✕</button>`;
      const meta = it.querySelector('.item-meta');
      if (meta && hasOpt) meta.textContent += ' · ⚙ ' + optSummary(p.opts);
    });
  }
  const _origRPL = window.renderPersonelList;
  window.renderPersonelList = function(){ _origRPL.apply(this, arguments); decoratePersonelList(); };

  /* ══════════════════════════════════════════════════════════
     4) ALGORİTMA PENCERESİ
     ══════════════════════════════════════════════════════════ */
  window.openAlgoModal = function(){
    const R = RULES, h = m => (m/60).toString().replace('.',',') + ' saat';
    modalShell('algoModal','🧠 Algoritma Nasıl Çalışır?',`
      <p class="po-hint">Dağıtım tamamen <b>kurallara dayalı rastgele bir planlayıcıdır</b>: her “Dağıt”a bastığınızda yeni bir tohum seçilir, bu yüzden her plan farklıdır ama hepsi aynı kurallara uyar.</p>
      <div class="al-steps">
        <div class="al-step"><div><strong>Hedefler belirlenir</strong><span>Eşit dağıtımda herkese aynı hedef saat yazılır. “Ağırlıklı rastgele”de toplam korunur, kişiler hedefin ±%${Math.round(R.RANDOM_SPREAD*100)}’i kadar sapar; kapasitesini aşan kişinin fazlası diğerlerine aktarılır. Kişiye özel hedef girdiyseniz o kişi bu havuzun dışında kalır.</span></div></div>
        <div class="al-step"><div><strong>Müsait günler çıkarılır</strong><span>Resmî tatiller, kişinin izinleri, “çalışamaz” işaretlediği haftanın günleri ve (kapalıysa) hafta sonları listeden düşülür. “Sadece hafta içi / hafta sonu” seçilen kişide diğer gün tipi de düşer.</span></div></div>
        <div class="al-step"><div><strong>Tur tur dağıtılır</strong><span>Her turda herkes <b>rastgele sırayla</b> bir parça alır. Böylece listenin başındaki kişi en iyi günleri kapmaz; herkes aynı anda ilerler.</span></div></div>
        <div class="al-step"><div><strong>Gün puanlanır</strong><span>Her aday gün için puan hesaplanır, en düşük puan seçilir: rastgelelik + o gün zaten mesaiye kalan kişi sayısı (günlere eşit yayılım) + kişinin o haftaki yükü + yan yana mesai günü + aynı güne ikinci kez ekleme. Gün uzunluğu rastgele seçilir (hafta içi 2–3 saat, hafta sonu 4–6 saat).</span></div></div>
        <div class="al-step"><div><strong>Kurallar denetlenir</strong><span>Aşağıdaki sınırlar her atamada kontrol edilir. Hedefe başka türlü ulaşılamazsa sırayla kademeli esneme yapılır (önce hafta sonu tek gün ve ardışık gün kuralı, sonra günlük kişi sınırı). Günlük ve haftalık saat sınırları asla esnemez. Yine de ulaşılamazsa eksik saat raporda kırmızı gösterilir.</span></div></div>
      </div>
      <table class="al-rules"><tbody>
        <tr><td>Hafta içi günlük fazla mesai (üst sınır)</td><td>${h(WD_OT_MAX)}</td></tr>
        <tr><td>Hafta sonu günlük mesai (09–12 + 13–16)</td><td>${h(WE_FULL)}</td></tr>
        <tr><td>Haftalık fazla mesai (üst sınır)</td><td>${h(R.WEEK_OT_MAX)}</td></tr>
        <tr><td>Bir güne yazılan en küçük mesai</td><td>${h(R.MIN_DAY)}</td></tr>
        <tr><td>Üst üste en çok mesaili gün</td><td>${R.MAX_STREAK} gün</td></tr>
        <tr><td>Aynı hafta sonunda kişi başı en çok gün</td><td>${R.ONE_WE_DAY?'1 gün':'sınırsız'}</td></tr>
        <tr><td>Aynı gün mesaiye kalan en çok kişi</td><td>${R.MAX_PER_DAY>0?R.MAX_PER_DAY+' kişi':'sınırsız'}</td></tr>
      </tbody></table>
      <p class="po-hint"></p>`,
      `<button class="btn-primary btn-inline" onclick="closeModal('algoModal')">Anladım</button>`);
    openModal('algoModal');
  };




  /* ══════════════════════════════════════════════════════════
     5) YARDIM & GERİ BİLDİRİM
     ══════════════════════════════════════════════════════════ */
  function feedbackUrl(){
    const sec = (document.querySelector('.section.active')||{}).id || '';
    const sep = FEEDBACK_URL.includes('?') ? '&' : '?';
    return `${FEEDBACK_URL}${sep}v=${APP_VERSION}&sayfa=${encodeURIComponent(sec.replace('sec-',''))}`;
  }


  window.openFeedbackModal = function(){
    window.open(feedbackUrl(), '_blank', 'noopener');
  };  

  function buildFab(){
    if ($('fabRoot')) return;
    const fab = document.createElement('div'); fab.className = 'fab'; fab.id = 'fabRoot';
    fab.innerHTML = `
      <div class="fab-menu" id="fabMenu" role="menu">
        <button type="button" data-act="algo">🧠 Algoritma nasıl çalışır?</button>
        <button type="button" data-act="video">🎬 Nasıl kullanılır? (video)</button>
        <button type="button" data-act="feedback">💬 Öneri · Hata · Görüş</button>
        <div class="fab-ver">Emvalis v${APP_VERSION}</div>
      </div>
      <button type="button" class="fab-btn" id="fabBtn" aria-haspopup="true" aria-expanded="false">💬 <span>Öneri / Hata</span></button>`;
    document.body.appendChild(fab);
    const menu = $('fabMenu');
    window.toggleFab = function(force){
      const open = force!=null ? force : !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      $('fabBtn').setAttribute('aria-expanded', open);
    };
    $('fabBtn').onclick = () => toggleFab();
    menu.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      toggleFab(false);
      if (b.dataset.act==='algo') openAlgoModal();
      else if (b.dataset.act==='video') openVideoModal();
      else if (b.dataset.act==='feedback') openFeedbackModal();
    });
    document.addEventListener('click', e => { if (!fab.contains(e.target) && !e.target.closest('.hdr-help')) toggleFab(false); });
    document.addEventListener('keydown', e => { if (e.key==='Escape') toggleFab(false); });
  }




  /* ══════════════════════════════════════════════════════════
     6) ARAYÜZE BAĞLANTILAR (butonlar, uyarılar)
     ══════════════════════════════════════════════════════════ */
  function refreshDagitimInfo(){
    const box = $('personel-info-box'); if (!box) return;
    const grup = ($('set-grup')||{}).value || 'kadrolu';
    const n = (state[grup]||{people:[]}).people.filter(p => p.opts && Object.keys(p.opts).length).length;
    box.textContent = box.textContent.replace(/ · \d+ kişide özel ayar.*$/,'');
    if (n) box.textContent += ` · ${n} kişide özel ayar var.`;
  }
  const _origUPIB = window.updatePersonelInfoBox;
  window.updatePersonelInfoBox = function(){ _origUPIB.apply(this, arguments); refreshDagitimInfo(); };

  function injectDagitimButtons(){
    const box = $('personel-info-box');
    if (box && !$('exDagitimActions')) {
      const row = document.createElement('div'); row.className = 'ex-actions'; row.id = 'exDagitimActions';
      row.innerHTML = `
        <button type="button" class="ex-btn" onclick="openPersonOpts()">⚙️ Kişi Bazlı Ayarlar</button>
        <button type="button" class="ex-btn" onclick="openHolidayModal()">⊛ Resmî Tatiller</button>
        <button type="button" class="ex-btn" onclick="showSection('personel')">📅 İzinler</button>`;
      box.insertAdjacentElement('afterend', row);
    }
    const ph = document.querySelector('#sec-dagitim .panel-header');
    if (ph && !$('exAlgoBtn')) {
      const b = document.createElement('button'); b.type='button'; b.id='exAlgoBtn'; b.className='ex-btn';
      b.textContent = '🧠 Algoritma nasıl çalışır?'; b.onclick = openAlgoModal; ph.appendChild(b);
    }
  }
  function injectHeaderAndDrawer(){
    const dn = document.querySelector('.drawer-nav');
    if (dn && !$('drawerAlgo')) {
      dn.insertAdjacentHTML('beforeend', `
        <button class="drawer-nav-btn" id="drawerAlgo" onclick="openAlgoModal();closeDrawer()"><span>🧠</span> Algoritma</button>
        <button class="drawer-nav-btn" onclick="closeDrawer();toggleFab(true)"><span>💬</span> Öneri / Hata</button>`);
    }
  }

  // Dağıtımdan önce: ayın resmî tatili tanımlı değilse uyar (engellemez)
  const _origGen = window.generateDistribution;
  window.generateDistribution = function(){
    try {
      const y = +$('set-yil').value, m = +$('set-ay').value;
      const have = new Set(holIsos());
      const miss = trHolidaysForYear(y).list.filter(h => +h.iso.slice(5,7)===m && !have.has(h.iso));
      if (miss.length) notify(`Bu ayda tanımlı olmayan resmî tatil var: ${miss.map(h=>isoDisplay(h.iso).slice(0,5)+' '+h.name).join(', ')}. Personel sayfasından “Hazır listeyi ekle” ile ekleyebilirsiniz.`,'warning',9000);
    } catch(e){}
    return _origGen.apply(this, arguments);
  };

  /* ── Başlat ── */
  injectHolidayQuick(); injectDagitimButtons(); injectHeaderAndDrawer(); buildFab();
  refreshDagitimInfo();
})();
