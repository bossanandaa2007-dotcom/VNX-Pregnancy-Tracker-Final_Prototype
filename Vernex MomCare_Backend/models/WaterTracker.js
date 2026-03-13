const mongoose = require("mongoose");

const waterTrackerSchema = new mongoose.Schema(
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
      default: "ml",
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
    collection: "watertrackers",
  }
);

module.exports =
  mongoose.models.WaterTracker ||
  mongoose.model("WaterTracker", waterTrackerSchema);
