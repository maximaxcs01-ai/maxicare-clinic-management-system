const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const validDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const normalizePeriods = (periods, label) => {
  if (!Array.isArray(periods)) throw new Error(`${label} periods must be an array`);
  const normalized = periods.map((period) => ({
    startTime: typeof period?.startTime === "string" ? period.startTime.trim() : "",
    endTime: typeof period?.endTime === "string" ? period.endTime.trim() : "",
  }));
  for (const period of normalized) {
    if (!TIME_PATTERN.test(period.startTime) || !TIME_PATTERN.test(period.endTime)) throw new Error(`${label} contains an invalid time`);
    if (toMinutes(period.startTime) >= toMinutes(period.endTime)) throw new Error(`${label} start time must be before end time`);
  }
  normalized.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let index = 1; index < normalized.length; index += 1) {
    if (toMinutes(normalized[index].startTime) < toMinutes(normalized[index - 1].endTime)) throw new Error(`${label} periods cannot overlap`);
  }
  return normalized;
};

const validateSchedule = (req, res, next) => {
  try {
    const body = req.body || {};
    const inputWeekly = body.weeklySchedule || {};
    const invalidDay = Object.keys(inputWeekly).find((day) => !DAYS.includes(day));
    if (invalidDay) return res.status(400).json({ message: `Invalid day: ${invalidDay}` });
    const weeklySchedule = {};
    for (const day of DAYS) weeklySchedule[day] = normalizePeriods(inputWeekly[day] || [], day);

    if (!Array.isArray(body.dateOverrides || [])) return res.status(400).json({ message: "Date overrides must be an array" });
    const seenDates = new Set();
    const dateOverrides = (body.dateOverrides || []).map((override) => {
      const date = typeof override?.date === "string" ? override.date.trim() : "";
      if (!validDate(date)) throw new Error("Date override contains an invalid date");
      if (seenDates.has(date)) throw new Error("Only one override is allowed per date");
      seenDates.add(date);
      if (!["unavailable", "custom"].includes(override.type)) throw new Error("Invalid date override type");
      const periods = override.type === "custom" ? normalizePeriods(override.periods, date) : [];
      if (override.type === "custom" && periods.length === 0) throw new Error("Custom hours require at least one period");
      return { ...(override._id ? { _id: override._id } : {}), date, type: override.type, periods };
    });
    const status = body.status || "active";
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Invalid schedule status" });
    req.validatedSchedule = { weeklySchedule, dateOverrides, status };
    next();
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { DAYS, TIME_PATTERN, toMinutes, validDate, normalizePeriods, validateSchedule };
