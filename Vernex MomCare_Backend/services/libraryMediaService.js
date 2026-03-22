const path = require("path");
const LibraryItem = require("../models/LibraryItem");
const LibraryImportItem = require("../models/LibraryImportItem");
const DiaryEntry = require("../models/DiaryEntry");
const Patient = require("../models/Patient");
const {
  formatDateParts,
  resolveMediaType,
  validateUploadedFile,
  writeUploadedFile,
} = require("./libraryStorageService");
const { getBucketItems } = require("./libraryCatalogService");
const {
  buildSpotifyEmbedUrl,
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
  extractSpotifyId,
  extractYouTubeId,
  fetchSpotifyMetadata,
  fetchYouTubeMetadata,
} = require("./libraryEmbedUtils");

const deriveUploadSourceType = ({ sourceType, mediaType, isCamera }) => {
  if (sourceType && typeof sourceType === "string") return sourceType;
  if (isCamera) return mediaType === "video" ? "camera_video" : "camera_photo";
  return mediaType === "video" ? "upload_video" : "upload_photo";
};

const normalizeTrimester = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["first", "second", "third", "all"].includes(normalized)) return normalized;
  return "";
};

const normalizeFitnessCategory = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "General";
  if (/first/i.test(raw)) return "First Trimester";
  if (/second/i.test(raw)) return "Second Trimester";
  if (/third/i.test(raw)) return "Third Trimester";
  return "General";
};

const inferTrimesterFromCategory = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("first")) return "first";
  if (raw.includes("second")) return "second";
  if (raw.includes("third")) return "third";
  return "all";
};

const toLibraryResponse = (item, req) => {
  const value = item.toObject ? item.toObject() : item;
  const youtubeVideoId = value.youtubeVideoId || extractYouTubeId(value.youtubeUrl || value.embedUrl);
  const spotifyData = extractSpotifyId(value.spotifyUrl || "");
  const spotifyType = value.spotifyType || spotifyData?.type || "";
  const spotifyId = value.spotifyId || spotifyData?.id || "";
  const embedUrl =
    value.embedUrl ||
    (youtubeVideoId ? buildYouTubeEmbedUrl(youtubeVideoId) : "") ||
    (spotifyId && spotifyType ? buildSpotifyEmbedUrl({ id: spotifyId, type: spotifyType }) : "");
  const streamUrl =
    value.storagePath && (value.mediaType === "image" || value.mediaType === "video")
      ? `${req.protocol}://${req.get("host")}/api/library/item/${value._id}/stream`
      : "";

  return {
    id: String(value._id),
    patientId: value.patientId ? String(value.patientId) : null,
    uploadedBy: value.uploadedBy ?? null,
    bucket: value.bucket,
    sourceType: value.sourceType,
    mediaType: value.mediaType,
    title: value.title,
    description: value.description,
    mimeType: value.mimeType,
    sizeBytes: value.sizeBytes,
    storagePath: value.storagePath,
    thumbnailPath: value.thumbnailPath,
    capturedAt: value.capturedAt,
    uploadedAt: value.uploadedAt,
    folderYear: value.folderYear,
    folderMonth: value.folderMonth,
    folderDay: value.folderDay,
    folderTime: value.folderTime,
    diaryEntryId: value.diaryEntryId ? String(value.diaryEntryId) : null,
    pregnancyWeek: value.pregnancyWeek,
    pregnancyMonth: value.pregnancyMonth,
    trimester: value.trimester,
    doctorId: value.doctorId || "",
    category: value.category || "",
    isDefault: Boolean(value.isDefault),
    youtubeVideoId,
    defaultYouTubeVideoId: value.defaultYouTubeVideoId || "",
    youtubeUrl: value.youtubeUrl,
    spotifyId,
    defaultSpotifyId: value.defaultSpotifyId || "",
    spotifyType,
    spotifyUrl: value.spotifyUrl,
    embedUrl,
    sourceAuthority: value.sourceAuthority,
    tags: value.tags || [],
    isEncrypted: value.isEncrypted,
    encryptionMeta: value.encryptionMeta || {},
    adminVisibility: value.adminVisibility,
    isSyncedFromGoogle: value.isSyncedFromGoogle,
    googleSourceType: value.googleSourceType,
    googleSourceId: value.googleSourceId,
    checksum: value.checksum || "",
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    streamUrl,
    previewUrl:
      streamUrl ||
      value.thumbnailPath ||
      buildYouTubeThumbnailUrl(youtubeVideoId) ||
      embedUrl ||
      value.spotifyUrl ||
      value.youtubeUrl ||
      "",
  };
};

const buildBucketQuery = ({ patientId, bucket }) => {
  const query = { bucket, status: "active" };
  if (bucket === "memories" || bucket === "diary") {
    query.patientId = patientId;
  }
  if (bucket === "diary") {
    query.diaryEntryId = { $ne: null };
  }
  return query;
};

const uploadLibraryFile = async ({ patientId, uploadedBy, bucket = "memories", sourceType, file, capturedAt, isCamera = false }) => {
  const mediaType = validateUploadedFile(file);
  const timestamp = capturedAt ? new Date(capturedAt) : new Date();
  const storageInfo = await writeUploadedFile({
    patientId,
    bucket,
    mediaType,
    timestamp,
    originalName: file.originalname,
    buffer: file.buffer,
  });

  return LibraryItem.create({
    patientId,
    uploadedBy: uploadedBy || patientId,
    bucket,
    sourceType: deriveUploadSourceType({ sourceType, mediaType, isCamera }),
    mediaType,
    title: file.originalname || path.basename(storageInfo.relativeStoragePath),
    description: "",
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: storageInfo.storagePath,
    thumbnailPath: "",
    capturedAt: capturedAt ? new Date(capturedAt) : null,
    uploadedAt: new Date(),
    folderYear: storageInfo.folderYear,
    folderMonth: storageInfo.folderMonth,
    folderDay: storageInfo.folderDay,
    folderTime: storageInfo.folderTime,
    diaryEntryId: null,
    checksum: storageInfo.checksum,
    isEncrypted: false,
    encryptionMeta: {
      status: "not_enabled",
      keyRef: "",
      provider: "",
    },
    adminVisibility: "patient_admin",
    isSyncedFromGoogle: false,
    googleSourceType: "",
    googleSourceId: "",
    status: "active",
  });
};

const createFitnessItem = async (payload) => {
  const youtubeUrl = String(payload.youtubeUrl || payload.youtube_url || "").trim();
  const youtubeVideoId = payload.youtubeVideoId || extractYouTubeId(youtubeUrl);
  if (!youtubeUrl || !youtubeVideoId) {
    const error = new Error("A valid YouTube URL is required");
    error.statusCode = 400;
    throw error;
  }

  const metadata =
    !String(payload.title || "").trim() || !String(payload.description || "").trim()
      ? await fetchYouTubeMetadata(youtubeUrl)
      : null;

  const normalizedCategory = normalizeFitnessCategory(payload.category);
  const resolvedTitle = String(payload.title || "").trim() || metadata?.title || "Pregnancy Fitness Video";
  const resolvedDescription =
    String(payload.description || "").trim() || "Recommended by your doctor";

  return LibraryItem.create({
    patientId: null,
    uploadedBy: payload.uploadedBy || payload.doctorId || "doctor",
    doctorId: String(payload.doctorId || ""),
    bucket: "fitness",
    sourceType: payload.sourceType || "doctor_fitness",
    mediaType: "youtube",
    title: resolvedTitle,
    description: resolvedDescription,
    pregnancyWeek: payload.week ?? payload.pregnancyWeek ?? null,
    pregnancyMonth: payload.month ?? payload.pregnancyMonth ?? null,
    trimester: normalizeTrimester(payload.trimester || inferTrimesterFromCategory(normalizedCategory) || "all"),
    category: normalizedCategory,
    isDefault: Boolean(payload.isDefault),
    youtubeVideoId,
    defaultYouTubeVideoId: "",
    youtubeUrl,
    embedUrl: buildYouTubeEmbedUrl(youtubeVideoId),
    sourceAuthority: payload.sourceAuthority || metadata?.authorName || "",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    adminVisibility: "patient_admin",
    isEncrypted: false,
    encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
    status: "active",
  });
};

const updateFitnessItem = async ({ itemId, actor, title, description, category }) => {
  const item = await LibraryItem.findById(itemId);
  if (!item || item.status !== "active" || item.bucket !== "fitness") {
    const error = new Error("Fitness video not found");
    error.statusCode = 404;
    throw error;
  }

  if (!actor || actor.role !== "doctor") {
    const error = new Error("Only doctors can update fitness videos");
    error.statusCode = 403;
    throw error;
  }

  const normalizedCategory = normalizeFitnessCategory(category);
  if (item.isDefault || item.sourceType === "fitness_seed" || item.sourceType === "doctor_fitness_override") {
    const targetVideoId = String(item.defaultYouTubeVideoId || item.youtubeVideoId || "").trim();
    if (!targetVideoId) {
      const error = new Error("Default fitness reference is missing");
      error.statusCode = 400;
      throw error;
    }

    await LibraryItem.findOneAndUpdate(
      {
        bucket: "fitness",
        doctorId: actor.userId,
        sourceType: "doctor_fitness_hidden",
        defaultYouTubeVideoId: targetVideoId,
      },
      { status: "deleted" },
      { new: true }
    );

    return LibraryItem.findOneAndUpdate(
      {
        bucket: "fitness",
        doctorId: actor.userId,
        sourceType: "doctor_fitness_override",
        defaultYouTubeVideoId: targetVideoId,
      },
      {
        patientId: null,
        uploadedBy: actor.userId,
        doctorId: actor.userId,
        bucket: "fitness",
        sourceType: "doctor_fitness_override",
        mediaType: "youtube",
        title: String(title || "").trim() || item.title || "Pregnancy Fitness Video",
        description:
          String(description || "").trim() || item.description || "Recommended by your doctor",
        pregnancyWeek: item.pregnancyWeek ?? null,
        pregnancyMonth: item.pregnancyMonth ?? null,
        trimester: normalizeTrimester(item.trimester || inferTrimesterFromCategory(normalizedCategory) || "all"),
        category: normalizedCategory,
        isDefault: true,
        youtubeVideoId: item.youtubeVideoId || targetVideoId,
        defaultYouTubeVideoId: targetVideoId,
        youtubeUrl: item.youtubeUrl || "",
        embedUrl: item.embedUrl || buildYouTubeEmbedUrl(item.youtubeVideoId || targetVideoId),
        sourceAuthority: item.sourceAuthority || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        adminVisibility: "patient_admin",
        isEncrypted: false,
        encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
        status: "active",
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  if (String(item.doctorId || "") !== actor.userId) {
    const error = new Error("Doctors can only edit their own fitness videos");
    error.statusCode = 403;
    throw error;
  }

  item.title = String(title || "").trim() || "Pregnancy Fitness Video";
  item.description = String(description || "").trim() || "Recommended by your doctor";
  item.category = normalizedCategory;
  item.trimester = inferTrimesterFromCategory(normalizedCategory);
  await item.save();
  return item;
};

const createMusicItem = async (payload) => {
  const spotifyUrl = String(payload.spotifyUrl || payload.spotify_url || "").trim();
  const spotifyData = extractSpotifyId(spotifyUrl);
  if (!spotifyUrl || !spotifyData) {
    const error = new Error("A valid Spotify track, playlist, or album URL is required");
    error.statusCode = 400;
    throw error;
  }

  const resolvedTitle = String(payload.title || "").trim() || "Relaxing Pregnancy Music";
  const resolvedDescription =
    String(payload.description || "").trim() || "Recommended by your doctor";
  const metadata = await fetchSpotifyMetadata(spotifyUrl);

  return LibraryItem.create({
    patientId: null,
    uploadedBy: payload.uploadedBy || payload.doctorId || "doctor",
    doctorId: String(payload.doctorId || ""),
    bucket: "music",
    sourceType: payload.sourceType || "doctor_music",
    mediaType: "spotify",
    title: resolvedTitle,
    description: resolvedDescription,
    trimester: normalizeTrimester(payload.trimester || ""),
    category: String(payload.category || "").trim(),
    isDefault: Boolean(payload.isDefault),
    spotifyId: spotifyData.id,
    defaultSpotifyId: "",
    spotifyType: spotifyData.type,
    spotifyUrl,
    embedUrl: buildSpotifyEmbedUrl(spotifyData),
    thumbnailPath: metadata?.thumbnailUrl || "",
    sourceAuthority: payload.sourceAuthority || "Spotify",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    adminVisibility: "patient_admin",
    isEncrypted: false,
    encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
    status: "active",
  });
};

const updateMusicItem = async ({ itemId, actor, title, description }) => {
  const item = await LibraryItem.findById(itemId);
  if (!item || item.status !== "active" || item.bucket !== "music") {
    const error = new Error("Music item not found");
    error.statusCode = 404;
    throw error;
  }

  if (!actor || actor.role !== "doctor") {
    const error = new Error("Only doctors can update music");
    error.statusCode = 403;
    throw error;
  }

  if (item.isDefault || item.sourceType === "music_seed" || item.sourceType === "doctor_music_override") {
    const targetSpotifyId = String(item.defaultSpotifyId || item.spotifyId || "").trim();
    if (!targetSpotifyId) {
      const error = new Error("Default music reference is missing");
      error.statusCode = 400;
      throw error;
    }

    await LibraryItem.findOneAndUpdate(
      {
        bucket: "music",
        doctorId: actor.userId,
        sourceType: "doctor_music_hidden",
        defaultSpotifyId: targetSpotifyId,
      },
      { status: "deleted" },
      { new: true }
    );

    return LibraryItem.findOneAndUpdate(
      {
        bucket: "music",
        doctorId: actor.userId,
        sourceType: "doctor_music_override",
        defaultSpotifyId: targetSpotifyId,
      },
      {
        patientId: null,
        uploadedBy: actor.userId,
        doctorId: actor.userId,
        bucket: "music",
        sourceType: "doctor_music_override",
        mediaType: "spotify",
        title: String(title || "").trim() || item.title || "Relaxing Pregnancy Music",
        description: String(description || "").trim() || item.description || "Recommended by your doctor",
        trimester: normalizeTrimester(item.trimester || ""),
        category: String(item.category || "").trim(),
        isDefault: true,
        spotifyId: item.spotifyId || targetSpotifyId,
        defaultSpotifyId: targetSpotifyId,
        spotifyType: item.spotifyType || "",
        spotifyUrl: item.spotifyUrl || "",
        embedUrl: item.embedUrl || buildSpotifyEmbedUrl({
          id: item.spotifyId || targetSpotifyId,
          type: item.spotifyType || "",
        }),
        thumbnailPath: item.thumbnailPath || "",
        sourceAuthority: item.sourceAuthority || "Spotify",
        tags: Array.isArray(item.tags) ? item.tags : [],
        adminVisibility: "patient_admin",
        isEncrypted: false,
        encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
        status: "active",
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  if (String(item.doctorId || "") !== actor.userId) {
    const error = new Error("Doctors can only edit their own music");
    error.statusCode = 403;
    throw error;
  }

  item.title = String(title || "").trim() || "Relaxing Pregnancy Music";
  item.description = String(description || "").trim() || "Recommended by your doctor";
  await item.save();
  return item;
};

const listPatientBucketItems = async ({ patientId, bucket }) =>
  LibraryItem.find(buildBucketQuery({ patientId, bucket })).sort({ createdAt: -1 }).lean();

const getPatientLibrarySummary = async (patientId, actor) => {
  const [memories, diaryMedia, fitness, music] = await Promise.all([
    listPatientBucketItems({ patientId, bucket: "memories" }),
    listPatientBucketItems({ patientId, bucket: "diary" }),
    getBucketItems({ bucket: "fitness", patientId, actor }),
    getBucketItems({ bucket: "music", patientId, actor }),
  ]);

  return {
    memories,
    diaryMedia,
    fitness,
    music,
    counts: {
      memories: memories.length,
      diaryMedia: diaryMedia.length,
      fitness: fitness.length,
      music: music.length,
    },
  };
};

const getItemById = async (id) => LibraryItem.findById(id);

const softDeleteItem = async (id, actor = null) => {
  const item = await LibraryItem.findById(id);
  if (!item) return null;

  if (
    actor?.role === "doctor" &&
    item.bucket === "fitness" &&
    (item.isDefault || item.sourceType === "fitness_seed" || item.sourceType === "doctor_fitness_override")
  ) {
    const targetVideoId = String(item.defaultYouTubeVideoId || item.youtubeVideoId || "").trim();
    if (!targetVideoId) {
      const error = new Error("Default fitness reference is missing");
      error.statusCode = 400;
      throw error;
    }

    await LibraryItem.findOneAndUpdate(
      {
        bucket: "fitness",
        doctorId: actor.userId,
        sourceType: "doctor_fitness_override",
        defaultYouTubeVideoId: targetVideoId,
      },
      { status: "deleted" },
      { new: true }
    );

    await LibraryItem.findOneAndUpdate(
      {
        bucket: "fitness",
        doctorId: actor.userId,
        sourceType: "doctor_fitness_hidden",
        defaultYouTubeVideoId: targetVideoId,
      },
      {
        patientId: null,
        uploadedBy: actor.userId,
        doctorId: actor.userId,
        bucket: "fitness",
        sourceType: "doctor_fitness_hidden",
        mediaType: "youtube",
        title: item.title || "Pregnancy Fitness Video",
        description: item.description || "Recommended by your doctor",
        pregnancyWeek: item.pregnancyWeek ?? null,
        pregnancyMonth: item.pregnancyMonth ?? null,
        trimester: normalizeTrimester(item.trimester || ""),
        category: String(item.category || "").trim(),
        isDefault: false,
        youtubeVideoId: item.youtubeVideoId || targetVideoId,
        defaultYouTubeVideoId: targetVideoId,
        youtubeUrl: item.youtubeUrl || "",
        embedUrl: item.embedUrl || buildYouTubeEmbedUrl(item.youtubeVideoId || targetVideoId),
        sourceAuthority: item.sourceAuthority || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        adminVisibility: "patient_admin",
        isEncrypted: false,
        encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
        status: "active",
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return item;
  }

  if (
    actor?.role === "doctor" &&
    item.bucket === "music" &&
    (item.isDefault || item.sourceType === "music_seed" || item.sourceType === "doctor_music_override")
  ) {
    const targetSpotifyId = String(item.defaultSpotifyId || item.spotifyId || "").trim();
    if (!targetSpotifyId) {
      const error = new Error("Default music reference is missing");
      error.statusCode = 400;
      throw error;
    }

    await LibraryItem.findOneAndUpdate(
      {
        bucket: "music",
        doctorId: actor.userId,
        sourceType: "doctor_music_override",
        defaultSpotifyId: targetSpotifyId,
      },
      { status: "deleted" },
      { new: true }
    );

    await LibraryItem.findOneAndUpdate(
      {
        bucket: "music",
        doctorId: actor.userId,
        sourceType: "doctor_music_hidden",
        defaultSpotifyId: targetSpotifyId,
      },
      {
        patientId: null,
        uploadedBy: actor.userId,
        doctorId: actor.userId,
        bucket: "music",
        sourceType: "doctor_music_hidden",
        mediaType: "spotify",
        title: item.title || "Relaxing Pregnancy Music",
        description: item.description || "Recommended by your doctor",
        trimester: normalizeTrimester(item.trimester || ""),
        category: String(item.category || "").trim(),
        isDefault: false,
        spotifyId: item.spotifyId || targetSpotifyId,
        defaultSpotifyId: targetSpotifyId,
        spotifyType: item.spotifyType || "",
        spotifyUrl: item.spotifyUrl || "",
        embedUrl: item.embedUrl || buildSpotifyEmbedUrl({
          id: item.spotifyId || targetSpotifyId,
          type: item.spotifyType || "",
        }),
        thumbnailPath: item.thumbnailPath || "",
        sourceAuthority: item.sourceAuthority || "Spotify",
        tags: Array.isArray(item.tags) ? item.tags : [],
        adminVisibility: "patient_admin",
        isEncrypted: false,
        encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
        status: "active",
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return item;
  }

  return LibraryItem.findByIdAndUpdate(id, { status: "deleted" }, { new: true });
};

const registerGoogleImportPlaceholder = async ({
  patientId,
  uploadedBy,
  provider,
  externalId,
  externalUrl,
  previewUrl,
  mediaType = "external",
  title,
  description,
}) => {
  const importItem = await LibraryImportItem.findOneAndUpdate(
    { patientId, provider, externalId },
    {
      patientId,
      provider,
      externalId,
      externalUrl,
      previewUrl: previewUrl || "",
      mediaType: mediaType === "video" ? "video" : "photo",
      importStatus: "registered",
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const now = formatDateParts(new Date());
  const item = await LibraryItem.create({
    patientId,
    uploadedBy: uploadedBy || patientId,
    bucket: "memories",
    sourceType: provider,
    mediaType: mediaType === "video" ? "video" : mediaType === "image" ? "image" : "external",
    title: title || path.basename(externalUrl || previewUrl || externalId || provider),
    description: description || "",
    mimeType: "",
    sizeBytes: 0,
    storagePath: "",
    thumbnailPath: previewUrl || "",
    uploadedAt: new Date(),
    folderYear: now.year,
    folderMonth: now.month,
    folderDay: now.day,
    folderTime: now.time,
    sourceAuthority: provider === "google_photos" ? "Google Photos" : "Google Drive",
    isEncrypted: false,
    encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
    adminVisibility: "patient_admin",
    isSyncedFromGoogle: true,
    googleSourceType: provider,
    googleSourceId: externalId,
    status: "active",
  });

  importItem.importedLibraryItemId = item._id;
  importItem.importStatus = "linked";
  await importItem.save();

  return item;
};

const attachDiaryMedia = async ({ entry, mediaIds }) => {
  if (!entry?._id) return;

  const detachedItems = await LibraryItem.find({
    diaryEntryId: entry._id,
    patientId: entry.userId || entry.patientId,
    _id: { $nin: mediaIds || [] },
    status: "active",
  });

  await Promise.all(
    detachedItems.map((item) => {
      item.bucket = "memories";
      item.diaryEntryId = null;
      item.sourceType = item.mediaType === "video" ? "upload_video" : "upload_photo";
      return item.save();
    })
  );

  const items = await LibraryItem.find({
    _id: { $in: mediaIds || [] },
    patientId: entry.userId || entry.patientId,
    status: "active",
  });

  await Promise.all(
    items.map((item) => {
      item.bucket = "diary";
      item.diaryEntryId = entry._id;
      item.sourceType = item.mediaType === "video" ? "diary_video" : "diary_photo";
      return item.save();
    })
  );
};

const resolveDiaryMediaRefs = async ({ entryId, mediaRefs, patientId }) => {
  const ids = Array.isArray(mediaRefs) ? mediaRefs.filter(Boolean) : [];
  if (ids.length > 0) {
    return LibraryItem.find({
      _id: { $in: ids },
      patientId,
      status: "active",
    }).sort({ createdAt: -1 });
  }

  if (entryId) {
    return LibraryItem.find({
      diaryEntryId: entryId,
      patientId,
      bucket: "diary",
      status: "active",
    }).sort({ createdAt: -1 });
  }

  return [];
};

const searchPatients = async (query) => {
  const filter = query
    ? {
        $or: [{ name: new RegExp(query, "i") }, { email: new RegExp(query, "i") }],
      }
    : {};

  return Patient.find(filter)
    .select("name email gestationalWeek profilePhoto")
    .sort({ name: 1 })
    .limit(25)
    .lean();
};

const migrateLegacyDiaryImages = async (req, entry) => {
  const legacyImages = Array.isArray(entry?.images) ? entry.images.filter(Boolean) : [];
  if (!entry || legacyImages.length === 0) return [];

  const existing = await LibraryItem.find({
    diaryEntryId: entry._id,
    patientId: entry.userId || entry.patientId,
    bucket: "diary",
    status: "active",
  });
  if (existing.length > 0) return existing;

  const created = [];
  for (const imageDataUrl of legacyImages) {
    const matches = /^data:(.+?);base64,(.+)$/.exec(imageDataUrl);
    if (!matches) continue;
    const mimeType = matches[1] || "image/jpeg";
    const buffer = Buffer.from(matches[2], "base64");
    const item = await uploadLibraryFile({
      patientId: entry.userId || entry.patientId,
      uploadedBy: entry.userId || entry.patientId,
      bucket: "diary",
      sourceType: "diary_photo",
      file: {
        buffer,
        mimetype: mimeType,
        originalname: `legacy-diary-${entry.date || entry.entryDate}.jpg`,
        size: buffer.length,
      },
      capturedAt: entry.updatedAt || entry.createdAt || new Date(),
      isCamera: false,
    });
    item.diaryEntryId = entry._id;
    await item.save();
    created.push(item);
  }

  entry.mediaRefs = created.map((item) => item._id);
  await DiaryEntry.updateOne({ _id: entry._id }, { mediaRefs: entry.mediaRefs });
  return created;
};

module.exports = {
  attachDiaryMedia,
  createFitnessItem,
  createMusicItem,
  extractSpotifyId,
  extractYouTubeId,
  fetchYouTubeMetadata,
  getItemById,
  getPatientLibrarySummary,
  listPatientBucketItems,
  migrateLegacyDiaryImages,
  registerGoogleImportPlaceholder,
  resolveDiaryMediaRefs,
  searchPatients,
  softDeleteItem,
  toLibraryResponse,
  updateFitnessItem,
  updateMusicItem,
  uploadLibraryFile,
};
