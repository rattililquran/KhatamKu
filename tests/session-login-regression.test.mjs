import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadApi(seed = {}) {
  const source = await readFile(new URL('../api.supabase.js', import.meta.url), 'utf8');
  const local = new Map();
  const session = new Map();
  if (seed.remember !== undefined) local.set('khatamku_remember', seed.remember);
  if (seed.localProfile) local.set('khatamku_user', '{"id":"u1"}');
  if (seed.sessionProfile) session.set('khatamku_user', '{"id":"u1"}');
  if (seed.legacyAuth) local.set('khatamku_auth', seed.legacyAuth);
  let signOutCalls = 0;
  let capturedOptions;
  const rpcCalls = [];
  const fakeSb = {
    functions: { invoke: async () => ({ data: {
      access_token: 'access', refresh_token: 'refresh', user: { id: 'u1', role: 'murid' }, dashboardData: null,
    } }) },
    auth: {
      setSession: async value => {
        await capturedOptions.auth.storage.setItem('khatamku_auth', JSON.stringify(value));
        return { error: null };
      },
      signOut: async () => { signOutCalls++; return { error: null }; },
    },
    rpc: async (...args) => { rpcCalls.push(args); return { data: null, error: null }; },
  };
  const makeStorage = map => ({
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  });
  const context = {
    window: { supabase: { createClient: (_url, _key, options) => { capturedOptions = options; return fakeSb; } } },
    localStorage: makeStorage(local),
    sessionStorage: makeStorage(session),
    crypto: { randomUUID: () => '20000000-0000-4000-8000-000000000001' },
    console,
  };
  vm.runInNewContext(`${source}\nglobalThis.api = gscript;`, context);
  return { api: context.api, local, session, rpcCalls, authStorage: capturedOptions.auth.storage, get signOutCalls() { return signOutCalls; } };
}

test('unchecked remember-me keeps the Supabase auth session in sessionStorage only', async () => {
  const { api, local, session } = await loadApi();

  await api.doLogin('user', 'password', false);

  assert.equal(local.has('khatamku_auth'), false);
  assert.equal(session.has('khatamku_auth'), true);
});

test('legacy unchecked sessions migrate out of persistent storage', async () => {
  const { local, session, authStorage } = await loadApi({ sessionProfile: true, legacyAuth: 'legacy-token' });

  const stored = authStorage.getItem('khatamku_auth');

  assert.equal(stored, 'legacy-token');
  assert.equal(local.has('khatamku_auth'), false);
  assert.equal(session.get('khatamku_auth'), 'legacy-token');
});

test('logout revokes the active Supabase session', async () => {
  const state = await loadApi();
  state.local.set('khatamku_auth', 'persistent-token');
  state.session.set('khatamku_auth', 'temporary-token');

  await state.api.logout();

  assert.equal(state.signOutCalls, 1);
  assert.equal(state.local.has('khatamku_auth'), false);
  assert.equal(state.session.has('khatamku_auth'), false);
});

test('login dashboard payload is accepted only when it matches the user role', async () => {
  const { api } = await loadApi();

  assert.deepEqual(api.loginDashboardForRole('admin', { total_murid: 12 }), { total_murid: 12 });
  assert.equal(api.loginDashboardForRole('admin', { students: [] }), null);
  assert.equal(api.loginDashboardForRole('guru', { students: [], halaqahs: ['A'] }).halaqahs[0], 'A');
  assert.equal(api.loginDashboardForRole('guru', { total_murid: 12 }), null);
  assert.equal(api.loginDashboardForRole('murid', { profile: {} }).profile instanceof Object, true);
});

test('progress RPC always receives an idempotency UUID', async () => {
  const { api, rpcCalls } = await loadApi();

  await api.saveProgressUpdate('u1', { startPage: 25, lastPageInput: 30 });

  assert.equal(rpcCalls[0][0], 'app_save_progress');
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls[0][1])), {
    p_start: 25,
    p_last: 30,
    p_date: null,
    p_request_id: '20000000-0000-4000-8000-000000000001',
  });
});
