import { AlertTriangle, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { getSeverityBadge } from "../utils/formatters.ts";

interface Flag {
  severity: string;
  pillar: string;
  message: string;
  icon: string;
}

interface Props {
  flags: Flag[];
}

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  CRITICAL: <AlertTriangle className="w-4 h-4" />,
  HIGH: <AlertCircle className="w-4 h-4" />,
  WATCH: <Eye className="w-4 h-4" />,
  POSITIVE: <CheckCircle className="w-4 h-4" />,
};

export default function RedFlagSection({ flags }: Props) {
  const critical = flags.filter((f) => f.severity === "CRITICAL");
  const high = flags.filter((f) => f.severity === "HIGH");
  const watch = flags.filter((f) => f.severity === "WATCH");
  const positive = flags.filter((f) => f.severity === "POSITIVE");

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">
        Red Flags &amp; Highlights
        <span className="text-sm font-normal text-white/35 ml-2">
          ({flags.length} detected)
        </span>
      </h2>

      <div className="space-y-2">
        {[...critical, ...high, ...watch, ...positive].map((flag, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3 rounded-lg"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <span className="mt-0.5">{flag.icon}</span>
            <div className="flex-1">
              <span className="text-sm text-white/80">{flag.message}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${getSeverityBadge(flag.severity)}`}
            >
              {flag.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
