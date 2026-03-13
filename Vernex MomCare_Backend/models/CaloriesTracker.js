const mongoose = require("mongoose");

const caloriesTrackerSchema = new mongoose.Schema(
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
      default: "kcal",
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
    collection: "caloriestrackers",
  }
);

module.exports =
  mongoose.models.CaloriesTracker ||
  mongoose.model("CaloriesTracker", caloriesTrackerSchema);
