export function ReasonBlock({
  reasons,
  compact = false,
}: {
  reasons: string[];
  compact?: boolean;
}) {
  if (!reasons.length) return null;
  if (compact) {
    return (
      <small className="reason">
        <b>推荐理由：</b>
        {reasons.join('')}
      </small>
    );
  }
  return (
    <div className="reason-block">
      <span className="reason-label">推荐理由</span>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
