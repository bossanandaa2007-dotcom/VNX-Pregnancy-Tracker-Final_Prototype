const express = require("express");
const {
  createFitness,
  createMusic,
  deleteLibraryItem,
  deleteMedia,
  editFitness,
  editMusic,
  getAdminPatients,
  getCurrentRoleBucket,
  getFitness,
  getMediaDetail,
  getMediaList,
  getMusic,
  getOverview,
  getPatientBucket,
  getPatientLibrary,
  googleDriveImportPlaceholder,
  googlePhotosImportPlaceholder,
  registerImport,
  streamLibraryItem,
  streamMedia,
  upload,
  uploadCamera,
  uploadLibrary,
  uploadMedia,
} = require("../controllers/libraryController");
const {
  authorizeLibraryItemDelete,
  authorizeLibraryItemRead,
  requireLibraryActor,
  requirePatientSelfAccess,
  requireRole,
} = require("../middleware/libraryAccess");

const router = express.Router();

router.use(requireLibraryActor);

// Requested contract
router.post("/upload", requireRole("patient"), upload.single("file"), requirePatientSelfAccess, uploadLibrary);
router.post("/upload-camera", requireRole("patient"), upload.single("file"), requirePatientSelfAccess, uploadCamera);
router.get("/patient/:patientId", requirePatientSelfAccess, getPatientLibrary);
router.get("/patient/:patientId/memories", requirePatientSelfAccess, getPatientBucket("memories"));
router.get("/patient/:patientId/diary-media", requirePatientSelfAccess, getPatientBucket("diary"));
router.get("/patient/:patientId/fitness", requirePatientSelfAccess, getPatientBucket("fitness"));
router.get("/patient/:patientId/music", requirePatientSelfAccess, getPatientBucket("music"));
router.post("/fitness", requireRole("doctor"), createFitness);
router.put("/fitness/:id", requireRole("doctor"), editFitness);
router.post("/music", requireRole("doctor"), createMusic);
router.put("/music/:id", requireRole("doctor"), editMusic);
router.delete("/item/:id", authorizeLibraryItemDelete, deleteLibraryItem);
router.get("/item/:id/stream", authorizeLibraryItemRead, streamLibraryItem);
router.post("/google/import/google-photos", requireRole("patient"), requirePatientSelfAccess, googlePhotosImportPlaceholder);
router.post("/google/import/google-drive", requireRole("patient"), requirePatientSelfAccess, googleDriveImportPlaceholder);

// Compatibility aliases for the existing in-repo Library wiring.
router.get("/overview", requireRole("patient"), requirePatientSelfAccess, getOverview);
router.get("/media", requireRole("patient"), requirePatientSelfAccess, getMediaList);
router.post("/media/upload", requireRole("patient"), upload.single("file"), requirePatientSelfAccess, uploadMedia);
router.post("/media/register-import", requireRole("patient"), requirePatientSelfAccess, registerImport);
router.get("/media/:mediaId", authorizeLibraryItemRead, getMediaDetail);
router.get("/media/:mediaId/stream", authorizeLibraryItemRead, streamMedia);
router.delete("/media/:mediaId", authorizeLibraryItemDelete, deleteMedia);
router.get("/fitness", requireRole("doctor", "patient"), getCurrentRoleBucket("fitness"));
router.get("/music", requireRole("doctor", "patient"), getCurrentRoleBucket("music"));
router.get("/admin/patients", requireRole("doctor"), getAdminPatients);

module.exports = router;
