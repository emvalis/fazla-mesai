/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.init.js  (6/6)
   İçerik : Klavye kısayolları · Arkaplan parçacık animasyonu ·
            Uygulama başlangıç (init) rutini
   Not    : EN SON yüklenmelidir — diğer tüm dosyalar tanımlı
            olmalı (fonksiyonları burada çağrılıyor).
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── KEYBOARD ────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      if (m.id === 'videoModal') closeVideoModal();
      else m.classList.remove('open');
    });
    closeDrawer();
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  // Ctrl+T: tema değiştir
  if (e.key.toLowerCase() === 't') { e.preventDefault(); toggleTheme(); }
  // Ctrl+G: mesai dağıt (Dağıtım sekmesindeyken)
  else if (e.key.toLowerCase() === 'g') {
    e.preventDefault();
    if (document.getElementById('sec-dagitim')?.classList.contains('active')) generateDistribution();
    else { showSection('dagitim'); notify('Önce parametreleri kontrol edin, sonra Ctrl+G ile dağıtın.','info'); }
  }
  // Ctrl+E: XLSX indir (bir dağıtım sonucu varsa)
  else if (e.key.toLowerCase() === 'e') {
    if (state.lastResult) { e.preventDefault(); exportExcel(); }
  }
});

/* ── PARTICLES ───────────────────────────────────────────── */
(function(){
  const canvas=document.getElementById('particleCanvas');
  const ctx=canvas.getContext('2d');
  let W,H,pts;
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  function init(){pts=Array.from({length:55},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28,r:Math.random()*1.6+.4,o:Math.random()*.32+.07}));}
  function draw(){
    ctx.clearRect(0,0,W,H);
    const theme=document.documentElement.getAttribute('data-theme');
    const alpha=theme==='light'?.4:1;
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      const c=theme==='light'?`rgba(160,120,40,${p.o*alpha})`:`rgba(212,168,64,${p.o})`;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();
    });
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<145){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(212,168,64,${.06*(1-dist/145)*alpha})`;ctx.lineWidth=.5;ctx.stroke();}
    }
    requestAnimationFrame(draw);
  }
  resize();init();draw();
  window.addEventListener('resize',()=>{resize();init();});
})();

/* ── INIT ────────────────────────────────────────────────── */
loadState();
let _savedTheme = null;
try { _savedTheme = localStorage.getItem('emv'); } catch(e){}
if (_savedTheme !== 'dark' && _savedTheme !== 'light') {
  _savedTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
applyTheme(_savedTheme);
const now=new Date();
const ayEl=document.getElementById('set-ay');
const yilEl=document.getElementById('set-yil');
if(ayEl) ayEl.value=now.getMonth()+1;
if(yilEl) yilEl.value=now.getFullYear();
updateClock();
updateStats();
renderHolidayChips();
renderPersonelList();
updatePersonelInfoBox();
// Init personel card color classes
const _lc = document.querySelector('.personel-list-card');
const _ac = document.querySelector('.add-form-card');
if (_lc) { _lc.classList.add('group-kadrolu'); }
if (_ac) { _ac.classList.add('group-kadrolu'); }
const _lbl = document.getElementById('active-group-label');
if (_lbl) _lbl.className = 'group-label-kadrolu';

// Restore last result if available
if(state.lastResult) {
  // Will render when user visits rapor tab
}

