const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const utils = require("../calendar-utils.js");
function moduleDefinition() {
  let mod;
  const ctx = {
    Module: {
      register: (name, d) => {
        assert.equal(name, "MMM-AdaptiveMonthlyCalendar");
        mod = d;
      },
    },
    Date,
    structuredClone,
    AdaptiveCalendarUtils: utils,
    console,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout() {},
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../MMM-AdaptiveMonthlyCalendar.js"),
      "utf8",
    ),
    ctx,
  );
  mod.config = { ...mod.defaults };
  mod.updateDom = () => {};
  mod.start();
  return mod;
}
test("exclusive all-day ends are copied, never mutating the shared notification", () => {
  const input = {
    title: "Sample",
    fullDayEvent: true,
    startDate: "2030-01-07",
    endDate: "2030-01-09",
    details: { tags: ["one"] },
  };
  const snapshot = JSON.stringify(input);
  const e = utils.normalizeEvent(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(utils.localDateKey(e.endDate), "2030-01-08");
  e.details.tags.push("two");
  assert.equal(input.details.tags.length, 1);
});
test("timed events crossing midnight retain the last calendar date", () => {
  const e = utils.normalizeEvent({
    startDate: "2030-01-07T20:00:00",
    endDate: "2030-01-09T08:00:00",
  });
  assert.equal(e.multiDayEvent, true);
  assert.equal(utils.localDateKey(e.endDate), "2030-01-09");
});
test("invalid dates and reverse intervals are rejected; no-end all-day events last one local day", () => {
  assert.equal(utils.normalizeEvent({ startDate: "2030-02-30" }), null);
  assert.equal(
    utils.normalizeEvent({ startDate: "2030-01-09", endDate: "2030-01-08" }),
    null,
  );
  const e = utils.normalizeEvent({
    fullDayEvent: true,
    startDate: "2030-01-08",
  });
  assert.equal(utils.localDateKey(e.endDate), "2030-01-08");
});
test("priorities use explicit first-match rules, with no personal title or color defaults", () => {
  const event = {
    title: "Workshop",
    calendarName: "Community",
    color: "#4FC3F7",
  };
  assert.equal(utils.priorityFor(event, []), 1000);
  assert.equal(
    utils.priorityFor(event, [
      { calendarName: "Community", priority: 2 },
      { title: "Workshop", priority: 0 },
    ]),
    2,
  );
  assert.equal(
    utils.priorityFor(event, [{ color: "#4fc3f7", priority: 1 }]),
    1,
  );
  assert.equal(
    utils.matchesAny(event, [{ title: "Workshop", calendarName: "Other" }]),
    false,
  );
});
test("row allocation conserves available height for sparse and dense months", () => {
  for (const [demand, space] of [
    [[60, 80, 60, 80, 60], 500],
    [[300, 60, 60, 60, 60, 60], 360],
    [[60, 60], 20],
  ]) {
    const rows = utils.allocateRows(demand, space, 54);
    assert.ok(Math.abs(rows.reduce((a, b) => a + b, 0) - space) < 0.001);
    assert.ok(rows.every((x) => x >= 0));
  }
});
test("ISO week numbering handles year boundaries", () => {
  for (const [date, week] of [
    ["2021-01-01", 53],
    ["2021-01-04", 1],
    ["2020-12-31", 53],
    ["2022-01-01", 52],
    ["2026-01-01", 1],
  ])
    assert.equal(utils.isoWeek(utils.toDate(date)), week, date);
});
test("notification ingestion isolates payloads, hides calendars and deduplicates", () => {
  const m = moduleDefinition();
  m.config.hideCalendars = ["Hidden"];
  const event = {
    title: "Sample",
    startDate: String(Date.parse("2030-01-08T12:00:00Z")),
    endDate: String(Date.parse("2030-01-08T13:00:00Z")),
    calendarName: "Community",
  };
  const payload = [event, event, { ...event, calendarName: "Hidden" }];
  const old = JSON.stringify(payload);
  m.notificationReceived("CALENDAR_EVENTS", payload, { identifier: "feed" });
  assert.equal(JSON.stringify(payload), old);
  assert.equal(m.events.length, 1);
  m.suspend();
});
test("disabling duplicate hiding retains separate matching entries", () => {
  const m = moduleDefinition();
  m.config.hideDuplicateEvents = false;
  const e = {
    title: "Sample",
    startDate: "2030-01-08",
    endDate: "2030-01-09",
    fullDayEvent: true,
  };
  m.notificationReceived("CALENDAR_EVENTS", [e, e], { identifier: "feed" });
  assert.equal(m.events.length, 2);
  m.suspend();
});

test("timed midnight ends do not create an extra calendar day", () => {
  const e = utils.normalizeEvent({
    startDate: "2030-01-08T20:00:00",
    endDate: "2030-01-09T00:00:00",
  });
  assert.equal(utils.localDateKey(e.renderEndDate), "2030-01-08");
  assert.equal(e.endDate.getHours(), 0);
  assert.equal(e.multiDayEvent, false);
});
