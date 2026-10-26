/* Standalone adaptive grid and native overflow dialog; custom additions under MIT. */
(function (root) {
  function sortEvents(table) {
    for (const cell of table.querySelectorAll("td.cell"))
      Array.from(cell.querySelectorAll(":scope > .event"))
        .map((event, index) => ({
          event,
          index,
          priority: Number(event.dataset.priority) || 0,
        }))
        .sort((a, b) => a.priority - b.priority || a.index - b.index)
        .forEach(({ event }) => cell.appendChild(event));
  }
  function fit(table, options) {
    if (!table.isConnected) return;
    const rows = Array.from(table.querySelectorAll("tr")).filter((row) =>
      row.querySelector("td.cell"),
    );
    if (!rows.length) return;
    const header = Math.max(30, Number(options.headerHeight) || 30),
      minimum = Math.max(
        54,
        Number(options.minRowHeight) || 54,
        (Number(options.overflowHeight) || 20) + 34,
      ),
      moreHeight = Math.max(18, Number(options.overflowHeight) || 20);
    table.querySelectorAll(".adaptive-more").forEach((e) => e.remove());
    table
      .querySelectorAll(".event")
      .forEach((e) => e.style.removeProperty("display"));
    sortEvents(table);
    const size = (e) => {
      const s = getComputedStyle(e);
      return (
        e.getBoundingClientRect().height +
        (parseFloat(s.marginTop) || 0) +
        (parseFloat(s.marginBottom) || 0)
      );
    };
    const overhead = (cell) => {
      const s = getComputedStyle(cell);
      return (
        size(cell.firstElementChild) +
        (parseFloat(s.paddingTop) || 0) +
        (parseFloat(s.paddingBottom) || 0) +
        2
      );
    };
    const demand = rows.map((row) =>
      Math.max(
        minimum,
        ...Array.from(
          row.querySelectorAll("td.cell"),
          (cell) =>
            overhead(cell) +
            Array.from(cell.querySelectorAll(":scope > .event")).reduce(
              (sum, e) => sum + size(e),
              0,
            ),
        ),
      ),
    );
    const heights = AdaptiveCalendarUtils.allocateRows(
      demand,
      table.clientHeight - header,
      minimum,
    );
    table.style.gridTemplateRows =
      header + "px " + heights.map((h) => h.toFixed(3) + "px").join(" ");
    for (const row of rows)
      for (const cell of row.querySelectorAll("td.cell")) {
        const events = Array.from(cell.querySelectorAll(":scope > .event")),
          sizes = events.map(size),
          space = Math.max(0, cell.clientHeight - overhead(cell));
        if (sizes.reduce((a, b) => a + b, 0) <= space + 1) continue;
        let used = 0,
          hidden = 0,
          full = false;
        events.forEach((e, i) => {
          if (full || used + sizes[i] > Math.max(0, space - moreHeight)) {
            e.style.setProperty("display", "none", "important");
            hidden++;
            full = true;
          } else used += sizes[i];
        });
        if (!hidden) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "adaptive-more";
        button.textContent = "+" + hidden + " more";
        button.style.height = moreHeight + "px";
        button.setAttribute(
          "aria-label",
          hidden + " more events on " + cell.dataset.date,
        );
        button.onclick = () => {
          for (const old of document.querySelectorAll(
            ".adaptive-calendar-dialog",
          ))
            if (old.dataset.owner === table.dataset.owner) old.remove();
          const dialog = document.createElement("dialog");
          dialog.className = "adaptive-calendar-dialog";
          dialog.dataset.owner = table.dataset.owner;
          const heading = document.createElement("h2");
          heading.textContent = "Events — " + cell.dataset.date;
          const headingId =
            "adaptive-title-" + Math.random().toString(36).slice(2);
          heading.id = headingId;
          dialog.setAttribute("aria-labelledby", headingId);
          const close = document.createElement("button");
          close.textContent = "Close";
          close.type = "button";
          close.autofocus = true;
          close.onclick = () => dialog.close();
          const list = document.createElement("ul");
          for (const event of events) {
            const item = document.createElement("li");
            item.textContent = event.textContent.trim();
            list.appendChild(item);
          }
          dialog.append(heading, close, list);
          dialog.addEventListener("close", () => {
            dialog.remove();
            if (cell.isConnected) cell.querySelector(".adaptive-more")?.focus();
          });
          dialog.addEventListener("click", (e) => {
            if (e.target === dialog) {
              const r = dialog.getBoundingClientRect();
              if (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
              )
                dialog.close();
            }
          });
          document.body.appendChild(dialog);
          dialog.showModal();
        };
        cell.appendChild(button);
      }
    table.dataset.adaptiveReady = "true";
  }
  root.AdaptiveCalendarLayout = { fit, sortEvents };
})(typeof self !== "undefined" ? self : this);
