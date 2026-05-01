"use client";

// Dynamic-import wrapper around face-api.js. Static `import * as
// faceapi from "face-api.js"` would pull ~650KB of TensorFlow-flavoured
// JS into the initial /session bundle, which on a mid-range phone
// blocks first paint for 8–15s and made the voice picker feel
// "stuck". By loading the library only when loadFaceModels() is
// actually invoked, the picker is now interactive within a few
// hundred ms and the heavy bundle streams in *after* the user has
// already chosen a voice.

type FaceApiModule = typeof import("face-api.js");

let lib: FaceApiModule | null = null;
let loaded = false;
let loadingPromise: Promise<void> | null = null;

async function getLib(): Promise<FaceApiModule> {
  if (lib) return lib;
  const mod = await import("face-api.js");
  lib = mod;
  return mod;
}

export async function loadFaceModels() {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const faceapi = await getLib();
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
  const faceapi = await getLib();
  const result = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
    )
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
