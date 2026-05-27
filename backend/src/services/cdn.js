const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://api-cdn.kroombox.com';
const CDN_PROJECT_NAME = process.env.CDN_PROJECT_NAME || 'GIAT Presensi';

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableUploadError(error) {
  const code = error?.cause?.code || error?.code;
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND'].includes(code) ||
    /fetch failed|network|timeout|aborted/i.test(String(error?.message || ''));
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

async function uploadDataUrl(dataUrl, fileName, options = {}) {
  const apiKey = getApiKey();
  const jwtToken = process.env.CDN_JWT_TOKEN || '';
  if (!apiKey && !jwtToken) {
    throw new Error('CDN_API_KEY atau CDN_JWT_TOKEN belum diisi di .env backend');
  }

  const maxAttempts = options.maxAttempts || 3;
  const { buffer, mimeType } = dataUrlToBlob(dataUrl);

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

      return {
        fileId: payload.fileId,
        status: payload.status || 'processing',
        tracking: payload.tracking || '',
        url: payload.fileId ? `${CDN_BASE_URL}/api/bridge/view/${payload.fileId}` : (payload.url || '')
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableUploadError(error)) break;
      await sleep(800 * attempt);
    }
  }

  const friendlyError = new Error('Upload foto bukti belum berhasil karena koneksi ke penyimpanan foto sedang tidak stabil. Silakan coba proses presensi lagi.');
  friendlyError.cause = lastError;
  friendlyError.isCdnUploadError = true;
  throw friendlyError;
}

async function deleteAsset(fileId) {
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
  CDN_BASE_URL
};
