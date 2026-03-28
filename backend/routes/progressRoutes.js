/**
 * Progress Routes — GET /api/progress/:company
 *
 * SSE (Server-Sent Events) endpoint for real-time progress streaming.
 * The frontend connects here before triggering the pipeline.
 */

import { Router } from "express";
import { runPipeline } from "../orchestrator/orchestrator.js";

const router = Router();

/**
 * GET /api/progress/:company?tier=free_score
 *
 * Opens an SSE stream and runs the pipeline, pushing progress events.
 * Stream auto-closes when the pipeline completes.
 */
router.get("/:company", async (req, res) => {
  const { company } = req.params;
  // SSE progress is only available for free_score tier (paid tiers go through /api/report)
  const tier = "free_score";
  // force=true bypasses all caches — always runs a fresh analysis
  const forceRefresh = req.query.force === 'true';

  if (!company || company.trim().length < 2) {
    return res.status(400).json({
      error: true,
      message: "Please provide a company name or ticker.",
    });
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ phase: "connected", message: "Stream connected" })}\n\n`);

  const startedAt = Date.now();
  let highWaterPct = 10; // Track the highest pct seen from pipeline events

  // Intercept writes to track the high-water mark of progress percentage
  const origWrite = res.write.bind(res);
  res.write = function(chunk, ...args) {
    try {
      const str = typeof chunk === 'string' ? chunk : chunk.toString();
      const match = str.match(/^data:\s*(\{.*\})/);
      if (match) {
        const evt = JSON.parse(match[1]);
        if (evt.pct && evt.pct > highWaterPct) {
          highWaterPct = evt.pct;
        }
      }
    } catch { /* ignore parse errors */ }
    return origWrite(chunk, ...args);
  };

  // Keepalive: send visible heartbeat events so UI shows progress even when waiting on in-flight jobs.
  const keepaliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      origWrite(
        `data: ${JSON.stringify({
          phase: "heartbeat",
          message: `Still working... (${elapsedSec}s elapsed)`,
          pct: highWaterPct,
          ts: Date.now(),
        })}\n\n`
      );
    } else {
      clearInterval(keepaliveInterval);
    }
  }, 15_000);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(keepaliveInterval);
    res.end();
  });

  try {
    // runPipeline will stream progress events via the sseRes parameter.
    // If a cached report is returned, the pipeline may NOT emit a "complete"
    // SSE event itself (it returns the report object directly).  We handle
    // that below so the frontend always receives the final event.
    const result = await runPipeline(company.trim(), tier, res, { forceRefresh });

    // If the stream is still open (i.e. pipeline returned from cache without
    // emitting "complete"), send the complete event now.
    if (result && !res.writableEnded) {
      // Don't re-send if pipeline already closed the stream (non-cache path).
      const report = result.error ? null : result;
      if (report) {
        console.log("[ProgressRoute] Pipeline returned cached/early report — forwarding to SSE.");
        res.write(
          `data: ${JSON.stringify({ phase: "complete", message: "Report ready!", pct: 100, report })}\n\n`
        );
      } else if (result.error) {
        res.write(
          `data: ${JSON.stringify({ phase: "error", message: result.message || "Pipeline failed." })}\n\n`
        );
      }
      res.end();
    }
  } catch (error) {
    console.error("[ProgressRoute] Stream error:", error.message);
    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({ phase: "error", message: "Pipeline failed. Please retry." })}\n\n`
      );
      res.end();
    }
  } finally {
    clearInterval(keepaliveInterval);
  }
});

export default router;
