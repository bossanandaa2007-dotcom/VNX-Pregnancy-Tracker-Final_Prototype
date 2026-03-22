const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORAGE_ROOT = path.join(__dirname, "..", "storage", "library");
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 50 * 1024 * 1024;

const ensureStorageRoot = async () => {
  await fsp.mkdir(STORAGE_ROOT, { recursive: true });
};

const sanitizeFileName = (value) =>
  String(value || "media")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "media";

const formatDateParts = (input) => {
  const date = input ? new Date(input) : new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return {
    date,
    year,
    month,
    day,
    time: `${hours}${minutes}${seconds}`,
  };
};

const resolveMediaType = (mimeType) => {
  if (IMAGE_MIME_TYPES.has(String(mimeType || "").toLowerCase())) return "image";
  if (VIDEO_MIME_TYPES.has(String(mimeType || "").toLowerCase())) return "video";
  return "";
};

const validateUploadedFile = (file) => {
  if (!file) {
    const error = new Error("Media file required");
    error.statusCode = 400;
    throw error;
  }

  const mediaType = resolveMediaType(file.mimetype);
  if (!mediaType) {
    const error = new Error("Unsupported file type");
    error.statusCode = 400;
    throw error;
  }

  const maxSize = mediaType === "image" ? IMAGE_MAX_SIZE : VIDEO_MAX_SIZE;
  if (Number(file.size || 0) > maxSize) {
    const error = new Error(
      mediaType === "image" ? "Image exceeds 10 MB limit" : "Video exceeds 50 MB limit"
    );
    error.statusCode = 400;
    throw error;
  }

  return mediaType;
};

const buildStorageDirectory = ({ patientId, bucket, mediaType, timestamp }) => {
  const { year, month, day } = formatDateParts(timestamp);
  const pluralType = mediaType === "video" ? "videos" : "photos";
  const normalizedBucket = bucket === "diary" ? "diary" : "memories";
  return {
    relativeDirectory: path.join(
      "patient",
      String(patientId),
      normalizedBucket,
      pluralType,
      year,
      month,
      day
    ),
    folderYear: year,
    folderMonth: month,
    folderDay: day,
  };
};

const buildStoredFileName = ({ originalName, timestamp }) => {
  const ext = path.extname(originalName || "").toLowerCase() || ".bin";
  const base = sanitizeFileName(path.basename(originalName || "media", ext));
  const suffix = crypto.randomBytes(6).toString("hex");
  const { time } = formatDateParts(timestamp);
  return `${time}-${base}-${suffix}${ext}`;
};

const writeUploadedFile = async ({ patientId, bucket, mediaType, timestamp, originalName, buffer }) => {
  await ensureStorageRoot();
  const { relativeDirectory, folderYear, folderMonth, folderDay } = buildStorageDirectory({
    patientId,
    bucket,
    mediaType,
    timestamp,
  });
  const absoluteDirectory = path.join(STORAGE_ROOT, relativeDirectory);
  await fsp.mkdir(absoluteDirectory, { recursive: true });

  const { time } = formatDateParts(timestamp);
  const fileName = buildStoredFileName({ originalName, timestamp });
  const absolutePath = path.join(absoluteDirectory, fileName);
  await fsp.writeFile(absolutePath, buffer);

  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  return {
    checksum,
    storagePath: absolutePath,
    relativeStoragePath: path.join(relativeDirectory, fileName).replace(/\\/g, "/"),
    folderYear,
    folderMonth,
    folderDay,
    folderTime: time,
  };
};

const openMediaStream = ({ storagePath, range }) => {
  const stats = fs.statSync(storagePath);
  const total = stats.size;

  if (!range) {
    return {
      status: 200,
      headers: {
        "Content-Length": total,
        "Accept-Ranges": "bytes",
      },
      stream: fs.createReadStream(storagePath),
    };
  }

  const [rawStart, rawEnd] = String(range).replace(/bytes=/, "").split("-");
  const start = Number(rawStart || 0);
  const end = rawEnd ? Number(rawEnd) : total - 1;
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(end, total - 1);

  return {
    status: 206,
    headers: {
      "Content-Range": `bytes ${safeStart}-${safeEnd}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": safeEnd - safeStart + 1,
    },
    stream: fs.createReadStream(storagePath, { start: safeStart, end: safeEnd }),
  };
};

module.exports = {
  IMAGE_MAX_SIZE,
  STORAGE_ROOT,
  VIDEO_MAX_SIZE,
  ensureStorageRoot,
  formatDateParts,
  openMediaStream,
  resolveMediaType,
  validateUploadedFile,
  writeUploadedFile,
};
