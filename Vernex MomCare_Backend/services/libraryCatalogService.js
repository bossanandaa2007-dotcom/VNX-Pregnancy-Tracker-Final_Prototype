const mongoose = require("mongoose");
const LibraryItem = require("../models/LibraryItem");
const Patient = require("../models/Patient");
const fitnessSeed = require("../data/libraryFitnessSeed");
const musicSeed = require("../data/libraryMusicSeed");
const {
  buildSpotifyEmbedUrl,
  buildYouTubeEmbedUrl,
  extractSpotifyId,
  extractYouTubeId,
  fetchSpotifyMetadata,
  fetchYouTubeMetadata,
} = require("./libraryEmbedUtils");

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

const toFitnessSeedRecord = async (item) => {
  const youtubeUrl = String(item.youtubeUrl || item.youtube_url || "").trim();
  const youtubeVideoId = extractYouTubeId(youtubeUrl);
  const metadata = youtubeUrl ? await fetchYouTubeMetadata(youtubeUrl) : null;
  const normalizedCategory = normalizeFitnessCategory(item.category);
  const resolvedTitle = String(item.title || "").trim() || metadata?.title || "Pregnancy Fitness Video";
  const resolvedDescription =
    String(item.description || "").trim() ||
    metadata?.title ||
    "Recommended for safe workouts";

  return {
    patientId: null,
    uploadedBy: "system_seed",
    doctorId: "",
    bucket: "fitness",
    sourceType: "fitness_seed",
    mediaType: "youtube",
    isDefault: true,
    title: resolvedTitle,
    description: resolvedDescription,
    uploadedAt: new Date(),
    trimester: item.trimester || inferTrimesterFromCategory(normalizedCategory),
    category: normalizedCategory,
    youtubeVideoId,
    youtubeUrl,
    embedUrl: youtubeVideoId ? buildYouTubeEmbedUrl(youtubeVideoId) : "",
    sourceAuthority: metadata?.authorName || item.sourceAuthority || "YouTube",
    tags: Array.isArray(item.tags) ? item.tags : [],
    adminVisibility: "patient_admin",
    isEncrypted: false,
    encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
  };
};

const toMusicSeedRecord = async (item) => {
  const spotifyUrl = String(item.spotifyUrl || item.spotify_url || "").trim();
  const spotifyData = extractSpotifyId(spotifyUrl);
  const metadata = spotifyUrl ? await fetchSpotifyMetadata(spotifyUrl) : null;
  const resolvedTitle = String(item.title || "").trim() || "Relaxing Pregnancy Music";
  const resolvedDescription =
    String(item.description || "").trim() || "Recommended by your doctor";

  return {
    patientId: null,
    uploadedBy: "system_seed",
    doctorId: "",
    bucket: "music",
    sourceType: "music_seed",
    mediaType: "spotify",
    isDefault: true,
    title: resolvedTitle,
    description: resolvedDescription,
    uploadedAt: new Date(),
    trimester: item.trimester || "",
    category: String(item.category || "").trim(),
    spotifyId: spotifyData?.id || "",
    spotifyType: spotifyData?.type || "",
    spotifyUrl,
    embedUrl: spotifyData ? buildSpotifyEmbedUrl(spotifyData) : "",
    thumbnailPath: metadata?.thumbnailUrl || "",
    sourceAuthority: item.sourceAuthority || "Spotify",
    tags: Array.isArray(item.tags) ? item.tags : [],
    adminVisibility: "patient_admin",
    isEncrypted: false,
    encryptionMeta: { status: "not_enabled", keyRef: "", provider: "" },
  };
};

const syncSeedBucket = async ({ bucket, sourceType, idField, desiredRecords }) => {
  const activeDesiredIds = desiredRecords.map((item) => item[idField]).filter(Boolean);

  await LibraryItem.updateMany(
    {
      bucket,
      status: "active",
      $or: [{ isDefault: true }, { sourceType }],
      [idField]: { $nin: activeDesiredIds },
    },
    { status: "deleted" }
  );

  for (const record of desiredRecords) {
    const identityValue = record[idField];
    if (!identityValue) continue;

    await LibraryItem.findOneAndUpdate(
      {
        bucket,
        sourceType,
        [idField]: identityValue,
      },
      {
        ...record,
        status: "active",
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }
};

const syncMusicDefaults = async () => {
  const desiredRecords = await Promise.all(
    musicSeed.map(async (item, index) => {
      const record = await toMusicSeedRecord(item);
      const createdAt = new Date(Date.UTC(2026, 0, 1, 0, index, 0));
      return {
        ...record,
        createdAt,
        updatedAt: createdAt,
      };
    })
  );

  await syncSeedBucket({
    bucket: "music",
    sourceType: "music_seed",
    idField: "spotifyId",
    desiredRecords,
  });
};

const mergeMusicItems = (items) => {
  const hiddenDefaultIds = new Set();
  const overrideByDefaultId = new Map();
  const seededDefaults = [];
  const doctorAdded = [];

  for (const item of items) {
    if (item.sourceType === "doctor_music_hidden") {
      const key = String(item.defaultSpotifyId || item.spotifyId || "").trim();
      if (key) hiddenDefaultIds.add(key);
      continue;
    }

    if (item.sourceType === "doctor_music_override") {
      const key = String(item.defaultSpotifyId || item.spotifyId || "").trim();
      if (key) overrideByDefaultId.set(key, item);
      continue;
    }

    if (item.isDefault || item.sourceType === "music_seed") {
      seededDefaults.push(item);
      continue;
    }

    doctorAdded.push(item);
  }

  const mergedDefaults = seededDefaults
    .filter((item) => !hiddenDefaultIds.has(String(item.spotifyId || "").trim()))
    .map((item) => overrideByDefaultId.get(String(item.spotifyId || "").trim()) || item);

  return [...mergedDefaults, ...doctorAdded];
};

const mergeFitnessItems = (items) => {
  const hiddenDefaultIds = new Set();
  const overrideByDefaultId = new Map();
  const seededDefaults = [];
  const doctorAdded = [];

  for (const item of items) {
    if (item.sourceType === "doctor_fitness_hidden") {
      const key = String(item.defaultYouTubeVideoId || item.youtubeVideoId || "").trim();
      if (key) hiddenDefaultIds.add(key);
      continue;
    }

    if (item.sourceType === "doctor_fitness_override") {
      const key = String(item.defaultYouTubeVideoId || item.youtubeVideoId || "").trim();
      if (key) overrideByDefaultId.set(key, item);
      continue;
    }

    if (item.isDefault || item.sourceType === "fitness_seed") {
      seededDefaults.push(item);
      continue;
    }

    doctorAdded.push(item);
  }

  const mergedDefaults = seededDefaults
    .filter((item) => !hiddenDefaultIds.has(String(item.youtubeVideoId || "").trim()))
    .map((item) => overrideByDefaultId.get(String(item.youtubeVideoId || "").trim()) || item);

  return [...mergedDefaults, ...doctorAdded];
};

const syncFitnessDefaults = async () => {
  const desiredRecords = await Promise.all(
    fitnessSeed.map(async (item, index) => {
      const record = await toFitnessSeedRecord(item);
      const createdAt = new Date(Date.UTC(2026, 0, 1, 1, index, 0));
      return {
        ...record,
        createdAt,
        updatedAt: createdAt,
      };
    })
  );

  await syncSeedBucket({
    bucket: "fitness",
    sourceType: "fitness_seed",
    idField: "youtubeVideoId",
    desiredRecords,
  });
};

const seedCatalogIfNeeded = async () => {
  await syncFitnessDefaults();
  await syncMusicDefaults();
};

const getBucketItems = async ({ bucket, patientId, actor }) => {
  const query = { bucket, status: "active" };

  if (bucket === "memories" || bucket === "diary") {
    query.patientId = patientId;
  }

  if ((bucket === "fitness" || bucket === "music") && actor) {
    const seedSourceType = bucket === "fitness" ? "fitness_seed" : "music_seed";

    if (actor.role === "doctor") {
      query.$or = [{ isDefault: true }, { sourceType: seedSourceType }, { doctorId: actor.userId }];
    }

    if (actor.role === "patient") {
      const patient = mongoose.isValidObjectId(actor.userId)
        ? await Patient.findById(actor.userId).select("doctorId").lean()
        : null;
      const assignedDoctorId = patient?.doctorId ? String(patient.doctorId) : "";
      query.$or = [{ isDefault: true }, { sourceType: seedSourceType }];
      if (assignedDoctorId) {
        query.$or.push({ doctorId: assignedDoctorId });
      }
    }
  }

  const sort =
    bucket === "fitness" || bucket === "music"
      ? { isDefault: -1, createdAt: -1 }
      : { createdAt: -1 };

  const items = await LibraryItem.find(query).sort(sort).lean();
  if (bucket === "fitness") {
    return mergeFitnessItems(items);
  }
  if (bucket === "music") {
    return mergeMusicItems(items);
  }
  return items;
};

module.exports = {
  getBucketItems,
  seedCatalogIfNeeded,
};
