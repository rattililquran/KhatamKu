// ============================================================
// api.js  — letakkan di root folder PWA (sejajar index.html)
// Menggantikan semua panggilan google.script.run di index.html
// ============================================================

// ── WAJIB DIISI: URL deploy Apps Script kamu ──────────────
// Setelah deploy Apps Script → salin URL-nya ke sini
// Contoh: https://script.google.com/macros/s/AKfycbx.../exec
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyksYnUPurX2MDixYGKPX4XwKqPTuefUq9x6LNrHWPKuBixRxUvp7JhgHhOpFu4V2uTww/exec';
// ──────────────────────────────────────────────────────────

/**
 * Mengirim request ke Apps Script dan mengembalikan Promise.
 *
 * Untuk mutasi (POST) gunakan method: 'POST'.
 * Untuk query ringan (GET) default.
 *
 * @param {string} action   - nama fungsi di Code_API.gs
 * @param {object} params   - parameter yang dikirim
 * @param {string} method   - 'GET' | 'POST' (default 'POST')
 */
async function gasCall(action, params = {}, method = 'POST') {
  // Apps Script tidak mendukung CORS preflight dengan body,
  // jadi kita pakai GET dengan params JSON-encoded untuk query,
  // dan POST no-cors redirect untuk mutasi.
  const url = new URL(GAS_URL);

  let fetchOptions;

  if (method === 'GET') {
    url.searchParams.set('action', action);
    url.searchParams.set('params', JSON.stringify(params));
    fetchOptions = { method: 'GET' };
  } else {
    // POST: Apps Script redirect ke GET setelah auth,
    // jadi kita tetap kirim sebagai GET dengan query string
    // (pola paling andal untuk Apps Script tanpa OAuth)
    url.searchParams.set('action', action);
    url.searchParams.set('params', JSON.stringify(params));
    fetchOptions = { method: 'GET' };
  }

  const res = await fetch(url.toString(), fetchOptions);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  if (!json.ok) {
    const err = new Error(json.error || 'Server error');
    err.gasError = true;
    throw err;
  }

  return json.data;
}

// ============================================================
// Objek pengganti google.script.run
// Pemakaian identik: gscript.doLogin(u,p).then(...).catch(...)
// ============================================================
const gscript = {

  // ── AUTH ──────────────────────────────────────────────────
  doLogin: (username, password) =>
    gasCall('doLogin', { username, password }),

  doRegister: (namaLengkap, username, password) =>
    gasCall('doRegister', { namaLengkap, username, password }),

  // ── DATA MURID ────────────────────────────────────────────
  getInitialData: (userId) =>
    gasCall('getInitialData', { userId }, 'GET'),

  saveProgressUpdate: (userId, progressData) =>
    gasCall('saveProgressUpdate', { userId, progressData }),

  saveUserTarget: (userId, targetData) =>
    gasCall('saveUserTarget', { userId, targetData }),

  saveUdzurStatus: (userId, status) =>
    gasCall('saveUdzurStatus', { userId, status }),

  getFullHistory: (userId) =>
    gasCall('getFullHistory', { userId }, 'GET'),

  resetReadingData: (userId) =>
    gasCall('resetReadingData', { userId }),

  // ── JURNAL ────────────────────────────────────────────────
  saveJournal: (userId, journalData) =>
    gasCall('saveJournal', { userId, journalData }),

  deleteJournal: (userId, id) =>
    gasCall('deleteJournal', { userId, id }),

  // ── KONTEN STATIS ─────────────────────────────────────────
  getTentangContent: () =>
    gasCall('getTentangContent', {}, 'GET'),

  getPotretContent: () =>
    gasCall('getPotretContent', {}, 'GET'),

  // ── GURU ──────────────────────────────────────────────────
  getTeacherDashboardData: (userId) =>
    gasCall('getTeacherDashboardData', { userId }, 'GET'),
};
