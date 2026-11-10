import { useEffect, useRef, useState } from 'react';
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
 * 用 MediaPipe 人脸关键点把造型妆面贴到眼睛、眉、鼻、唇和轮廓上。
 * 近景头像会按头身比例补一块模拟身材，再把服装对齐到肩线以下。
 */
export function TryOnPreview({
  faceUrl,
  work,
  clothing,
  accessories,
  makeupOpacity,
  clothingOpacity,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('');
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !faceUrl) return;
    const token = { cancel: false };
    setStatus('正在按五官位置对齐…');

    (async () => {
      try {
        const { detectFacePixels, loadHtmlImage } = await import('../lib/faceMesh');
        const { paintTryOn } = await import('../lib/tryOnRender');
        if (token.cancel) return;
        const userImg = await loadHtmlImage(faceUrl);
        const userLm = await detectFacePixels(faceUrl);
        if (token.cancel) return;
        if (!userLm) {
          setSimulated(false);
          setStatus('没有识别到正脸，妆面和服装不会错位贴上。请换一张五官清楚的照片。');
          const ctx = canvas.getContext('2d');
          canvas.width = userImg.naturalWidth;
          canvas.height = userImg.naturalHeight;
          ctx?.drawImage(userImg, 0, 0);
          return;
        }

        const workImg = work ? await loadHtmlImage(work.imageDataUrl) : null;
        const workLm = work ? await detectFacePixels(work.imageDataUrl) : null;
        const clothingImg = clothing ? await loadHtmlImage(clothing.imageDataUrl) : null;
        const clothingLm = clothing ? await detectFacePixels(clothing.imageDataUrl) : null;
        const accessoryImages = await Promise.all(
          accessories.map((item) => loadHtmlImage(item.imageDataUrl).catch(() => null)),
        );
        if (token.cancel) return;

        const result = await paintTryOn(
          canvas,
          userImg,
          userLm,
          workImg,
          workLm,
          clothingImg,
          clothingLm,
          accessories,
          accessoryImages.map((img) => img ?? new Image()),
          makeupOpacity,
          clothingOpacity,
        );
        if (token.cancel) return;
        setSimulated(result.simulated);
        if (work && !workLm) {
          setStatus('这套造型照片里没有识别到脸，妆面没有贴上，避免贴错位置。');
        } else {
          setStatus('');
        }
      } catch (error) {
        console.error(error);
        if (!token.cancel) setStatus('五官定位暂时不可用，请检查网络后重试。');
      }
    })();

    return () => {
      token.cancel = true;
    };
  }, [faceUrl, work, clothing, accessories, makeupOpacity, clothingOpacity]);

  if (!faceUrl) {
    return (
      <div className="tryon-stage" aria-label="试妆实时预览">
        <div className="tryon-empty">请先选择或上传客户人脸</div>
      </div>
    );
  }

  return (
    <div className="tryon-preview-stack">
      <div className={`tryon-stage ${simulated ? 'is-figure' : ''}`} aria-label="试妆实时预览">
        <canvas ref={canvasRef} />
      </div>
      {simulated && (
        <p className="tryon-sim-banner">
          近景头像 · 已按头身比例生成全身预览，服装对齐在模拟身材上
        </p>
      )}
      {status && <p className="tryon-status">{status}</p>}
    </div>
  );
}
