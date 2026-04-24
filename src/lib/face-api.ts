"use client";

import * as faceapi from "face-api.js";

let loaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels() {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const MODEL_URL = "/models";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    loaded = true;
  })();
  return loadingPromise;
}

export async function detectExpression(video: HTMLVideoElement) {
  if (!loaded) await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
    .withFaceExpressions();
  if (!result) return null;
  return result.expressions as unknown as {
    neutral: number;
    happy: number;
    sad: number;
    angry: number;
    fearful: number;
    disgusted: number;
    surprised: number;
  };
}

export { faceapi };
