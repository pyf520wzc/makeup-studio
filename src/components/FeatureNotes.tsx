import { catalogMoves } from '../lib/recommend';
import type { AnalysisCues, FeatureAnalysis, WorkItem } from '../types';

export function FeatureNotes({
  analysis,
  works = [],
}: {
  analysis: FeatureAnalysis;
  works?: WorkItem[];
}) {
  const details = analysis.featureDetails ?? [];
  const cues = analysis.cues;
  const moves = works.length ? catalogMoves(analysis, works) : [];
  return (
    <div className="feature-notes">
      {analysis.summary ? (
        <p className="analysis-summary">{analysis.summary}</p>
      ) : (
        <p className="analysis-summary">
          这次还没有分区测量。重新分析一张正脸后，会看到比例、优缺点，以及图库里能对上的作品。
        </p>
      )}
      {cues && typeof cues.eyeWidth === 'number' && (
        <ProportionList cues={cues} faceShape={analysis.faceShape} />
      )}
      <VerdictList title="优点" items={analysis.strengths} empty="这次没测出特别突出的优点。" />
      <VerdictList title="缺点" items={analysis.weaknesses} empty="这次没测出明显短板。" />
      {works.length > 0 && (
        <div className="list-block">
          <h3>按现有作品放大优点 / 遮盖缺点</h3>
          <ul>
            {moves.length === 0 && <li>这次没有可对照的优缺点。</li>}
            {moves.map((move) => (
              <li key={`${move.aim}-${move.feature}`}>
                {move.aim}「{move.feature}」：
                {move.work
                  ? `用图库里的「${move.work.title}」（风格 ${move.work.styles.join('、') || '未标'}，标签 ${move.work.tags.join('、') || '无'}）。`
                  : '现有作品的标题、风格和标签都对不上，不另造妆容。'}
              </li>
            ))}
          </ul>
        </div>
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
    </div>
  );
}

function ProportionList({
  cues,
  faceShape,
}: {
  cues: AnalysisCues;
  faceShape: string;
}) {
  const thirds =
    cues.upperShare > 0
      ? `三庭上/中/下约 ${pct(cues.upperShare)} / ${pct(cues.midShare)} / ${pct(cues.lowerShare)}`
      : '三庭没有稳定分开';
  return (
    <div className="list-block">
      <h3>五官比例（相对这张脸）</h3>
      <ul>
        <li>眼：暗区宽度约占脸宽 {pct(cues.eyeWidth)}，比面颊暗 {cues.eyeDelta}</li>
        <li>眉：暗区宽度约占脸宽 {pct(cues.browWidth)}，对比 {cues.browContrast}</li>
        <li>鼻：亮部约占脸宽 {pct(cues.noseWidth)}，比面颊 {cues.noseHighlight >= 0 ? '亮' : '暗'} {Math.abs(cues.noseHighlight)}</li>
        <li>
          唇：色区宽度约占脸宽 {pct(cues.lipWidth)}，厚度约占脸高 {pct(cues.lipHeight)}，红差 {cues.lipRedness}
        </li>
        <li>
          脸：{faceShape}，长宽比 {cues.faceRatio}，{thirds}
        </li>
      </ul>
    </div>
  );
}

function VerdictList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="list-block">
      <h3>{title}</h3>
      <ul>
        {(items.length ? items : [empty]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function pct(n: number | undefined): string {
  return `${Math.round((n ?? 0) * 100)}%`;
}
