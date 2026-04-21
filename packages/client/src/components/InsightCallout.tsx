interface Props { insights: string[]; }

export default function InsightCallout({ insights }: Props) {
  if (insights.length === 0) return null;
  return (
    <div className="insight-callout">
      <ul className="insight-callout-list">
        {insights.map((text, i) => <li key={i} className="insight-callout-item">{text}</li>)}
      </ul>
    </div>
  );
}
