const express = require("express");
const mongoose = require("mongoose");

const {
  getAnalyticsHistoryByPatient,
  getAnalyticsSummaryByPatient,
} = require("../services/analyticsService");

const router = express.Router();

const validatePatientId = (patientId, res) => {
  if (!mongoose.Types.ObjectId.isValid(patientId)) {
    res.status(400).json({
      success: false,
      message: "Invalid patientId",
    });
    return false;
  }

  return true;
};

const createHistoryRouteHandler = (metric) => async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!validatePatientId(patientId, res)) {
      return;
    }

    const history = await getAnalyticsHistoryByPatient(metric, patientId);
    return res.status(200).json(history);
  } catch (error) {
    console.error(`Analytics ${metric} history error:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to load ${metric} history`,
    });
  }
};

router.get("/summary/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!validatePatientId(patientId, res)) {
      return;
    }

    const analyticsSummary = await getAnalyticsSummaryByPatient(patientId);

    return res.status(200).json({
      steps: analyticsSummary.latestSteps,
      heartRate: analyticsSummary.latestHeartRate,
      spo2: analyticsSummary.latestSpo2,
      weight: analyticsSummary.latestWeight,
      water: analyticsSummary.latestWater,
      calories: analyticsSummary.latestCalories,
      sleep: analyticsSummary.lastSleepDuration,
    });
  } catch (error) {
    console.error("Analytics summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load analytics summary",
    });
  }
});

router.get("/history/steps/:patientId", createHistoryRouteHandler("steps"));
router.get("/history/heartrate/:patientId", createHistoryRouteHandler("heartrate"));
router.get("/history/spo2/:patientId", createHistoryRouteHandler("spo2"));
router.get("/history/sleep/:patientId", createHistoryRouteHandler("sleep"));
router.get("/history/water/:patientId", createHistoryRouteHandler("water"));
router.get("/history/weight/:patientId", createHistoryRouteHandler("weight"));
router.get("/history/calories/:patientId", createHistoryRouteHandler("calories"));

module.exports = router;
