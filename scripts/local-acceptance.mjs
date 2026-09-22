// Starts Netlify Dev and checks the real local Functions / Blobs emulator.
// Test data stays in Netlify's isolated local storage.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['node_modules/netlify-cli/bin/run.js', 'dev', '--offline'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
const origin = 'http://localhost:8888';
const results = {};
const deadline = setTimeout(() => { console.error('Local acceptance timed out. Last output:', output.slice(-3500)); try { process.kill(-server.pid, 'SIGTERM'); } catch {} process.exit(1); }, 180000);
try {
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try { const response = await fetch(`${origin}/api/health`, {signal: AbortSignal.timeout(15000)}); if (response.ok) { results.health = await response.json(); ready = true; break; } } catch {}
    if (server.exitCode !== null) break;
  }
  assert.ok(ready, `Local server did not become healthy: ${output.slice(-2500)}`);
  const home = await fetch(origin); assert.equal(home.status, 200);
  assert.match(await home.text(), /The Royal Flush/); results.homepage = 'passed';
  const invalid = await fetch(`${origin}/api/restrooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(invalid.status, 400); results.invalidSubmission = 'passed';
  const payload = { locationName: 'Royal Flush Local Acceptance Test', address: '405 South Santa Anita Avenue, Arcadia, California', latitude: 34.133, longitude: -118.035, mensCode: '#2468', womensCode: 'Ask cashier', rating: 4, notes: 'Local testing only.' };
  const created = await fetch(`${origin}/api/restrooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(created.status, 201, await created.clone().text());
  const { restroom } = await created.json(); assert.equal(restroom.mensCode, '#2468'); assert.equal(restroom.womensCode, 'Ask cashier');
  const get = await fetch(`${origin}/api/restrooms`, { headers: { Cookie: '' }, cache: 'no-store' });
  assert.ok((await get.json()).restrooms.some(r => r.id === restroom.id)); results.sharedLocalStorage = 'passed across independent HTTP requests (not browsers)';
  const update = await fetch(`${origin}/api/restrooms/${restroom.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...restroom, mensCode: 'Updated 2468', expectedUpdatedAt: restroom.updatedAt }) });
  assert.equal(update.status, 200, (await update.clone().text()) + output.slice(-2500));
  const { restroom: edited } = await update.json(); assert.equal(edited.id, restroom.id); assert.equal(edited.createdAt, restroom.createdAt); assert.equal(edited.womensCode, 'Ask cashier'); assert.equal(edited.mensCode, 'Updated 2468');
  const stale = await fetch(`${origin}/api/restrooms/${restroom.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...restroom, expectedUpdatedAt: restroom.updatedAt }) });
  assert.equal(stale.status, 409);
  const independent = await fetch(`${origin}/api/restrooms`, { cache: 'no-store' });
  assert.deepEqual((await independent.json()).restrooms.find(r => r.id === restroom.id), edited); results.fullListingEditAndConflict = 'passed';
  const geography = await fetch(`${origin}/api/geocode?q=2901%20Los%20Feliz%20Boulevard%20Los%20Angeles`);
  results.geocode = { status: geography.status, body: await geography.json() };
  console.log(JSON.stringify(results, null, 2));
} finally {
  clearTimeout(deadline);
  try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
}
