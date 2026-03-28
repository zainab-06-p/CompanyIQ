/**
 * TinyFish Web Agent API Wrapper
 *
 * Core integration layer — every agent in the system depends on this module.
 * Handles SSE streaming, retries, timeouts, and progress callbacks.
 *
 * Endpoint: POST https://agent.tinyfish.ai/v1/automation/run-sse
 * Protocol: Server-Sent Events (STARTED → PROGRESS* → COMPLETE)
 */

import fetch from "node-fetch";
import { AsyncLocalStorage } from "node:async_hooks";
import config from "../config/env.js";

const tinyfishBudgetStorage = new AsyncLocalStorage();

export async function withTinyFishBudget({ maxCalls = Number.POSITIVE_INFINITY, label = "report" } = {}, fn) {
  const state = {
    label,
    maxCalls,
    used: 0,
    blocked: 0,
  };
  return tinyfishBudgetStorage.run(state, fn);
}

export function getTinyFishBudgetSnapshot() {
  const state = tinyfishBudgetStorage.getStore();
  if (!state) return null;
  return {
    label: state.label,
    maxCalls: state.maxCalls,
    used: state.used,
    remaining: Math.max(0, state.maxCalls - state.used),
    blocked: state.blocked,
  };
}

function consumeTinyFishBudget() {
  const state = tinyfishBudgetStorage.getStore();
  if (!state) {
    return { allowed: true, reason: null };
  }

  if (state.used >= state.maxCalls) {
    state.blocked += 1;
    return {
      allowed: false,
      reason: `TinyFish budget exceeded (${state.used}/${state.maxCalls}) for ${state.label}`,
    };
  }

  state.used += 1;
  return { allowed: true, reason: null };
}

/**
 * Call the TinyFish Web Agent API.
 *
 * @param {string} url            - Target website URL to navigate
 * @param {string} goal           - Plain English instruction for the browser agent
 * @param {object} [options]      - Optional configuration
 * @param {string} [options.browserProfile]  - "lite" or "stealth" (default: "lite")
 * @param {object} [options.proxyConfig]     - { enabled: bool, country_code: string }
 * @param {number} [options.timeout]         - Max wait in ms (default: 90000)
 * @param {number} [options.retries]         - Retry count on failure (default: 1)
 * @param {function} [options.onProgress]    - Callback for PROGRESS events: (message) => void
 *
 * @returns {Promise<{resultJson: object|null, stepCount: number, durationMs: number, runId: string|null, error: string|null}>}
 */
export async function callTinyFish(url, goal, options = {}) {
  const {
    browserProfile = config.tinyfish.defaultBrowserProfile,
    proxyConfig = null,
    timeout = config.tinyfish.defaultTimeout,
    retries = config.tinyfish.defaultRetries,
    onProgress = null,
  } = options;

  console.log(`[TinyFish] Starting call to ${url} with timeout ${timeout}ms`);
  console.log(`[TinyFish] Goal length: ${goal.length} chars`);

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const budgetCheck = consumeTinyFishBudget();
    if (!budgetCheck.allowed) {
      console.warn(`[TinyFish] Budget exceeded: ${budgetCheck.reason}`);
      return {
        resultJson: null,
        stepCount: 0,
        durationMs: 0,
        runId: null,
        error: budgetCheck.reason,
      };
    }

    try {
      console.log(`[TinyFish] Attempt ${attempt + 1} for ${url}`);
      const result = await _executeTinyFishCall(url, goal, {
        browserProfile,
        proxyConfig,
        timeout,
        onProgress: (msg) => {
          console.log(`[TinyFish] Progress: ${msg}`);
          onProgress?.(msg);
        },
      });
      console.log(`[TinyFish] Success for ${url}: ${result.stepCount} steps`);
      console.log(`[TinyFish] API Request Details: ${JSON.stringify({
        url,
        goal,
        browserProfile,
        proxyConfig,
        timeout,
      })}`);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(
        `[TinyFish] Attempt ${attempt + 1} failed for ${url}: ${err.message}`
      );

      const msg = String(err?.message || "");
      const isTransientTransport =
        msg.includes("Premature close") ||
        msg.includes("ECONNRESET") ||
        msg.includes("socket hang up") ||
        msg.includes("fetch failed") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("stream ended without COMPLETE");

      // Don't retry on credit/auth errors — it wastes credits
      if (err.message.includes('403') || err.message.includes('FORBIDDEN') || err.message.includes('Insufficient credits')) {
        break;
      }
      if (attempt < retries) {
        // Exponential backoff + jitter for transient transport failures.
        const baseDelay = isTransientTransport ? 3000 : 1500;
        const delay = Math.min(baseDelay * 2 ** attempt, 10000) + Math.floor(Math.random() * 500);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // All retries exhausted
  return {
    resultJson: null,
    stepCount: 0,
    durationMs: 0,
    runId: null,
    error: lastError?.message || "Unknown error after retries",
  };
}

/**
 * Internal: Execute a single TinyFish API call with SSE parsing.
 */
async function _executeTinyFishCall(url, goal, { browserProfile, proxyConfig, timeout, onProgress }) {
  const startTime = Date.now();

  // Build request body — only url and goal; browser_profile causes
  // TinyFish to enter a heartbeat-only mode that never completes
  const body = { url, goal };
  if (proxyConfig) {
    body.proxy_config = proxyConfig;
  }

  console.log(`[TinyFish] _executeTinyFishCall: POST to ${config.tinyfish.baseUrl}`);
  console.log(`[TinyFish] Request body keys: ${Object.keys(body).join(', ')}`);
  console.log(`[TinyFish] API Key present: ${!!config.tinyfish.apiKey}`);

  // Create an AbortController with adaptive timeout — resets on each SSE event.
  // timeout <= 0 means no timeout.
  const controller = new AbortController();
  let timeoutId = null;
  const hasTimeout = Number(timeout) > 0;
  if (hasTimeout) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }
  const resetTimeout = () => {
    if (!hasTimeout) return;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => controller.abort(), timeout);
  };

  let response;
  try {
    response = await fetch(config.tinyfish.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.tinyfish.apiKey,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    console.log(`[TinyFish] Response status: ${response.status} ${response.statusText}`);
    console.log(`[TinyFish] Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`TinyFish call timed out after ${timeout}ms for ${url}`);
    }
    console.error(`[TinyFish] Fetch error: ${err.message}`);
    throw err;
  }

  if (!response.ok) {
    if (timeoutId) clearTimeout(timeoutId);
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `TinyFish API returned ${response.status}: ${errText}`
    );
  }

  // Parse SSE stream
  return new Promise((resolve, reject) => {
    let stepCount = 0;
    let runId = null;
    let resultJson = null;
    let buffer = "";

    const stream = response.body;

    stream.on("data", (chunk) => {
      buffer += chunk.toString();

      // Process complete SSE messages (separated by double newlines)
      const messages = buffer.split("\n\n");
      // Keep the last potentially incomplete message in the buffer
      buffer = messages.pop() || "";

      for (const message of messages) {
        if (!message.trim()) continue;

        // Extract `data: ` lines from the SSE message
        const dataLines = message
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6));

        if (dataLines.length === 0) continue;

        const dataStr = dataLines.join("\n");

        let parsed;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          // Non-JSON data line — skip
          continue;
        }

        const eventType = parsed.type || parsed.event || parsed.status;

        if (eventType === "STARTED" || eventType === "started") {
          runId = parsed.runId || parsed.run_id || null;
          onProgress?.("Agent started — navigating to website...");
          resetTimeout();
        } else if (eventType === "HEARTBEAT" || eventType === "heartbeat") {
          // Keep-alive from TinyFish — reset the timeout
          resetTimeout();
        } else if (eventType === "STREAMING_URL" || eventType === "streaming_url") {
          // Browser streaming URL — reset timeout, ignore data
          resetTimeout();
        } else if (eventType === "PROGRESS" || eventType === "progress") {
          stepCount++;
          const purpose = parsed.purpose || parsed.message || `Step ${stepCount}`;
          onProgress?.(purpose);
          resetTimeout();
        } else if (eventType === "COMPLETE" || eventType === "complete" || eventType === "completed") {
          resultJson = parsed.resultJson || parsed.result_json || parsed.result || parsed.data || parsed;
          // Remove meta fields from result if they exist
          if (resultJson && typeof resultJson === "object") {
            delete resultJson.type;
            delete resultJson.event;
            delete resultJson.status;
          }
        } else if (eventType === "ERROR" || eventType === "error" || eventType === "failed") {
          if (timeoutId) clearTimeout(timeoutId);
          reject(
            new Error(
              `TinyFish agent error: ${parsed.error || parsed.message || JSON.stringify(parsed)}`
            )
          );
          return;
        }
      }
    });

    stream.on("end", () => {
      if (timeoutId) clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (resultJson) {
        resolve({ resultJson, stepCount, durationMs, runId, error: null });
      } else {
        // Stream ended without a COMPLETE event — try parsing the last buffer
        if (buffer.trim()) {
          try {
            const last = JSON.parse(
              buffer
                .split("\n")
                .filter((l) => l.startsWith("data: "))
                .map((l) => l.slice(6))
                .join("")
            );
            resolve({
              resultJson: last.resultJson || last.result || last,
              stepCount,
              durationMs,
              runId,
              error: null,
            });
            return;
          } catch {
            // ignore
          }
        }
        reject(new Error("TinyFish stream ended without COMPLETE event"));
      }
    });

    stream.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Utility: Run multiple TinyFish calls in parallel with a concurrency limit.
 *
 * @param {Array<{url: string, goal: string, options?: object, label?: string}>} calls
 * @param {number} [concurrency=3] - Max parallel calls (TinyFish plan limit)
 * @returns {Promise<Array<{label: string, result: object}>>}
 */
export async function callTinyFishParallel(calls, concurrency = 3) {
  const results = [];
  const queue = [...calls];

  async function worker() {
    while (queue.length > 0) {
      const call = queue.shift();
      if (!call) break;
      const result = await callTinyFish(call.url, call.goal, call.options || {});
      results.push({ label: call.label || call.url, result });
    }
  }

  // Spawn `concurrency` number of workers
  const workers = Array.from({ length: Math.min(concurrency, calls.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  return results;
}

export default { callTinyFish, callTinyFishParallel };
