const fs = require('fs');
const ratioFile = 'engine/ratioEngine.js';
let content = fs.readFileSync(ratioFile, 'utf8');

const newHelpers = \unction unwrap(v) {
  if (v && typeof v === 'object' && 'state' in v) {
    return v.state === 'FETCHED' ? v.value : null;
  }
  return v;
}

function safeDivide(numerator, denominator, multiplier = 1) {
  const n = unwrap(numerator);
  const d = unwrap(denominator);
  if (n === null || n === undefined) return null;
  if (!d || d === 0) return null;
  const result = (n / d) * multiplier;
  return isFinite(result) ? result : null;
}

function safeAdd(a, b) {
  const numA = unwrap(a) || 0;
  const numB = unwrap(b) || 0;
  if (unwrap(a) === null && unwrap(b) === null) return null;
  return numA + numB;
}

function safeSub(a, b) {
  const numA = unwrap(a);
  const numB = unwrap(b);
  if (numA === null || numA === undefined || numB === null || numB === undefined) return null;
  return numA - numB;
}

function round\;

content = content.replace(/function safeDivide[\\s\\S]*?function round/m, newHelpers);

fs.writeFileSync(ratioFile, content);
console.log('Patched ratioEngine.js helpers!');
