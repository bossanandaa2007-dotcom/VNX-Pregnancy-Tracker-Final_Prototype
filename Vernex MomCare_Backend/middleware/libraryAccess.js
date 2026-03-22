const LibraryItem = require("../models/LibraryItem");
const Patient = require("../models/Patient");

const getActorFromHeaders = (req) => {
  const role = String(req.headers["x-user-role"] || req.query.libraryUserRole || "").trim().toLowerCase();
  const userId = String(req.headers["x-user-id"] || req.query.libraryUserId || "").trim();

  if (!role || !userId) return null;
  if (!["doctor", "patient"].includes(role)) return null;

  return { role, userId };
};

const requireLibraryActor = (req, res, next) => {
  const actor = getActorFromHeaders(req);
  if (!actor) {
    return res.status(401).json({ error: "Library authorization headers are required" });
  }

  req.libraryActor = actor;
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  const actor = req.libraryActor;
  if (!actor || !roles.includes(actor.role)) {
    return res.status(403).json({ error: "You are not allowed to access this library resource" });
  }
  next();
};

const requirePatientSelfAccess = (req, res, next) => {
  const actor = req.libraryActor;
  const patientId = String(req.params.patientId || req.query.patientId || req.body.patientId || "");

  if (!actor || actor.role !== "patient") {
    return res.status(403).json({ error: "Only patients can access personal media" });
  }

  if (!patientId || patientId !== actor.userId) {
    return res.status(403).json({ error: "Patient media access is limited to your own account" });
  }

  next();
};

const authorizeLibraryItemDelete = async (req, res, next) => {
  try {
    const actor = req.libraryActor;
    const item = await LibraryItem.findById(req.params.id || req.params.mediaId);
    if (!item || item.status !== "active") {
      return res.status(404).json({ error: "Library item not found" });
    }

    if (actor.role === "patient") {
      const ownsPersonalMedia =
        ["memories", "diary"].includes(item.bucket) &&
        String(item.patientId || "") === actor.userId;

      if (!ownsPersonalMedia) {
        return res.status(403).json({ error: "Patients can only delete their own personal media" });
      }
    }

    if (actor.role === "doctor") {
      const ownsGuidedContent =
        (item.bucket === "fitness" && (item.isDefault || item.sourceType === "fitness_seed")) ||
        (item.bucket === "music" && (item.isDefault || item.sourceType === "music_seed")) ||
        (["fitness", "music"].includes(item.bucket) && String(item.doctorId || "") === actor.userId);

      if (!ownsGuidedContent) {
        return res.status(403).json({ error: "Doctors can only delete their own guided content" });
      }
    }

    req.libraryItem = item;
    next();
  } catch (error) {
    next(error);
  }
};

const authorizeLibraryItemRead = async (req, res, next) => {
  try {
    const actor = req.libraryActor;
    const item = await LibraryItem.findById(req.params.id || req.params.mediaId);
    if (!item || item.status !== "active") {
      return res.status(404).json({ error: "Library item not found" });
    }

    if (actor.role === "patient") {
      const canReadPersonalMedia =
        ["memories", "diary"].includes(item.bucket) &&
        String(item.patientId || "") === actor.userId;
      let canReadGuidedContent = false;
      if (["fitness", "music"].includes(item.bucket)) {
        const patient = await Patient.findById(actor.userId).select("doctorId").lean();
        const assignedDoctorId = patient?.doctorId ? String(patient.doctorId) : "";
        canReadGuidedContent =
          Boolean(item.isDefault) ||
          /_seed$/.test(String(item.sourceType || "")) ||
          (assignedDoctorId && String(item.doctorId || "") === assignedDoctorId);
      }

      if (!canReadPersonalMedia && !canReadGuidedContent) {
        return res.status(403).json({ error: "You are not allowed to access this library item" });
      }
    }

    if (actor.role === "doctor") {
      const canReadGuidedContent =
        ["fitness", "music"].includes(item.bucket) &&
        (item.isDefault || String(item.doctorId || "") === actor.userId || /_seed$/.test(String(item.sourceType || "")));

      if (!canReadGuidedContent) {
        return res.status(403).json({ error: "Doctors cannot access patient personal media" });
      }
    }

    req.libraryItem = item;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authorizeLibraryItemDelete,
  authorizeLibraryItemRead,
  requireLibraryActor,
  requirePatientSelfAccess,
  requireRole,
};
