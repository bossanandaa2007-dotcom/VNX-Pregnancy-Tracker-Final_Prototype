const {
  StepsTracker,
  HeartRateTracker,
  Spo2Tracker,
  SleepTracker,
  WaterTracker,
  WeightTracker,
  CaloriesTracker,
} = require("../models/trackerModels");

const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;
const SYNC_MODEL_CONFIG = {
  steps: StepsTracker,
  heartrate: HeartRateTracker,
  spo2: Spo2Tracker,
  water: WaterTracker,
  weight: WeightTracker,
  calories: CaloriesTracker,
};

const buildBasePayload = ({ patientId, value, recordedAt, source, device }) => ({
  patientId,
  value,
  recordedAt,
  source,
  device,
});

const createTrackerRecord = async (metric, payload) => {
  const Model = SYNC_MODEL_CONFIG[metric];

  if (!Model) {
    throw new Error(`Unsupported sync metric: ${metric}`);
  }

  await Model.create(buildBasePayload(payload));
};

const createSleepTrackerRecord = async (payload) => {
  const endTime = payload.recordedAt;
  const duration = payload.value;
  const startTime = new Date(endTime.getTime() - duration * HOURS_TO_MILLISECONDS);

  await SleepTracker.create({
    ...buildBasePayload(payload),
    duration,
    startTime,
    endTime,
  });
};

const syncWearableMetric = async (metric, payload) => {
  if (metric === "sleep") {
    await createSleepTrackerRecord(payload);
    return;
  }

  await createTrackerRecord(metric, payload);
};

module.exports = {
  syncWearableMetric,
};
