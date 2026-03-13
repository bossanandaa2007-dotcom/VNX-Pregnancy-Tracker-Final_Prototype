const mongoose = require("mongoose");

const stepsTrackerSchema = new mongoose.Schema(
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
      default: "steps",
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
    collection: "stepstrackers",
  }
);

module.exports =
  mongoose.models.StepsTracker ||
  mongoose.model("StepsTracker", stepsTrackerSchema);
