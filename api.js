// ============================================================
// api.js  — letakkan di root folder PWA (sejajar index.html)
// Menggantikan semua panggilan google.script.run di index.html
// ============================================================

// ── WAJIB DIISI: URL deploy Apps Script kamu ──────────────
// Setelah deploy Apps Script → salin URL-nya ke sini
// Contoh: https://script.google.com/macros/s/AKfycbx.../exec
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxFEIClFkIBclKTC8tg6PxWtjZ5FdWEwpRd2roOPzz9xiOiHMP5WRDA4L0NbWBVSoB_iA/exec';
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

  calibrateReadingPosition: (userId, calibrationData) =>
    gasCall('calibrateReadingPosition', { userId, calibrationData }),

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

  // ── ADMIN: HEALTH DASHBOARD ───────────────────────────────
  adminGetHealthDashboard: (adminId) =>
    gasCall('adminGetHealthDashboard', { adminId }, 'GET'),

  // ── ADMIN: MANAJEMEN PENGGUNA ─────────────────────────────
  /**
   * @param {object} [filters] { role, halaqah, search }
   */
  adminGetAllUsers: (adminId, filters = {}) =>
    gasCall('adminGetAllUsers', { adminId, filters }, 'GET'),

  /**
   * @param {object} muridData { nis, password, namaLengkap, halaqah?, noWa?, targetHarian?, halamanAwal? }
   */
  adminAddMurid: (adminId, muridData) =>
    gasCall('adminAddMurid', { adminId, muridData }),

  /**
   * @param {object} editData { namaLengkap?, halaqah?, noWa?, targetHarian? }
   */
  adminEditMurid: (adminId, userId, editData) =>
    gasCall('adminEditMurid', { adminId, userId, editData }),

  adminResetPassword: (adminId, userId, newPassword) =>
    gasCall('adminResetPassword', { adminId, userId, newPassword }),

  /** ⚠️ PERMANEN — hapus murid + semua data bacaan & jurnal */
  adminDeleteMurid: (adminId, userId) =>
    gasCall('adminDeleteMurid', { adminId, userId }),

  /**
   * @param {object} calibrationData { page: number, surahId?: number }
   */
  adminCalibrateStudent: (adminId, userId, calibrationData) =>
    gasCall('adminCalibrateStudent', { adminId, userId, calibrationData }),

  adminResetStudentData: (adminId, userId) =>
    gasCall('adminResetStudentData', { adminId, userId }),

  // ── ADMIN: MANAJEMEN HALAQAH ──────────────────────────────
  adminGetAllHalaqah: (adminId) =>
    gasCall('adminGetAllHalaqah', { adminId }, 'GET'),

  adminAddHalaqah: (adminId, halaqahName) =>
    gasCall('adminAddHalaqah', { adminId, halaqahName }),

  /** Hapus halaqah & pindahkan seluruh anggota ke Halaqah_Umum */
  adminDeleteHalaqah: (adminId, halaqahName) =>
    gasCall('adminDeleteHalaqah', { adminId, halaqahName }),

  adminMoveStudentHalaqah: (adminId, userId, newHalaqah) =>
    gasCall('adminMoveStudentHalaqah', { adminId, userId, newHalaqah }),

  // ── ADMIN: BULK IMPORT CSV ────────────────────────────────
  /**
   * Import massal murid dari CSV yang sudah di-parse frontend.
   *
   * Template kolom CSV (header di baris pertama):
   *   NIS, Password, Nama_Lengkap, Halaqah, No_WA, Target_Harian, Halaman_Awal
   *
   * Cara parse CSV di frontend sebelum memanggil fungsi ini:
   *   const rows = parseCSV(csvText);  // lihat parseAdminCSV() di bawah
   *   gscript.adminImportCSV(adminId, rows).then(...)
   *
   * @param {Array} rows — array of objects hasil parseAdminCSV()
   * @returns {{ imported, skipped, errors, details }}
   */
  adminImportCSV: (adminId, rows) =>
    gasCall('adminImportCSV', { adminId, rows }),

  // ── ADMIN: MANAJEMEN KONTEN ───────────────────────────────
  /** @param {object} contentData — { wa_link?, ig_link?, deskripsi_app?, ... } */
  adminUpdateTentang: (adminId, contentData) =>
    gasCall('adminUpdateTentang', { adminId, contentData }),

  /**
   * Simpan artikel Potret (INSERT jika id kosong, UPDATE jika id ada).
   * @param {object} artikelData { id?, judul, kategori?, penulis?, tanggal?,
   *                               ringkasan?, isi, referensi?, aktif? }
   */
  adminSavePotretArtikel: (adminId, artikelData) =>
    gasCall('adminSavePotretArtikel', { adminId, artikelData }),

  adminDeletePotretArtikel: (adminId, artikelId) =>
    gasCall('adminDeletePotretArtikel', { adminId, artikelId }),

  adminTogglePotretArtikel: (adminId, artikelId, aktif) =>
    gasCall('adminTogglePotretArtikel', { adminId, artikelId, aktif }),

  // ── ADMIN: MANAJEMEN GURU ─────────────────────────────────
  /** @param {object} guruData { username, password, namaLengkap, halaqah?, noWa? } */
  adminAddGuru: (adminId, guruData) =>
    gasCall('adminAddGuru', { adminId, guruData }),

  /** halaqahStr boleh multi: "Halaqah_A, Halaqah_B" */
  adminUpdateGuruHalaqah: (adminId, guruId, halaqahStr) =>
    gasCall('adminUpdateGuruHalaqah', { adminId, guruId, halaqahStr }),
};
// ============================================================
// HELPER FRONTEND: Parser CSV untuk fitur Bulk Import
// ============================================================

/**
 * Mengubah teks CSV mentah menjadi array of objects siap dikirim ke
 * gscript.adminImportCSV().
 *
 * FORMAT KOLOM (header di baris 1, case-insensitive):
 *   NIS, Password, Nama_Lengkap, Halaqah, No_WA, Target_Harian, Halaman_Awal
 *
 * Kolom opsional (boleh kosong): Halaqah, No_WA, Target_Harian, Halaman_Awal
 *
 * @param  {string} csvText  — isi file .csv sebagai teks (baca dengan FileReader)
 * @returns {Array}          — array of objects, satu object per baris data
 *
 * Contoh pemakaian di frontend:
 *   fileInput.addEventListener('change', async (e) => {
 *     const text = await e.target.files[0].text();
 *     const rows = parseAdminCSV(text);
 *     const result = await gscript.adminImportCSV(currentUser.id, rows);
 *     showImportResult(result);
 *   });
 */
function parseAdminCSV(csvText) {
  // Normalisasi line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Cari baris header (baris pertama tidak kosong)
  let headerLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) { headerLine = i; break; }
  }
  if (headerLine < 0) return [];

  const headers = _splitCSVLine(lines[headerLine]).map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  );

  // Peta nama header → key object
  const colMap = {
    'nis'           : 'nis',
    'username'      : 'nis',
    'id_murid'      : 'nis',
    'password'      : 'password',
    'pass'          : 'password',
    'nama_lengkap'  : 'namaLengkap',
    'nama'          : 'namaLengkap',
    'halaqah'       : 'halaqah',
    'kelas'         : 'halaqah',
    'no_wa'         : 'noWa',
    'no_whatsapp'   : 'noWa',
    'whatsapp'      : 'noWa',
    'target_harian' : 'targetHarian',
    'target'        : 'targetHarian',
    'halaman_awal'  : 'halamanAwal',
    'halaman'       : 'halamanAwal',
  };

  const mappedHeaders = headers.map(h => colMap[h] || h);
  const rows = [];

  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip baris kosong

    const cols = _splitCSVLine(line);
    const obj  = {};
    mappedHeaders.forEach((key, idx) => {
      obj[key] = (cols[idx] || '').trim();
    });
    // Pastikan field wajib ada
    if (obj.nis || obj.namaLengkap) rows.push(obj);
  }

  return rows;
}

/**
 * Memecah satu baris CSV menjadi array kolom.
 * Mendukung nilai yang dibungkus tanda kutip ganda (RFC 4180).
 */
function _splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}
