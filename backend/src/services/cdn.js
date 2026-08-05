const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://api-cdn.kroombox.com';
const CDN_PROJECT_NAME = process.env.CDN_PROJECT_NAME || 'GIAT Presensi';
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const LOCAL_ASSET_PREFIX = 'local:';

function getApiKey() {
  return process.env.CDN_API_KEY || process.env.CDNKROOMBOX_API_KEY || '';
}

function getAuthHeaders() {
  const apiKey = getApiKey();
  if (apiKey) return { 'x-api-key': apiKey };

  const jwtToken = process.env.CDN_JWT_TOKEN || '';
  if (jwtToken) return { Authorization: `Bearer ${jwtToken}` };

  return {};
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Format foto tidak valid');
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { buffer, mimeType };
}

function extensionFromMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'application/pdf') return '.pdf';
  return '.jpg';
}

function sanitizeFileName(fileName) {
  const parsed = path.parse(String(fileName || 'asset'));
  const base = parsed.name
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'asset';
  return `${base}${parsed.ext || ''}`;
}

function localAssetId(fileName) {
  return `${LOCAL_ASSET_PREFIX}${fileName}`;
}

function isLocalAssetId(fileId) {
  return String(fileId || '').startsWith(LOCAL_ASSET_PREFIX);
}

function localFileNameFromId(fileId) {
  if (!isLocalAssetId(fileId)) return '';
  return path.basename(String(fileId).slice(LOCAL_ASSET_PREFIX.length));
}

function localAssetUrl(fileId) {
  const fileName = localFileNameFromId(fileId);
  return fileName ? `/uploads/${encodeURIComponent(fileName)}` : '';
}

async function saveLocalAsset(buffer, mimeType, fileName) {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const sanitized = sanitizeFileName(fileName);
  const ext = path.extname(sanitized) || extensionFromMime(mimeType);
  const base = path.basename(sanitized, path.extname(sanitized));
  const finalName = `${Date.now()}-${crypto.randomUUID()}-${base}${ext}`;
  await fs.writeFile(path.join(UPLOADS_DIR, finalName), buffer);
  const fileId = localAssetId(finalName);

  return {
    fileId,
    status: 'ready',
    tracking: '',
    url: localAssetUrl(fileId),
    storage: 'local'
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableUploadError(error) {
  if (error?.noUploadRetry) return false;

  const code = error?.cause?.code || error?.code;
  const status = Number(error?.status || error?.cause?.status || 0);
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND'].includes(code) ||
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    /fetch failed|network|timeout|aborted/i.test(String(error?.message || ''));
}

function isPendingCdnAssetStatus(status) {
  return [404, 408, 425, 429, 500, 502, 503, 504].includes(Number(status || 0));
}

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForCdnAsset(fileId, attempts = 5) {
  const viewUrl = `${CDN_BASE_URL}/api/bridge/view/${fileId}`;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(viewUrl, {
        method: 'GET',
        headers: getAuthHeaders()
      }, 12000);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const contentLength = Number(response.headers.get('content-length') || 0);
        await response.body?.cancel().catch(() => {});

        if (contentType.startsWith('image/') || contentLength > 0) {
          return true;
        }

        const error = new Error('CDN asset sudah merespons, tetapi isi file belum siap.');
        error.status = response.status || 202;
        lastError = error;
      } else {
        const error = new Error(`CDN asset belum bisa diakses (${response.status})`);
        error.status = response.status;
        lastError = error;

        if (!isPendingCdnAssetStatus(response.status)) {
          await response.body?.cancel().catch(() => {});
          break;
        }

        await response.body?.cancel().catch(() => {});
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await sleep(Math.min(1200 + (attempt * 350), 4000));
    }
  }

  const error = new Error('Foto sudah dikirim ke CDN, tetapi file belum bisa dibuka dari CDN.');
  error.cause = lastError;
  error.status = lastError?.status || 503;
  throw error;
}

async function uploadDataUrl(dataUrl, fileName, options = {}) {
  const apiKey = getApiKey();
  const jwtToken = process.env.CDN_JWT_TOKEN || '';
  const allowLocalFallback = options.localFallback === true;
  const requireVerified = options.requireVerified === true;
  const maxAttempts = options.maxAttempts || 4;
  const { buffer, mimeType } = dataUrlToBlob(dataUrl);

  if (!apiKey && !jwtToken) {
    if (allowLocalFallback) {
      return await saveLocalAsset(buffer, mimeType, fileName);
    }
    const error = new Error('CDN_API_KEY atau CDN_JWT_TOKEN belum diisi di .env backend. Foto wajib tersimpan ke CDN.');
    error.isCdnUploadError = true;
    error.attempts = 0;
    throw error;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: mimeType }), fileName);
      formData.append('projectName', CDN_PROJECT_NAME);

      const response = await fetchWithTimeout(`${CDN_BASE_URL}/api/bridge/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        const error = new Error(payload.message || 'Upload foto ke CDN gagal');
        error.status = response.status;
        throw error;
      }

      if (!payload.fileId) {
        const error = new Error('Upload foto ke CDN belum mengembalikan file ID.');
        error.status = response.status || 502;
        throw error;
      }

      try {
        await waitForCdnAsset(payload.fileId, options.verifyAttempts || 5);
      } catch (verifyError) {
        if (requireVerified) {
          const error = new Error('Foto sudah dikirim ke CDN, tetapi file belum bisa dibuka dari CDN. Silakan coba lagi beberapa saat.');
          error.cause = verifyError;
          error.status = verifyError?.status || 503;
          error.isCdnUploadError = true;
          error.noUploadRetry = true;
          error.fileId = payload.fileId;
          error.attempts = attempt;
          throw error;
        }

        console.warn(
          'Upload foto ke CDN berhasil, tetapi verifikasi akses file belum siap:',
          verifyError?.message || verifyError
        );
      }

      return {
        fileId: payload.fileId,
        status: 'ready',
        tracking: payload.tracking || '',
        url: `${CDN_BASE_URL}/api/bridge/view/${payload.fileId}`,
        storage: 'cdn'
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableUploadError(error)) break;
      await sleep(800 * attempt);
    }
  }

  if (allowLocalFallback) {
    console.error('Penyimpanan utama gagal, memakai folder uploads lokal:', lastError?.message || lastError);
    return await saveLocalAsset(buffer, mimeType, fileName);
  }

  if (lastError?.isCdnUploadError && lastError?.noUploadRetry) {
    throw lastError;
  }

  const friendlyError = new Error(`Upload foto ke CDN belum berhasil setelah ${maxAttempts} percobaan. Periksa koneksi/server CDN lalu coba lagi.`);
  friendlyError.cause = lastError;
  friendlyError.isCdnUploadError = true;
  friendlyError.attempts = maxAttempts;
  throw friendlyError;
}

async function deleteAsset(fileId) {
  if (isLocalAssetId(fileId)) {
    const fileName = localFileNameFromId(fileId);
    if (!fileName) return;
    await fs.unlink(path.join(UPLOADS_DIR, fileName)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }

  const apiKey = getApiKey();
  const jwtToken = process.env.CDN_JWT_TOKEN || '';
  if ((!apiKey && !jwtToken) || !fileId) return;

  const response = await fetch(`${CDN_BASE_URL}/api/bridge/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Gagal menghapus asset CDN');
  }
}

module.exports = {
  uploadDataUrl,
  deleteAsset,
  CDN_BASE_URL,
  UPLOADS_DIR,
  LOCAL_ASSET_PREFIX,
  isLocalAssetId,
  localAssetUrl
};
