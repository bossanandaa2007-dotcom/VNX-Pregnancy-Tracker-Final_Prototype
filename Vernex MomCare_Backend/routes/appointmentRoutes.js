const express = require("express");
const router = express.Router();

const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const User = require("../models/User");

const VALID_STATUSES = new Set(["pending", "approved", "rejected", "completed"]);
const MUTABLE_STATUSES = new Set(["approved", "rejected"]);

const toDateOnly = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const serializeAppointment = (appt) => {
  const dateValue = appt.date ? new Date(appt.date).toISOString().slice(0, 10) : "";
  return {
    _id: appt._id,
    id: appt._id,
    patientId: typeof appt.patientId === "object" ? appt.patientId?._id : appt.patientId,
    patientName: typeof appt.patientId === "object" ? appt.patientId?.name || "" : "",
    doctorId: typeof appt.doctorId === "object" ? appt.doctorId?._id : appt.doctorId,
    doctorName: typeof appt.doctorId === "object" ? appt.doctorId?.name || "" : "",
    date: dateValue,
    time: appt.time || "",
    notes: appt.notes || "",
    patientNotes: appt.notes || "",
    doctorNotes: appt.doctorNotes || "",
    status: VALID_STATUSES.has(appt.status) ? appt.status : "pending",
    completedAt: appt.completedAt || null,
    createdAt: appt.createdAt,
    updatedAt: appt.updatedAt,
  };
};

// Patient books a new appointment.
router.post("/", async (req, res) => {
  try {
    const { patientId, doctorId: inputDoctorId, date, time, notes } = req.body;

    if (!patientId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "patientId, date and time are required",
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const doctorId = inputDoctorId || patient.doctorId;
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "No assigned doctor found for this patient",
      });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const appointmentDate = toDateOnly(date);
    if (!appointmentDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment date",
      });
    }

    const existing = await Appointment.findOne({
      doctorId,
      date: appointmentDate,
      time: String(time).trim(),
      status: { $in: ["pending", "approved"] },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This slot is already requested or booked",
      });
    }

    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      date: appointmentDate,
      time: String(time).trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
      status: "pending",
    });

    await appointment.populate("patientId", "name email");
    await appointment.populate("doctorId", "name email specialty");

    return res.status(201).json({
      success: true,
      message: "Appointment request sent",
      appointment: serializeAppointment(appointment.toObject()),
    });
  } catch (error) {
    console.error("Create appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create appointment",
    });
  }
});

// List appointments for one patient.
router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const appointments = await Appointment.find({ patientId })
      .populate("doctorId", "name email specialty")
      .sort({ date: 1, time: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      appointments: appointments.map((appt) => serializeAppointment(appt.toObject())),
    });
  } catch (error) {
    console.error("Fetch patient appointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
    });
  }
});

// List appointments for one doctor.
router.get("/doctor/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const appointments = await Appointment.find({ doctorId })
      .populate("patientId", "name email")
      .sort({ date: 1, time: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      appointments: appointments.map((appt) => serializeAppointment(appt.toObject())),
    });
  } catch (error) {
    console.error("Fetch doctor appointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
    });
  }
});

// Doctor updates appointment status (approve / reject).
router.put("/:appointmentId/status", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const doctorNotes =
      typeof req.body?.doctorNotes === "string" ? req.body.doctorNotes.trim() : "";

    if (!MUTABLE_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition",
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed appointments cannot be changed",
      });
    }

    appointment.status = status;
    if (status === "rejected") {
      appointment.doctorNotes = doctorNotes;
    }
    if (status !== "completed") {
      appointment.completedAt = null;
    }
    await appointment.save();

    await appointment.populate("patientId", "name email");
    await appointment.populate("doctorId", "name email specialty");

    return res.status(200).json({
      success: true,
      message: "Appointment status updated",
      appointment: serializeAppointment(appointment.toObject()),
    });
  } catch (error) {
    console.error("Update appointment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
    });
  }
});

// Doctor adds visit notes and moves the appointment to history.
router.put("/:appointmentId/doctor-notes", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorNotes = typeof req.body?.doctorNotes === "string" ? req.body.doctorNotes.trim() : "";

    if (!doctorNotes) {
      return res.status(400).json({
        success: false,
        message: "Doctor notes are required",
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appointment.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Rejected appointments cannot be completed",
      });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          doctorNotes,
          status: "completed",
          completedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    await updatedAppointment.populate("patientId", "name email");
    await updatedAppointment.populate("doctorId", "name email specialty");

    return res.status(200).json({
      success: true,
      message: "Doctor notes added",
      appointment: serializeAppointment(updatedAppointment.toObject()),
    });
  } catch (error) {
    console.error("Update appointment doctor notes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save doctor notes",
    });
  }
});

module.exports = router;
