const express = require("express");
const mongoose = require("mongoose");

const DeviceConnection = require("../models/DeviceConnection");

const router = express.Router();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

router.post("/connect", async (req, res) => {
  try {
    const { patientId, deviceName, sourceApp, connectedAt, lastSync } = req.body;

    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patientId",
      });
    }

    if (!deviceName || !String(deviceName).trim() || !sourceApp || !String(sourceApp).trim()) {
      return res.status(400).json({
        success: false,
        message: "patientId, deviceName and sourceApp are required",
      });
    }

    const parsedConnectedAt = connectedAt ? new Date(connectedAt) : new Date();
    const parsedLastSync = lastSync ? new Date(lastSync) : new Date();

    if (Number.isNaN(parsedConnectedAt.getTime()) || Number.isNaN(parsedLastSync.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid connectedAt or lastSync",
      });
    }

    await DeviceConnection.findOneAndUpdate(
      {
        patientId,
        deviceName: String(deviceName).trim(),
        sourceApp: String(sourceApp).trim(),
      },
      {
        $setOnInsert: {
          connectedAt: parsedConnectedAt,
        },
        $set: {
          lastSync: parsedLastSync,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Connect device error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to connect device",
    });
  }
});

router.get("/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patientId",
      });
    }

    const devices = await DeviceConnection.find({ patientId })
      .sort({ lastSync: -1, connectedAt: -1, _id: -1 })
      .lean();

    return res.status(200).json(devices);
  } catch (error) {
    console.error("Fetch device connections error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch device connections",
    });
  }
});

module.exports = router;
