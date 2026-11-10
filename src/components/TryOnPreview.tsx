import { useEffect, useRef, useState } from 'react';
import type { InventoryItem, WorkItem } from '../types';

type Props = {
  faceUrl: string;
  work: WorkItem | null;
  clothing: InventoryItem | null;
  accessories: InventoryItem[];
  makeupOpacity: number;
  clothingOpacity: number;
  /** 每次画完效果图后回传 JPEG，供保存和还原台展示 */
  onResult?: (dataUrl: string) => void;
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
  onResult,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onResultRef = useRef(onResult);
  const [status, setStatus] = useState('');
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !faceUrl) return;
    onResultRef.current = onResult;
    const token = { cancel: false };
    setStatus('正在按五官位置对齐…');

    const publish = () => {
      try {
        onResultRef.current?.(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        /* canvas may be tainted; ignore */
      }
    };

    const paintFaceNow = (img: HTMLImageElement) => {
      const maxW = 720;
      const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#f6ebe6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      publish();
    };

    (async () => {
      try {
        const { detectFacePixels, loadHtmlImage } = await import('../lib/faceMesh');
        const { paintTryOn } = await import('../lib/tryOnRender');
        if (token.cancel) return;
        const userImg = await loadHtmlImage(faceUrl);
        if (token.cancel) return;
        paintFaceNow(userImg);
        const userLm = await detectFacePixels(faceUrl);
        if (token.cancel) return;
        if (!userLm) {
          setSimulated(false);
          setStatus('没有识别到正脸。已显示原图，妆面和服装不会错位贴上。');
          paintFaceNow(userImg);
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
        publish();
        if (work && !workLm) {
          setStatus('这套造型照片里没有识别到脸，已保留顾客照片，妆面没有贴错位置。');
        } else {
          setStatus('');
        }
      } catch (error) {
        console.error(error);
        if (!token.cancel) {
          setStatus('五官定位暂时不可用，已显示上传的照片。');
          if (canvas.width < 32) {
            const img = new Image();
            img.onload = () => {
              if (!token.cancel) paintFaceNow(img);
            };
            img.src = faceUrl;
          }
        }
      }
    })();

    return () => {
      token.cancel = true;
    };
  }, [faceUrl, work, clothing, accessories, makeupOpacity, clothingOpacity, onResult]);

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
