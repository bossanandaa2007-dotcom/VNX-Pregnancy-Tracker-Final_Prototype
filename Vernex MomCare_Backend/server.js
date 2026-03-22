const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const aiRoutes = require("./routes/aiRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const diaryRoutes = require("./routes/diaryRoutes");
const pregnancyRoutes = require("./routes/pregnancyRoutes");
const messageRoutes = require("./routes/messageRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const trackerRoutes = require("./routes/trackerRoutes");
const syncRoutes = require("./routes/syncRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const guideRoutes = require("./routes/guides");
const approvalRoutes = require("./routes/approvalRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const libraryRoutes = require("./routes/libraryRoutes");
const Guide = require("./models/Guide");
const guideDataset = require("./data/guideDataset");
const { seedCatalogIfNeeded } = require("./services/libraryCatalogService");
const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowCredentials = String(process.env.CORS_CREDENTIALS || "false").toLowerCase() === "true";

const isPrivateNetworkHostname = (hostname = "") => {
  const normalized = String(hostname || "").toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }

  const match172 = normalized.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (
    normalized.startsWith("fe80:") ||
    normalized.startsWith("[fe80:")
  ) {
    return true;
  }

  return false;
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return isPrivateNetworkHostname(hostname);
  } catch {
    return false;
  }
};

// 1) Connect DB
connectDB()
  .then(async () => {
    try {
      const count = await Guide.countDocuments();
      if (count === 0) {
        await Guide.insertMany(guideDataset);
        console.log("Guide dataset seeded (empty DB).");
      }
    } catch (err) {
      console.error("Guide seed error:", err?.message || err);
    }

    try {
      await seedCatalogIfNeeded();
    } catch (err) {
      console.error("Library seed error:", err?.message || err);
    }
  })
  .catch((err) => {
    console.error("DB init error:", err?.message || err);
  });

// 2) Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: allowCredentials,
  })
);
app.use(express.json({ limit: "20mb" }));

// 3) Routes
app.get("/", (req, res) => {
  res.send("VNX MomCare Backend is running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/diary", diaryRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/pregnancy", pregnancyRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/guides", guideRoutes);
app.use("/api/auth/guides", guideRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/auth/approvals", approvalRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/trackers", trackerRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/device", deviceRoutes);

// 4) 404 handler (optional but good)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// 5) Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
