const multer = require("multer");
const {
  createFitnessItem,
  createMusicItem,
  getItemById,
  getPatientLibrarySummary,
  listPatientBucketItems,
  registerGoogleImportPlaceholder,
  searchPatients,
  softDeleteItem,
  toLibraryResponse,
  updateFitnessItem,
  updateMusicItem,
  uploadLibraryFile,
} = require("../services/libraryMediaService");
const { getBucketItems } = require("../services/libraryCatalogService");
const { openMediaStream } = require("../services/libraryStorageService");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const requirePatientId = (value, res) => {
  if (!value) {
    res.status(400).json({ error: "Patient ID required" });
    return false;
  }
  return true;
};

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  res.status(error?.statusCode || 500).json({ error: error?.message || fallbackMessage });
};

const getPatientLibrary = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!requirePatientId(patientId, res)) return;
    const data = await getPatientLibrarySummary(patientId, req.libraryActor);
    res.json({
      counts: data.counts,
      memories: data.memories.map((item) => toLibraryResponse(item, req)),
      diaryMedia: data.diaryMedia.map((item) => toLibraryResponse(item, req)),
      fitness: data.fitness.map((item) => toLibraryResponse(item, req)),
      music: data.music.map((item) => toLibraryResponse(item, req)),
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch patient library");
  }
};

const getPatientBucket = (bucket) => async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!requirePatientId(patientId, res)) return;
    const items =
      bucket === "fitness" || bucket === "music"
        ? await getBucketItems({ bucket, patientId, actor: req.libraryActor })
        : await listPatientBucketItems({ patientId, bucket });
    res.json({ items: items.map((item) => toLibraryResponse(item, req)) });
  } catch (error) {
    handleError(res, error, `Failed to fetch ${bucket} library items`);
  }
};

const uploadCommon = async ({ req, res, isCamera }) => {
  try {
    const patientId = req.body.patientId;
    if (!requirePatientId(patientId, res)) return;

    const item = await uploadLibraryFile({
      patientId,
      uploadedBy: req.body.uploadedBy || patientId,
      bucket: "memories",
      sourceType: req.body.sourceType,
      file: req.file,
      capturedAt: req.body.capturedAt,
      isCamera,
    });

    res.status(201).json({ item: toLibraryResponse(item, req) });
  } catch (error) {
    handleError(res, error, "Failed to upload library file");
  }
};

const uploadLibrary = async (req, res) => uploadCommon({ req, res, isCamera: false });
const uploadCamera = async (req, res) => uploadCommon({ req, res, isCamera: true });

const createFitness = async (req, res) => {
  try {
    if (!req.body?.youtubeUrl && !req.body?.youtube_url) {
      return res.status(400).json({ error: "youtube_url is required" });
    }
    const item = await createFitnessItem(req.body || {});
    res.status(201).json({ item: toLibraryResponse(item, req) });
  } catch (error) {
    handleError(res, error, "Failed to create fitness item");
  }
};

const editFitness = async (req, res) => {
  try {
    const item = await updateFitnessItem({
      itemId: req.params.id,
      actor: req.libraryActor,
      title: req.body?.title,
      description: req.body?.description,
      category: req.body?.category,
    });
    res.json({ item: toLibraryResponse(item, req) });
  } catch (error) {
    handleError(res, error, "Failed to update fitness item");
  }
};

const createMusic = async (req, res) => {
  try {
    if (!req.body?.spotifyUrl && !req.body?.spotify_url) {
      return res.status(400).json({ error: "spotify_url is required" });
    }
    const item = await createMusicItem(req.body || {});
    res.status(201).json({ item: toLibraryResponse(item, req) });
  } catch (error) {
    handleError(res, error, "Failed to create music item");
  }
};

const editMusic = async (req, res) => {
  try {
    const item = await updateMusicItem({
      itemId: req.params.id,
      actor: req.libraryActor,
      title: req.body?.title,
      description: req.body?.description,
    });
    res.json({ item: toLibraryResponse(item, req) });
  } catch (error) {
    handleError(res, error, "Failed to update music item");
  }
};

const deleteLibraryItem = async (req, res) => {
  try {
    const item = await softDeleteItem(req.params.id, req.libraryActor);
    if (!item) return res.status(404).json({ error: "Library item not found" });
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete library item");
  }
};

const streamLibraryItem = async (req, res) => {
  try {
    const item = await getItemById(req.params.id);
    if (!item || item.status !== "active") {
      return res.status(404).json({ error: "Library item not found" });
    }
    if (!item.storagePath || !["image", "video"].includes(item.mediaType)) {
      return res.status(400).json({ error: "Streaming unavailable for this item" });
    }

    const streamPayload = openMediaStream({
      storagePath: item.storagePath,
      range: req.headers.range,
    });
    res.status(streamPayload.status);
    res.setHeader("Content-Type", item.mimeType);
    Object.entries(streamPayload.headers).forEach(([key, value]) => res.setHeader(key, value));
    streamPayload.stream.pipe(res);
  } catch (error) {
    handleError(res, error, "Failed to stream library item");
  }
};

const googlePlaceholder = (provider) => async (req, res) => {
  try {
    const { patientId, uploadedBy, externalId, externalUrl, previewUrl, mediaType, title, description } =
      req.body || {};
    if (!requirePatientId(patientId, res)) return;
    if (!externalId || !externalUrl) {
      return res.status(400).json({ error: "externalId and externalUrl are required" });
    }

    const item = await registerGoogleImportPlaceholder({
      patientId,
      uploadedBy,
      provider,
      externalId,
      externalUrl,
      previewUrl,
      mediaType,
      title,
      description,
    });
    res.status(201).json({ item: toLibraryResponse(item, req), placeholder: true });
  } catch (error) {
    handleError(res, error, "Failed to register Google import placeholder");
  }
};

const getAdminPatients = async (req, res) => {
  try {
    const items = await searchPatients(req.query.query || "");
    res.json({ items });
  } catch (error) {
    handleError(res, error, "Failed to fetch patients");
  }
};

// Compatibility endpoints for the in-progress frontend/library wiring already present in the repo.
const getOverview = async (req, res) => {
  try {
    const patientId = req.query.patientId;
    if (!requirePatientId(patientId, res)) return;
    const data = await getPatientLibrarySummary(patientId, req.libraryActor);
    res.json({
      counts: { memories: data.counts.memories, diaryMedia: data.counts.diaryMedia },
      latestMemories: data.memories.slice(0, 6).map((item) => toLibraryResponse(item, req)),
      latestDiaryMedia: data.diaryMedia.slice(0, 6).map((item) => toLibraryResponse(item, req)),
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch library overview");
  }
};

const getMediaList = async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const section = req.query.section;
    if (!requirePatientId(patientId, res)) return;
    const bucket = section === "diary" ? "diary" : "memories";
    const items = await listPatientBucketItems({ patientId, bucket });
    res.json({ items: items.map((item) => toLibraryResponse(item, req)) });
  } catch (error) {
    handleError(res, error, "Failed to fetch library media");
  }
};

const registerImport = async (req, res) => {
  const provider =
    req.body?.provider === "google_photos" ? "google_photos" : "google_drive";
  return googlePlaceholder(provider)(req, res);
};
const getMediaDetail = async (req, res) => {
  try {
    const item = await getItemById(req.params.mediaId);
    if (!item || item.status !== "active") {
      return res.status(404).json({ error: "Library item not found" });
    }
    res.json({ item: toLibraryResponse(item, req) });
  } catch (error) {
    handleError(res, error, "Failed to fetch media detail");
  }
};
const deleteMedia = async (req, res) => deleteLibraryItem({ ...req, params: { id: req.params.mediaId } }, res);
const getFitness = getPatientBucket("fitness");
const getMusic = getPatientBucket("music");

const getCurrentRoleBucket = (bucket) => async (req, res) => {
  try {
    const actor = req.libraryActor;
    const patientId = actor.role === "patient" ? actor.userId : "";
    const items = await getBucketItems({ bucket, patientId, actor });
    res.json({ items: items.map((item) => toLibraryResponse(item, req)) });
  } catch (error) {
    handleError(res, error, `Failed to fetch ${bucket} library items`);
  }
};

module.exports = {
  createFitness,
  createMusic,
  deleteLibraryItem,
  deleteMedia,
  editFitness,
  editMusic,
  getAdminPatients,
  getFitness,
  getMediaDetail,
  getMediaList,
  getMusic,
  getCurrentRoleBucket,
  getOverview,
  getPatientBucket,
  getPatientLibrary,
  googleDriveImportPlaceholder: googlePlaceholder("google_drive"),
  googlePhotosImportPlaceholder: googlePlaceholder("google_photos"),
  registerImport,
  streamLibraryItem,
  streamMedia: async (req, res) => streamLibraryItem({ ...req, params: { id: req.params.mediaId } }, res),
  upload,
  uploadCamera,
  uploadLibrary,
  uploadMedia: async (req, res) => uploadCommon({ req, res, isCamera: false }),
};
