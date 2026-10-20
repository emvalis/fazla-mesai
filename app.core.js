/* ══════════════════════════════════════════════════════════
   Emvalis v3 — app.core.js  (1/6)
   İçerik : State (kayıt/yükleme) · Tarih yardımcıları ·
            Ses motoru · Bildirim sistemi
   Not    : Diğer tüm app.*.js dosyaları buna bağımlıdır.
            index.html'de İLK sırada yüklenmelidir.
   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── STATE ───────────────────────────────────────────────── */
const STORAGE_KEY = 'takbis_plus_v3';
let state = {
  kadrolu:    { people:[], settings:{} },
  sozlesmeli: { people:[], settings:{} },
  holidays:   [],
  lastResult: null,
  theme:      'dark'
};
let activePersonelGroup = 'kadrolu';
let currentLeaveGroup   = null;
let currentLeaveIdx     = null;

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
}
function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return;
    const d = JSON.parse(s);
    state.kadrolu    = d.kadrolu    || { people:[], settings:{} };
    state.sozlesmeli = d.sozlesmeli || { people:[], settings:{} };
    state.holidays   = d.holidays   || [];
    state.lastResult = rehydrateResult(d.lastResult);
    state.theme      = d.theme      || 'dark';
  } catch(e){}
}

// JSON.stringify turns Date objects into ISO strings and Set objects into "{}",
// so a saved lastResult must be rebuilt into real Date/Set instances before use.
function rehydrateResult(r) {
  if (!r || !Array.isArray(r.allDates) || !Array.isArray(r.assigned)) return null;
  try {
    const allDates = r.allDates.map(parseDate).filter(Boolean);
    const assigned = r.assigned.map(a => ({
      person: a.person,
      dayMap: a.dayMap || {},
      leavesSet: new Set((a.person?.leaves||[]).map(l=>dateKey(parseDate(l))).filter(Boolean))
    }));
    if (!allDates.length || assigned.length !== r.assigned.length) return null;
    return { ...r, allDates, assigned };
  } catch(e) { return null; }
}

/* ── DATE HELPERS ────────────────────────────────────────── */
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date && !isNaN(s)) return s;
  s = String(s).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  // DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d,m,y] = s.split('.').map(Number);
    return new Date(y, m-1, d);
  }
  const t = new Date(s);
  return isNaN(t) ? null : t;
}
function dateToISO(d) {
  if (!(d instanceof Date)) d = parseDate(d);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateToDisplay(d) {
  if (!(d instanceof Date)) d = parseDate(d);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}
function datesInMonth(y, m) {
  const res = [], tot = new Date(y, m, 0).getDate();
  for (let d=1; d<=tot; d++) res.push(new Date(y, m-1, d));
  return res;
}
function dateKey(d) { return dateToISO(d); }
function isWeekend(d) { return d.getDay()===0 || d.getDay()===6; }
function isHolidayDate(d, hols) {
  const dk = dateKey(d);
  return hols.some(h => { const p=parseDate(h); return p && dateKey(p)===dk; });
}
const TR_MONTHS  = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const TR_DAYS    = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const DAY_TR_ABB = ['PAZ','PZT','SAL','ÇAR','PER','CUM','CMT'];

/* ── SOUND ENGINE ────────────────────────────────────────── */
let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type='sine', dur=0.18, vol=0.18, delay=0) {
  if (!soundEnabled) return;
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.05);
  } catch(e){}
}

const Sounds = {
  click:   () => playTone(880, 'sine',     0.06, 0.12),
  add:     () => { playTone(523, 'sine', 0.14, 0.18); playTone(784, 'sine', 0.14, 0.14, 0.08); },
  delete:  () => { playTone(330, 'sine', 0.1, 0.14); playTone(220, 'sine', 0.14, 0.1, 0.1); },
  success: () => { playTone(523,'sine',0.1,0.16); playTone(659,'sine',0.1,0.16,0.1); playTone(784,'sine',0.18,0.18,0.2); },
  error:   () => { playTone(220,'sawtooth',0.12,0.14); playTone(185,'sawtooth',0.16,0.12,0.12); },
  excel:   () => { playTone(440,'sine',0.08,0.14); playTone(554,'sine',0.08,0.14,0.08); playTone(659,'sine',0.12,0.16,0.16); playTone(880,'sine',0.16,0.14,0.26); },
  notify:  () => playTone(660, 'sine', 0.1, 0.12),
  tabSwitch: () => playTone(440, 'sine', 0.07, 0.1),
  toggle:  () => playTone(660, 'triangle', 0.08, 0.1),
};

/* ── NOTIFICATION SYSTEM ─────────────────────────────────── */
let notifCount = 0;
const NOTIF_ICONS = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
const NOTIF_TITLES = { success:'Başarılı', error:'Hata', warning:'Uyarı', info:'Bilgi' };

function notify(msg, type='info', duration=3800) {
  Sounds.notify();
  const container = document.getElementById('notifContainer');
  const id = `notif-${++notifCount}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = `notif notif-${type}`;
  div.innerHTML = `
    <div class="notif-icon">${NOTIF_ICONS[type]||'ℹ️'}</div>
    <div class="notif-body">
      <div class="notif-title">${NOTIF_TITLES[type]||type}</div>
      <div class="notif-msg">${msg}</div>
    </div>
    <button class="notif-close" onclick="dismissNotif('${id}')" aria-label="Kapat">✕</button>
    <div class="notif-progress" style="animation-duration:${duration}ms"></div>`;
  container.appendChild(div);
  requestAnimationFrame(() => { requestAnimationFrame(() => div.classList.add('show')); });
  setTimeout(() => dismissNotif(id), duration);
  // keep max 5
  const all = container.querySelectorAll('.notif');
  if (all.length > 5) dismissNotif(all[0].id);
}

function dismissNotif(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(() => el.remove(), 450);
}

