const path = require('path');
const tf = require('@tensorflow/tfjs');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const sharp = require('sharp');

let modelsLoaded = false;

function modelsPath() {
  return process.env.FACE_MODELS_PATH || path.resolve(__dirname, '../../models');
}

async function loadModels() {
  if (modelsLoaded) return;
  await tf.ready();
  const modelDir = modelsPath();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);
  modelsLoaded = true;
  console.log(`✅ Face recognition models loaded from ${modelDir}`);
}

async function dataUrlToTensor(dataUrl) {
  const cleanBase64 = String(dataUrl || '').replace(/^data:image\/\w+;base64,/, '');
  const imgBuffer = Buffer.from(cleanBase64, 'base64');
  const { data, info } = await sharp(imgBuffer)
    .resize(640, 480, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
}

async function extractDescriptor(dataUrl) {
  await loadModels();
  let tensor = null;
  try {
    tensor = await dataUrlToTensor(dataUrl);
    const detection = await faceapi
      .detectSingleFace(tensor)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection || detection.detection.score < 0.5) return null;
    return Array.from(detection.descriptor);
  } finally {
    if (tensor) tensor.dispose();
  }
}

function parseStoredDescriptor(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (_e) { return null; }
  }
  return value;
}

function faceDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i += 1) {
    const diff = Number(desc1[i]) - Number(desc2[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function findBestMatch(queryDescriptor, employees, threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.6')) {
  let best = null;
  let bestDistance = Infinity;

  for (const emp of employees) {
    const descriptor = parseStoredDescriptor(emp.face_descriptor);
    const distance = faceDistance(queryDescriptor, descriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = emp;
    }
  }

  if (best && bestDistance <= threshold) {
    return { matched: true, employee: best, distance: bestDistance };
  }
  return { matched: false, employee: null, distance: bestDistance };
}

module.exports = {
  loadModels,
  extractDescriptor,
  findBestMatch,
  faceDistance,
  parseStoredDescriptor
};
