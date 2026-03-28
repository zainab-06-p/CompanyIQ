/**
 * AnnualReportSection — Extracted Annual Report Insights
 *
 * Shows management commentary, auditor opinion, contingent liabilities,
 * and related party transactions extracted directly from the BSE PDF filing.
 */

import { BookOpen, AlertTriangle, CheckCircle, FileWarning, Users2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ManagementCommentary {
  performanceOverview: string;
  outlookStatement: string;
  keyRisks: string[];
  strategicInitiatives: string[];
}

interface AuditorReport {
  firmName: string;
  opinion: string;
  keyAuditMatters: string[];
  qualifications: string[];
  emphasisOfMatter: string[];
}

interface ContingentLiability {
  description: string;
  amountCrores: number;
  type: string;
}

interface RelatedPartyTransaction {
  partyName: string;
  transactionType: string;
  amountCrores: number;
  armLength: boolean;
}

interface RiskSignal {
  severity: "HIGH" | "WATCH";
  message: string;
}

interface Props {
  data: {
    available: boolean;
    reportYear: string | null;
    managementCommentary: ManagementCommentary | null;
    auditorReport: AuditorReport | null;
    contingentLiabilities: ContingentLiability[];
    relatedPartyTransactions: RelatedPartyTransaction[];
    totalContingentLiabilityValue: number;
    riskSignals: RiskSignal[];
  };
}

const OPINION_STYLE: Record<string, string> = {
  Unqualified: "text-green-400 bg-green-900/20 border-green-700/40",
  Qualified: "text-yellow-400 bg-yellow-900/20 border-yellow-700/40",
  Adverse: "text-red-400 bg-red-900/20 border-red-700/40",
  "Disclaimer of Opinion": "text-red-400 bg-red-900/20 border-red-700/40",
};

export default function AnnualReportSection({ data }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!data?.available) {
    return (
      <section className="rounded-2xl glass-card p-6 mt-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Annual Report Analysis</h2>
        </div>
        <p className="text-white/35 text-sm">
          Annual report PDF could not be extracted for this company.
        </p>
      </section>
    );
  }

  const opinionStyle =
    OPINION_STYLE[data.auditorReport?.opinion || ""] || OPINION_STYLE["Unqualified"];

  const isClean = data.auditorReport?.opinion === "Unqualified";

  return (
    <section className="rounded-2xl glass-card p-6 mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Annual Report Analysis</h2>
            <p className="text-xs text-white/40">
              Extracted from BSE filing — {data.reportYear || "Latest available"}
            </p>
          </div>
        </div>
        {data.riskSignals.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-900/20 border border-red-700/40">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-400 font-medium">
              {data.riskSignals.length} risk signal{data.riskSignals.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Risk signals */}
      {data.riskSignals.length > 0 && (
        <div className="mb-5 space-y-2">
          {data.riskSignals.map((s, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                s.severity === "HIGH"
                  ? "bg-red-900/15 border-red-700/40 text-red-300"
                  : "bg-yellow-900/15 border-yellow-700/40 text-yellow-300"
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {s.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Auditor Report */}
        <div className="rounded-xl glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            {isClean ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <FileWarning className="w-4 h-4 text-red-400" />
            )}
            <h3 className="text-sm font-medium text-slate-300">Auditor's Report</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-white/35">Audit Firm</span>
              <p className="text-sm text-white font-medium">
                {data.auditorReport?.firmName || "Not disclosed"}
              </p>
            </div>
            <div>
              <span className="text-xs text-white/35">Opinion</span>
              <div className="mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${opinionStyle}`}
                >
                  {data.auditorReport?.opinion || "Unqualified"}
                </span>
              </div>
            </div>
            {data.auditorReport?.keyAuditMatters && data.auditorReport.keyAuditMatters.length > 0 && (
              <div>
                <span className="text-xs text-white/35">Key Audit Matters</span>
                <ul className="mt-1 space-y-1">
                  {data.auditorReport.keyAuditMatters.slice(0, 3).map((m, i) => (
                    <li key={i} className="text-xs text-white/70 flex items-start gap-1.5">
                      <span className="text-white/35 mt-0.5">•</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(data.auditorReport?.qualifications || []).length > 0 && (
              <div className="mt-2 p-2 rounded bg-red-900/20 border border-red-700/30">
                <span className="text-xs text-red-400 font-medium">Qualifications:</span>
                {data.auditorReport!.qualifications.map((q, i) => (
                  <p key={i} className="text-xs text-red-300 mt-0.5">{q}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contingent Liabilities */}
        <div className="rounded-xl glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-medium text-slate-300">Contingent Liabilities</h3>
          </div>
          {data.contingentLiabilities.length === 0 ? (
            <p className="text-sm text-white/35">None disclosed</p>
          ) : (
            <>
              <div className="mb-3 text-right">
                <span className="text-xs text-white/35">Total: </span>
                <span className="text-base font-bold text-yellow-400">
                  ₹{data.totalContingentLiabilityValue?.toFixed(0)} Cr
                </span>
              </div>
              <div className="space-y-2">
                {data.contingentLiabilities.slice(0, 4).map((cl, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 text-xs"
                  >
                    <span className="text-white/70 flex-1">{cl.description}</span>
                    <div className="text-right flex-shrink-0">
                      <span className="text-yellow-400 font-medium">
                        ₹{cl.amountCrores?.toFixed(0)} Cr
                      </span>
                      <div className="text-white/35">{cl.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toggle expanded sections */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
      >
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        {expanded ? "Hide" : "Show"} management commentary & related party transactions
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Management Commentary */}
          {data.managementCommentary && (
            <div className="rounded-xl glass-card p-4">
              <h3 className="text-sm font-medium text-white/70 mb-3">
                Management Discussion & Analysis
              </h3>
              {data.managementCommentary.performanceOverview && (
                <div className="mb-3">
                  <span className="text-xs text-white/35 uppercase tracking-wide">Performance Overview</span>
                  <p className="text-sm text-white/70 mt-1 leading-relaxed">
                    {data.managementCommentary.performanceOverview}
                  </p>
                </div>
              )}
              {data.managementCommentary.outlookStatement && (
                <div className="mb-3">
                  <span className="text-xs text-white/35 uppercase tracking-wide">Management Outlook</span>
                  <p className="text-sm text-white/70 mt-1 leading-relaxed italic">
                    "{data.managementCommentary.outlookStatement}"
                  </p>
                </div>
              )}
              {data.managementCommentary.keyRisks?.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-white/35 uppercase tracking-wide">Key Risks Mentioned</span>
                  <ul className="mt-1 space-y-1">
                    {data.managementCommentary.keyRisks.map((r, i) => (
                      <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                        <span className="text-red-500 mt-0.5">▲</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.managementCommentary.strategicInitiatives?.length > 0 && (
                <div>
                  <span className="text-xs text-white/35 uppercase tracking-wide">Strategic Initiatives</span>
                  <ul className="mt-1 space-y-1">
                    {data.managementCommentary.strategicInitiatives.map((s, i) => (
                      <li key={i} className="text-xs text-green-300 flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Related Party Transactions */}
          {data.relatedPartyTransactions.length > 0 && (
            <div className="rounded-xl glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users2 className="w-4 h-4 text-white/40" />
                <h3 className="text-sm font-medium text-white/70">
                  Related Party Transactions (Top {data.relatedPartyTransactions.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="pb-2 text-left text-white/35">Party</th>
                      <th className="pb-2 text-left text-white/35">Transaction</th>
                      <th className="pb-2 text-right text-white/35">Amount</th>
                      <th className="pb-2 text-center text-white/35">Arm's Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.relatedPartyTransactions.map((rpt, i) => (
                      <tr key={i} className="border-b border-white/[0.04]">
                        <td className="py-2 pr-3 text-white font-medium">{rpt.partyName}</td>
                        <td className="py-2 pr-3 text-white/70">{rpt.transactionType}</td>
                        <td className="py-2 text-right text-amber-400 font-medium">
                          ₹{rpt.amountCrores?.toFixed(0)} Cr
                        </td>
                        <td className="py-2 text-center">
                          <span
                            className={`text-xs ${
                              rpt.armLength ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {rpt.armLength ? "✓" : "✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
