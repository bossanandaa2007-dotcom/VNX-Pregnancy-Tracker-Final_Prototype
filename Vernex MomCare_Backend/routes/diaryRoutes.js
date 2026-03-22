const express = require("express");
const DiaryEntry = require("../models/DiaryEntry");
const {
  attachDiaryMedia,
  migrateLegacyDiaryImages,
  resolveDiaryMediaRefs,
  toLibraryResponse,
} = require("../services/libraryMediaService");

const router = express.Router();

const normalizeDate = (raw) => {
  if (!raw) return "";
  const asString = String(raw).trim();
  // expected format from frontend input[type=date]: yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeMonth = (raw) => {
  if (!raw) return "";
  const asString = String(raw).trim();
  return /^\d{4}-\d{2}$/.test(asString) ? asString : "";
};

const normalizeImages = (rawImages, legacyImage) => {
  if (Array.isArray(rawImages)) {
    const cleaned = rawImages
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }

  if (legacyImage) {
    const single = String(legacyImage).trim();
    return single ? [single] : [];
  }

  return [];
};

const buildDiaryEntryResponse = async (req, entry) => {
  const fallbackImages = normalizeImages(entry.images, entry.imageData);
  let diaryMedia = await resolveDiaryMediaRefs({
    entryId: entry._id,
    mediaRefs: entry.mediaRefs,
    patientId: entry.userId || entry.patientId,
  });

  if (diaryMedia.length === 0 && fallbackImages.length > 0) {
    diaryMedia = await migrateLegacyDiaryImages(req, entry);
  }

  return {
    ...entry.toObject(),
    images: fallbackImages,
    imageData: fallbackImages[0] || "",
    mediaRefs:
      Array.isArray(entry.mediaRefs) && entry.mediaRefs.length > 0
        ? entry.mediaRefs.map((value) => String(value?._id || value))
        : diaryMedia.map((item) => String(item._id)),
    mediaItems: diaryMedia.map((item) => toLibraryResponse(item, req)),
  };
};

// Get entry dates for a month
router.get("/dates", async (req, res) => {
  try {
    const patientId = req.query.patientId || req.query.userId;
    const normalizedMonth = normalizeMonth(req.query.month);
    if (!patientId) return res.status(400).json({ error: "Patient ID required" });
    if (!normalizedMonth) return res.status(400).json({ error: "Valid month required" });

    const nextMonthDate = new Date(`${normalizedMonth}-01T00:00:00Z`);
    nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
    const nextMonth = nextMonthDate.toISOString().slice(0, 7);

    const entries = await DiaryEntry.find({
      $and: [
        { $or: [{ patientId }, { userId: patientId }] },
        {
          $or: [
            { entryDate: { $gte: `${normalizedMonth}-01`, $lt: `${nextMonth}-01` } },
            { date: { $gte: `${normalizedMonth}-01`, $lt: `${nextMonth}-01` } },
          ],
        },
      ],
    })
      .select("entryDate date")
      .lean();

    const dates = Array.from(
      new Set(
        entries
          .map((entry) => entry.date || entry.entryDate)
          .filter(Boolean)
      )
    ).sort();

    res.json({ dates });
  } catch (err) {
    console.error("Diary dates fetch error:", err);
    res.status(500).json({ error: "Failed to fetch diary dates" });
  }
});

// Get entry for a date
router.get("/", async (req, res) => {
  try {
    const patientId = req.query.patientId || req.query.userId;
    const { date } = req.query;
    if (!patientId) return res.status(400).json({ error: "Patient ID required" });
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return res.status(400).json({ error: "Valid date required" });

    const entry = await DiaryEntry.findOne({
      $or: [
        { patientId, entryDate: normalizedDate },
        { userId: patientId, date: normalizedDate },
      ],
    });
    if (!entry) {
      return res.json({ entry: null });
    }
    res.json({ entry: await buildDiaryEntryResponse(req, entry) });
  } catch (err) {
    console.error("Diary fetch error:", err);
    res.status(500).json({ error: "Failed to fetch diary entry" });
  }
});

// Create or update entry
router.post("/upsert", async (req, res) => {
  try {
    const patientId = req.body?.patientId || req.body?.userId;
    const { date, text, mood, imageData, images, mediaRefs } = req.body;
    if (!patientId) return res.status(400).json({ error: "Patient ID required" });
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return res.status(400).json({ error: "Valid date required" });

    const normalizedImages = normalizeImages(images, imageData);

    const update = {
      text: text || "",
      mood: mood || undefined,
      imageData: normalizedImages[0] || "",
      images: normalizedImages,
      mediaRefs: Array.isArray(mediaRefs) ? mediaRefs.filter(Boolean) : [],
    };

    let entry = await DiaryEntry.findOne({
      $or: [
        { patientId, entryDate: normalizedDate },
        { userId: patientId, date: normalizedDate },
      ],
    });

    if (!entry) {
      entry = new DiaryEntry({
        patientId,
        userId: patientId,
        date: normalizedDate,
        entryDate: normalizedDate,
        ...update,
      });
    } else {
      entry.patientId = patientId;
      entry.userId = patientId;
      entry.date = normalizedDate;
      entry.entryDate = normalizedDate;
      entry.text = update.text;
      entry.mood = update.mood;
      entry.imageData = update.imageData;
      entry.images = update.images;
      entry.mediaRefs = update.mediaRefs;
    }

    await entry.save();
    await attachDiaryMedia({ entry, mediaIds: update.mediaRefs });
    res.json({ entry: await buildDiaryEntryResponse(req, entry) });
  } catch (err) {
    console.error("Diary upsert error:", err);
    res.status(500).json({ error: "Failed to save diary entry" });
  }
});

module.exports = router;
