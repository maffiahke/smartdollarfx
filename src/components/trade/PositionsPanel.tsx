import { TrendingDown, TrendingUp } from "lucide-react";

export interface Position {
  id: string;
  asset: string;
  type: string;
  direction: "up" | "down";
  stake: number;
  payout: number;
  expiry: number;
  openPrice: number;
  status: "open" | "won" | "lost";
  profit?: number;
  isDemo?: boolean;
}

export type PositionsTab = "open" | "all" | "won" | "lost";

interface PositionsPanelProps {
  positions: Position[];
  activeTab: PositionsTab;
  onTabChange: (tab: PositionsTab) => void;
  timeLeft: Record<string, number>;
  className?: string;
}

export function PositionsPanel({
  positions,
  activeTab,
  onTabChange,
  timeLeft,
  className = "",
}: PositionsPanelProps) {
  const openPositions = positions.filter((p) => p.status === "open");
  const wonPositions = positions.filter((p) => p.status === "won");
  const lostPositions = positions.filter((p) => p.status === "lost");

  const visible =
    activeTab === "open"
      ? openPositions
      : activeTab === "won"
        ? wonPositions
        : activeTab === "lost"
          ? lostPositions
          : positions;

  const formatTimeLeft = (id: string) => {
    const secs = timeLeft[id];
    if (secs === undefined) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.07] shrink-0">
        {(
          [
            { key: "open", label: "Open" },
            { key: "all", label: "All" },
            { key: "won", label: "Won" },
            { key: "lost", label: "Lost" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex-1 py-2.5 sm:py-3 text-[10px] xs:text-[11px] sm:text-xs font-semibold transition min-h-[44px] whitespace-nowrap ${
              activeTab === t.key
                ? "text-white border-b-2 border-[#833ab4]"
                : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Position list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">
            No {activeTab} positions
          </div>
        ) : (
          visible.map((p) => (
            <div
              key={p.id}
              className="p-3 sm:p-4 border-b border-white/[0.04] hover:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-300 truncate">
                  {p.asset}
                </span>
                {p.status === "open" ? (
                  <span className="text-[10px] sm:text-[11px] text-amber-400 tabular-nums shrink-0">
                    {formatTimeLeft(p.id)}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold shrink-0 ${
                      p.status === "won" ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {p.status === "won"
                      ? `+$${p.profit?.toFixed(2) ?? "0.00"}`
                      : `-$${p.stake.toFixed(2)}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {p.direction === "up" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
                )}
                <span className="text-[10px] sm:text-[11px] text-gray-500 truncate">
                  ${p.stake} · {p.type}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}