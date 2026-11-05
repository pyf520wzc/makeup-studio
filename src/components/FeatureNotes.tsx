import { contourMeasurePhrase } from '../lib/faceAnalysis';
import { recommendInventory, recommendWorks } from '../lib/recommend';
import type { FeatureAnalysis, InventoryItem, Occasion, WorkItem } from '../types';

export function FeatureNotes({
  analysis,
  works = [],
  inventory = [],
  occasion = '',
}: {
  analysis: FeatureAnalysis;
  works?: WorkItem[];
  inventory?: InventoryItem[];
  occasion?: Occasion | '';
}) {
  const cues = analysis.cues;
  const rankedWorks = works.length ? recommendWorks(analysis, works, occasion).slice(0, 4) : [];
  const rankedInventory = inventory.length
    ? recommendInventory(
        analysis,
        inventory,
        rankedWorks.map((item) => item.work),
        occasion,
      ).slice(0, 4)
    : [];

  return (
    <div className="feature-notes">
      <section className="analysis-summary-block">
        <h3>分析总结</h3>
        <p className="analysis-summary">
          {analysis.summary || '重新分析一张正脸后，这里会把优点和缺点收成一段话。'}
        </p>
        <h4>需要放大的优点</h4>
        <ul>
          {(analysis.strengths.length ? analysis.strengths : ['这次没测出特别适合放大的优点。']).map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
        <h4>需要减弱的缺点</h4>
        <ul>
          {(analysis.weaknesses.length ? analysis.weaknesses : ['这次没测出明显需要减弱的短板。']).map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
        <h4>推荐妆造造型</h4>
        {rankedWorks.length === 0 ? (
          <p className="muted">作品库是空的，没有可推荐的造型。</p>
        ) : (
          <ul className="catalog-picks">
            {rankedWorks.map(({ work, reasons }) => (
              <li key={work.id}>
                <strong>{work.title}</strong>
                <span className="muted">
                  {' '}
                  风格 {work.styles.join('、') || '未标'} · 标签 {work.tags.join('、') || '无'}
                </span>
                <p>{reasons[0]}</p>
              </li>
            ))}
          </ul>
        )}
        {rankedInventory.length > 0 && (
          <>
            <h4>推荐服装 / 饰品</h4>
            <ul className="catalog-picks">
              {rankedInventory.map(({ item, reasons }) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span className="muted">
                    {' '}
                    {item.category} · 风格 {item.styles.join('、') || '未标'} · 颜色{' '}
                    {item.colors.join('、') || '未标'}
                  </span>
                  <p>{reasons[0]}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="analysis-section">
        <h3>五官比例</h3>
        {cues && typeof cues.eyeWidth === 'number' ? (
          <ul>
            <li>
              眼：暗区宽度约占脸宽 {pct(cues.eyeWidth)}，高度约占脸高 {pct(cues.eyeHeight)}，比面颊暗 {cues.eyeDelta}
              {cues.eyeGap > 0 ? `，两眼间距约占脸宽 ${pct(cues.eyeGap)}` : ''}
            </li>
            <li>眉：暗区宽度约占脸宽 {pct(cues.browWidth)}，对比 {cues.browContrast}</li>
            <li>
              鼻：亮部约占脸宽 {pct(cues.noseWidth)}，比面颊{cues.noseHighlight >= 0 ? '亮' : '暗'}{' '}
              {Math.abs(cues.noseHighlight)}
            </li>
            <li>
              唇：色区宽度约占脸宽 {pct(cues.lipWidth)}，厚度约占脸高 {pct(cues.lipHeight)}，红差 {cues.lipRedness}
            </li>
            <li>
              三庭：
              {cues.upperShare > 0
                ? `上 / 中 / 下约 ${pct(cues.upperShare)} / ${pct(cues.midShare)} / ${pct(cues.lowerShare)}`
                : '这次没有稳定分开'}
              。脸的长宽比 {cues.faceRatio}
            </li>
          </ul>
        ) : (
          <p className="muted">重新分析一张正脸后，这里会写出眼、眉、鼻、唇相对脸的比例。</p>
        )}
      </section>

      <section className="analysis-section">
        <h3>肤色</h3>
        <p>
          <strong className="analysis-kicker">{analysis.skinTone}</strong>
          {skinEvidence(analysis)}
        </p>
      </section>

      <section className="analysis-section">
        <h3>脸型</h3>
        <p>
          <strong className="analysis-kicker">{analysis.faceShape}</strong>
          {cues ? contourMeasurePhrase(cues) : '轮廓比例还没测到。'}
        </p>
      </section>

      <section className="analysis-section">
        <h3>眼型</h3>
        <p>
          <strong className="analysis-kicker">{analysis.eyeShape || '待分析'}</strong>
          {analysis.eyeEvidence || '重新分析后，会根据眼裂宽高和明暗判断桃花眼、杏眼、丹凤眼或深邃眼。'}
        </p>
      </section>

    </div>
  );
}

function skinEvidence(analysis: FeatureAnalysis): string {
  const lean =
    analysis.warmth > 25 ? '红蓝差为正，底色偏暖' : analysis.warmth < 12 ? '红蓝差很小，底色偏冷' : '冷暖居中';
  return `面颊明度 ${analysis.brightness}，冷暖差 ${analysis.warmth}。${lean}，所以记为${analysis.skinTone}。`;
}

function pct(n: number | undefined): string {
  return `${Math.round((n ?? 0) * 100)}%`;
}
