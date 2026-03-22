const express = require("express");
const cheerio = require("cheerio");
const Notification = require("../models/Notification");

const router = express.Router();

const DEFAULT_COUNTRY = process.env.OPENWEATHER_COUNTRY || "IN";
const MOHFW_PRESS_URL =
  process.env.MOHFW_PRESS_URL || "https://mohfw.gov.in/press-releases";
const MOHFW_HOME_URL = process.env.MOHFW_HOME_URL || "https://mohfw.gov.in/";

const fetchWithNoStore = async (url, options = {}) =>
  fetch(url, {
    ...options,
    headers: {
      "Cache-Control": "no-store",
      ...(options.headers || {}),
    },
  });

const fetchJson = async (url) => {
  const res = await fetchWithNoStore(url);
  const data = await res.json();
  if (!res.ok) {
    const message = data?.message || data?.error || "Request failed";
    throw new Error(message);
  }
  return data;
};

const fetchText = async (url) => {
  const res = await fetchWithNoStore(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return text;
};

const getLastModified = async (url) => {
  try {
    const head = await fetchWithNoStore(url, { method: "HEAD" });
    const lm = head.headers.get("last-modified");
    if (lm) return new Date(lm).toISOString();
  } catch {
    // ignore
  }
  try {
    const res = await fetchWithNoStore(url);
    const lm = res.headers.get("last-modified");
    if (lm) return new Date(lm).toISOString();
  } catch {
    // ignore
  }
  return null;
};

const getGeo = async (city) => {
  const cleanCity = String(city || "").trim();
  if (!cleanCity) throw new Error("City not found");
  const q = encodeURIComponent(cleanCity);
  const urlWithCountry = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json&country=${DEFAULT_COUNTRY}`;
  const data = await fetchJson(urlWithCountry);
  if (data?.results?.[0]) {
    return {
      name: data.results[0].name,
      lat: data.results[0].latitude,
      lon: data.results[0].longitude,
    };
  }
  const urlFallback = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`;
  const fallback = await fetchJson(urlFallback);
  if (!fallback?.results?.[0]) throw new Error(`City not found: ${cleanCity}`);
  return {
    name: fallback.results[0].name,
    lat: fallback.results[0].latitude,
    lon: fallback.results[0].longitude,
  };
};

const getWeather = async (lat, lon) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=precipitation_probability,temperature_2m&forecast_days=1&timezone=auto&temperature_unit=celsius`;
  return fetchJson(url);
};

const weatherCodeToCondition = (code) => {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Clouds";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Clear";
};

const getBestTemp = (weather) => {
  if (weather?.current?.temperature_2m !== undefined) {
    return weather.current.temperature_2m;
  }
  const times = weather?.hourly?.time || [];
  const temps = weather?.hourly?.temperature_2m || [];
  if (!times.length || !temps.length) return 0;
  const now = Date.now();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(times[i]);
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(now - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return temps[bestIdx] ?? 0;
};

const buildNotifications = (weather, city) => {
  const items = [];
  const temp = Math.round(getBestTemp(weather));
  const humidity = weather?.current?.relative_humidity_2m ?? 0;
  const condition = weatherCodeToCondition(weather?.current?.weather_code ?? 0);
  const desc = condition.toLowerCase();
  const pop =
    Math.max(
      ...(weather?.hourly?.precipitation_probability || [0])
    ) / 100;

  if (condition === "Clear" && temp >= 30) {
    items.push({
      type: "sunny",
      title: `Sunny in ${city}`,
      message: `It is sunny and ${temp} C in ${city}. Use sunscreen, hydrate, and wear a hat.`,
      severity: "info",
    });
  }

  if (
    ["Rain", "Drizzle", "Thunderstorm"].includes(condition) ||
    pop >= 0.6
  ) {
    items.push({
      type: "rain",
      title: `Rain expected in ${city}`,
      message: `Rain is likely today (${Math.round(
        pop * 100
      )}% chance). Carry an umbrella and wear non-slip shoes.`,
      severity: "warning",
    });
  }

  if (temp <= 15) {
    items.push({
      type: "winter",
      title: `Cool weather in ${city}`,
      message: `Temperature is ${temp} C. Stay warm and avoid long exposure to cold.`,
      severity: "info",
    });
  }

  if (temp >= 35 || (temp >= 32 && humidity >= 70)) {
    items.push({
      type: "heat",
      title: `Heat caution in ${city}`,
      message: `It is hot (${temp} C). Rest often, drink fluids, and avoid peak sun hours.`,
      severity: "warning",
    });
  }

  return { items, summary: { temp, condition, desc, humidity } };
};

const ensureNotifications = async (userId, city, weather) => {
  const { items, summary } = buildNotifications(weather, city);
  const today = new Date().toISOString().slice(0, 10);

  const created = [];
  for (const item of items) {
    const fingerprint = `${userId}|${city}|${item.type}|${item.title}|${today}`;
    const exists = await Notification.findOne({ fingerprint }).lean();
    if (exists) continue;
    const doc = await Notification.create({
      userId,
      city,
      type: item.type,
      title: item.title,
      message: item.message,
      severity: item.severity,
      fingerprint,
    });
    created.push(doc);
  }

  return { created, summary };
};

const parseMohfwLinks = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const links = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!href || !text) return;
    const isPress =
      /press/i.test(text) ||
      /press/i.test(href) ||
      /release/i.test(text) ||
      /advisory/i.test(text) ||
      /guideline/i.test(text) ||
      /covid/i.test(text);
    if (!isPress) return;
    const url = href.startsWith("http")
      ? href
      : new URL(href, baseUrl).toString();
    links.push({ title: text, url });
  });
  return links;
};

const fetchMohfwUpdates = async () => {
  try {
    const pressHtml = await fetchText(MOHFW_PRESS_URL);
    let links = parseMohfwLinks(pressHtml, MOHFW_PRESS_URL);
    if (links.length < 3) {
      const homeHtml = await fetchText(MOHFW_HOME_URL);
      links = links.concat(parseMohfwLinks(homeHtml, MOHFW_HOME_URL));
    }
    const dedup = new Map();
    for (const l of links) {
      if (!dedup.has(l.url)) dedup.set(l.url, l);
    }
    return Array.from(dedup.values()).slice(0, 10);
  } catch (err) {
    console.warn("MoHFW updates skipped:", err?.message || String(err));
    return [];
  }
};

const ensureMohfwNotifications = async (userId) => {
  const updates = await fetchMohfwUpdates();
  const created = [];
  for (const u of updates) {
    const fingerprint = `${userId}|mohfw|${u.url}`;
    const exists = await Notification.findOne({ fingerprint }).lean();
    if (exists) continue;
    const severity = /alert|emergency|outbreak|epidemic|pandemic/i.test(u.title)
      ? "danger"
      : "info";
    const doc = await Notification.create({
      userId,
      city: "India",
      type: "health",
      title: `MoHFW: ${u.title}`,
      message: "Official MoHFW update. Open to read details.",
      severity,
      source: "mohfw",
      url: u.url,
      fingerprint,
    });
    created.push(doc);
  }
  return created;
};

router.post("/refresh", async (req, res) => {
  try {
    const { userId, city } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    if (!city) return res.status(400).json({ error: "City required" });

    const geo = await getGeo(city);
    const weather = await getWeather(geo.lat, geo.lon);
    const { summary } = await ensureNotifications(userId, geo.name, weather);
    await ensureMohfwNotifications(userId);

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ city: geo.name, summary, notifications });
  } catch (err) {
    console.error("Notification refresh error:", err);
    res.status(500).json({
      error: "Notification refresh failed",
      detail: err?.message || String(err),
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { userId, city, limit } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const safeLimit = Math.min(Number(limit) || 50, 200);

    const query = { userId };
    if (city) query.city = city;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    res.json({ notifications });
  } catch (err) {
    console.error("Notification list error:", err);
    res.status(500).json({ error: "Notification list failed" });
  }
});

router.get("/resources", async (req, res) => {
  try {
    const resources = [
      {
        title: "MoHFW Press Releases (English)",
        url: "https://www.mohfw.gov.in/press-release",
        source: "mohfw",
      },
      {
        title: "WHO Maternal Health",
        url: "https://www.who.int/topics/pregnancy/en/",
        source: "who",
      },
      {
        title: "ACOG Patient Education",
        url: "https://www.acog.org/clinical-information/patient-education-materials",
        source: "acog",
      },
    ];

    const withDates = await Promise.all(
      resources.map(async (r) => ({
        ...r,
        updatedAt: await getLastModified(r.url),
      }))
    );

    const sorted = withDates.sort((a, b) => {
      if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      if (a.updatedAt) return -1;
      if (b.updatedAt) return 1;
      return 0;
    });

    res.json({ resources: sorted });
  } catch (err) {
    console.error("Resources error:", err);
    res.status(500).json({ error: "Resources failed" });
  }
});

module.exports = router;
