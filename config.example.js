// Add this entry to the modules array in an isolated MagicMirror config.
module.exports = {
  module: "MMM-AdaptiveMonthlyCalendar",
  position: "bottom_bar",
  config: {
    mode: "currentMonth",
    firstDayOfWeek: "sunday",
    calendarHeight: 520,
    calendarWidth: 1000,
    showWeekNumber: false,
    priorityRules: [{ calendarName: "Community", priority: 0 }],
    compactTitleRules: [{ title: "Synthetic workshop" }],
  },
};
