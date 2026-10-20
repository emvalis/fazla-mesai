/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.personel.js  (3/6)
   İçerik : Personel yönetimi (ekle/sil/düzenle) · CSV
            içe/dışa aktarım · Resmi tatiller · Slider'lar
   Not    : app.core.js ve app.ui.js'ten sonra yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── PERSONEL ────────────────────────────────────────────── */
function switchPersonelTab(group) {
  activePersonelGroup = group;
  Sounds.tabSwitch();
  document.getElementById('tbtn-kadrolu').classList.toggle('active', group==='kadrolu');
  document.getElementById('tbtn-sozlesmeli').classList.toggle('active', group==='sozlesmeli');
  const lbl = document.getElementById('active-group-label');
  if (lbl) {
    lbl.textContent = group==='kadrolu' ? 'Kadrolu Personel' : 'Sözleşmeli Personel';
    lbl.className = group==='kadrolu' ? 'group-label-kadrolu' : 'group-label-sozlesmeli';
  }
  // accent strip on cards
  const listCard = document.querySelector('.personel-list-card');
  const addCard  = document.querySelector('.add-form-card');
  if (listCard) { listCard.classList.toggle('group-kadrolu', group==='kadrolu'); listCard.classList.toggle('group-sozlesmeli', group==='sozlesmeli'); }
  if (addCard)  { addCard.classList.toggle('group-kadrolu', group==='kadrolu');  addCard.classList.toggle('group-sozlesmeli', group==='sozlesmeli'); }
  renderPersonelList();
}

function addPerson() {
  const sicil = document.getElementById('inp-sicil').value.trim();
  const ad    = document.getElementById('inp-ad').value.trim();
  const unvan = document.getElementById('inp-unvan').value.trim();
  if (!sicil) { notify('Sicil no zorunlu!','error'); Sounds.error(); return; }
  if (!ad)    { notify('Ad Soyad zorunlu!','error'); Sounds.error(); return; }
  if (state[activePersonelGroup].people.some(p=>p.sicil===sicil)) {
    notify('Bu sicil zaten kayıtlı!','warning'); Sounds.error(); return;
  }
  state[activePersonelGroup].people.push({ sicil, ad, unvan, leaves:[] });
  saveState(); renderPersonelList(); updateStats();
  ['inp-sicil','inp-ad','inp-unvan'].forEach(id => document.getElementById(id).value='');
  document.getElementById('inp-sicil').focus();
  Sounds.add();
  notify(`${ad} başarıyla eklendi.`, 'success');
}

function removePerson(group, idx) {
  if (!confirm('Bu personeli silmek istiyor musunuz?')) return;
  const name = state[group].people[idx].ad;
  state[group].people.splice(idx,1);
  saveState(); renderPersonelList(); updateStats();
  Sounds.delete();
  notify(`${name} silindi.`, 'info');
}

function openLeaveModal(group, idx) {
  currentLeaveGroup = group; currentLeaveIdx = idx;
  const p = state[group].people[idx];
  document.getElementById('leaveModalTitle').textContent = `📅 İzin Günleri — ${p.ad}`;
  document.getElementById('leaveText').value =
    (p.leaves||[]).map(l=>{ const d=parseDate(l); return d?dateToDisplay(d):''; }).filter(Boolean).join('\n');
  openModal('leaveModal');
}

function saveLeave() {
  const txt = document.getElementById('leaveText').value;
  const dates = txt.split('\n').map(l=>l.trim()).filter(Boolean)
    .map(l=>{ const d=parseDate(l); return d?dateToISO(d):null; }).filter(Boolean);
  state[currentLeaveGroup].people[currentLeaveIdx].leaves = dates;
  saveState(); closeModal('leaveModal');
  Sounds.success();
  notify('İzin günleri kaydedildi.','success');
  renderPersonelList();
}

function renderPersonelList() {
  const grp = state[activePersonelGroup];
  const list = document.getElementById('personelList');
  const badge = document.getElementById('personel-count');
  if (badge) badge.textContent = `${grp.people.length} kişi`;
  if (!list) return;
  list.innerHTML='';
  if (!grp.people.length) {
    list.innerHTML='<div class="empty-list">Henüz personel eklenmedi.</div>'; return;
  }
  grp.people.forEach((p,i) => {
    const initials = p.ad.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'?';
    const lv = (p.leaves||[]).length;
    const div = document.createElement('div');
    div.className='personel-item'; div.style.animationDelay=`${i*0.04}s`;
    div.setAttribute('role','listitem');
    div.innerHTML=`
      <div class="item-avatar" aria-hidden="true">${initials}</div>
      <div class="item-info">
        <div class="item-name">${escHtml(p.ad)}</div>
        <div class="item-meta">${escHtml(p.sicil)}${p.unvan?` · ${escHtml(p.unvan)}`:''}${lv?` · ${lv} izin günü`:''}</div>
      </div>
      <div class="item-actions">
        <button class="item-btn" title="İzin Günleri" onclick="openLeaveModal('${activePersonelGroup}',${i})" aria-label="${p.ad} izin günleri">📅</button>
        <button class="item-btn danger" title="Sil" onclick="removePerson('${activePersonelGroup}',${i})" aria-label="${p.ad} sil">✕</button>
      </div>`;
    list.appendChild(div);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── CSV IMPORT / EXPORT ─────────────────────────────────── */
function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l=>l.trim());
    let added=0, skipped=0;
    lines.forEach((line,idx) => {
      if (idx===0 && line.toLowerCase().includes('sicil')) return; // header
      const parts = line.split(',').map(p=>p.trim().replace(/^"|"$/g,''));
      if (parts.length<2) return;
      const [sicil,ad,unvan=''] = parts;
      if (!sicil||!ad) return;
      if (state[activePersonelGroup].people.some(p=>p.sicil===sicil)) { skipped++; return; }
      state[activePersonelGroup].people.push({ sicil, ad, unvan, leaves:[] });
      added++;
    });
    saveState(); renderPersonelList(); updateStats();
    Sounds.success();
    notify(`CSV yüklendi: ${added} eklendi, ${skipped} atlandı.`, added>0?'success':'warning');
    event.target.value='';
  };
  reader.readAsText(file, 'UTF-8');
}

function exportPersonelCSV() {
  const grp = state[activePersonelGroup];
  if (!grp.people.length) { notify('Dışa aktarılacak personel yok.','warning'); return; }
  const rows = [['Sicil','AdSoyad','Unvan']];
  grp.people.forEach(p => rows.push([p.sicil, p.ad, p.unvan||'']));
  const csv = '\uFEFF' + rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\r\n');
  downloadFile(csv, `personel_${activePersonelGroup}.csv`, 'text/csv;charset=utf-8');
  Sounds.excel();
  notify('CSV indirildi.','success');
}

function downloadFile(content, name, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}

/* ── HOLIDAYS ────────────────────────────────────────────── */
function openHolidayModal() {
  const txt = state.holidays.map(h=>{ const d=parseDate(h); return d?dateToDisplay(d):''; }).filter(Boolean).join('\n');
  document.getElementById('holidayText').value=txt;
  openModal('holidayModal');
}
function saveHolidays() {
  const txt = document.getElementById('holidayText').value;
  const dates = txt.split('\n').map(l=>l.trim()).filter(Boolean)
    .map(l=>{ const d=parseDate(l); return d?dateToISO(d):null; }).filter(Boolean);
  state.holidays = [...new Set(dates)].sort();
  saveState(); closeModal('holidayModal'); renderHolidayChips(); updateStats();
  Sounds.success();
  notify(`${state.holidays.length} tatil günü kaydedildi.`, 'success');
}
function renderHolidayChips() {
  const chips = document.getElementById('holidayChips');
  if (!chips) return;
  chips.innerHTML='';
  if (!state.holidays.length) {
    chips.innerHTML='<span style="color:var(--text-dim);font-size:.82rem">Tanımlı tatil yok.</span>'; return;
  }
  [...state.holidays].sort().forEach((h,i) => {
    const d=parseDate(h); if(!d) return;
    const chip=document.createElement('span');
    chip.className='holiday-chip'; chip.style.animationDelay=`${i*0.03}s`;
    chip.textContent=dateToDisplay(d); chips.appendChild(chip);
  });
}

/* ── SLIDERS ─────────────────────────────────────────────── */
document.getElementById('set-hedef')?.addEventListener('input', e=>{
  document.getElementById('set-hedef-val').textContent=e.target.value+' sa';
});
document.getElementById('set-blok')?.addEventListener('input', e=>{
  document.getElementById('set-blok-val').textContent=e.target.value+' dk';
});
document.getElementById('set-ay')?.addEventListener('change', updateStats);
document.getElementById('set-yil')?.addEventListener('change', updateStats);

/* ── EXCEL İÇE AKTARIM (.xlsx / .xls / .csv) ─────────────── */
async function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';                       // aynı dosya tekrar seçilebilsin
  try {
    if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Türkçe karakter, boşluk, nokta ve tire farkını yok sayan karşılaştırma
    const norm = s => String(s).trim().replace(/İ/g,'i').replace(/ı/g,'i').toLowerCase()
      .replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9]/g,'');
    const SICIL_NAMES = ['sicilno','sicil','tk'];
    const AD_NAMES    = ['adisoyadi','adsoyad','adi','ad','isim'];
    const SOYAD_NAMES = ['soyadi','soyad','soyisim'];
    const UNVAN_NAMES = ['unvan','unvani','gorev','gorevi','kadro','pozisyon'];

    // Başlık satırını ilk 5 satırda ara
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, rawRows.length); i++) {
      const n = rawRows[i].map(norm);
      if (n.some(c => [...SICIL_NAMES, ...AD_NAMES, ...SOYAD_NAMES].includes(c))) { headerRowIdx = i; break; }
    }
    const headers = rawRows[headerRowIdx];
    const rows = rawRows.slice(headerRowIdx + 1)
      .filter(r => r.some(c => c !== ''))
      .map(r => { const o = {}; headers.forEach((h,i) => { o[h] = r[i] !== undefined ? r[i] : ''; }); return o; });
    if (!rows.length) { notify('Dosyada veri bulunamadı','error'); Sounds.error(); return; }

    const keys = Object.keys(rows[0]);
    const findCol = names => keys.find(k => names.includes(norm(k))) || null;
    const colAd = findCol(AD_NAMES), colSoyad = findCol(SOYAD_NAMES),
          colSicil = findCol(SICIL_NAMES), colUnvan = findCol(UNVAN_NAMES);
    if (!colAd) { notify('Ad Soyad sütunu bulunamadı. Başlıklar: ' + keys.join(', '),'error'); Sounds.error(); return; }

    const people = state[activePersonelGroup].people;
    let added = 0, skipped = 0;
    rows.forEach(row => {
      const sicil = String(row[colSicil] ?? '').trim();
      const ad = (String(row[colAd] ?? '').trim() + ' ' + (colSoyad ? String(row[colSoyad] ?? '').trim() : '')).trim();
      const unvan = colUnvan ? String(row[colUnvan] ?? '').trim() : '';
      if (!ad) { skipped++; return; }
      if (sicil && people.some(p => p.sicil === sicil)) { skipped++; return; }
      people.push({ sicil, ad, unvan, leaves: [] });
      added++;
    });

    saveState(); renderPersonelList(); updateStats();
    if (typeof updatePersonelInfoBox === 'function') updatePersonelInfoBox();
    Sounds.success();
    notify(`Excel yüklendi: ${added} eklendi${skipped ? ', ' + skipped + ' atlandı (boş/tekrar)' : ''}.`, added ? 'success' : 'warning');
  } catch (err) {
    console.error(err);
    notify('Dosya okunamadı: ' + err.message, 'error'); Sounds.error();
  }
}