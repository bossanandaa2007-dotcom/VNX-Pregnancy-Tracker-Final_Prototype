const mongoose = require("mongoose");

const libraryImportItemSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["google_photos", "google_drive"],
      required: true,
      index: true,
    },
    externalId: { type: String, required: true },
    externalUrl: { type: String, required: true },
    previewUrl: { type: String, default: "" },
    mediaType: {
      type: String,
      enum: ["photo", "video"],
      required: true,
    },
    importStatus: {
      type: String,
      enum: ["registered", "linked", "failed"],
      default: "registered",
    },
    importedLibraryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LibraryItem",
      default: null,
    },
  },
  { timestamps: true }
);

libraryImportItemSchema.index({ patientId: 1, provider: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model("LibraryImportItem", libraryImportItemSchema);
