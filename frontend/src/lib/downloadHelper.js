import axios from "axios";
import { toast } from "sonner";

/**
 * Safe blob download helper.
 * Handles any Content-Type (PDF, ZIP, XLSX, CSV, etc.)
 * If the server returns an error (4xx/5xx), parses the error message
 * from JSON or text and shows a toast — never propagates exceptions.
 *
 * @param {Object} options
 * @param {string} options.url - Full URL to download from
 * @param {string} [options.method="GET"] - HTTP method
 * @param {Object} [options.data] - Request body (for POST)
 * @param {Object} options.headers - Auth headers
 * @param {string} [options.fallbackFilename="download"] - Filename if server doesn't provide one
 * @param {number} [options.timeout=120000] - Timeout in ms
 * @param {function} [options.onProgress] - Progress callback (percent 0-100)
 * @param {string} [options.errorPrefix="Error en la descarga"] - Toast error prefix
 * @returns {Promise<boolean>} true if download succeeded, false if failed
 */
export async function safeDownloadBlob({
  url,
  method = "GET",
  data = undefined,
  headers,
  fallbackFilename = "download",
  timeout = 120000,
  onProgress,
  errorPrefix = "Error en la descarga",
}) {
  try {
    const res = await axios({
      url,
      method,
      data,
      headers,
      responseType: "blob",
      timeout,
      onDownloadProgress: onProgress
        ? (evt) => {
            if (evt.total) {
              onProgress(Math.round((evt.loaded * 100) / evt.total));
            } else {
              onProgress(Math.min(95, Math.round(evt.loaded / 1024)));
            }
          }
        : undefined,
    });

    if (onProgress) onProgress(100);

    // Extract filename from Content-Disposition header
    const disposition = res.headers["content-disposition"] || "";
    const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = filenameMatch ? filenameMatch[1].trim() : fallbackFilename;

    // Create download link
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    return true;
  } catch (err) {
    // Parse error from blob response safely
    let message = errorPrefix;

    try {
      if (err.response?.data instanceof Blob) {
        const contentType = err.response.headers?.["content-type"] || "";

        // If server returned JSON or text error, parse it
        if (contentType.includes("json") || contentType.includes("text")) {
          const text = await err.response.data.text();
          try {
            const parsed = JSON.parse(text);
            message = parsed.detail || parsed.message || parsed.error || text;
          } catch {
            message = text || errorPrefix;
          }
        } else {
          // Binary content-type on error — unusual, use status text
          message = `${errorPrefix} (${err.response.status})`;
        }
      } else if (err.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (err.code === "ECONNABORTED") {
        message = "La descarga tardo demasiado. Intente nuevamente.";
      } else if (err.response?.status) {
        message = `${errorPrefix} (${err.response.status})`;
      }
    } catch {
      // If even the error parsing fails, just use the prefix
      message = errorPrefix;
    }

    console.error("[safeDownloadBlob]", err.message || err, { url, status: err.response?.status });
    toast.error(typeof message === "string" ? message : errorPrefix);
    return false;
  }
}
