import { Network, Users, Shield, AlertTriangle } from "lucide-react";

interface Sibling {
  name: string;
  ticker: string;
  sector: string;
}

interface Competitor {
  name: string;
  ticker: string;
  industry: string;
}

interface Props {
  graph: {
    company: { name: string; ticker: string; sector: string };
    promoterGroup: {
      groupName: string | null;
      totalListedCompanies: number;
      siblings: Sibling[];
      contagionRisk: string;
    };
    competitors: Competitor[];
    dependencies: {
      revenueConcentration: string;
      supplierConcentration: string;
      flags: Array<{ severity: string; message: string }>;
    };
    directorNetwork: {
      totalDirectors: number;
      recentChanges: number;
      independentDirectors: number;
      flags: Array<{ severity: string; message: string }>;
    };
    groupRiskLevel: { level: string; reason: string };
  };
}

function getRiskBadge(level: string) {
  switch (level) {
    case "HIGH": return "bg-red-900/30 text-red-400 border-red-700/50";
    case "MODERATE": return "bg-yellow-900/30 text-yellow-400 border-yellow-700/50";
    default: return "bg-green-900/30 text-green-400 border-green-700/50";
  }
}

export default function RelationshipGraphSection({ graph }: Props) {
  if (!graph) return null;

  const { promoterGroup, competitors, dependencies, directorNetwork, groupRiskLevel } = graph;

  return (
    <div className="mt-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center">
            <Network className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Company Network</h2>
            <p className="text-xs text-white/35">Relationships, competitors & dependencies</p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getRiskBadge(groupRiskLevel.level)}`}>
          Group Risk: {groupRiskLevel.level}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Promoter Group */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Promoter Group</h3>
          </div>
          {promoterGroup.groupName ? (
            <>
              <p className="text-sm text-white/70 mb-2">
                {promoterGroup.groupName}
                <span className="text-xs text-white/35 ml-2">
                  ({promoterGroup.totalListedCompanies} listed companies)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {promoterGroup.siblings.slice(0, 6).map((s) => (
                  <span
                    key={s.ticker}
                    style={{ background: "rgba(255,255,255,0.06)" }}
                    className="px-2 py-0.5 rounded text-xs text-white/70"
                  >
                    {s.ticker}
                  </span>
                ))}
                {promoterGroup.siblings.length > 6 && (
                  <span className="px-2 py-0.5 text-xs text-white/35">
                    +{promoterGroup.siblings.length - 6} more
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-white/35">Contagion Risk:</span>
                <span className={`text-xs font-medium ${
                  promoterGroup.contagionRisk === "HIGH" ? "text-red-400" :
                  promoterGroup.contagionRisk === "MODERATE" ? "text-yellow-400" :
                  "text-green-400"
                }`}>
                  {promoterGroup.contagionRisk}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/40">Standalone — no group contagion risk</p>
          )}
        </div>

        {/* Competitors */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Sector Competitors</h3>
          </div>
          {competitors.length > 0 ? (
            <div className="space-y-1.5">
              {competitors.slice(0, 5).map((c) => (
                <div key={c.ticker} className="flex items-center justify-between">
                  <span className="text-sm text-white/70">{c.name}</span>
                  <span className="text-xs text-white/35 font-mono">{c.ticker}</span>
                </div>
              ))}
              {competitors.length > 5 && (
                <p className="text-xs text-white/35">+{competitors.length - 5} more competitors</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40">No direct competitors in database</p>
          )}
        </div>

        {/* Director Network */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">Board of Directors</h3>
          </div>
          {directorNetwork.totalDirectors > 0 ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Total Directors</span>
                <span className="text-white">{directorNetwork.totalDirectors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Independent</span>
                <span className="text-white">{directorNetwork.independentDirectors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Recent Changes</span>
                <span className={directorNetwork.recentChanges >= 3 ? "text-orange-400" : "text-white"}>
                  {directorNetwork.recentChanges}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/40">Director data not available</p>
          )}
          {directorNetwork.flags?.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 mt-2 text-xs text-orange-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{f.message}</span>
            </div>
          ))}
        </div>

        {/* Dependencies */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Key Dependencies</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Revenue Concentration</span>
              <span className="text-white">{dependencies.revenueConcentration}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Supplier Concentration</span>
              <span className="text-white">{dependencies.supplierConcentration}</span>
            </div>
          </div>
          {dependencies.flags?.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 mt-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{f.message}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-white/25 text-center mt-3">{groupRiskLevel.reason}</p>
    </div>
  );
}
