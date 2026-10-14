const AppError = require("./AppError");

const MANILA_OFFSET = "+08:00";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateString = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const getManilaDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const toManilaDayStart = (date) =>
  new Date(`${date}T00:00:00.000${MANILA_OFFSET}`);

const getManilaDayRange = (date) => {
  if (!isValidDateString(date)) {
    throw new AppError("Date must be a valid YYYY-MM-DD Manila calendar date.", 400);
  }
  const start = toManilaDayStart(date);
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
};

const getManilaDateRange = (from, to) => {
  if (!isValidDateString(from) || !isValidDateString(to)) {
    throw new AppError("Date range must use valid YYYY-MM-DD Manila calendar dates.", 400);
  }
  if (from > to) throw new AppError("Date-from must be on or before date-to.", 400);
  const { start } = getManilaDayRange(from);
  const { end } = getManilaDayRange(to);
  return { start, end };
};

const getTodayManilaRange = (now = new Date()) =>
  getManilaDayRange(getManilaDate(now));

module.exports = {
  getManilaDate,
  getManilaDayRange,
  getManilaDateRange,
  getTodayManilaRange,
  isValidDateString,
};
