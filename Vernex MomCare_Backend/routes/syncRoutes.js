const express = require("express");
const mongoose = require("mongoose");

const { syncWearableMetric } = require("../services/syncService");

const router = express.Router();

const parseSyncPayload = (body) => {
  const { patientId, value, recordedAt, source = "", device = "" } = body;
  const numericValue = Number(value);
  const parsedRecordedAt = new Date(recordedAt);

  if (!mongoose.Types.ObjectId.isValid(patientId)) {
    return { error: "Invalid patientId" };
  }

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { error: "Invalid value" };
  }

  if (Number.isNaN(parsedRecordedAt.getTime())) {
    return { error: "Invalid recordedAt" };
  }

  return {
    payload: {
      patientId,
      value: numericValue,
      recordedAt: parsedRecordedAt,
      source,
      device,
    },
  };
};

const createSyncHandler = (metric) => async (req, res) => {
  try {
    const { error, payload } = parseSyncPayload(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    await syncWearableMetric(metric, payload);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error(`Sync ${metric} error:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to sync ${metric} data`,
    });
  }
};

router.post("/steps", createSyncHandler("steps"));
router.post("/heartrate", createSyncHandler("heartrate"));
router.post("/spo2", createSyncHandler("spo2"));
router.post("/sleep", createSyncHandler("sleep"));
router.post("/water", createSyncHandler("water"));
router.post("/weight", createSyncHandler("weight"));
router.post("/calories", createSyncHandler("calories"));

module.exports = router;
