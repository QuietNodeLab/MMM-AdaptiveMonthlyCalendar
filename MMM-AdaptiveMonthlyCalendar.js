/* Derived from the pinned upstream MMM-MonthlyCalendar; see UPSTREAM.md. */
(function () {
  function el(tag, options) {
    var result = document.createElement(tag);

    options = options || {};
    for (var key in options) {
      result[key] = options[key];
    }

    return result;
  }

  function addOneDay(d) {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + 1,
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds(),
    );
  }

  function diffDays(a, b) {
    a = new Date(a);
    b = new Date(b);

    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);

    return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }

  function getWeekNumber(date) {
    return AdaptiveCalendarUtils.isoWeek(date);
  }

  function formatEventTime(d) {
    var h = d.getHours();
    var m = d.getMinutes().toString().padStart(2, "0");
    if (config.timeFormat === 12) {
      return (h % 12 || 12) + (m > 0 ? `:${m}` : "") + (h < 12 ? "am" : "pm");
    } else {
      return `${h}:${m}`;
    }
  }

  function equals(a, b) {
    if (typeof a !== typeof b) {
      return false;
    }

    if (!!a && (a.constructor === Array || a.constructor === Object)) {
      for (var key in a) {
        if (!b.hasOwnProperty(key) || !equals(a[key], b[key])) {
          return false;
        }
      }

      return true;
    } else if (!!a && a.constructor == Date) {
      return a.valueOf() === b.valueOf();
    }

    return a === b;
  }

  function getLuminance(color) {
    try {
      const [r, g, b, a, s, d] = color.match(/([0-9.]+)/g);
      return 0.299 * +r + 0.587 * +g + 0.114 * +b;
    } catch {
      return 0;
    }
  }

  Module.register("MMM-AdaptiveMonthlyCalendar", {
    // Default module config
    defaults: {
      adaptiveFit: true,
      calendarHeight: 520,
      calendarWidth: 1000,
      headerHeight: 30,
      minRowHeight: 54,
      overflowHeight: 20,
      priorityRules: [],
      compactTitleRules: [],
      updateDelay: 100,
      mode: "currentMonth",
      firstDayOfWeek: "sunday",
      showWeekNumber: false,
      displaySymbol: false,
      wrapTitles: false,
      hideCalendars: [],
      luminanceThreshold: 110,
      multiDayEndingTimeSeparator: " until ",
      hideDuplicateEvents: true,
    },

    start: function () {
      var self = this;

      self.sourceEvents = Object.create(null);
      self.events = [];
      self.displayedDay = null;
      self.displayedEvents = [];
      self.updateTimer = null;
      self.skippedUpdateCount = 0;
      this.watchDay();
    },

    notificationReceived: function (notification, payload, sender) {
      var self = this;

      if (notification === "CALENDAR_EVENTS") {
        if (!Array.isArray(payload)) {
          console.warn("MMM-AdaptiveMonthlyCalendar expected an event array");
          return;
        }

        // Step 1: Parse and filter incoming events
        self.sourceEvents[sender?.identifier || "calendar"] = payload
          .map((e) => AdaptiveCalendarUtils.normalizeEvent(e))
          .filter(
            (e) => e && !self.config.hideCalendars.includes(e.calendarName),
          );

        // Step 2: Schedule update
        if (self.updateTimer !== null) {
          clearTimeout(self.updateTimer);
          ++self.skippedUpdateCount;
        }

        self.updateTimer = setTimeout(
          () => {
            const today = new Date().setHours(12, 0, 0, 0).valueOf();

            // Step 3: Combine and sort events
            self.events = Object.values(self.sourceEvents)
              .flat()
              .sort((a, b) => {
                if (a.startDate != b.startDate)
                  return a.startDate - b.startDate;
                if (a.endDate != b.endDate) return a.endDate - b.endDate;
                return a.title.localeCompare(b.title);
              });

            // Step 4: Remove duplicates using a hash table
            if (self.config.hideDuplicateEvents) {
              const seenEvents = new Map(); // Hash table for deduplication
              self.events = self.events.filter((event) => {
                const key = `${event.title}|${event.startDate.valueOf()}|${event.endDate.valueOf()}`;
                if (seenEvents.has(key)) {
                  return false; // Duplicate
                }
                seenEvents.set(key, true);
                return true; // Unique
              });
            }

            // Step 5: Update DOM if needed
            if (
              today !== self.displayedDay ||
              !equals(self.events, self.displayedEvents)
            ) {
              self.displayedDay = today;
              self.displayedEvents = self.events;
              self.updateTimer = null;
              self.skippedUpdateCount = 0;
              self.updateDom();
            }
          },
          Math.max(0, Number(self.config.updateDelay) || 0),
        );
      }
    },

    getScripts() {
      return [this.file("calendar-utils.js"), this.file("adaptive-layout.js")];
    },

    watchDay() {
      clearInterval(this.dayTimer);
      this.lastDay = new Date().toDateString();
      this.dayTimer = setInterval(() => {
        const day = new Date().toDateString();
        if (day !== this.lastDay) {
          this.lastDay = day;
          this.updateDom(0);
        }
      }, 30000);
    },
    suspend() {
      clearTimeout(this.updateTimer);
      clearInterval(this.dayTimer);
      this.resizeObserver?.disconnect();
      if (typeof document !== "undefined")
        for (const dialog of document.querySelectorAll(
          ".adaptive-calendar-dialog",
        ))
          if (dialog.dataset.owner === this.identifier) {
            dialog.close();
            dialog.remove();
          }
    },
    resume() {
      this.watchDay();
      this.updateDom(0);
    },

    getStyles: function () {
      return ["MMM-AdaptiveMonthlyCalendar.css"];
    },

    getDom: function () {
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const weeksToMonthDays = {
        nextoneweek: 0,
        currentweek: 0,
        oneweek: 0,
        twoweeks: 7,
        threeweeks: 14,
        fourweeks: 21,
        nextfourweeks: 21,
      };
      const self = this;
      const now = new Date();
      const table = el("table", { className: "small wrapper" });
      const height = Math.max(180, Number(self.config.calendarHeight) || 520);
      table.style.height = height + "px";
      table.style.setProperty(
        "--calendar-width",
        Math.max(280, Number(self.config.calendarWidth) || 1000) + "px",
      );
      table.style.setProperty(
        "--calendar-columns",
        (self.config.showWeekNumber ? "3ch " : "") + "repeat(7,minmax(0,1fr))",
      );
      table.dataset.owner = this.identifier || "calendar";
      if (!self.config.adaptiveFit) table.classList.add("adaptive-off");
      const today = now.getDate();
      const mode = self.config.mode.toLowerCase();
      let firstDayOfWeek = self.config.firstDayOfWeek.toLowerCase();
      var row = el("tr");
      var cell;
      var cellIndex, monthDays;
      var dateCells = [];
      var startDayOffset = 0;

      if (firstDayOfWeek === "today") {
        firstDayOfWeek = days[now.getDay()].toLowerCase();
      }

      while (
        firstDayOfWeek !== days[0].toLowerCase() &&
        startDayOffset < days.length
      ) {
        days.push(days.shift());
        ++startDayOffset;
      }

      startDayOffset = startDayOffset % 7;

      if (mode in weeksToMonthDays) {
        cellIndex = today - now.getDay() + startDayOffset;
        while (cellIndex > today) {
          cellIndex -= 7;
        }
        monthDays = cellIndex + weeksToMonthDays[mode];
      } else {
        if (mode === "lastmonth") {
          now.setDate(1);
          now.setMonth(now.getMonth() - 1);
        } else if (mode === "nextmonth") {
          now.setDate(1);
          now.setMonth(now.getMonth() + 1);
        }
        cellIndex =
          1 -
          new Date(now.getFullYear(), now.getMonth(), 1).getDay() +
          startDayOffset;
        monthDays =
          32 - new Date(now.getFullYear(), now.getMonth(), 32).getDate();
        while (cellIndex > 1) {
          cellIndex -= 7;
        }
      }

      if (self.config.showWeekNumber) {
        row.appendChild(el("th", { className: "weeknum" }));
      }

      for (var day = 0; day < 7; ++day) {
        const headerDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          cellIndex + day,
        );
        row.appendChild(
          el("th", {
            className: "header",
            innerHTML: headerDate.toLocaleString(config.language, {
              weekday: "long",
            }),
          }),
        );
      }
      table.appendChild(row);

      for (var week = 0; week < 6 && cellIndex <= monthDays; ++week) {
        row = el("tr", { className: "xsmall" });
        if (self.config.showWeekNumber) {
          const weekDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            cellIndex,
          );
          row.appendChild(
            el("td", {
              className: "weeknum",
              innerHTML: getWeekNumber(weekDate),
            }),
          );
        }

        for (day = 0; day < 7; ++day, ++cellIndex) {
          var cellDate = new Date(now.getFullYear(), now.getMonth(), cellIndex);
          var cellDay = cellDate.getDate();

          cell = el("td", { className: "cell" });
          cell.dataset.date = AdaptiveCalendarUtils.localDateKey(cellDate);
          if (["lastmonth", "nextmonth"].includes(mode)) {
            // Do nothing
          } else if (cellIndex === today) {
            cell.classList.add("today");
          } else if (cellIndex !== cellDay && mode === "currentmonth") {
            cell.classList.add("other-month");
          } else if (cellIndex < today) {
            cell.classList.add("past-date");
          }

          if ((week === 0 && day === 0) || cellDay === 1) {
            cellDay = cellDate.toLocaleString(config.language, {
              month: "short",
              day: "numeric",
            });
          }

          cell.appendChild(el("div", { innerHTML: cellDay }));
          row.appendChild(cell);
          dateCells[cellIndex] = cell;
        }

        table.appendChild(row);
      }

      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const indexes = Object.keys(dateCells).map(Number);
      const firstVisibleDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        Math.min(...indexes),
      );
      const lastVisibleDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        Math.max(...indexes),
        23,
        59,
        59,
        999,
      );
      for (var i in self.events) {
        var e = self.events[i];

        for (
          var eventDate = new Date(
            Math.max(
              +new Date(
                e.startDate.getFullYear(),
                e.startDate.getMonth(),
                e.startDate.getDate(),
              ),
              +firstVisibleDate,
            ),
          );
          eventDate <= e.renderEndDate && eventDate <= lastVisibleDate;
          eventDate = addOneDay(eventDate)
        ) {
          var dayDiff = diffDays(eventDate, monthStart);

          if (dayDiff in dateCells) {
            let div = el("div", { className: "event" });
            div.dataset.priority = String(
              AdaptiveCalendarUtils.priorityFor(e, self.config.priorityRules),
            );
            if (
              !e.fullDayEvent &&
              AdaptiveCalendarUtils.matchesAny(e, self.config.compactTitleRules)
            )
              div.classList.add("adaptive-compact-title");
            if (!self.config.wrapTitles) {
              div.classList.add("event-nowrap");
            }

            // Print the time if it is NOT a full day event.
            // And if it is NOT the 2nd or later day of a multi-day event.
            if (
              !e.fullDayEvent &&
              !(e.multiDayEvent && eventDate > e.startDate)
            ) {
              div.appendChild(
                el("span", {
                  className: "event-label",
                  innerText:
                    formatEventTime(e.startDate) +
                    " – " +
                    formatEventTime(e.endDate),
                }),
              );
            }

            // Preserve the customized title/detail structure.
            let eventDetails = el("div", {
              className: "adaptive-event-details",
            });
            if (self.config.displaySymbol) {
              for (let symbol of Array.isArray(e.symbol)
                ? e.symbol
                : e.symbol
                  ? [e.symbol]
                  : []) {
                eventDetails.appendChild(
                  el("span", {
                    className: `event-label ${String(symbol).includes(" ") ? symbol : "fa fa-" + symbol}`,
                  }),
                );
              }
            }

            eventDetails.appendChild(
              el("span", {
                className: "adaptive-event-title",
                innerText: e.title,
              }),
            );
            div.appendChild(eventDetails);

            // Configured compact timed-title rendering.
            if (div.classList.contains("adaptive-compact-title")) {
              div.textContent =
                formatEventTime(e.startDate) +
                " – " +
                formatEventTime(e.endDate) +
                " " +
                e.title;
            }

            // Print ending time if last day of multi-day event.
            if (
              !e.fullDayEvent &&
              e.multiDayEvent &&
              eventDate.toDateString() == e.renderEndDate.toDateString()
            ) {
              div.appendChild(
                el("span", {
                  className: "event-label",
                  innerText:
                    self.config.multiDayEndingTimeSeparator +
                    formatEventTime(e.endDate),
                }),
              );
            }

            if (e.color) {
              var c = e.color;

              if (e.fullDayEvent || e.multiDayEvent) {
                div.style.backgroundColor = c;
                if (
                  getLuminance(div.style.backgroundColor) >=
                  self.config.luminanceThreshold
                ) {
                  div.className += " event-lightbackground";
                } else {
                  div.className += " event-darkbackground";
                }
              } else {
                div.style.color = c;
              }
            }

            dateCells[dayDiff].appendChild(div);
          }
        }
      }

      AdaptiveCalendarLayout.sortEvents(table);
      const rowCount = table.querySelectorAll("tr").length - 1;
      const header = Math.max(30, Number(self.config.headerHeight) || 30);
      const rowMinimum = Math.max(
        54,
        Number(self.config.minRowHeight) || 54,
        (Number(self.config.overflowHeight) || 20) + 34,
      );
      table.style.height =
        Math.max(height, header + rowCount * rowMinimum + 2) + "px";
      table.style.gridTemplateRows =
        header + "px repeat(" + rowCount + ",minmax(0,1fr))";
      this.resizeObserver?.disconnect();
      const fit = () => {
        if (table.isConnected && self.config.adaptiveFit)
          AdaptiveCalendarLayout.fit(table, self.config);
      };
      this.resizeObserver = new ResizeObserver(() =>
        requestAnimationFrame(fit),
      );
      this.resizeObserver.observe(table);
      requestAnimationFrame(fit);
      document.fonts?.ready.then(fit);
      return table;
    },
  });
})();
