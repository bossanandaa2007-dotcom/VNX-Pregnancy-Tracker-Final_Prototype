const express = require("express");
const router = express.Router();

const Reminder = require("../models/Reminder");
const Patient = require("../models/Patient");
const User = require("../models/User");

const serializeReminder = (reminder) => ({
  _id: reminder._id,
  id: reminder._id,
  patientId:
    typeof reminder.patientId === "object" ? reminder.patientId?._id : reminder.patientId,
  patientName:
    typeof reminder.patientId === "object" ? reminder.patientId?.name || "" : "",
  doctorId: typeof reminder.doctorId === "object" ? reminder.doctorId?._id : reminder.doctorId,
  doctorName:
    typeof reminder.doctorId === "object" ? reminder.doctorId?.name || "" : "",
  createdByRole: reminder.createdByRole,
  createdById: reminder.createdById,
  title: reminder.title || "",
  details: reminder.details || "",
  intervalLabel: reminder.intervalLabel || "",
  startDate: reminder.startDate || null,
  endDate: reminder.endDate || null,
  notifyTimes: Array.isArray(reminder.notifyTimes) ? reminder.notifyTimes : [],
  completedDate: reminder.completedDate || null,
  completedTimes: Array.isArray(reminder.completedTimes) ? reminder.completedTimes : [],
  isDone: !!reminder.isDone,
  lastMarkedAt: reminder.lastMarkedAt || null,
  createdAt: reminder.createdAt,
  updatedAt: reminder.updatedAt,
});

const normalizeTimes = (values) =>
  Array.isArray(values)
    ? [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort()
    : [];

const normalizeDateKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const getPatientAndDoctor = async (patientId) => {
  const patient = await Patient.findById(patientId);
  if (!patient) return { error: "Patient not found" };

  const doctor = await User.findById(patient.doctorId);
  if (!doctor || doctor.role !== "doctor") {
    return { error: "Assigned doctor not found" };
  }

  return { patient, doctor };
};

const canManageReminder = (reminder, actorRole, actorId) =>
  String(reminder.createdByRole) === String(actorRole) &&
  String(reminder.createdById) === String(actorId);

router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId } = req.query;

    const { patient, error } = await getPatientAndDoctor(patientId);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (doctorId && String(patient.doctorId) !== String(doctorId)) {
      return res.status(403).json({
        success: false,
        message: "Doctor is not assigned to this patient",
      });
    }

    const reminders = await Reminder.find({ patientId })
      .populate("patientId", "name")
      .populate("doctorId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reminders: reminders.map((item) => serializeReminder(item.toObject())),
    });
  } catch (error) {
    console.error("Fetch reminders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reminders",
    });
  }
});

router.post("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { actorRole, actorId, title, details, intervalLabel, notifyTimes, startDate, endDate } = req.body;

    if (!actorRole || !actorId || !title || !intervalLabel) {
      return res.status(400).json({
        success: false,
        message: "actorRole, actorId, title and intervalLabel are required",
      });
    }

    const { patient, doctor, error } = await getPatientAndDoctor(patientId);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (actorRole === "patient") {
      if (String(patient._id) !== String(actorId)) {
        return res.status(403).json({
          success: false,
          message: "Patient can only create reminders for their own profile",
        });
      }
    } else if (actorRole === "doctor") {
      if (String(doctor._id) !== String(actorId)) {
        return res.status(403).json({
          success: false,
          message: "Doctor can only create reminders for assigned patients",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid actor role",
      });
    }

    const reminder = await Reminder.create({
      patientId: patient._id,
      doctorId: doctor._id,
      createdByRole: actorRole,
      createdById: actorId,
      title: String(title).trim(),
      details: typeof details === "string" ? details.trim() : "",
      intervalLabel: String(intervalLabel).trim(),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      notifyTimes: normalizeTimes(notifyTimes),
    });

    await reminder.populate("patientId", "name");
    await reminder.populate("doctorId", "name");

    return res.status(201).json({
      success: true,
      message: "Reminder created successfully",
      reminder: serializeReminder(reminder.toObject()),
    });
  } catch (error) {
    console.error("Create reminder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create reminder",
    });
  }
});

router.put("/:reminderId", async (req, res) => {
  try {
    const { reminderId } = req.params;
    const { actorRole, actorId, title, details, intervalLabel, notifyTimes, startDate, endDate } = req.body;

    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    if (!canManageReminder(reminder, actorRole, actorId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this reminder",
      });
    }

    if (typeof title === "string" && title.trim()) reminder.title = title.trim();
    if (typeof details === "string") reminder.details = details.trim();
    if (typeof intervalLabel === "string" && intervalLabel.trim()) {
      reminder.intervalLabel = intervalLabel.trim();
    }
    if (Array.isArray(notifyTimes)) {
      reminder.notifyTimes = normalizeTimes(notifyTimes);
      reminder.completedTimes = normalizeTimes(reminder.completedTimes).filter((value) =>
        reminder.notifyTimes.includes(value)
      );
      reminder.isDone =
        reminder.notifyTimes.length > 0 &&
        reminder.completedTimes.length >= reminder.notifyTimes.length;
      if (reminder.completedTimes.length === 0) {
        reminder.lastMarkedAt = null;
      }
    }
    if (startDate !== undefined) {
      reminder.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      reminder.endDate = endDate ? new Date(endDate) : null;
    }

    await reminder.save();
    await reminder.populate("patientId", "name");
    await reminder.populate("doctorId", "name");

    return res.status(200).json({
      success: true,
      message: "Reminder updated successfully",
      reminder: serializeReminder(reminder.toObject()),
    });
  } catch (error) {
    console.error("Update reminder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update reminder",
    });
  }
});

router.delete("/:reminderId", async (req, res) => {
  try {
    const { reminderId } = req.params;
    const { actorRole, actorId } = req.body;

    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    if (!canManageReminder(reminder, actorRole, actorId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this reminder",
      });
    }

    await Reminder.findByIdAndDelete(reminderId);

    return res.status(200).json({
      success: true,
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    console.error("Delete reminder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete reminder",
    });
  }
});

router.patch("/:reminderId/status", async (req, res) => {
  try {
    const { reminderId } = req.params;
    const { patientId, isDone, time, dateKey } = req.body;

    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    if (!patientId || String(reminder.patientId) !== String(patientId)) {
      return res.status(403).json({
        success: false,
        message: "Patient can only update their own reminders",
      });
    }

    const normalizedNotifyTimes = normalizeTimes(reminder.notifyTimes);
    const normalizedDateKey =
      normalizeDateKey(dateKey) || new Date().toISOString().slice(0, 10);
    const targetTime = typeof time === "string" ? time.trim() : normalizedNotifyTimes[0] || "default";

    if (normalizedNotifyTimes.length > 0 && !normalizedNotifyTimes.includes(targetTime)) {
      return res.status(400).json({
        success: false,
        message: "Reminder time is invalid",
      });
    }

    const sameDay = reminder.completedDate === normalizedDateKey;
    const completedTimes = sameDay ? normalizeTimes(reminder.completedTimes) : [];

    reminder.completedDate = normalizedDateKey;
    reminder.completedTimes = !!isDone
      ? normalizeTimes([...completedTimes, targetTime])
      : completedTimes.filter((value) => value !== targetTime);
    reminder.isDone =
      normalizedNotifyTimes.length > 0
        ? reminder.completedTimes.length >= normalizedNotifyTimes.length
        : reminder.completedTimes.length > 0;
    reminder.lastMarkedAt = reminder.completedTimes.length > 0 ? new Date() : null;
    await reminder.save();
    await reminder.populate("patientId", "name");
    await reminder.populate("doctorId", "name");

    return res.status(200).json({
      success: true,
      message: "Reminder status updated successfully",
      reminder: serializeReminder(reminder.toObject()),
    });
  } catch (error) {
    console.error("Update reminder status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update reminder status",
    });
  }
});

module.exports = router;
