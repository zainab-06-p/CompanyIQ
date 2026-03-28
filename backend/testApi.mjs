import fetch from 'node-fetch';
import config from './config/env.js';

console.log('Testing TinyFish API...');
console.log('Base URL:', config.tinyfish.baseUrl);
console.log('API Key prefix:', config.tinyfish.apiKey?.substring(0, 15));

const body = {
  url: 'https://www.bseindia.com/corporates/ann.html',
  goal: 'Search for company code 532540 and extract the latest 5 corporate announcements. Return as JSON with array of {date, subject, category}.'
};

const controller = new AbortController();
const timeoutId = setTimeout(() => { console.log('TIMEOUT after 300s'); controller.abort(); }, 300000);

try {
  console.log('Sending request...');
  const startTime = Date.now();
  
  const res = await fetch(config.tinyfish.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.tinyfish.apiKey,
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  
  console.log(`Response received in ${Date.now() - startTime}ms`);
  console.log('Status:', res.status);
  console.log('Headers:', JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
  
  if (!res.ok) {
    const txt = await res.text();
    console.log('Error body:', txt);
    process.exit(1);
  }
  
  // Read SSE stream
  const reader = res.body;
  let eventCount = 0;
  
  for await (const chunk of reader) {
    const text = chunk.toString();
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      eventCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${elapsed}s] Event ${eventCount}: ${line.substring(0, 300)}`);
    }
  }
  
  clearTimeout(timeoutId);
  console.log(`\nStream complete. Total events: ${eventCount}, Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  
} catch (err) {
  clearTimeout(timeoutId);
  console.error('Error:', err.name, '-', err.message);
}
