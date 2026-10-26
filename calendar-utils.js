(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AdaptiveCalendarUtils = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 86400000;
  function localDateKey(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function toDate(value) {
    if (value instanceof Date) return new Date(+value);
    if (
      typeof value === "number" ||
      (typeof value === "string" && /^\d+$/.test(value))
    )
      return new Date(Number(value));
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return localDateKey(date) === value ? date : new Date(NaN);
    }
    return new Date(value);
  }
  function normalizeEvent(value) {
    if (!value || typeof value !== "object") return null;
    const e = structuredClone(value);
    e.startDate = toDate(e.startDate);
    if (!Number.isFinite(+e.startDate)) return null;
    e.endDate =
      e.endDate != null
        ? toDate(e.endDate)
        : e.fullDayEvent
          ? new Date(
              e.startDate.getFullYear(),
              e.startDate.getMonth(),
              e.startDate.getDate() + 1,
            )
          : new Date(+e.startDate);
    if (!Number.isFinite(+e.endDate) || e.endDate < e.startDate) return null;
    if (e.fullDayEvent) {
      if (+e.endDate === +e.startDate) return null;
      e.endDate = new Date(+e.endDate - 1);
    }
    e.renderEndDate =
      !e.fullDayEvent && +e.endDate > +e.startDate
        ? new Date(+e.endDate - 1)
        : new Date(+e.endDate);
    e.title = String(e.title || "Event");
    e.multiDayEvent =
      localDateKey(e.startDate) !== localDateKey(e.renderEndDate);
    return e;
  }
  function matches(event, rule) {
    if (!rule || typeof rule !== "object") return false;
    const keys = ["calendarName", "title", "color"].filter(
      (k) => rule[k] != null,
    );
    return (
      keys.length > 0 &&
      keys.every(
        (k) =>
          String(event[k] || "").toLowerCase() ===
          String(rule[k]).toLowerCase(),
      )
    );
  }
  function matchesAny(event, rules) {
    return Array.isArray(rules) && rules.some((r) => matches(event, r));
  }
  function priorityFor(event, rules) {
    for (const rule of Array.isArray(rules) ? rules : [])
      if (matches(event, rule) && Number.isFinite(rule.priority))
        return rule.priority;
    return 1000;
  }
  function allocateRows(demand, space, minimum) {
    if (!demand.length) return [];
    space = Math.max(0, space);
    minimum = Math.min(Math.max(0, minimum), space / demand.length);
    const total = demand.reduce((a, b) => a + b, 0);
    if (total <= space)
      return demand.map((x) => x + (space - total) / demand.length);
    const extra = demand.map((x) => Math.max(0, x - minimum)),
      weight = extra.reduce((a, b) => a + b, 0),
      remaining = space - minimum * demand.length;
    return extra.map(
      (x) =>
        minimum +
        (weight ? (remaining * x) / weight : remaining / demand.length),
    );
  }
  // ISO week 1 is the week containing January 4; use Monday ordinals in UTC.
  function isoWeek(date) {
    const stamp = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const monday = stamp - ((new Date(stamp).getUTCDay() + 6) % 7) * DAY;
    const weekYear = new Date(monday + 3 * DAY).getUTCFullYear();
    const january4 = Date.UTC(weekYear, 0, 4);
    const firstMonday =
      january4 - ((new Date(january4).getUTCDay() + 6) % 7) * DAY;
    return 1 + Math.round((monday - firstMonday) / (7 * DAY));
  }
  return {
    localDateKey,
    toDate,
    normalizeEvent,
    matchesAny,
    priorityFor,
    allocateRows,
    isoWeek,
  };
});
