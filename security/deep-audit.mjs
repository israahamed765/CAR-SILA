#!/usr/bin/env node
/**
 * Deep external security audit for CAR-SILA (authorized owner testing).
 * Focus: CSRF on mutating methods, auth enumeration signals, error leakage.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.AUDIT_BASE || 'https://car-sila-sand.vercel.app';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'deep-audit-results.json');

const MUTATING = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/admin',
  '/api/auth/google',
  '/api/auth/logout',
  '/api/public/reports',
  '/api/public/calls',
  '/api/public/calls/ice',
  '/api/public/calls/end',
  '/api/public/messages',
  '/api/translate',
  '/api/vehicles',
  '/api/vehicles/delete',
  '/api/vehicles/clear',
  '/api/vehicles/return',
  '/api/vehicles/status',
  '/api/vehicles/token',
  '/api/reports/status',
  '/api/messages',
  '/api/profile',
  '/api/admin/users/status',
  '/api/messages/read',
  '/api/notifications/read',
  '/api/push/subscribe',
  '/api/push/unsubscribe',
  '/api/sos/help',
  '/api/sos/request',
  '/api/sos/accept',
  '/api/sos/close',
  '/api/sos/message',
  '/api/calls/signal'
];

const LEAK_HINTS = [
  /at\s+\S+\s+\(/i,
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /supabase/i,
  /node_modules/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /stack/i,
  /passwordHash/i,
  /service_role/i
];

const results = {
  base: BASE,
  startedAt: new Date().toISOString(),
  csrf: [],
  methods: [],
  enumeration: [],
  errorLeakage: [],
  summary: {}
};

const parseSetCookie = (res) => {
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  const jar = {};
  for (const line of raw) {
    const [pair] = String(line).split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return jar;
};

const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

const readBody = async (res) => {
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { text, json };
};

const leakScore = (text) => LEAK_HINTS.filter((re) => re.test(text)).map((re) => String(re));

async function seedCsrf() {
  const res = await fetch(`${BASE}/api/bootstrap`, { method: 'GET' });
  const jar = parseSetCookie(res);
  await readBody(res);
  return jar;
}

async function testCsrf() {
  const jar = await seedCsrf();
  const cookie = cookieHeader(jar);
  for (const path of MUTATING) {
    const noToken = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie
      },
      body: '{}'
    });
    const noBody = await readBody(noToken);
    const badToken = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': '00000000-0000-4000-8000-000000000000'
      },
      body: '{}'
    });
    const badBody = await readBody(badToken);
    results.csrf.push({
      path,
      noToken: { status: noToken.status, error: noBody.json?.error || null, leak: leakScore(noBody.text) },
      badToken: { status: badToken.status, error: badBody.json?.error || null, leak: leakScore(badBody.text) },
      pass: noToken.status === 403 && noBody.json?.error === 'csrf'
        && badToken.status === 403 && badBody.json?.error === 'csrf'
    });
  }

  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const res = await fetch(`${BASE}/api/profile`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: '{}'
    });
    const body = await readBody(res);
    results.methods.push({
      method,
      status: res.status,
      error: body.json?.error || null,
      pass: res.status === 403 || res.status === 405
    });
  }
}

async function testEnumeration() {
  const jar = await seedCsrf();
  const token = jar.carsila_csrf || '';
  const cookie = cookieHeader(jar);
  const headers = {
    'Content-Type': 'application/json',
    Cookie: cookie,
    'X-CSRF-Token': token
  };

  // Use invalid payloads so probes never create real accounts on a live target.
  const regA = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Audit Probe',
      email: 'missing-user-carsila-audit@example.com',
      password: '1',
      phone: '0599000000'
    })
  });
  const regABody = await readBody(regA);

  const regB = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Audit Probe',
      email: 'also-missing-carsila-audit@example.com',
      password: '1',
      phone: '0599000000'
    })
  });
  const regBBody = await readBody(regB);

  const loginMissing = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'missing-user-carsila-audit@example.com', password: 'wrong-password' })
  });
  const loginMissingBody = await readBody(loginMissing);

  const loginJunk = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'not-an-email', password: 'x' })
  });
  const loginJunkBody = await readBody(loginJunk);

  results.enumeration.push({
    case: 'register_unknown_email',
    status: regA.status,
    error: regABody.json?.error || null,
    note: 'Should be validation or registration_failed / create — not email_taken'
  });
  results.enumeration.push({
    case: 'register_possible_existing_or_reserved',
    status: regB.status,
    error: regBBody.json?.error || null,
    note: 'Must not return email_taken'
  });
  results.enumeration.push({
    case: 'login_unknown_email',
    status: loginMissing.status,
    error: loginMissingBody.json?.error || null,
    note: 'Expect invalid_credentials only'
  });
  results.enumeration.push({
    case: 'login_invalid_format',
    status: loginJunk.status,
    error: loginJunkBody.json?.error || null
  });

  // Same client-facing code for missing vs wrong-password style probes
  const codes = [loginMissingBody.json?.error, loginJunkBody.json?.error].filter(Boolean);
  results.enumeration.push({
    case: 'login_error_code_consistency',
    codes,
    pass: codes.every((c) => c === 'invalid_credentials')
  });

  results.enumeration.push({
    case: 'register_never_email_taken',
    pass: regABody.json?.error !== 'email_taken' && regBBody.json?.error !== 'email_taken',
    errors: [regABody.json?.error, regBBody.json?.error]
  });
}

async function testErrorLeakage() {
  const jar = await seedCsrf();
  const token = jar.carsila_csrf || '';
  const cookie = cookieHeader(jar);

  const cases = [
    {
      name: 'invalid_json_login',
      run: () => fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': token },
        body: '{not-json'
      })
    },
    {
      name: 'unknown_api_path',
      run: () => fetch(`${BASE}/api/does-not-exist-${Date.now()}`, {
        method: 'GET',
        headers: { Cookie: cookie }
      })
    },
    {
      name: 'bootstrap_get',
      run: () => fetch(`${BASE}/api/bootstrap`, { method: 'GET' })
    },
    {
      name: 'vehicle_missing',
      run: () => fetch(`${BASE}/api/public/vehicle?token=not-a-real-token`, { method: 'GET' })
    },
    {
      name: 'translate_empty',
      run: () => fetch(`${BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': token },
        body: JSON.stringify({ text: '' })
      })
    }
  ];

  for (const item of cases) {
    const res = await item.run();
    const body = await readBody(res);
    const leaks = leakScore(body.text);
    results.errorLeakage.push({
      case: item.name,
      status: res.status,
      contentType: res.headers.get('content-type'),
      error: body.json?.error || null,
      bodyPreview: body.text.slice(0, 240),
      leaks,
      pass: leaks.length === 0 && (body.json ? typeof body.json.error === 'string' || body.json.user !== undefined || body.json.vehicles !== undefined : !/Exception|at\s+/.test(body.text))
    });
  }
}

await testCsrf();
await testEnumeration();
await testErrorLeakage();

results.finishedAt = new Date().toISOString();
results.summary = {
  csrfTotal: results.csrf.length,
  csrfPass: results.csrf.filter((x) => x.pass).length,
  csrfFail: results.csrf.filter((x) => !x.pass).map((x) => x.path),
  methodPass: results.methods.filter((x) => x.pass).length,
  enumerationFlags: results.enumeration.filter((x) => x.pass === false),
  leakageFails: results.errorLeakage.filter((x) => !x.pass).map((x) => x.case)
};

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
console.log(`Wrote ${OUT}`);
