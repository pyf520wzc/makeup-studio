import type { InventoryItem, WorkItem } from '../types';

type Props = {
  faceUrl: string;
  work: WorkItem | null;
  clothing: InventoryItem | null;
  accessories: InventoryItem[];
  makeupOpacity: number;
  clothingOpacity: number;
};

/**
 * CSS 图层叠放演示试妆：脸为底层，妆造用 soft-light/overlay 叠在脸部椭圆区，
 * 服装遮罩在下半身，饰品按类别定位。非真实 ML try-on。
 */
export function TryOnPreview({
  faceUrl,
  work,
  clothing,
  accessories,
  makeupOpacity,
  clothingOpacity,
}: Props) {
  const earrings = accessories.filter((a) => /耳|钉|环/.test(a.name) || a.category === '饰品');
  const hair = accessories.filter((a) => /发|夹|花|假发/.test(a.name) || a.category === '假发');
  const props = accessories.filter(
    (a) => !earrings.includes(a) && !hair.includes(a),
  );

  return (
    <div className="tryon-stage" aria-label="试妆实时预览">
      {!faceUrl ? (
        <div className="tryon-empty">请先选择或上传客户人脸</div>
      ) : (
        <>
          <img className="tryon-layer tryon-face" src={faceUrl} alt="客户人脸" />

          {work && (
            <div
              className="tryon-layer tryon-makeup"
              style={{ opacity: makeupOpacity }}
            >
              <img src={work.imageDataUrl} alt={work.title} />
            </div>
          )}

          {clothing && (
            <div
              className="tryon-layer tryon-clothing"
              style={{ opacity: clothingOpacity }}
            >
              <img src={clothing.imageDataUrl} alt={clothing.name} />
            </div>
          )}

          {hair.slice(0, 2).map((item, i) => (
            <div
              key={item.id}
              className={`tryon-layer tryon-acc tryon-hair tryon-hair-${i}`}
            >
              <img src={item.imageDataUrl} alt={item.name} />
            </div>
          ))}

          {earrings.slice(0, 2).map((item, i) => (
            <div
              key={item.id}
              className={`tryon-layer tryon-acc tryon-ear tryon-ear-${i}`}
            >
              <img src={item.imageDataUrl} alt={item.name} />
            </div>
          ))}

          {props.slice(0, 2).map((item, i) => (
            <div
              key={item.id}
              className={`tryon-layer tryon-acc tryon-prop tryon-prop-${i}`}
            >
              <img src={item.imageDataUrl} alt={item.name} />
            </div>
          ))}

          <div className="tryon-vignette" aria-hidden />
        </>
      )}
    </div>
  );
}
