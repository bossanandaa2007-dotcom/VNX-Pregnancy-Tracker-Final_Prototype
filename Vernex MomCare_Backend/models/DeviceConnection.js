const mongoose = require("mongoose");

const deviceConnectionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    deviceName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceApp: {
      type: String,
      required: true,
      trim: true,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "deviceconnections",
  }
);

deviceConnectionSchema.index(
  { patientId: 1, deviceName: 1, sourceApp: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.DeviceConnection ||
  mongoose.model("DeviceConnection", deviceConnectionSchema);
