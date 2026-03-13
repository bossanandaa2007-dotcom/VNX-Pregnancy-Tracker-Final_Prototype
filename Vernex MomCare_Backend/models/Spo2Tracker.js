const mongoose = require("mongoose");

const spo2TrackerSchema = new mongoose.Schema(
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
      default: "%",
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
    collection: "spo2trackers",
  }
);

module.exports =
  mongoose.models.Spo2Tracker ||
  mongoose.model("Spo2Tracker", spo2TrackerSchema);
