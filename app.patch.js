/* ══════════════════════════════════════════════════════════
   Emvalis — app.patch.js
   İçerik : 1) Resmî tatil listesi yeni tasarım
            2) Personel DÜZENLE
            3) Personel PASİFE AL / AKTİF ET (pasifler dağıtıma girmez)
   Not    : app.extras.js'ten SONRA, app.init.js'ten ÖNCE yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

(function(){
  const $   = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const normIso = v => { const d = parseDate(v); return d ? dateToISO(d) : null; };
  const MON = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];
  const GRP_LABEL = { kadrolu:'Kadrolu', sozlesmeli:'Sözleşmeli' };

  /* ══════════════════════════════════════════════════════════
     1) RESMÎ TATİL LİSTESİ
     ══════════════════════════════════════════════════════════ */
  window.renderHolidayChips = function(){
    const box = $('holidayChips'); if (!box) return;
    box.classList.remove('holiday-chips'); box.classList.add('hol-list');

    const names = state.holidayNames || (state.holidayNames = {});
    const dates = [...new Set((state.holidays||[]).map(normIso).filter(Boolean))].sort();

    if (!dates.length) {
      box.innerHTML = '<div class="hol-empty">Tanımlı tatil yok.<br>“Hazır listeyi ekle” ile başlayın.</div>';
      box._runs = []; return;
    }

    const today = dateToISO(new Date());
    const runs  = groupRuns(dates, false);
    const byYear = {};
    runs.forEach((r,i) => { (byYear[r.start.slice(0,4)] = byYear[r.start.slice(0,4)] || []).push({r,i}); });

    let html = '';
    Object.keys(byYear).sort().forEach(y => {
      const list = byYear[y];
      const dayCount = list.reduce((s,x) => s + x.r.dates.length, 0);
      html += `<div class="hol-year">${y}<small>${list.length} kayıt · ${dayCount} gün</small></div>`;
      list.forEach(({r,i}) => {
        const nm = [...new Set(r.dates.map(d => names[d]).filter(Boolean))];
        // "Ramazan Bayramı 1. Gün" / "... Arifesi (yarım gün)" → ortak ad: "Ramazan Bayramı"
        const baseOf = s => s.replace(/\s*\d+\.\s*Gün$/i,'').replace(/\s*Arifesi.*$/i,'').trim();
        const bases = [...new Set(nm.map(baseOf))];
        const hasArife = nm.some(x => /arife/i.test(x));
        const name = bases.length === 0 ? 'Resmî tatil' : (bases.length === 1 ? bases[0] : `${bases[0]} +${bases.length-1}`);
        const n = r.dates.length;
        const [, m, d] = r.start.split('-');
        const sub = n === 1 ? isoDisplay(r.start) : `${isoDisplay(r.start)} – ${isoDisplay(r.end)}`;
        html += `<div class="hol-item${r.end < today ? ' past' : ''}" title="${esc(nm.join(', '))}">
          <div class="hol-date"><b>${d}</b><span>${MON[+m-1]}</span></div>
          <div class="hol-body">
            <div class="hol-name">${esc(name)}</div>
            <div class="hol-sub"><span class="hol-range">${sub}</span>${n > 1 ? `<span class="hol-days">${n} gün</span>` : ''}${hasArife ? '<span class="hol-days">arife dahil</span>' : ''}</div>
          </div>
          <button class="hol-x" data-run="${i}" aria-label="Sil" title="Sil">✕</button>
        </div>`;
      });
    });
    box.innerHTML = html;
    box._runs = runs;

    if (!box._wiredNew) {
      box._wiredNew = true;
      box.addEventListener('click', e => {
        const b = e.target.closest('.hol-x'); if (!b) return;
        const r = (box._runs||[])[+b.dataset.run]; if (!r) return;
        const del = new Set(r.dates);
        state.holidays = (state.holidays||[]).map(normIso).filter(i => i && !del.has(i));
        r.dates.forEach(i => { if (state.holidayNames) delete state.holidayNames[i]; });
        saveState(); renderHolidayChips(); updateStats(); Sounds.delete();
      });
    }
  };

  /* ══════════════════════════════════════════════════════════
     2) PERSONEL DÜZENLE
     ══════════════════════════════════════════════════════════ */
  let editCtx = null; // {group, idx}

  function ensureEditModal(){
    let ov = $('personEditModal');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'modal-overlay'; ov.id = 'personEditModal';
    ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
    ov.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">✏️ Personeli Düzenle</h3>
          <button class="modal-close" onclick="closeModal('personEditModal')" aria-label="Kapat">✕</button>
        </div>
        <div class="modal-body">
          <div class="field-group">
            <label class="field-label" for="pe-sicil">Sicil No</label>
            <input type="text" id="pe-sicil" class="field-input" autocomplete="off" inputmode="numeric">
          </div>
          <div class="field-group">
            <label class="field-label" for="pe-ad">Ad Soyad</label>
            <input type="text" id="pe-ad" class="field-input" autocomplete="off">
          </div>
          <div class="field-group">
            <label class="field-label" for="pe-unvan">Unvan</label>
            <input type="text" id="pe-unvan" class="field-input" autocomplete="off">
          </div>
          <div class="field-group">
            <label class="field-label" for="pe-grup">Grup</label>
            <select id="pe-grup" class="field-input">
              <option value="kadrolu">Kadrolu</option>
              <option value="sozlesmeli">Sözleşmeli</option>
            </select>
          </div>
          <label class="pe-check"><input type="checkbox" id="pe-pasif"> <span>Pasif (dağıtıma dahil edilmesin)</span></label>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeModal('personEditModal')">İptal</button>
          <button class="btn-primary btn-inline" onclick="savePersonEdit()">Kaydet</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') savePersonEdit(); });
    return ov;
  }

  window.openPersonEdit = function(group, idx){
    const p = state[group] && state[group].people[idx]; if (!p) return;
    ensureEditModal();
    editCtx = { group, idx };
    $('pe-sicil').value = p.sicil || '';
    $('pe-ad').value    = p.ad || '';
    $('pe-unvan').value = p.unvan || '';
    $('pe-grup').value  = group;
    $('pe-pasif').checked = !!p.pasif;
    openModal('personEditModal');
    setTimeout(() => $('pe-ad').focus(), 60);
  };

  window.savePersonEdit = function(){
    if (!editCtx) return;
    const { group, idx } = editCtx;
    const p = state[group].people[idx]; if (!p) return;
    const sicil = $('pe-sicil').value.trim();
    const ad    = $('pe-ad').value.trim();
    const unvan = $('pe-unvan').value.trim();
    const grup  = $('pe-grup').value;
    if (!sicil) { notify('Sicil no zorunlu!','error'); Sounds.error(); return; }
    if (!ad)    { notify('Ad Soyad zorunlu!','error'); Sounds.error(); return; }
    if (state[grup].people.some((x,i) => x.sicil === sicil && !(grup === group && i === idx))) {
      notify('Bu sicil ' + GRP_LABEL[grup] + ' grubunda zaten kayıtlı!','warning'); Sounds.error(); return;
    }
    p.sicil = sicil; p.ad = ad; p.unvan = unvan; p.pasif = $('pe-pasif').checked;
    if (!p.pasif) delete p.pasif;
    if (grup !== group) {                      
      state[group].people.splice(idx,1);
      state[grup].people.push(p);
    }
    saveState(); closeModal('personEditModal');
    renderPersonelList(); updateStats(); updatePersonelInfoBox();
    Sounds.success();
    notify(grup !== group ? `${ad}, ${GRP_LABEL[grup]} grubuna taşındı.` : `${ad} güncellendi.`, 'success');
    editCtx = null;
  };

  /* ══════════════════════════════════════════════════════════
     3) PASİFE AL / AKTİF ET
     ══════════════════════════════════════════════════════════ */
  window.togglePasif = function(group, idx){
    const p = state[group] && state[group].people[idx]; if (!p) return;
    if (p.pasif) { delete p.pasif; } else { p.pasif = true; }
    saveState(); renderPersonelList(); updateStats(); updatePersonelInfoBox();
    Sounds.tabSwitch();
    notify(p.pasif ? `${p.ad} pasife alındı — dağıtıma girmeyecek.` : `${p.ad} tekrar aktif.`, p.pasif ? 'info' : 'success');
  };

  /* ── Personel listesini yeniden çiz: yeni butonlar + pasif görünüm ── */
  function decorate(){
    const list = $('personelList'); if (!list) return;
    const grp  = state[activePersonelGroup]; if (!grp) return;

    const total = grp.people.length, pas = grp.people.filter(p => p.pasif).length;
    const badge = $('personel-count');
    if (badge) badge.textContent = pas ? `${total - pas} aktif · ${pas} pasif` : `${total} kişi`;

    list.querySelectorAll('.personel-item').forEach((it,i) => {
      const p = grp.people[i]; if (!p) return;
      const g = activePersonelGroup;
      const lv = (p.leaves||[]).length, hasOpt = !!(p.opts && Object.keys(p.opts).length);

      it.classList.toggle('is-pasif', !!p.pasif);
      const nameEl = it.querySelector('.item-name');
      if (nameEl && p.pasif && !nameEl.querySelector('.pill-pasif')) nameEl.insertAdjacentHTML('beforeend','<span class="pill-pasif">Pasif</span>');

      const acts = it.querySelector('.item-actions'); if (!acts) return;
      acts.innerHTML = `
        <button class="ex-btn${lv?' has':''}" onclick="openLeaveModal('${g}',${i})" title="İzin günlerini düzenle">📅 <span class="lbl">İzin</span>${lv?` <span class="ex-badge">${lv}</span>`:''}</button>
        
        <button class="item-btn" onclick="openPersonEdit('${g}',${i})" title="Düzenle" aria-label="Düzenle">✏️</button>
        <button class="item-btn ${p.pasif ? 'aktif-btn' : 'pasif-btn'}" onclick="togglePasif('${g}',${i})" title="${p.pasif ? 'Aktif et' : 'Pasife al'}" aria-label="${p.pasif ? 'Aktif et' : 'Pasife al'}">${p.pasif ? '▶' : '⏸'}</button>
        <button class="item-btn danger" onclick="removePerson('${g}',${i})" title="Sil" aria-label="Sil">✕</button>`;
    });
  }
  const _rpl = window.renderPersonelList;
  window.renderPersonelList = function(){ _rpl.apply(this, arguments); decorate(); };

  /* ── Panel sayaçları: sadece AKTİF personel ── */
  const _us = window.updateStats;
  window.updateStats = function(){
    _us.apply(this, arguments);
    const act = g => state[g].people.filter(p => !p.pasif).length;
    const set = (id,v) => { const e = $(id); if (e) e.textContent = v; };
    set('stat-kad', act('kadrolu')); set('stat-soz', act('sozlesmeli'));
  };

  /* ── Dağıtım ekranındaki bilgi kutusu ── */
  const _upib = window.updatePersonelInfoBox;
  window.updatePersonelInfoBox = function(){
    _upib.apply(this, arguments);
    const box = $('personel-info-box'); if (!box) return;
    const grup = ($('set-grup')||{}).value || 'kadrolu';
    const all = state[grup].people, pas = all.filter(p => p.pasif).length;
    box.textContent = box.textContent.replace(/: \d+ personel kayıtlı\./,
      `: ${all.length - pas} aktif personel${pas ? ` (${pas} pasif, dağıtıma girmez)` : ''}.`);
  };
})();






/* ── Müdürlük adı (localStorage'ta saklanır; yalnızca ilk seferde sorulur) ── */
const MUD_KEY='emvalis_mudurluk';
function getMudurluk(){ try{ return (localStorage.getItem(MUD_KEY)||'').trim(); }catch(e){ return ''; } }
function setMudurluk(v){ try{ localStorage.setItem(MUD_KEY,String(v).trim()); }catch(e){} }

(function(){
  document.body.insertAdjacentHTML('beforeend',`
  <div class="modal-overlay" id="mudModal" role="dialog" aria-modal="true" aria-labelledby="mudTitle">
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title" id="mudTitle">🏢 Müdürlük / Birim Adı</h3>
        <button class="modal-close" onclick="closeModal('mudModal')" aria-label="Kapat">✕</button>
      </div>
      <div class="modal-body">
        <p class="modal-hint">Müdürlüğünüzü yazın (örn. <code>Nurdağı TM</code>). Excel çizelgesinin sol üst köşesinde görünür ve hatırlanır. Sonradan üstteki <b>🏢</b> butonundan değiştirebilirsiniz.</p>
        <input type="text" class="field-input" id="mudInput" maxlength="60" placeholder="Müdürlüğünüzün adı" autocomplete="off">
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModal('mudModal')">İptal</button>
        <button class="btn-primary btn-inline" id="mudSaveBtn" onclick="confirmMudurluk()">Kaydet</button>
      </div>
    </div>
  </div>`);

  const inp=()=>document.getElementById('mudInput');
  let mode='dist';                       // 'dist' = kaydet ve dağıt, 'edit' = sadece kaydet

  function refreshMudBtn(){
    const b=document.getElementById('exMudBtn');
    if(b) b.textContent='🏢 '+(getMudurluk()||'Müdürlük adı gir');
  }
  function openMud(m){
    mode=m;
    inp().value=getMudurluk();
    document.getElementById('mudSaveBtn').textContent = m==='dist' ? 'Kaydet ve Dağıt' : 'Kaydet';
    openModal('mudModal');
    setTimeout(()=>{ inp().focus(); inp().select(); },120);
  }
  window.openMudurlukModal=()=>openMud('edit');

  inp().addEventListener('keydown',e=>{ if(e.key==='Enter') confirmMudurluk(); });

  window.confirmMudurluk=function(){
    const v=inp().value.trim();
    if(!v){ notify('Lütfen müdürlük adını yazın!','error'); inp().focus(); return; }
    setMudurluk(v);
    refreshMudBtn();
    closeModal('mudModal');
    if(mode==='dist'){ window._mudOK=true; generateDistribution(); }
    else notify('Müdürlük adı kaydedildi: '+v,'success');
  };

  // Ad kayıtlıysa sormadan dağıt; kayıtlı değilse (ilk sefer) pencereyi aç
  const _gen=window.generateDistribution;
  window.generateDistribution=function(){
    if(window._mudOK || getMudurluk()){ window._mudOK=false; return _gen.apply(this,arguments); }
    openMud('dist');
  };

  // "Algoritma nasıl çalışır?" butonunun yanına müdürlük butonu
  const ph=document.querySelector('#sec-dagitim .panel-header');
  if(ph && !document.getElementById('exMudBtn')){
    const b=document.createElement('button');
    b.type='button'; b.id='exMudBtn'; b.className='ex-btn';
    b.title='Müdürlük adını değiştir';
    b.onclick=()=>openMudurlukModal();
    const algo=document.getElementById('exAlgoBtn');
    b.style.marginLeft='auto';                 // boş alanı soluna alır → sağa yaslanır
    if(algo){ algo.style.marginLeft='.6rem'; ph.insertBefore(b,algo); }
    else ph.appendChild(b);
    refreshMudBtn();
  }
})();