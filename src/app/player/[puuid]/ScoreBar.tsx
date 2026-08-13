const BAR_COLOR = "#2a78d6";

export default function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: "#666" }}>{pct}</span>
      </div>
      <div style={{ background: "#eee", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: BAR_COLOR, height: "100%" }} />
      </div>
    </div>
  );
}
