/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.ui.js  (2/6)
   İçerik : Tema · Saat · Navigasyon · Mobil çekmece ·
            Video/Genel modallar · Dashboard istatistikleri
   Not    : app.core.js'ten sonra yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── THEME ───────────────────────────────────────────────── */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  state.theme = t;
  const btn = document.getElementById('themeToggleBtn');
  const icon = document.getElementById('themeIcon');
  const dBtn = document.getElementById('drawerThemeBtn');
  if (icon) icon.textContent = t === 'dark' ? '☀️' : '🌙';
  if (btn)  btn.title = t === 'dark' ? 'Aydınlık Temaya Geç ' : 'Koyu Temaya Geç ';
  if (dBtn) dBtn.textContent = t === 'dark' ? '☀️ Aydınlık Tema' : '🌙 Koyu Tema';
  try { localStorage.setItem('emv', t); } catch(e){}   // ← EKLENDİ (ortak tema kaydı)
  saveState();
}
function toggleTheme() {
  Sounds.toggle();
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/* ── CLOCK ───────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const cl = document.getElementById('liveClock');
  const dl = document.getElementById('liveDate');
  if (cl) cl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  if (dl) dl.textContent = `${TR_DAYS[now.getDay()]}, ${now.getDate()} ${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}
const pad = n => String(n).padStart(2,'0');
setInterval(updateClock, 1000); updateClock();

/* ── NAVIGATION ──────────────────────────────────────────── */
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn,.drawer-nav-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById(`sec-${name}`);
  if (sec) sec.classList.add('active');
  document.querySelectorAll(`[data-section="${name}"]`).forEach(b => b.classList.add('active'));
  Sounds.tabSwitch();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });   // yeni sekme her zaman en üstten açılsın
  if (name==='personel')  renderPersonelList();
  if (name==='dashboard') updateStats();
  if (name==='dagitim')   updatePersonelInfoBox();
  if (name==='rapor' && state.lastResult) { renderTable(state.lastResult); renderSummary(state.lastResult); }
}

/* ── MOBILE DRAWER ───────────────────────────────────────── */
function openDrawer() {
  document.getElementById('mobileDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded','true');
  Sounds.click();
}
function closeDrawer() {
  document.getElementById('mobileDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded','false');
}

/* ── VIDEO MODAL ─────────────────────────────────────────── */
function openVideoModal() {
  Sounds.click();
  document.getElementById('videoIframe').src = 'https://www.youtube.com/embed/B9VRvOKKwfs?si=I9l_nLgda-9-Aro8&autoplay=1&rel=0';
  openModal('videoModal');
}
function closeVideoModal() {
  document.getElementById('videoIframe').src = '';
  document.getElementById('videoModal').classList.remove('open');
}

/* ── MODALS ──────────────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  Sounds.click();
}
function closeModal(id) {
  if (id==='videoModal') { closeVideoModal(); return; }
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target===m) {
      if (m.id==='videoModal') closeVideoModal();
      else m.classList.remove('open');
    }
  });
});

/* ── STATS ───────────────────────────────────────────────── */
function updateStats() {
  const kad = state.kadrolu.people.length;
  const soz = state.sozlesmeli.people.length;
  const tat = state.holidays.length;
  const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  el('stat-kad', kad); el('stat-soz', soz); el('stat-tatil', tat);
  const mx = Math.max(kad,soz,1);
  const bar = (id,v) => { const e=document.getElementById(id); if(e) e.style.width=`${v}%`; };
  bar('sbar-kad', (kad/mx)*100); bar('sbar-soz', (soz/mx)*100); bar('sbar-tatil', Math.min(100,tat*8));
  const ay=document.getElementById('set-ay'), yil=document.getElementById('set-yil');
  if (ay && yil) el('stat-ay', `${TR_MONTHS[+ay.value-1]} ${yil.value}`);
}
function updatePersonelInfoBox() {
  const grup = document.getElementById('set-grup')?.value||'kadrolu';
  const n = state[grup].people.length;
  const box = document.getElementById('personel-info-box');
  if (box) box.textContent = `${grup==='kadrolu'?'Kadrolu':'Sözleşmeli'}: ${n} personel kayıtlı.`;
}

