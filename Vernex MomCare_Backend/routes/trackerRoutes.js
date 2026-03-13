const express = require("express");
const mongoose = require("mongoose");

const {
  StepsTracker,
  HeartRateTracker,
  Spo2Tracker,
  SleepTracker,
  WaterTracker,
  WeightTracker,
  CaloriesTracker,
} = require("../models/trackerModels");

const router = express.Router();

const TRACKER_CONFIG = {
  steps: StepsTracker,
  heartrate: HeartRateTracker,
  spo2: Spo2Tracker,
  sleep: SleepTracker,
  water: WaterTracker,
  weight: WeightTracker,
  calories: CaloriesTracker,
};

const LIST_SORT = { recordedAt: -1, createdAt: -1, _id: -1 };
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const parseBasePayload = (body) => {
  const { patientId, value, recordedAt, source = "", device = "", unit } = body;
  const numericValue = Number(value);
  const parsedRecordedAt = recordedAt ? new Date(recordedAt) : new Date();

  if (!isValidObjectId(patientId)) {
    return { error: "Invalid patientId" };
  }

  if (!Number.isFinite(numericValue)) {
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
      ...(unit ? { unit: String(unit).trim() } : {}),
    },
  };
};

const buildSleepPayload = (basePayload, body) => {
  const duration = body.duration !== undefined ? Number(body.duration) : basePayload.value;
  const parsedEndTime = body.endTime ? new Date(body.endTime) : basePayload.recordedAt;
  const parsedStartTime = body.startTime
    ? new Date(body.startTime)
    : new Date(parsedEndTime.getTime() - duration * 60 * 60 * 1000);

  if (!Number.isFinite(duration) || duration < 0) {
    return { error: "Invalid duration" };
  }

  if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
    return { error: "Invalid startTime or endTime" };
  }

  return {
    payload: {
      ...basePayload,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      duration,
    },
  };
};

const serializeTrackerRecord = (metric, record) => {
  const baseRecord = {
    _id: record._id,
    patientId: record.patientId,
    value: record.value,
    unit: record.unit,
    source: record.source || "",
    device: record.device || "",
    recordedAt: record.recordedAt,
    createdAt: record.createdAt,
  };

  if (metric === "sleep") {
    return {
      ...baseRecord,
      startTime: record.startTime,
      endTime: record.endTime,
      duration: record.duration,
    };
  }

  return baseRecord;
};

const createPostHandler = (metric) => async (req, res) => {
  try {
    const { error, payload: basePayload } = parseBasePayload(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const Model = TRACKER_CONFIG[metric];
    const finalPayload =
      metric === "sleep" ? buildSleepPayload(basePayload, req.body) : { payload: basePayload };

    if (finalPayload.error) {
      return res.status(400).json({
        success: false,
        message: finalPayload.error,
      });
    }

    const record = await Model.create(finalPayload.payload);

    return res.status(201).json({
      success: true,
      tracker: serializeTrackerRecord(metric, record.toObject()),
    });
  } catch (error) {
    console.error(`Create ${metric} tracker error:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to create ${metric} tracker entry`,
    });
  }
};

const createGetHandler = (metric) => async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patientId",
      });
    }

    const Model = TRACKER_CONFIG[metric];
    const records = await Model.find({ patientId }).sort(LIST_SORT).lean();

    return res.status(200).json(records.map((record) => serializeTrackerRecord(metric, record)));
  } catch (error) {
    console.error(`Fetch ${metric} tracker error:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to fetch ${metric} tracker entries`,
    });
  }
};

router.post("/steps", createPostHandler("steps"));
router.post("/heartrate", createPostHandler("heartrate"));
router.post("/spo2", createPostHandler("spo2"));
router.post("/sleep", createPostHandler("sleep"));
router.post("/water", createPostHandler("water"));
router.post("/weight", createPostHandler("weight"));
router.post("/calories", createPostHandler("calories"));

router.get("/steps/:patientId", createGetHandler("steps"));
router.get("/heartrate/:patientId", createGetHandler("heartrate"));
router.get("/spo2/:patientId", createGetHandler("spo2"));
router.get("/sleep/:patientId", createGetHandler("sleep"));
router.get("/water/:patientId", createGetHandler("water"));
router.get("/weight/:patientId", createGetHandler("weight"));
router.get("/calories/:patientId", createGetHandler("calories"));

module.exports = router;
