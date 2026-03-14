const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdByRole: {
      type: String,
      enum: ["patient", "doctor"],
      required: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
    },
    intervalLabel: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    notifyTimes: {
      type: [String],
      default: [],
    },
    completedDate: {
      type: String,
      default: null,
    },
    completedTimes: {
      type: [String],
      default: [],
    },
    isDone: {
      type: Boolean,
      default: false,
    },
    lastMarkedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model("Reminder", reminderSchema);
