import fetch from 'node-fetch';

console.log('[Test] Testing backend health...');
try {
  const health = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(3000) });
  console.log('[Test] Health:', health.status, await health.text());
} catch(e) {
  console.error('[Test] Health check failed:', e.message);
}

console.log('\n[Test] Testing progress endpoint for MRF (reading first 5 events)...');
try {
  const res = await fetch('http://localhost:3001/api/progress/MRF', { signal: AbortSignal.timeout(30000) });
  console.log('[Test] Progress status:', res.status, res.statusText);

  let eventCount = 0;
  const startTime = Date.now();
  for await (const chunk of res.body) {
    const text = chunk.toString();
    console.log(`[${((Date.now()-startTime)/1000).toFixed(1)}s] ${text.trim().slice(0,200)}`);
    eventCount++;
    if (eventCount >= 8) { console.log('[Test] Got 8 events, stopping'); break; }
  }
} catch(e) {
  console.error('[Test] Progress endpoint error:', e.message);
}

console.log('[Test] Done.');
