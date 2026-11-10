import { FaceLandmarker, FilesetResolver, type FaceLandmarker as FaceLandmarkerType } from '@mediapipe/tasks-vision';

export type Pt = { x: number; y: number };

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarkerType> | null = null;
const cache = new Map<string, Pt[] | null>();

export function loadFaceLandmarker(): Promise<FaceLandmarkerType> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

/** Landmark positions in the source image's pixel space. */
export async function detectFacePixels(src: string): Promise<Pt[] | null> {
  if (cache.has(src)) return cache.get(src) ?? null;
  const img = await loadHtmlImage(src);
  const marker = await loadFaceLandmarker();
  const result = marker.detect(img);
  const face = result.faceLandmarks[0];
  if (!face) {
    cache.set(src, null);
    return null;
  }
  const points = face.map((p) => ({ x: p.x * img.naturalWidth, y: p.y * img.naturalHeight }));
  cache.set(src, points);
  return points;
}

export function isHeadshot(img: HTMLImageElement, lm: Pt[]): boolean {
  const forehead = lm[10];
  const chin = lm[152];
  if (!forehead || !chin) return false;
  const faceH = (chin.y - forehead.y) / img.naturalHeight;
  const chinRatio = chin.y / img.naturalHeight;
  return faceH > 0.34 && chinRatio > 0.68;
}
