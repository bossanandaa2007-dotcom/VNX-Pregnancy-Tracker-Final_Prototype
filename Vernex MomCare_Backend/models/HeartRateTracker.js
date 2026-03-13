const mongoose = require("mongoose");

const heartRateTrackerSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      default: "bpm",
    },
    source: {
      type: String,
      default: "",
    },
    device: {
      type: String,
      default: "",
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "heartratetrackers",
  }
);

module.exports =
  mongoose.models.HeartRateTracker ||
  mongoose.model("HeartRateTracker", heartRateTrackerSchema);
