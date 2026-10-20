/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.distribution.js  (4/6)
   İçerik : Mesai dağıtım algoritması · Sonuç tablosu render ·
            Dağıtım özet grafiği
   Not    : app.core.js ve app.personel.js'ten sonra yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── DISTRIBUTION ENGINE ─────────────────────────────────── */
const NORMAL_DAY_MIN = 480;
const WD_OT_MAX      = 180;   // hafta içi günlük max fazla mesai (8 + 3 = 11 saat)
const WE_FULL        = 360;   // hafta sonu net 6 saat (09:00-12:00 + 13:00-16:00)

/* ── KURALLAR: tüm ayarlar buradan yapılır ── */
const RULES = {
  MIN_DAY:       30,    // bir güne yazılacak en küçük mesai (dk)
  WEEK_OT_MAX:   1200,  // kişi başı haftalık max fazla mesai (dk) = 20 saat
  MAX_STREAK:    4,     // üst üste en çok kaç gün mesai
  ONE_WE_DAY:    true,  // aynı hafta sonunda kişiye yalnız 1 gün (haftalık 1 gün dinlenme)
  MAX_PER_DAY:   0,     // aynı gün mesaiye kalabilecek en çok kişi (0 = sınırsız)
  RANDOM_SPREAD: 0.5    // "Ağırlıklı Rastgele"de kişiler hedefin ±%50'si kadar sapabilir
};

// Kişi bazlı "odak" seçenekleri → hafta sonu payı (kişi ayarı: p.opts.focus)
const FOCUS_RATIO = { weekday:0, wd70:0.30, bal:0.50, we70:0.70, weekend:1 };

function stableRng(seed) {
  let s = seed>>>0;
  return ()=>{
    s = (s + 0x6D2B79F5)>>>0;
    let t = s;
    t = Math.imul(t ^ (t>>>15), t | 1);
    t ^= t + Math.imul(t ^ (t>>>7), t | 61);
    return ((t ^ (t>>>14))>>>0) / 4294967296;
  };
}
function mkSeed(...parts) {
  let h=2166136261;
  for(const p of parts) for(const c of String(p)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function shuffle(arr,rng){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function hm2m(hm){ const[h,m]=hm.split(':').map(Number); return h*60+m; }
function m2hm(m){ return `${pad(Math.floor(m/60))}:${pad(m%60)}`; }
function m2hms(m){ return m2hm(m)+':00'; }
function addMin(hm,min){ return m2hm(hm2m(hm)+min); }
// Hafta sonu bitiş saati: 09:00-12:00, öğle arası, 13:00'dan devam (Excel ile aynı mantık)
function weekendEnd(ot){ return ot<=180 ? addMin('09:00',ot) : addMin('13:00',ot-180); }

function generateDistribution() {
  if (document.getElementById('loadingOverlay').classList.contains('active')) return; // çift tıklama koruması
  const grup     = document.getElementById('set-grup').value;
  const year     = +document.getElementById('set-yil').value;
  const month    = +document.getElementById('set-ay').value;
  const targetH  = +document.getElementById('set-hedef').value;
  const block    = +document.getElementById('set-blok').value;
  const distType = document.querySelector('input[name="dagitim"]:checked')?.value||'esit';
  const odak     = document.getElementById('set-odak').value;
  const weOK     = document.getElementById('set-haftasonu').checked;
  const people   = (state[grup]?.people || []).filter(p => !p.pasif);   // pasif personel dağıtıma girmez

  if (!people.length) { notify((state[grup]?.people||[]).length ? 'Bu grupta aktif personel yok (hepsi pasif).' : 'Önce personel ekleyin!','error'); Sounds.error(); return; }
  if (!(year>=2000 && year<=2100) || !(month>=1 && month<=12)) { notify('Yıl veya ay geçersiz!','error'); Sounds.error(); return; }
  if (!Number.isFinite(targetH) || targetH<0) { notify('Hedef saat geçersiz!','error'); Sounds.error(); return; }
  if (!Number.isFinite(block) || block<15) { notify('Blok boyutu en az 15 dk olmalı!','error'); Sounds.error(); return; }

  document.getElementById('loadingOverlay').classList.add('active');
  setTimeout(()=>{
    try {
      const seed   = (Date.now() ^ Math.floor(Math.random()*0x7fffffff))>>>0;   // her seferinde farklı plan
      const result = _distribute(people, state.holidays, year, month, targetH, block, distType, odak, weOK, grup, seed);
      state.lastResult = result;
      saveState();
      renderTable(result);
      renderSummary(result);
      showSection('rapor');
      Sounds.success();
      notify(`Dağıtım tamamlandı! ${people.length} personel, ${TR_MONTHS[month-1]} ${year}.`,'success',4500);
      const eksik = result.unmet.filter(x=>x>0).length;
      if (eksik) notify(`${eksik} kişide hedef saate ulaşılamadı (izin/tatil/kapasite yetersiz).`,'warning',7000);
      if (result.relaxed) notify(`${result.relaxed} kişide "hafta sonu tek gün / ardışık gün" kuralı esnetildi.`,'info',6000);
    } catch(e) {
      notify('Dağıtım hatası: '+e.message,'error');
      Sounds.error(); console.error(e);
    } finally {
      document.getElementById('loadingOverlay').classList.remove('active');
    }
  }, 60);
}

function _distribute(people, holidays, year, month, targetH, block, distType, odak, weOK, grup, seed) {
  if (seed==null) seed = mkSeed(year,month,grup,Date.now());
  seed = seed>>>0;
  const rng      = stableRng(seed);
  const R        = RULES;
  const UNIT     = 15;
  const allDates = datesInMonth(year, month);
  const nDays    = allDates.length;
  const n        = people.length;
  block = Math.max(UNIT, Math.round(block/UNIT)*UNIT);
  const ratioWE  = !weOK ? 0 : odak==='weekend' ? 0.70 : odak==='weekday' ? 0.30 : 0.50;
  const sum = a => a.reduce((x,y)=>x+y,0);

  const holSet = new Set(holidays.map(h=>{const d=parseDate(h);return d?dateKey(d):null;}).filter(Boolean));
  const weekOf = [];
  let wk = 0;
  allDates.forEach((d,i)=>{ weekOf[i]=wk; if(d.getDay()===0) wk++; });

  // kişi bazlı çalışılabilir günler (izin, tatil, hafta sonu kapalı, kişiye özel ayarlar)
  const ctx = people.map(p=>{
    const o       = p.opts || {};
    const focus   = (o.focus && FOCUS_RATIO[o.focus]!==undefined) ? o.focus : null;
    const blocked = new Set((o.blocked||[]).map(Number));
    const leavesSet = new Set((p.leaves||[]).map(l=>{const d=parseDate(l);return d?dateKey(d):null;}).filter(Boolean));
    const days = [];
    allDates.forEach((d,i)=>{
      const dk = dateKey(d);
      if (holSet.has(dk)||leavesSet.has(dk)) return;
      if (blocked.has(d.getDay())) return;                 // "şu gün çalışamaz"
      const we = isWeekend(d);
      if (we && (!weOK || focus==='weekday')) return;      // hafta sonu kapalı / kişi sadece hafta içi
      if (!we && focus==='weekend') return;                // kişi sadece hafta sonu
      days.push({i, w:weekOf[i], we, cap: we?WE_FULL:WD_OT_MAX});
    });
    const ratio = focus ? FOCUS_RATIO[focus] : ratioWE;
    return { p, leavesSet, days, ratio, u:new Array(nDays).fill(0), wk:{}, weN:{}, rem:0, tier:0, weT:0, wdT:0, weU:0, wdU:0, done:false };
  });

  function capacity(c){
    const byWeek = {};
    c.days.forEach(d=>{ byWeek[d.w]=(byWeek[d.w]||0)+d.cap; });
    return sum(Object.values(byWeek).map(v=>Math.min(v,R.WEEK_OT_MAX)));
  }

  // kişi başı hedefler (15 dk adımlarıyla). Kişiye özel hedef (p.opts.targetH) havuzun dışında kalır.
  const baseMin = Math.round(targetH*60/UNIT)*UNIT;
  const fixed = ctx.map(c=>{
    const t = c.p.opts && c.p.opts.targetH;
    return (typeof t==='number' && Number.isFinite(t) && t>=0) ? Math.round(t*60/UNIT)*UNIT : null;
  });
  const pool = ctx.map((c,k)=>k).filter(k=>fixed[k]===null);
  let targets = ctx.map((c,k)=>fixed[k]!==null ? fixed[k] : baseMin);
  if (distType!=='esit' && pool.length>1 && baseMin>0) {
    const np  = pool.length;
    const tot = baseMin*np;
    const w   = pool.map(()=>1+(rng()*2-1)*R.RANDOM_SPREAD);
    const sw  = sum(w);
    const t   = w.map(x=>Math.round(tot*x/sw/UNIT)*UNIT);
    let diff = tot-sum(t), i=0, guard=200000;
    while (diff!==0 && guard-->0) {
      const k = i++%np;
      if (diff>0)              { t[k]+=UNIT; diff-=UNIT; }
      else if (t[k]>=UNIT)     { t[k]-=UNIT; diff+=UNIT; }
    }
    // kapasiteyi aşanı kırp, fazlayı yeri olanlara aktar
    const caps = pool.map(k=>capacity(ctx[k]));
    let over = 0;
    for (let j=0;j<np;j++) if (t[j]>caps[j]) { over+=t[j]-caps[j]; t[j]=caps[j]; }
    let g2 = 200000;
    while (over>=UNIT && g2-->0) {
      let moved=false;
      for (const j of shuffle([...Array(np).keys()],rng)) {
        if (over<UNIT) break;
        if (t[j]+UNIT<=caps[j]) { t[j]+=UNIT; over-=UNIT; moved=true; }
      }
      if (!moved) break;
    }
    pool.forEach((k,j)=>{ targets[k]=t[j]; });
  }
  ctx.forEach((c,k)=>{
    c.rem = targets[k];
    c.weT = Math.round(targets[k]*c.ratio/UNIT)*UNIT;
    c.wdT = targets[k]-c.weT;
  });

  const heads  = new Array(nDays).fill(0);          // gün başına mesaiye kalan kişi sayısı
  const wHeads = Math.min(1.5, 12/Math.max(n,1));

  function streakWith(c,i){
    let run=1;
    for(let k=i-1;k>=0&&c.u[k]>0;k--) run++;
    for(let k=i+1;k<nDays&&c.u[k]>0;k++) run++;
    return run;
  }
  // tier 0: tüm kurallar · 1: hafta sonu/ardışık gün esner · 2: ardışık gün ve günlük kişi sınırı kalkar
  function feasible(c,d,tier){
    const used = c.u[d.i];
    const eff  = Math.min(d.cap-used, R.WEEK_OT_MAX-(c.wk[d.w]||0));
    const need = used>0 ? Math.min(c.rem,block) : Math.min(c.rem,R.MIN_DAY);
    if (eff<=0 || eff<need) return false;
    if (used===0) {
      if (tier===0 && R.ONE_WE_DAY && d.we && (c.weN[d.w]||0)>=1) return false;
      if (tier<2 && R.MAX_PER_DAY>0 && heads[d.i]>=R.MAX_PER_DAY) return false;
      const lim = tier===0 ? R.MAX_STREAK : tier===1 ? R.MAX_STREAK+2 : 99;
      if (streakWith(c,d.i)>lim) return false;
    }
    return true;
  }
  function pickChunk(isWE,rem,avail,typeNeed){
    const opts = isWE ? [240,300,360] : [120,150,180];
    let c = opts[Math.floor(rng()*opts.length)];
    c = Math.max(block, Math.floor(c/block)*block);
    c = Math.min(c, Math.max(typeNeed,R.MIN_DAY), rem, avail);
    if (c<rem) c = Math.max(block, Math.floor(c/block)*block);
    if (c>avail) c = avail;
    const left = rem-c;
    if (left>0 && left<R.MIN_DAY && rem<=avail) c = rem;   // küçük artık bırakma
    return c;
  }
  function place(c){
    while (c.tier<=2) {
      const needWE = Math.max(0,c.weT-c.weU), needWD = Math.max(0,c.wdT-c.wdU);
      const first  = rng() < (needWE+1)/(needWE+needWD+2) ? 'we' : 'wd';
      for (const t of [first, first==='we'?'wd':'we']) {
        const isWE = t==='we';
        let best=null, bs=Infinity;
        for (const d of c.days) {
          if (d.we!==isWE || !feasible(c,d,c.tier)) continue;
          const s = rng()*2                                   // rastgelelik
                  + heads[d.i]*wHeads                         // günlere eşit yayılım
                  + (c.wk[d.w]||0)/60*0.35                    // haftalara eşit yayılım
                  + ((c.u[d.i-1]>0?1:0)+(c.u[d.i+1]>0?1:0))   // yan yana gün cezası
                  + (c.u[d.i]>0?1.5:0);                       // aynı güne ekleme cezası
          if (s<bs) { bs=s; best=d; }
        }
        if (!best) continue;
        const used  = c.u[best.i];
        const avail = Math.min(best.cap-used, R.WEEK_OT_MAX-(c.wk[best.w]||0));
        const give  = pickChunk(isWE, c.rem, avail, isWE?needWE:needWD);
        if (give<=0) continue;
        if (used===0) { heads[best.i]++; if (isWE) c.weN[best.w]=(c.weN[best.w]||0)+1; }
        c.u[best.i] += give;
        c.wk[best.w] = (c.wk[best.w]||0)+give;
        c.rem -= give;
        if (isWE) c.weU+=give; else c.wdU+=give;
        return true;
      }
      c.tier++;
    }
    return false;
  }

  // turlar halinde dağıt: her turda herkes sırayla 1 parça alır (adil)
  let active = ctx.filter(c=>c.rem>0), safety = 1000000;
  while (active.length && safety-->0) {
    for (const c of shuffle(active,rng)) { if (c.rem>0 && !place(c)) c.done=true; }
    active = active.filter(c=>c.rem>0 && !c.done);
  }

  const assigned = ctx.map(c=>{
    const dayMap = {};
    c.u.forEach((m,i)=>{ if(m>0) dayMap[dateKey(allDates[i])]=m; });
    return { person:c.p, dayMap, leavesSet:c.leavesSet };
  });
  const unmet   = ctx.map(c=>c.rem);
  const relaxed = ctx.filter(c=>c.tier>0).length;
  const custom  = ctx.filter(c=>c.p.opts && Object.keys(c.p.opts).length).length;
  return { assigned, people, allDates, holidays, year, month, grup, weOK, seed, targets, unmet, relaxed, custom };
}

function buildWeeks(allDates){
  const weeks=[];let cur=[];
  allDates.forEach(d=>{cur.push(d);if(d.getDay()===0){weeks.push(cur);cur=[];}});
  if(cur.length) weeks.push(cur);
  return weeks;
}

/* ── RENDER TABLE ────────────────────────────────────────── */
function renderTable(result) {
  const{assigned,allDates,holidays,year,month,grup,weOK}=result;
  const weeks=buildWeeks(allDates);
  const wrapper=document.getElementById('tableWrapper');
  document.getElementById('rapor-title').textContent=`${TR_MONTHS[month-1].toUpperCase()} ${year} — ${grup.toUpperCase()} FAZLA MESAİ`;

  // filter setup
  const fpEl=document.getElementById('filterPerson');
  if(fpEl){
    fpEl.innerHTML='<option value="">Tüm Personel</option>';
    assigned.forEach(({person:p})=>{
      const o=document.createElement('option');
      o.value=p.sicil; o.textContent=p.ad; fpEl.appendChild(o);
    });
  }
  document.getElementById('raporFilters').style.display='block';

  const totalCols=3+weeks.reduce((a,wk)=>a+wk.length*2+2,0)+2;

  let html=`<table class="mesai-table"><thead>`;
  html+=`<tr><th colspan="${totalCols}" class="c-title" style="font-size:.95rem;padding:.55rem;text-align:left">
    <span style="position:sticky;left:.8rem;display:inline-block;color:#fff">FAZLA MESAİ &mdash; ${grup.toUpperCase()} &mdash; ${TR_MONTHS[month-1].toUpperCase()} ${year} (Emvalis)</span>
  </th></tr>`;
  html+=`<tr>
    <th rowspan="3" class="c-lhdr" style="min-width:50px">SİCİL</th>
    <th rowspan="3" class="c-lhdr" style="min-width:130px">ADI SOYADI</th>
    <th rowspan="3" class="c-lhdr" style="min-width:90px">ÜNVAN</th>`;
  weeks.forEach((wk,wi)=>{
    html+=`<th colspan="${wk.length*2}" class="c-wktotalh" style="font-size:.72rem">Hafta ${wi+1} (${dateToDisplay(wk[0])} – ${dateToDisplay(wk[wk.length-1])})</th>`;
    html+=`<th rowspan="3" class="c-wktotalh" style="min-width:52px">Hftlk<br>Toplam</th>`;
    html+=`<th rowspan="3" class="c-wkoverh"  style="min-width:52px">Hftlk<br>Fazla</th>`;
  });
  html+=`<th rowspan="3" class="c-monthlyh" style="min-width:52px">Aylık<br>Fazla</th>`;
  html+=`<th rowspan="3" class="c-sigh" style="min-width:65px">İmza</th></tr>`;
  html+=`<tr>`;
  weeks.forEach(wk=>wk.forEach(d=>{const we=isWeekend(d);html+=`<th colspan="2" class="c-dayname" style="${we?'color:#8B0000':''}">${DAY_TR_ABB[d.getDay()]}</th>`;}));
  html+=`</tr><tr>`;
  weeks.forEach(wk=>wk.forEach(d=>{const we=isWeekend(d);html+=`<th class="c-date" style="${we?'color:#8B0000':''}">${d.getDate()}</th><th class="c-date" style="${we?'color:#8B0000':''}">—</th>`;}));
  html+=`</tr>`;
  html+=`<tr><td colspan="3" class="c-sub" style="text-align:left;padding:.25rem .5rem">Giriş / Çıkış</td>`;
  weeks.forEach(wk=>{wk.forEach(()=>{html+=`<td class="c-sub">GİR</td><td class="c-sub">ÇIK</td>`;});html+=`<td class="c-sub"></td><td class="c-sub"></td>`;});
  html+=`<td class="c-sub"></td><td class="c-sub"></td></tr></thead><tbody id="tableBody">`;

  assigned.forEach(({person:p,dayMap,leavesSet})=>{
    html+=`<tr data-sicil="${escHtml(p.sicil)}">
      <td class="c-sicil">${escHtml(p.sicil)}</td>
      <td class="c-name">${escHtml(p.ad)}</td>
      <td class="c-name" style="font-size:.8rem;color:#555">${escHtml(p.unvan||'—')}</td>`;
    let monthlyOT=0;
    weeks.forEach(wk=>{
      let wkT=0,wkOT=0;
      wk.forEach(d=>{
        const dk=dateKey(d);
        const isHol=isHolidayDate(d,holidays);
        const isLv=leavesSet.has(dk);
        const isWE=isWeekend(d);
        const ot=dayMap[dk]||0;
        if(isHol||isLv){html+=`<td colspan="2" class="c-holiday">${isHol?'Tatil':'İzin'}</td>`;return;}
        if(isWE){
          if(ot>0&&weOK){const aus=weekendEnd(ot);html+=`<td class="c-we-ot" data-ot="${ot}">09:00</td><td class="c-we-ot">${aus}</td>`;wkT+=ot;wkOT+=ot;}
          else{html+=`<td class="c-dash">—</td><td class="c-dash">—</td>`;}
        }else{
          const bg=ot>0?'c-wd-ot':'c-normal';
          const aus=ot>0?addMin('17:00',ot):'17:00';
          html+=`<td class="${bg}" data-ot="${ot}">08:00</td><td class="${bg}">${aus}</td>`;
          wkT+=NORMAL_DAY_MIN+ot;wkOT+=ot;
        }
      });
      monthlyOT+=wkOT;
      html+=`<td class="c-wktotal">${m2hms(wkT)}</td>`;
      html+=`<td class="${wkOT>0?'c-wkover':'c-white'}">${m2hms(wkOT)}</td>`;
    });
    html+=`<td class="${monthlyOT>0?'c-monthly':'c-white'}">${m2hms(monthlyOT)}</td>`;
    html+=`<td class="c-normal"></td></tr>`;
  });
  html+=`</tbody></table>`;
  wrapper.innerHTML=html;
  applyFilter();
}

function applyFilter() {
  const fp=document.getElementById('filterPerson')?.value||'';
  const otOnly=document.getElementById('filterOtOnly')?.checked||false;
  const rows=document.querySelectorAll('#tableBody tr');
  rows.forEach(row=>{
    const sicil=row.getAttribute('data-sicil');
    const matchPerson=!fp||sicil===fp;
    let show=matchPerson;
    if(show&&otOnly){
      const hasOT=[...row.querySelectorAll('[data-ot]')].some(td=>+td.getAttribute('data-ot')>0);
      show=hasOT;
    }
    row.style.display=show?'':'none';
  });
}

/* ── DISTRIBUTION SUMMARY CHART ──────────────────────────── */
function renderSummary(result) {
  const {assigned,allDates,holidays}=result||{};
  const sumDiv=document.getElementById('distSummary');
  const statsDiv=document.getElementById('summaryStats');
  const chartDiv=document.getElementById('summaryChart');
  if(!sumDiv||!assigned) return;

  const totals=assigned.map(({person:p,dayMap,leavesSet})=>{
    let tot=0;
    allDates.forEach(d=>{
      const dk=dateKey(d);
      if(!isHolidayDate(d,holidays)&&!leavesSet.has(dk)) tot+=dayMap[dk]||0;
    });
    return{name:p.ad,min:tot};
  });
  totals.forEach((t,i)=>{ t.unmet=(result.unmet||[])[i]||0; });
  const mins=totals.map(t=>t.min);
  const avg=mins.length?Math.round(mins.reduce((a,b)=>a+b,0)/mins.length):0;
  const mxRaw=Math.max(...mins,0);
  const mx=Math.max(mxRaw,1);            // yalnızca grafik oranı için (0'a bölmeyi önler)
  const mn=mins.length?Math.min(...mins):0;
  const unmetN=(result.unmet||[]).filter(x=>x>0).length;
  const mesaiGun=allDates.filter(d=>assigned.some(a=>(a.dayMap[dateKey(d)]||0)>0)).length;

  statsDiv.innerHTML=`
    <div class="summary-stat"><div class="summary-stat-label">Ortalama</div><div class="summary-stat-value">${m2hm(avg)}</div></div>
    <div class="summary-stat"><div class="summary-stat-label">Maksimum</div><div class="summary-stat-value">${m2hm(mxRaw)}</div></div>
    <div class="summary-stat"><div class="summary-stat-label">Minimum</div><div class="summary-stat-value">${m2hm(mn)}</div></div>
    <div class="summary-stat"><div class="summary-stat-label">Toplam Personel</div><div class="summary-stat-value">${totals.length}</div></div>
    <div class="summary-stat"><div class="summary-stat-label">Mesaili Gün</div><div class="summary-stat-value">${mesaiGun}</div></div>
    <div class="summary-stat"><div class="summary-stat-label">Hedefe Ulaşamayan</div><div class="summary-stat-value">${unmetN}</div></div>`;

  const shortName=n=>{
    const parts=String(n||'').trim().split(/\s+/);
    return parts.length>1 ? `${parts[0]} ${parts[parts.length-1][0]}.` : parts[0];
  };
  chartDiv.innerHTML=totals.map(t=>`
    <div class="chart-bar-row">
      <div class="chart-bar-name" title="${escHtml(t.name)}">${escHtml(shortName(t.name))}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:0%" data-w="${Math.round(t.min/mx*100)}"></div></div>
      <div class="chart-bar-val">${m2hm(t.min)}${t.unmet>0?`<span title="Hedefe ulaşılamadı" style="color:#E05050;font-size:.68rem"> −${m2hm(t.unmet)}</span>`:''}</div>
    </div>`).join('');

  sumDiv.style.display='block';
  setTimeout(()=>{
    document.querySelectorAll('.chart-bar-fill').forEach(el=>{
      el.style.width=el.getAttribute('data-w')+'%';
    });
  },80);
}
