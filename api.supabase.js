// ============================================================
// api.supabase.js — pengganti api.js (versi Supabase)
// Objek `gscript` DIPERTAHANKAN namanya → index.html nyaris tak berubah.
// Muat SEBELUM file ini:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// Lalu: <script src="api.supabase.js"></script>
// ============================================================

// ── WAJIB DIISI (dari Project Settings → API di Supabase baru) ──
const SUPABASE_URL = "https://afykoejnpkiorqbkgndp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmeWtvZWpucGtpb3JxYmtnbmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjYxMzMsImV4cCI6MjA5OTU0MjEzM30.iqkExRXfmYH3734r8SHSGlv91kCTe2IUGE6b7wKiXwk";
// ────────────────────────────────────────────────────────────

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "khatamku_auth" },
});

// Helper: buka hasil RPC / lempar error seragam (mirip gasCall lama)
async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

// ── AUTH via Edge Function `auth` ───────────────────────────
async function invokeAuth(payload) {
  const { data, error } = await sb.functions.invoke("auth", { body: payload });
  if (error) {
    // pesan error dari fungsi ada di context response
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

const gscript = {
  // ── AUTH ──────────────────────────────────────────────────
  // Mengembalikan {user, dashboardData} — sama seperti GAS doLogin.
  doLogin: async (username, password) => {
    const res = await invokeAuth({ action: "login", identifier: username, password });
    // pasang sesi supabase agar RPC berikutnya terautentikasi
    const { error: sessErr } = await sb.auth.setSession({
      access_token: res.access_token, refresh_token: res.refresh_token,
    });
    if (sessErr) throw new Error("Gagal memasang sesi login: " + sessErr.message);
    return { user: res.user, dashboardData: res.dashboardData };
  },

  doRegister: (namaLengkap, username, password, email) =>
    invokeAuth({ action: "register", namaLengkap, username, password, email }),

  logout: () => sb.auth.signOut(),

  // ── DATA MURID (userId diabaikan; server pakai auth.uid) ──
  getInitialData: (_userId) => rpc("app_get_initial_data"),

  saveProgressUpdate: (_userId, p) =>
    rpc("app_save_progress", {
      p_start: parseInt(p.startPage) || 0,
      p_last: parseInt(p.lastPageInput) || 0,
      p_date: p.date || null,
    }),

  saveUserTarget: (_userId, t) =>
    rpc("app_save_target", { p_daily: parseInt(t.dailyTargetPages) || 0 }),

  saveUdzurStatus: (_userId, status) => rpc("app_save_udzur", { p_status: status || "" }),

  getFullHistory: (_userId) => rpc("app_get_full_history"),

  resetReadingData: (_userId) => rpc("app_reset_reading"),

  calibrateReadingPosition: (_userId, c) =>
    rpc("app_calibrate", { p_page: parseInt(c.page), p_surah: c.surahId ? parseInt(c.surahId) : null }),

  // ── DZIKIR TRACKING (FITUR BARU) — jenis: 'pagi' | 'petang' ─
  getDzikirToday: () => rpc("app_dzikir_today"),
  tickDzikir: (jenis) => rpc("app_dzikir_tick", { p_jenis: jenis }),
  untickDzikir: (jenis) => rpc("app_dzikir_untick", { p_jenis: jenis }),
  getDzikirHistory: (days) => rpc("app_dzikir_history", { p_days: days || 30 }),

  // ── BOOKMARK (FITUR BARU) — langsung tabel via RLS ────────
  addBookmark: async (surahId, ayat, catatan) => {
    const s = parseInt(surahId), a = parseInt(ayat);
    if (!(s >= 1 && s <= 114) || !(a >= 1)) throw new Error("Referensi ayat tidak valid.");
    const { data, error } = await sb.from("bookmark")
      .upsert({ surah_id: s, ayat: a, catatan: catatan || "",
                user_id: (await sb.auth.getUser()).data.user.id },
              { onConflict: "user_id,surah_id,ayat" })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  listBookmarks: async () => {
    const { data, error } = await sb.from("bookmark").select("*").order("dibuat_pada", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
  deleteBookmark: async (id) => {
    const { error } = await sb.from("bookmark").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // ── KONTEN STATIS (tabel konten, RLS baca publik) ─────────
  getTentangContent: async () => {
    const { data, error } = await sb.from("konten").select("kunci, nilai");
    if (error) throw new Error(error.message);
    return Object.fromEntries((data || []).map((r) => [r.kunci, r.nilai]));
  },
  getPotretContent: async () => {
    const { data, error } = await sb.from("konten").select("kunci, nilai").like("kunci", "potret_%");
    if (error) throw new Error(error.message);
    return Object.fromEntries((data || []).map((r) => [r.kunci, r.nilai]));
  },

  // ── GURU ──────────────────────────────────────────────────
  getTeacherDashboardData: (_userId) => rpc("app_teacher_dashboard"),
  teacherSetTarget: (username, dailyTarget) => rpc("app_teacher_set_target", { p_username: username, p_daily: parseInt(dailyTarget) || 0 }),
  teacherSetUdzur: (username, status, endDate) => rpc("app_teacher_set_udzur", { p_username: username, p_status: status || "", p_end: endDate || null }),

  // ── ADMIN ─────────────────────────────────────────────────
  adminDashboard: () => rpc("app_admin_dashboard"),
  adminListUsers: (opts = {}) => rpc("app_admin_list_users", {
    p_role: opts.role || null,
    p_halaqah_id: opts.halaqahId || null,
    p_search: opts.search || null,
    p_limit: opts.limit || 50,
    p_offset: opts.offset || 0,
  }),
  adminAction: async (action, payload = {}) => {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    const { data, error } = await sb.functions.invoke("admin-actions", {
      body: { action, ...payload },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      let msg = error.message || "Kesalahan pada server (tidak ada pesan detail).";
      try {
        const json = await error.context.json();
        msg = json?.error || json?.message || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  },
  adminUpdateProfile: (userId, nama, role, halaqahId, noWa) => rpc("app_admin_update_profile", {
    p_user_id: userId, p_nama: nama, p_role: role, p_halaqah_id: halaqahId || "", p_no_wa: noWa || ""
  }),
  adminStudentDetail: (username) => rpc("app_admin_student_detail", { p_username: username }),

  // ── ADMIN: Halaqah (Tahap 3) ──────────────────────────────
  adminListHalaqah: () => rpc("app_admin_list_halaqah"),
  adminHalaqahDetail: (id) => rpc("app_admin_halaqah_detail", { p_id: id }),
  adminUpsertHalaqah: (id, nama) => rpc("app_admin_upsert_halaqah", { p_id: id, p_nama: nama || "" }),
  adminDeleteHalaqah: (id) => rpc("app_admin_delete_halaqah", { p_id: id }),
  adminSetHalaqahGuru: (halaqahId, guruIds) => rpc("app_admin_set_halaqah_guru", { p_halaqah_id: halaqahId, p_guru_ids: guruIds || [] }),
  adminMoveStudent: (username, newHalaqahId) => rpc("app_admin_move_student", { p_username: username, p_new_halaqah_id: newHalaqahId || "" }),
  adminListGuru: () => rpc("app_admin_list_guru"),

  // ── ADMIN: Analytics & Notifikasi (Tahap 4) ───────────────
  adminAnalytics: (from, to) => rpc("app_admin_analytics", { p_from: from, p_to: to }),
  adminNotifTargets: (scope, halaqahId) => rpc("app_admin_notif_targets", { p_scope: scope || "all", p_halaqah_id: halaqahId || null }),

  // ── ADMIN: Pengaturan (Tahap 5) ───────────────────────────
  adminListKonten: () => rpc("app_admin_list_konten"),
  adminSetKonten: (kunci, nilai) => rpc("app_admin_set_konten", { p_kunci: kunci, p_nilai: nilai || "" }),
  adminGetLog: (limit = 50, offset = 0) => rpc("app_admin_get_log", { p_limit: limit, p_offset: offset }),
};

// biar kompatibel jika ada kode lama memanggil window.gscript
window.gscript = gscript;
window.sb = sb;
