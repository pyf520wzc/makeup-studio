import type { FeatureAnalysis } from '../types';

export function FeatureNotes({ analysis }: { analysis: FeatureAnalysis }) {
  const details = analysis.featureDetails ?? [];
  return (
    <div className="feature-notes">
      {analysis.summary ? (
        <p className="analysis-summary">{analysis.summary}</p>
      ) : (
        <p className="analysis-summary">
          这次还没有分区测量记录。下面是当时保存的妆造方向，重新分析一张正脸后会看到眼、眉、鼻、唇的具体描述。
        </p>
      )}
      {details.length > 0 && (
        <ul className="feature-list">
          {details.map((item) => (
            <li key={item.part}>
              <strong>{item.part}</strong>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
      {analysis.directions.length > 0 && (
        <div className="list-block">
          <h3>妆造建议（参考）</h3>
          <ul>
            {analysis.directions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
