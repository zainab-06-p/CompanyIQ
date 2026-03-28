import dotenv from "dotenv";
dotenv.config();

const config = {
  // TinyFish
  tinyfish: {
    apiKey: process.env.TINYFISH_API_KEY,
    baseUrl: "https://agent.tinyfish.ai/v1/automation/run-sse",
    // 0 means no client-side timeout (wait until TinyFish completes).
    // 0 means no client-side timeout (wait until TinyFish completes).
    defaultTimeout: parseInt(process.env.TINYFISH_TIMEOUT_MS || "0", 10),
    defaultRetries: parseInt(process.env.TINYFISH_RETRIES || "0", 10),
    defaultBrowserProfile: "lite",
    budgetEnabled: (process.env.TINYFISH_BUDGET_ENABLED || "true").toLowerCase() === "true",
    budgetFreeScoreCalls: parseInt(process.env.TINYFISH_BUDGET_FREE_SCORE_CALLS || "6", 10),
    budgetQuickScanCalls: parseInt(process.env.TINYFISH_BUDGET_QUICK_SCAN_CALLS || "10", 10),
    budgetStandardCalls: parseInt(process.env.TINYFISH_BUDGET_STANDARD_CALLS || "16", 10),
  },

  // Groq (free LLM inference)
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: "https://api.groq.com/openai/v1",
    // llama-3.3-70b for quality synthesis, llama-3.1-8b for fast classification
    synthesisModel: "llama-3.3-70b-versatile",
    classificationModel: "llama-3.1-8b-instant",
    enableClassification: (process.env.GROQ_ENABLE_CLASSIFICATION || "false").toLowerCase() === "true",
    enableSynthesis: (process.env.GROQ_ENABLE_SYNTHESIS || "true").toLowerCase() === "true",
    classificationMaxHeadlines: parseInt(process.env.GROQ_CLASSIFICATION_MAX_HEADLINES || "12", 10),
    maxTokens: 1500,
  },

  // Razorpay
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    appUrl: process.env.APP_URL || "http://localhost:5173",
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    allowVercelPreviews: (process.env.ALLOW_VERCEL_PREVIEWS || "true").toLowerCase() === "true",
  },

  // Supabase (Auth + user history)
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Cache
  cache: {
    ttlHours: parseInt(process.env.CACHE_TTL_HOURS || "24", 10),
  },

  // Pipeline latency controls
  performance: {
    // When true, the orchestrator enforces an overall deadline and skips non-critical work.
    fastMode: (process.env.FAST_MODE || "false").toLowerCase() === "true",
    // End-to-end budget for free/quick paths.
    maxReportMs: parseInt(process.env.MAX_REPORT_MS || "30000", 10),
    // Per-agent timeout in fast mode.
    fastAgentTimeoutMs: parseInt(process.env.FAST_AGENT_TIMEOUT_MS || "26000", 10),
    // Whether to launch an extra full-hydration run after fast partial output.
    backgroundHydration: (process.env.BACKGROUND_HYDRATION || "false").toLowerCase() === "true",
  },

  // Product pricing (in INR paise for Razorpay, display in rupees)
  pricing: {
    free_score: { paise: 0, rupees: 0, label: "Free Score" },
    quick_scan: { paise: 24_900, rupees: 249, label: "Quick Scan" },
    standard: { paise: 49_900, rupees: 499, label: "Standard Report" },
  },
};

export default config;
