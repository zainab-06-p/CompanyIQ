import { useState } from "react";
import { createOrder, connectSSE, type ProgressEvent } from "../utils/api.ts";
import { X, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  company: string;
  tier: "quick_scan" | "standard";
  onClose: () => void;
  onReport: (report: any) => void;
}

const TIER_INFO: Record<string, { label: string; price: string; features: string[] }> = {
  quick_scan: {
    label: "Quick Scan",
    price: "₹249",
    features: [
      "Full Financial Analysis with 25 Ratios",
      "Legal & Governance Audit",
      "Shareholding Pattern Trends",
      "Red Flag Detection",
    ],
  },
  standard: {
    label: "Standard Report",
    price: "₹499",
    features: [
      "Everything in Quick Scan",
      "AI News Sentiment Analysis",
      "Executive Summary & Investment Thesis",
      "Revenue & Profit Trend Charts",
      "Sentiment Donut & Shareholding Charts",
    ],
  },
};

type Stage = "confirm" | "paying" | "generating" | "done" | "error";

export default function PaymentModal({ company, tier, onClose, onReport }: Props) {
  const [stage, setStage] = useState<Stage>("confirm");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const info = TIER_INFO[tier];

  // Demo mode: use SSE directly without payment
  const handleDemo = () => {
    setStage("generating");
    setProgress(0);
    setProgressMsg("Starting analysis...");

    connectSSE(
      company,
      tier,
      (event: ProgressEvent) => {
        setProgress(event.pct);
        setProgressMsg(event.message);
        if (event.phase === "complete" && event.report) {
          setStage("done");
          setTimeout(() => onReport(event.report), 600);
        }
        if (event.phase === "error") {
          setStage("error");
          setErrorMsg(event.message || "Analysis failed");
        }
      },
      (err) => {
        setStage("error");
        setErrorMsg(err);
      }
    );
  };

  // Real payment: create order → open Razorpay → verify → generate
  const handlePay = async () => {
    try {
      setStage("paying");
      const order = await createOrder(company, tier);

      // Check if Razorpay SDK is loaded
      if (!(window as any).Razorpay) {
        // Fallback to demo mode if SDK not loaded
        setStage("error");
        setErrorMsg("Razorpay SDK not loaded. Use Demo mode for now.");
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "CompanyIQ",
        description: `${info.label} — ${company}`,
        order_id: order.orderId,
        handler: async (response: any) => {
          // Payment successful, now generate report via SSE
          setStage("generating");
          setProgress(0);
          setProgressMsg("Payment verified. Starting analysis...");

          // Store payment info and use SSE for real-time progress
          sessionStorage.setItem(
            `payment_${company}_${tier}`,
            JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
          );

          connectSSE(
            company,
            tier,
            (event: ProgressEvent) => {
              setProgress(event.pct);
              setProgressMsg(event.message);
              if (event.phase === "complete" && event.report) {
                setStage("done");
                setTimeout(() => onReport(event.report), 600);
              }
              if (event.phase === "error") {
                setStage("error");
                setErrorMsg(event.message || "Analysis failed");
              }
            },
            (err) => {
              setStage("error");
              setErrorMsg(err);
            }
          );
        },
        modal: {
          ondismiss: () => setStage("confirm"),
        },
        theme: { color: "#00ff87" },
      });

      rzp.open();
    } catch (err: any) {
      setStage("error");
      setErrorMsg(err.message || "Payment failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div style={{ background: "rgba(4,8,16,0.95)" }} className="border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="text-lg font-bold text-white">{info.label}</h3>
          {stage === "confirm" && (
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {stage === "confirm" && (
            <>
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-white mb-1">{info.price}</div>
                <div className="text-sm text-white/40">for {company}</div>
              </div>

              <ul className="space-y-2 mb-6">
                {info.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <button
                  onClick={handleDemo}
                  style={{ background: "#00ff87" }}
                  className="w-full py-3 text-black hover:opacity-90 rounded-xl font-semibold transition-opacity flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Generate Report (Demo)
                </button>
                <button
                  onClick={handlePay}
                  style={{ background: "rgba(255,255,255,0.06)" }}
                  className="w-full py-3 border border-white/[0.08] text-white hover:bg-white/10 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  Pay {info.price} with Razorpay
                </button>
              </div>

              <p className="text-xs text-white/30 text-center mt-4">
                Demo mode generates the full report for free. Payment mode uses Razorpay checkout.
              </p>
            </>
          )}

          {stage === "paying" && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" style={{ color: "#00ff87" }} />
              <p className="text-white/70">Opening Razorpay checkout...</p>
            </div>
          )}

          {stage === "generating" && (
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/50">{progressMsg}</span>
                <span className="text-sm font-mono font-bold" style={{ color: "#00ff87" }}>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "#00ff87" }}
                />
              </div>
              <p className="text-xs text-white/30 text-center mt-4">
                TinyFish AI agents are analyzing {company}...
              </p>
            </div>
          )}

          {stage === "done" && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-semibold text-white">Report Ready!</p>
              <p className="text-sm text-white/40 mt-1">Redirecting to full report...</p>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-lg font-semibold text-white mb-2">Something went wrong</p>
              <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
              <button
                onClick={() => setStage("confirm")}
                style={{ background: "rgba(255,255,255,0.06)" }}
                className="px-6 py-2 hover:bg-white/10 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
