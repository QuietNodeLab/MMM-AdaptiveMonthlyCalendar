const assert = require("node:assert/strict"),
  path = require("node:path"),
  { createRequire } = require("node:module"),
  { execFileSync } = require("node:child_process");
if (!process.env.MM_RUNTIME_PATH)
  throw Error(
    "Set MM_RUNTIME_PATH to the pinned MagicMirror 2.38.0 checkout with dev dependencies",
  );
const runtime = path.resolve(process.env.MM_RUNTIME_PATH),
  runtimeRequire = createRequire(path.join(runtime, "package.json")),
  { chromium } = runtimeRequire("playwright");
const root = path.resolve(__dirname, "..");
assert.equal(
  execFileSync("git", ["-C", runtime, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  require("../test-runtime.json").commit,
  "Runtime must match the pinned source",
);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.MM_BROWSER_EXECUTABLE
      ? { executablePath: process.env.MM_BROWSER_EXECUTABLE }
      : {}),
  });
  let checks = 0;
  async function pageFor(now, options = {}) {
    const context = await browser.newContext({
        timezoneId: "America/New_York",
        viewport: { width: 1200, height: 900 },
      }),
      page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) => r.abort());
    await page.clock.install({ time: new Date(now) });
    await page.setContent(
      '<style>body{background:#050b12;margin:24px;font-family:system-ui;color:white}#host{width:1050px;max-width:100%}</style><main id="host" class="MMM-AdaptiveMonthlyCalendar"></main>',
    );
    await page.evaluate(() => {
      window.config = { language: "en", timeFormat: 12 };
      window.Module = {
        register(n, d) {
          window.definition = d;
        },
      };
    });
    for (const file of [
      "calendar-utils.js",
      "adaptive-layout.js",
      "MMM-AdaptiveMonthlyCalendar.js",
    ])
      await page.addScriptTag({ path: path.join(root, file) });
    await page.addStyleTag({
      path: path.join(root, "MMM-AdaptiveMonthlyCalendar.css"),
    });
    await page.evaluate((options) => {
      window.m = Object.assign({}, definition);
      m.identifier = "synthetic-calendar";
      m.config = { ...m.defaults, ...options };
      m.file = (x) => x;
      m.updateDom = () =>
        document.querySelector("#host").replaceChildren(m.getDom());
      m.start();
      m.updateDom();
    }, options);
    return { context, page, errors };
  }
  async function feed(page, events) {
    await page.evaluate((events) => {
      const before = JSON.stringify(events);
      m.notificationReceived("CALENDAR_EVENTS", events, {
        identifier: "sample-feed",
      });
      if (JSON.stringify(events) !== before)
        throw Error("Shared input mutated");
    }, events);
    await page.clock.runFor(1200);
    await page.waitForFunction(
      () => document.querySelector("table").dataset.adaptiveReady === "true",
    );
  }
  try {
    for (const [now, month, weeks] of [
      ["2030-01-08T15:00:00Z", "2030-01", 5],
      ["2030-06-08T15:00:00Z", "2030-06", 6],
    ]) {
      const { context, page, errors } = await pageFor(now, {
        calendarHeight: 420,
        priorityRules: [
          { calendarName: "Priority", priority: 0 },
          { calendarName: "Other", priority: 10 },
        ],
        compactTitleRules: [{ title: "Compact" }],
        showWeekNumber: true,
      });
      try {
        const events = [
          {
            title: "A low",
            calendarName: "Other",
            fullDayEvent: true,
            startDate: month + "-08",
            endDate: month + "-09",
            color: "#B388FF",
          },
          {
            title: "Z high",
            calendarName: "Priority",
            fullDayEvent: true,
            startDate: month + "-08",
            endDate: month + "-09",
            color: "#4FC3F7",
          },
          ...Array.from({ length: 22 }, (_, i) => ({
            title: "Synthetic event " + String(i).padStart(2, "0"),
            fullDayEvent: true,
            startDate: month + "-08",
            endDate: month + "-09",
            color: "#FFD54F",
          })),
          {
            title: "Compact",
            startDate: month + "-08T10:00:00",
            endDate: month + "-08T11:00:00",
          },
          {
            title: "Timed final morning",
            startDate: month + "-07T20:00:00",
            endDate: month + "-09T08:00:00",
          },
        ];
        await feed(page, events);
        assert.equal(await page.locator("tr").count(), weeks + 1);
        const cell = page.locator('[data-date="' + month + '-08"]');
        assert.match(
          await cell.locator(".event").first().innerText(),
          /Z high/,
        );
        const more = cell.locator(".adaptive-more");
        assert.equal(await more.count(), 1);
        const bounds = await cell.evaluate((cell) => {
          const bottom = cell.getBoundingClientRect().bottom;
          return Array.from(cell.querySelectorAll(".event,.adaptive-more"))
            .filter((e) => getComputedStyle(e).display !== "none")
            .every((e) => e.getBoundingClientRect().bottom <= bottom + 1);
        });
        assert.equal(bounds, true);
        assert.equal(
          await page
            .locator('[data-date="' + month + '-09"] .event')
            .filter({ hasText: "Z high" })
            .count(),
          0,
        );
        assert.equal(
          await page
            .locator('[data-date="' + month + '-09"] .event')
            .filter({ hasText: "Timed final morning" })
            .count(),
          1,
        );
        await more.click();
        assert.equal(await page.locator("dialog[open] li").count(), 26);
        await page.keyboard.press("Escape");
        await page.waitForSelector("dialog", { state: "detached" });
        await page.evaluate(
          () => (document.querySelector("#host").style.width = "650px"),
        );
        await page.clock.runFor(300);
        await page.waitForTimeout(50);
        await page.clock.runFor(300);
        assert.equal(await cell.locator(".adaptive-more").count(), 1);
        if (process.env.WRITE_SCREENSHOTS === "1")
          await page.locator("#host").screenshot({
            path: path.join(
              root,
              "docs",
              weeks === 5 ? "preview.png" : "six-weeks.png",
            ),
          });
        assert.deepEqual(errors, []);
        checks++;
        console.log(
          "PASS dense " +
            weeks +
            "-week month: priority, exclusive end, timed final day, overflow dialog/Escape and resize",
        );
      } finally {
        await context.close();
      }
    }
    for (const [fixture, now, day, next] of [
      ["winter", "2030-01-08T15:00:00Z", "2030-01-08", "2030-01-09"],
      ["spring-dst", "2030-03-10T16:00:00Z", "2030-03-10", "2030-03-11"],
    ]) {
      const ingested = JSON.parse(
        execFileSync(
          process.execPath,
          [path.join(__dirname, "ingest-worker.cjs"), fixture, now],
          {
            env: {
              ...process.env,
              MM_RUNTIME_PATH: runtime,
              TZ: "America/New_York",
            },
            encoding: "utf8",
            timeout: 30000,
          },
        ),
      );
      assert.equal(ingested.requests, 1);
      const { context, page, errors } = await pageFor(now);
      try {
        await feed(page, ingested.events);
        const today = page.locator('[data-date="' + day + '"]');
        assert.match(await today.innerText(), /Today only/);
        assert.match(await today.innerText(), /Ongoing final day/);
        assert.doesNotMatch(await today.innerText(), /Expired/);
        assert.equal(
          await page
            .locator('[data-date="' + next + '"] .event')
            .filter({ hasText: "Today only" })
            .count(),
          0,
        );
        assert.deepEqual(errors, []);
        checks++;
        console.log(
          "PASS actual " +
            fixture +
            " ICS ingestion and exclusive final-day rendering",
        );
      } finally {
        await context.close();
      }
    }
    for (const [mode, prefix] of [
      ["nextMonth", "2030-02"],
      ["lastMonth", "2029-12"],
    ]) {
      const { context, page, errors } = await pageFor("2030-01-31T15:00:00Z", {
        mode,
      });
      try {
        await page.clock.runFor(500);
        assert.ok(
          (await page.locator('[data-date^="' + prefix + '-"]').count()) >= 28,
        );
        assert.deepEqual(errors, []);
        checks++;
        console.log("PASS " + mode + " from the 31st");
      } finally {
        await context.close();
      }
    }
    {
      const { context, page, errors } = await pageFor("2030-01-08T15:00:00Z", {
        adaptiveFit: false,
        calendarHeight: 300,
        priorityRules: [{ calendarName: "Priority", priority: 0 }],
      });
      try {
        await page.evaluate(() =>
          m.notificationReceived(
            "CALENDAR_EVENTS",
            Array.from({ length: 20 }, (_, i) => ({
              title: "Synthetic " + i,
              calendarName: i === 19 ? "Priority" : "Other",
              fullDayEvent: true,
              startDate: "2030-01-08",
              endDate: "2030-01-09",
            })),
            { identifier: "feed" },
          ),
        );
        await page.clock.runFor(500);
        const cell = page.locator('[data-date="2030-01-08"]');
        assert.equal(await page.locator(".adaptive-more").count(), 0);
        assert.match(
          await cell.locator(".event").first().innerText(),
          /Synthetic 19/,
        );
        assert.equal(
          await cell.evaluate((e) => getComputedStyle(e).overflowY),
          "auto",
        );
        assert.ok(await cell.evaluate((e) => e.scrollHeight > e.clientHeight));
        assert.deepEqual(errors, []);
        checks++;
        console.log(
          "PASS non-adaptive mode preserves priority and scrollable content",
        );
      } finally {
        await context.close();
      }
    }
    console.log("Calendar browser checks passed: " + checks);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
