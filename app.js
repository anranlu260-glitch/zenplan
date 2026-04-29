const STORAGE_KEY = "smart-planner-state-v1";
const DEFAULT_PLANNING_WINDOWS = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "14:00", end: "18:00" },
  evening: { start: "19:00", end: "22:00" },
};

const DEFAULT_STATE = {
  tasks: [
    {
      id: crypto.randomUUID(),
      title: "高数课",
      kind: "fixed",
      priority: 3,
      fixedSlotEnabled: true,
      start: "08:30",
      end: "10:00",
      duration: 90,
      frequency: "weekly",
      weeklyMode: "custom_days",
      weekdays: [1, 3, 5],
      dates: [],
      date: todayString(),
      deadline: "",
      repeatInterval: 1,
      repeatStrategy: "calendar",
      nextDate: "",
      lastCompletedAt: "",
      reminderEnabled: true,
      reminderLeadMinutes: null,
      completed: false,
      completedAt: "",
      completedDates: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "复习当天课程",
      kind: "flexible",
      priority: 2,
      fixedSlotEnabled: false,
      start: "19:00",
      end: "",
      duration: 60,
      frequency: "daily",
      weeklyMode: "same_day",
      weekdays: [],
      dates: [],
      date: todayString(),
      deadline: "",
      repeatInterval: 1,
      repeatStrategy: "after_completion",
      nextDate: todayString(),
      lastCompletedAt: "",
      reminderEnabled: true,
      reminderLeadMinutes: 15,
      completed: false,
      completedAt: "",
      completedDates: [],
      createdAt: new Date().toISOString(),
    },
  ],
  settings: {
    preset: "zenplan",
    focusReminderEnabled: true,
    reminderBufferMinutes: 10,
    planningBufferMinutes: 10,
    soundEnabled: true,
    notifyAdjustments: true,
    preferGapBlocks: true,
    planningWindows: DEFAULT_PLANNING_WINDOWS,
  },
  lastPlanSignature: "",
};

let state = loadState();
let notificationTimers = [];
let editingTaskId = null;
let lastRenderedSchedule = [];
let lastRenderedScheduleDate = "";

const els = {
  tabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view"),
  planDate: document.querySelector("#plan-date"),
  todayTitle: document.querySelector("#today-title"),
  todaySubtitle: document.querySelector("#today-subtitle"),
  generatePlan: document.querySelector("#generate-plan"),
  weekStrip: document.querySelector("#week-strip"),
  planningRulesNote: document.querySelector("#planning-rules-note"),
  adjustmentNote: document.querySelector("#adjustment-note"),
  weekProgressNote: document.querySelector("#week-progress-note"),
  scheduleList: document.querySelector("#schedule-list"),
  metricTotal: document.querySelector("#metric-total"),
  metricFixed: document.querySelector("#metric-fixed"),
  metricFlexible: document.querySelector("#metric-flexible"),
  metricCompleted: document.querySelector("#metric-completed"),
  nextFocus: document.querySelector("#next-focus"),
  todayLoadNote: document.querySelector("#today-load-note"),
  deadlineAlert: document.querySelector("#deadline-alert"),
  ruleFocusNote: document.querySelector("#rule-focus-note"),
  openTaskEditor: document.querySelector("#open-task-editor"),
  closeTaskEditor: document.querySelector("#close-task-editor"),
  cancelTaskEditor: document.querySelector("#cancel-task-editor"),
  taskEditorModal: document.querySelector("#task-editor-modal"),
  taskEditorTitle: document.querySelector("#task-editor-title"),
  taskSubmitButton: document.querySelector("#task-submit-button"),
  taskForm: document.querySelector("#task-form"),
  taskTitle: document.querySelector("#task-title"),
  taskKind: document.querySelector("#task-kind"),
  taskPriority: document.querySelector("#task-priority"),
  taskFixedSlotEnabled: document.querySelector("#task-fixed-slot-enabled"),
  taskTimeWindowWrap: document.querySelector("#task-time-window-wrap"),
  taskStart: document.querySelector("#task-start"),
  taskEnd: document.querySelector("#task-end"),
  taskDurationWrap: document.querySelector("#task-duration-wrap"),
  taskDuration: document.querySelector("#task-duration"),
  taskFrequency: document.querySelector("#task-frequency"),
  weeklyModeWrap: document.querySelector("#weekly-mode-wrap"),
  taskWeeklyMode: document.querySelector("#task-weekly-mode"),
  repeatAdvancedWrap: document.querySelector("#repeat-advanced-wrap"),
  taskRepeatInterval: document.querySelector("#task-repeat-interval"),
  repeatStrategyWrap: document.querySelector("#repeat-strategy-wrap"),
  taskRepeatStrategy: document.querySelector("#task-repeat-strategy"),
  customWeekdayWrap: document.querySelector("#custom-weekday-wrap"),
  weeklyOptions: document.querySelector("#weekly-options"),
  specificDatesWrap: document.querySelector("#specific-dates-wrap"),
  specificDates: document.querySelector("#specific-dates"),
  onceDateWrap: document.querySelector("#once-date-wrap"),
  taskDate: document.querySelector("#task-date"),
  taskDeadline: document.querySelector("#task-deadline"),
  taskReminderEnabled: document.querySelector("#task-reminder-enabled"),
  taskReminderLeadWrap: document.querySelector("#task-reminder-lead-wrap"),
  taskReminderLead: document.querySelector("#task-reminder-lead"),
  taskList: document.querySelector("#task-list"),
  taskCountNote: document.querySelector("#task-count-note"),
  taskMetricTotal: document.querySelector("#task-metric-total"),
  taskMetricFixed: document.querySelector("#task-metric-fixed"),
  taskMetricRecurring: document.querySelector("#task-metric-recurring"),
  libraryTodayCount: document.querySelector("#library-today-count"),
  libraryDeadlineCount: document.querySelector("#library-deadline-count"),
  libraryFixedRatio: document.querySelector("#library-fixed-ratio"),
  settingsForm: document.querySelector("#settings-form"),
  requestPermission: document.querySelector("#request-permission"),
  notifyBeforeEnabled: document.querySelector("#notify-before-enabled"),
  notifyBeforeOptions: document.querySelector("#notify-before-options"),
  planningBufferOptions: document.querySelector("#planning-buffer-options"),
  preferGapBlocks: document.querySelector("#prefer-gap-blocks"),
  windowMorningStart: document.querySelector("#window-morning-start"),
  windowMorningEnd: document.querySelector("#window-morning-end"),
  windowAfternoonStart: document.querySelector("#window-afternoon-start"),
  windowAfternoonEnd: document.querySelector("#window-afternoon-end"),
  windowEveningStart: document.querySelector("#window-evening-start"),
  windowEveningEnd: document.querySelector("#window-evening-end"),
  soundToggle: document.querySelector("#sound-toggle"),
  notificationLog: document.querySelector("#notification-log"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return normalizeState(DEFAULT_STATE);

  try {
    return normalizeState({ ...DEFAULT_STATE, ...JSON.parse(saved) });
  } catch {
    return normalizeState(DEFAULT_STATE);
  }
}

function normalizeState(nextState) {
  return {
    ...nextState,
    tasks: (nextState.tasks || []).map(normalizeTask),
    settings: normalizeSettings(nextState.settings),
  };
}

function normalizeTask(task) {
  const normalized = {
    ...task,
    priority: Number(task.priority ?? 2),
    fixedSlotEnabled: task.fixedSlotEnabled ?? task.kind === "fixed",
    duration: Math.max(5, Number(task.duration ?? 60)),
    frequency: task.frequency ?? "once",
    weeklyMode:
      task.weeklyMode ??
      (Array.isArray(task.weekdays) && task.weekdays.length > 1 ? "custom_days" : "same_day"),
    weekdays: Array.isArray(task.weekdays) ? task.weekdays.map(Number) : [],
    dates: Array.isArray(task.dates) ? task.dates : [],
    date: task.date ?? "",
    deadline: task.deadline ?? "",
    repeatInterval: Math.max(1, Number(task.repeatInterval ?? 1)),
    repeatStrategy: task.repeatStrategy ?? "calendar",
    nextDate: task.nextDate ?? "",
    lastCompletedAt: task.lastCompletedAt ?? "",
    reminderEnabled: task.reminderEnabled ?? true,
    reminderLeadMinutes:
      task.reminderLeadMinutes === "" || task.reminderLeadMinutes == null
        ? null
        : Number(task.reminderLeadMinutes),
    completed: Boolean(task.completed),
    completedAt: task.completedAt ?? "",
    completedDates: Array.isArray(task.completedDates) ? task.completedDates : [],
    createdAt: task.createdAt ?? new Date().toISOString(),
  };

  normalized.start = task.start || "09:00";
  normalized.end =
    task.end ||
    (normalized.fixedSlotEnabled
      ? formatMinutes(parseMinutes(normalized.start) + normalized.duration)
      : "");
  normalized.duration = normalized.fixedSlotEnabled
    ? durationBetween(normalized.start, normalized.end, normalized.duration)
    : normalized.duration;

  if (!normalized.date && normalized.frequency !== "specific") {
    normalized.date = normalized.createdAt.slice(0, 10);
  }

  if (isCompletionAnchored(normalized) && !normalized.nextDate) {
    normalized.nextDate = normalized.date || normalized.createdAt.slice(0, 10);
  }

  if (normalized.frequency === "weekly" && normalized.weeklyMode === "same_day" && !normalized.weekdays.length) {
    normalized.weekdays = [new Date(`${normalized.date || todayString()}T12:00:00`).getDay()];
  }

  return normalized;
}

function normalizeSettings(settings = {}) {
  const cloudStyle = settings.notificationSettings || {};
  const planningWindows = settings.planningWindows || DEFAULT_PLANNING_WINDOWS;

  return {
    preset: "zenplan",
    focusReminderEnabled:
      settings.focusReminderEnabled ?? settings.notifyBeforeEnabled ?? cloudStyle.enabled ?? true,
    reminderBufferMinutes: Math.max(
      5,
      Number(settings.reminderBufferMinutes ?? settings.notifyBeforeMinutes ?? cloudStyle.timeBeforeMinutes ?? 10)
    ),
    planningBufferMinutes: Math.max(5, Number(settings.planningBufferMinutes ?? 10)),
    soundEnabled:
      settings.soundEnabled ?? cloudStyle.soundEnabled ?? settings.notifySound !== "silent",
    notifyAdjustments: settings.notifyAdjustments ?? true,
    preferGapBlocks: settings.preferGapBlocks ?? true,
    planningWindows: normalizePlanningWindows(planningWindows),
  };
}

function normalizePlanningWindows(windows = DEFAULT_PLANNING_WINDOWS) {
  return {
    morning: normalizeWindow(windows.morning, DEFAULT_PLANNING_WINDOWS.morning),
    afternoon: normalizeWindow(windows.afternoon, DEFAULT_PLANNING_WINDOWS.afternoon),
    evening: normalizeWindow(windows.evening, DEFAULT_PLANNING_WINDOWS.evening),
  };
}

function normalizeWindow(windowValue, fallback) {
  const start = windowValue?.start || fallback.start;
  const end = windowValue?.end || fallback.end;
  return parseMinutes(end) > parseMinutes(start) ? { start, end } : { ...fallback };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayString() {
  return toDateString(new Date());
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString, amount) {
  const next = new Date(`${dateString}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return toDateString(next);
}

function daysBetween(fromDateString, toDateString) {
  const start = new Date(`${fromDateString}T12:00:00`);
  const end = new Date(`${toDateString}T12:00:00`);
  return Math.round((end - start) / 86400000);
}

function startOfWeek(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDisplayDate(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${dateString}T12:00:00`));
}

function weekdayChipLabel(date) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short" })
    .format(date)
    .replace("周", "")
    .replace("星期", "");
}

function monthDayLabel(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function parseMinutes(time) {
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function formatMinutes(minutes) {
  const safe = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hour = String(Math.floor(safe / 60)).padStart(2, "0");
  const minute = String(safe % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function durationBetween(start, end, fallback = 60) {
  if (!start || !end) return fallback;
  const diff = parseMinutes(end) - parseMinutes(start);
  return diff > 0 ? diff : fallback;
}

function roundToFive(value) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function usesFixedSlot(task) {
  return task.fixedSlotEnabled || task.kind === "fixed";
}

function isCompletionAnchored(task) {
  if (task.frequency === "once" || task.frequency === "specific" || task.kind === "deadline") return false;
  if (task.repeatStrategy !== "after_completion") return false;
  if (task.frequency === "daily") return true;
  return task.frequency === "weekly" && task.weeklyMode === "same_day";
}

function taskStartAnchor(task) {
  return task.date || task.createdAt.slice(0, 10) || todayString();
}

function repeatIntervalDays(task) {
  return task.frequency === "weekly" ? task.repeatInterval * 7 : task.repeatInterval;
}

function taskCurrentDueDate(task) {
  return task.nextDate || taskStartAnchor(task);
}

function taskReminderLead(task) {
  if (!task.reminderEnabled) return null;
  return task.reminderLeadMinutes ?? state.settings.reminderBufferMinutes;
}

function taskOccursOn(task, dateString) {
  if (task.kind === "deadline") {
    if (task.completed && task.completedAt === dateString) return true;
    if (task.completed) return false;
    const startDate = taskStartAnchor(task);
    if (dateString < startDate) return false;
    return !task.deadline || dateString <= task.deadline.slice(0, 10);
  }

  if (task.frequency === "once") {
    if (task.completed && task.completedAt === dateString) return true;
    return task.date === dateString;
  }

  if (task.frequency === "specific") {
    return task.dates.includes(dateString);
  }

  if (isCompletionAnchored(task)) {
    if (task.lastCompletedAt === dateString) return true;
    return dateString >= taskCurrentDueDate(task);
  }

  const startDate = taskStartAnchor(task);
  if (dateString < startDate) return false;

  if (task.frequency === "daily") {
    return daysBetween(startDate, dateString) % task.repeatInterval === 0;
  }

  if (task.frequency === "weekly") {
    if (!task.weekdays.includes(new Date(`${dateString}T12:00:00`).getDay())) return false;
    const startWeek = toDateString(startOfWeek(startDate));
    const currentWeek = toDateString(startOfWeek(dateString));
    const diffWeeks = Math.floor(daysBetween(startWeek, currentWeek) / 7);
    return diffWeeks % task.repeatInterval === 0;
  }

  return false;
}

function isTaskCompletedOn(task, dateString) {
  if (task.kind === "deadline" || task.frequency === "once") return task.completed;
  if (isCompletionAnchored(task)) return task.lastCompletedAt === dateString;
  return task.completedDates.includes(dateString);
}

function toggleTaskCompletion(taskId, dateString) {
  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;

    if (task.kind === "deadline" || task.frequency === "once") {
      const completed = !task.completed;
      return normalizeTask({
        ...task,
        completed,
        completedAt: completed ? dateString : "",
      });
    }

    if (isCompletionAnchored(task)) {
      const completed = task.lastCompletedAt !== dateString;
      return normalizeTask({
        ...task,
        lastCompletedAt: completed ? dateString : "",
        nextDate: completed ? addDaysToDateString(dateString, repeatIntervalDays(task)) : dateString,
      });
    }

    const completedDates = new Set(task.completedDates);
    if (completedDates.has(dateString)) {
      completedDates.delete(dateString);
    } else {
      completedDates.add(dateString);
    }

    return normalizeTask({
      ...task,
      completedDates: [...completedDates],
    });
  });

  saveState();
}

function expandTasksForDate(dateString) {
  return state.tasks
    .map(normalizeTask)
    .filter((task) => taskOccursOn(task, dateString))
    .map((task) => ({
      ...task,
      completedForDate: isTaskCompletedOn(task, dateString),
      startMinutes: usesFixedSlot(task) ? parseMinutes(task.start) : null,
      endMinutes: usesFixedSlot(task) ? parseMinutes(task.end) : null,
    }));
}

function deadlinePressure(task, dateString) {
  if (task.kind !== "deadline" || !task.deadline) {
    return { sessions: 1, multiplier: 1, label: "" };
  }

  const daysLeft = daysBetween(dateString, task.deadline.slice(0, 10));
  if (daysLeft <= 0) return { sessions: 3, multiplier: 1.8, label: "高压" };
  if (daysLeft <= 2) return { sessions: 2, multiplier: 1.5, label: "冲刺" };
  if (daysLeft <= 5) return { sessions: 2, multiplier: 1.25, label: "升温" };
  return { sessions: 1, multiplier: 1, label: "" };
}

function buildScheduleEntries(task, dateString) {
  if (usesFixedSlot(task)) {
    return [
      {
        entryId: `${task.id}:0`,
        taskId: task.id,
        title: task.title,
        kind: task.kind,
        priority: task.priority,
        duration: task.duration,
        startMinutes: task.startMinutes,
        endMinutes: task.endMinutes,
        source: task.kind === "deadline" ? "截止" : "固定",
        placementHint: "fixed",
        fixedSlot: true,
        completed: task.completedForDate,
        deadline: task.deadline,
        pressureLabel: deadlinePressure(task, dateString).label,
      },
    ];
  }

  const pressure = deadlinePressure(task, dateString);
  const totalDuration = roundToFive(task.duration * pressure.multiplier);
  const segmentDuration = roundToFive(totalDuration / pressure.sessions);

  return Array.from({ length: pressure.sessions }, (_, index) => ({
    entryId: `${task.id}:${index}`,
    taskId: task.id,
    title: pressure.sessions > 1 ? `${task.title} · 专注段 ${index + 1}` : task.title,
    kind: task.kind,
    priority: task.priority,
    duration: segmentDuration,
    source: task.kind === "deadline" ? (pressure.label || "截止") : "自动",
    placementHint: "window",
    fixedSlot: false,
    completed: task.completedForDate,
    deadline: task.deadline,
    pressureLabel: pressure.label,
  }));
}

function comparePlanningEntries(a, b) {
  const priorityDiff = b.priority - a.priority;
  if (priorityDiff !== 0) return priorityDiff;

  const urgencyDiff = deadlineUrgencyValue(b) - deadlineUrgencyValue(a);
  if (urgencyDiff !== 0) return urgencyDiff;

  return a.title.localeCompare(b.title, "zh-CN");
}

function deadlineUrgencyValue(entry) {
  return { 高压: 3, 冲刺: 2, 升温: 1 }[entry.pressureLabel] || 0;
}

function planningWindowBlocks(nowMinutes = 0) {
  return Object.entries(state.settings.planningWindows)
    .map(([key, windowValue]) => ({
      key,
      startMinutes: Math.max(parseMinutes(windowValue.start), nowMinutes || 0),
      endMinutes: parseMinutes(windowValue.end),
      placementHint: "window",
    }))
    .filter((block) => block.endMinutes - block.startMinutes >= 5);
}

function buildGapBlocks(fixedEntries, windowBlocks) {
  const buffer = state.settings.planningBufferMinutes;
  const gapBlocks = [];

  for (const windowBlock of windowBlocks) {
    let cursor = windowBlock.startMinutes;
    const busy = fixedEntries
      .filter((item) => item.endMinutes > windowBlock.startMinutes && item.startMinutes < windowBlock.endMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const item of busy) {
      if (item.startMinutes - cursor >= 5) {
        gapBlocks.push({
          startMinutes: cursor,
          endMinutes: item.startMinutes,
          placementHint: "gap",
        });
      }
      cursor = Math.max(cursor, item.endMinutes + buffer);
    }

    if (windowBlock.endMinutes - cursor >= 5) {
      gapBlocks.push({
        startMinutes: cursor,
        endMinutes: windowBlock.endMinutes,
        placementHint: "gap",
      });
    }
  }

  return gapBlocks;
}

function getWorkBlocks(nowMinutes = 0, fixedEntries = []) {
  const windows = planningWindowBlocks(nowMinutes);
  if (!state.settings.preferGapBlocks || !fixedEntries.length) {
    return windows;
  }

  return [...buildGapBlocks(fixedEntries, windows), ...windows];
}

function findSlot(schedule, workBlocks, duration) {
  const buffer = state.settings.planningBufferMinutes;

  for (const block of workBlocks) {
    let cursor = block.startMinutes;
    const busy = schedule
      .filter((item) => item.endMinutes > block.startMinutes && item.startMinutes < block.endMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const item of busy) {
      if (item.startMinutes - cursor >= duration) {
        return { startMinutes: cursor, placementHint: block.placementHint };
      }
      cursor = Math.max(cursor, item.endMinutes + buffer);
    }

    if (block.endMinutes - cursor >= duration) {
      return { startMinutes: cursor, placementHint: block.placementHint };
    }
  }

  return null;
}

function generateSchedule(dateString, { currentTimeAware = false } = {}) {
  const expandedTasks = expandTasksForDate(dateString);
  const fixedEntries = [];
  const pendingEntries = [];
  const completedDynamicEntries = [];

  for (const task of expandedTasks) {
    const entries = buildScheduleEntries(task, dateString);
    if (entries[0].fixedSlot) {
      fixedEntries.push(...entries);
      continue;
    }

    if (task.completedForDate) {
      const preservedEntries =
        lastRenderedScheduleDate === dateString
          ? lastRenderedSchedule.filter((item) => item.taskId === task.id)
          : [];

      if (preservedEntries.length) {
        completedDynamicEntries.push(
          ...preservedEntries.map((item) => ({
            ...item,
            completed: true,
            deadline: task.deadline,
          }))
        );
      } else {
        completedDynamicEntries.push(...entries);
      }
      continue;
    }

    pendingEntries.push(...entries);
  }

  fixedEntries.sort((a, b) => a.startMinutes - b.startMinutes);
  pendingEntries.sort(comparePlanningEntries);
  completedDynamicEntries.sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));

  const nowMinutes =
    currentTimeAware && dateString === todayString()
      ? new Date().getHours() * 60 + new Date().getMinutes() + 5
      : 0;
  const schedule = [...fixedEntries, ...completedDynamicEntries.filter((item) => Number.isFinite(item.startMinutes))];
  const workBlocks = getWorkBlocks(nowMinutes, fixedEntries);

  for (const entry of pendingEntries) {
    const preserved =
      lastRenderedScheduleDate === dateString
        ? lastRenderedSchedule.find((item) => item.entryId === entry.entryId)
        : null;
    const slotResult =
      preserved && !currentTimeAware
        ? {
            startMinutes: preserved.startMinutes,
            placementHint: preserved.placementHint || "window",
          }
        : findSlot(schedule, workBlocks, entry.duration);

    const startMinutes = slotResult?.startMinutes ?? Math.max(nowMinutes, parseMinutes(state.settings.planningWindows.evening.start));
    const placementHint = slotResult?.placementHint ?? "late";
    const source = placementHint === "gap" ? "课间" : placementHint === "late" ? "顺延" : entry.source;

    schedule.push({
      ...entry,
      startMinutes,
      endMinutes: startMinutes + entry.duration,
      placementHint,
      source,
    });
  }

  const unslottedCompleted = completedDynamicEntries.filter((item) => !Number.isFinite(item.startMinutes));
  for (const entry of unslottedCompleted) {
    const slotResult = findSlot(schedule, planningWindowBlocks(0), entry.duration);
    const startMinutes = slotResult?.startMinutes ?? parseMinutes(state.settings.planningWindows.evening.end) - entry.duration;
    schedule.push({
      ...entry,
      startMinutes,
      endMinutes: startMinutes + entry.duration,
      placementHint: slotResult?.placementHint || "window",
    });
  }

  return schedule.sort((a, b) => a.startMinutes - b.startMinutes);
}

function planSignature(schedule) {
  return schedule
    .map((item) => `${item.entryId}:${item.startMinutes}:${item.endMinutes}:${item.completed ? "done" : "todo"}`)
    .join("|");
}

function preserveCurrentLayout(dateString) {
  if (lastRenderedScheduleDate !== dateString || !lastRenderedSchedule.length) {
    return generateSchedule(dateString, { currentTimeAware: false });
  }

  const lookup = new Map(state.tasks.map((task) => [task.id, normalizeTask(task)]));
  return lastRenderedSchedule
    .filter((entry) => {
      const task = lookup.get(entry.taskId);
      return task && taskOccursOn(task, dateString);
    })
    .map((entry) => {
      const task = lookup.get(entry.taskId);
      return {
        ...entry,
        kind: task.kind,
        priority: task.priority,
        completed: isTaskCompletedOn(task, dateString),
        deadline: task.deadline,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

function planningRuleSummaryText() {
  const windows = Object.values(state.settings.planningWindows)
    .map((windowValue) => `${windowValue.start}-${windowValue.end}`)
    .join(" / ");
  return `${state.settings.preferGapBlocks ? "优先课间空档" : "按学习窗顺排"} · 缓冲 ${state.settings.planningBufferMinutes} 分钟 · ${windows}`;
}

function ruleFocusText(schedule) {
  const hasFixed = schedule.some((item) => item.fixedSlot);
  if (state.settings.preferGapBlocks && hasFixed) {
    return `先吃课间空档 · 缓冲 ${state.settings.planningBufferMinutes} 分钟`;
  }
  return `顺着学习窗安排 · 缓冲 ${state.settings.planningBufferMinutes} 分钟`;
}

function weekProgressText(dateString) {
  const weekStart = startOfWeek(dateString);
  const weekDates = Array.from({ length: 7 }, (_, index) => toDateString(addDays(weekStart, index)));

  let dueCount = 0;
  let doneCount = 0;

  for (const task of state.tasks.map(normalizeTask)) {
    if (weekDates.some((day) => taskOccursOn(task, day))) {
      dueCount += 1;
    }
    if (weekDates.some((day) => isTaskCompletedOn(task, day))) {
      doneCount += 1;
    }
  }

  return `本周完成 ${doneCount} / ${dueCount}`;
}

function scheduleLoadNote(schedule) {
  if (!schedule.length) {
    return "今天还没有排程，先把固定课表和临时安排录进任务库。";
  }

  const pendingMinutes = schedule
    .filter((item) => !item.completed)
    .reduce((total, item) => total + item.duration, 0);
  const gapTasks = schedule.filter((item) => item.placementHint === "gap").length;

  if (pendingMinutes >= 6 * 60) {
    return `今天属于高负载日，剩余约 ${durationText(pendingMinutes)}，建议先吃掉最硬的安排。`;
  }
  if (gapTasks >= 2) {
    return `今天有 ${gapTasks} 项任务利用了课间空档，节奏会比较紧凑。`;
  }
  if (pendingMinutes <= 2 * 60) {
    return "今天相对轻盈，适合留一点空白给临时事务和休息。";
  }
  return `今天节奏比较均衡，剩余约 ${durationText(pendingMinutes)}，可以把重点任务放在前半程。`;
}

function deadlineAlertText(dateString) {
  const candidates = state.tasks
    .map(normalizeTask)
    .filter((task) => task.kind === "deadline" && task.deadline && !task.completed)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  if (!candidates.length) return "暂无临近截止";

  const nearest = candidates[0];
  const daysLeft = daysBetween(dateString, nearest.deadline.slice(0, 10));
  if (daysLeft <= 0) return `${nearest.title} 今天到期`;
  if (daysLeft === 1) return `${nearest.title} 明天截止`;
  return `${nearest.title} 还有 ${daysLeft} 天`;
}

function renderWeekStrip(dateString) {
  const weekStart = startOfWeek(dateString);
  const today = todayString();

  els.weekStrip.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const value = toDateString(date);
    return `
      <button
        class="week-day ${value === dateString ? "active" : ""} ${value === today ? "is-today" : ""}"
        data-week-date="${value}"
        type="button"
        aria-pressed="${value === dateString}"
      >
        <span class="week-day-label">${weekdayChipLabel(date)}</span>
        <strong class="week-day-date">${date.getDate()}</strong>
        <small class="week-day-meta">${monthDayLabel(date)}</small>
      </button>
    `;
  }).join("");
}

function renderTodayInsights(schedule, dateString, { changed = false, forceAdjustment = false } = {}) {
  const fixedCount = schedule.filter((item) => item.fixedSlot).length;
  const remainingCount = schedule.filter((item) => !item.completed).length;

  els.todayTitle.textContent = `${formatDisplayDate(dateString)} 的整体安排`;
  els.todaySubtitle.textContent = `固定安排 ${fixedCount} 项，剩余待做 ${remainingCount} 项。`;
  els.metricTotal.textContent = String(schedule.length);
  els.metricFixed.textContent = String(fixedCount);
  els.metricFlexible.textContent = String(schedule.filter((item) => !item.fixedSlot).length);
  els.metricCompleted.textContent = String(schedule.filter((item) => item.completed).length);
  els.todayLoadNote.textContent = scheduleLoadNote(schedule);
  els.deadlineAlert.textContent = deadlineAlertText(dateString);
  els.ruleFocusNote.textContent = ruleFocusText(schedule);
  els.planningRulesNote.textContent = planningRuleSummaryText();
  els.weekProgressNote.textContent = weekProgressText(dateString);

  els.adjustmentNote.textContent = forceAdjustment
    ? "已结合当前时间点和已完成情况，重新优化今天剩余时间的安排。"
    : changed
      ? "任务状态发生变化，界面已实时同步。"
      : "计划已同步当前任务。新增、勾选或编辑任务后，可重新生成一天的节奏。";
}

function renderSchedule(forceAdjustment = false, preserveLayout = false) {
  const dateString = els.planDate.value;
  const schedule = preserveLayout
    ? preserveCurrentLayout(dateString)
    : generateSchedule(dateString, { currentTimeAware: forceAdjustment });
  const signature = planSignature(schedule);
  const changed = Boolean(state.lastPlanSignature && state.lastPlanSignature !== signature);

  renderWeekStrip(dateString);
  renderTodayInsights(schedule, dateString, { changed, forceAdjustment });
  els.nextFocus.textContent = nextFocusText(schedule, dateString);

  state.lastPlanSignature = signature;
  lastRenderedSchedule = schedule.map((item) => ({ ...item }));
  lastRenderedScheduleDate = dateString;
  saveState();

  if (!schedule.length) {
    els.scheduleList.innerHTML = '<div class="empty-state">今天还没有安排。</div>';
    scheduleNotifications([]);
    return;
  }

  els.scheduleList.innerHTML = schedule
    .map((item) => {
      const task = state.tasks.find((entry) => entry.id === item.taskId);
      const toggleDisabled = !task;
      return `
        <article class="schedule-item ${item.completed ? "is-completed" : ""}">
          <button
            class="completion-toggle ${item.completed ? "done" : ""}"
            data-toggle-complete="${item.taskId}"
            type="button"
            aria-label="${item.completed ? "取消完成" : "标记完成"}"
            ${toggleDisabled ? "disabled" : ""}
          ></button>
          <div class="schedule-time">${formatMinutes(item.startMinutes)} - ${formatMinutes(item.endMinutes)}</div>
          <div class="schedule-copy">
            <div class="schedule-title">${escapeHtml(item.title)}</div>
            <div class="schedule-meta">${scheduleMetaText(item)}</div>
          </div>
          <span class="tag">${item.source}</span>
        </article>
      `;
    })
    .join("");

  if (forceAdjustment && state.settings.notifyAdjustments) {
    notify("今日计划已重排", "已基于当前时间和完成情况优化剩余安排。");
  }

  scheduleNotifications(schedule);
}

function nextFocusText(schedule, dateString) {
  if (!schedule.length) return "等待生成";
  if (dateString !== todayString()) {
    return `首个安排：${schedule[0].title} · ${formatMinutes(schedule[0].startMinutes)}`;
  }

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const next = schedule.find((item) => !item.completed && item.endMinutes >= nowMinutes);
  if (!next) return "今天的安排已经完成或结束";
  return `下一项：${next.title} · ${formatMinutes(next.startMinutes)} 开始`;
}

function scheduleMetaText(item) {
  const parts = [durationText(item.duration), kindText(item.kind)];
  if (item.placementHint === "gap") parts.push("课间优先");
  if (item.placementHint === "late") parts.push("顺延安排");
  if (item.pressureLabel) parts.push(`${item.pressureLabel}规划`);
  if (item.deadline) parts.push(`截止 ${item.deadline.replace("T", " ")}`);
  return parts.join(" · ");
}

function renderLibraryInsights(dateString) {
  const allTasks = state.tasks.map(normalizeTask);
  const total = allTasks.length;
  const fixedCount = allTasks.filter((task) => usesFixedSlot(task)).length;
  const todayCount = allTasks.filter((task) => taskOccursOn(task, dateString)).length;
  const deadlineCount = allTasks.filter((task) => {
    if (task.kind !== "deadline" || !task.deadline || task.completed) return false;
    return daysBetween(dateString, task.deadline.slice(0, 10)) <= 3;
  }).length;

  els.taskMetricTotal.textContent = String(total);
  els.taskMetricFixed.textContent = String(fixedCount);
  els.taskMetricRecurring.textContent = String(allTasks.filter((task) => task.frequency !== "once").length);
  els.libraryTodayCount.textContent = `${todayCount} 项`;
  els.libraryDeadlineCount.textContent = `${deadlineCount} 项`;
  els.libraryFixedRatio.textContent = total ? `${Math.round((fixedCount / total) * 100)}%` : "0%";
}

function renderTasks() {
  const dateString = els.planDate.value;
  const tasks = [...state.tasks].map(normalizeTask).sort(compareTasks);
  renderLibraryInsights(dateString);
  els.taskCountNote.textContent = `${tasks.length} 个任务`;

  if (!tasks.length) {
    els.taskList.innerHTML = '<div class="empty-state">任务库还是空的。先添加课程、会议或目标吧。</div>';
    return;
  }

  els.taskList.innerHTML = tasks
    .map((task) => {
      const completed = isTaskCompletedOn(task, dateString);
      const occursToday = taskOccursOn(task, dateString);
      return `
        <article class="task-card ${completed ? "is-completed" : ""}">
          <div class="task-card-head">
            <div class="task-card-title">
              <div class="task-title-row">
                <button
                  class="completion-toggle ${completed ? "done" : ""}"
                  data-toggle-complete="${task.id}"
                  type="button"
                  aria-label="${completed ? "取消完成" : "标记完成"}"
                ></button>
                <strong>${escapeHtml(task.title)}</strong>
              </div>
              <div class="task-pill-row">
                <span class="task-pill">${kindText(task.kind)}</span>
                <span class="task-pill priority-${priorityName(task.priority)}">${priorityText(task.priority)}</span>
                <span class="task-pill">${frequencyText(task)}</span>
                ${usesFixedSlot(task) ? `<span class="task-pill">${task.start} - ${task.end}</span>` : ""}
                <span class="task-pill">${task.reminderEnabled ? reminderText(task) : "提醒关闭"}</span>
                ${occursToday ? '<span class="task-pill">今天发生</span>' : ""}
              </div>
            </div>
            <div class="task-card-actions">
              <button class="ghost-btn task-inline-btn" data-edit="${task.id}" type="button">编辑</button>
              <button class="danger-btn task-inline-btn" data-delete="${task.id}" type="button">删除</button>
            </div>
          </div>
          <p class="task-card-detail">${taskTimingText(task, dateString)}</p>
          ${task.deadline ? `<p class="task-card-detail">最终截止日期：${task.deadline.replace("T", " ")}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function compareTasks(a, b) {
  const dayWeightDiff = taskDayWeight(a) - taskDayWeight(b);
  if (dayWeightDiff !== 0) return dayWeightDiff;

  const kindWeightDiff = kindOrder(a.kind) - kindOrder(b.kind);
  if (kindWeightDiff !== 0) return kindWeightDiff;

  const timeA = a.start ? parseMinutes(a.start) : 24 * 60;
  const timeB = b.start ? parseMinutes(b.start) : 24 * 60;
  if (timeA !== timeB) return timeA - timeB;

  return a.title.localeCompare(b.title, "zh-CN");
}

function taskDayWeight(task) {
  if (task.kind === "deadline" && task.deadline) return -1;
  if (task.frequency === "daily") return 0;
  if (task.frequency === "weekly") return Math.min(...task.weekdays.map(weekdayWeight), 8);
  if (task.frequency === "specific" && task.dates.length) return 8;
  return 9;
}

function weekdayWeight(day) {
  return day === 0 ? 7 : day;
}

function kindOrder(kind) {
  return { fixed: 0, deadline: 1, flexible: 2 }[kind] ?? 3;
}

function taskTimingText(task, dateString) {
  const parts = [];
  if (usesFixedSlot(task)) {
    parts.push(`固定时段 ${task.start} - ${task.end}`);
  } else {
    parts.push(`专注时长 ${durationText(task.duration)}`);
  }

  if (task.frequency !== "once" && task.kind !== "deadline") {
    parts.push(frequencyText(task));
  }

  if (isCompletionAnchored(task)) {
    parts.push(`当前周期从 ${taskCurrentDueDate(task)} 开始`);
  }

  if (task.kind === "deadline" && task.deadline) {
    const daysLeft = daysBetween(dateString, task.deadline.slice(0, 10));
    parts.push(daysLeft <= 0 ? "已进入高压冲刺区" : `距离截止还有 ${daysLeft} 天`);
  }

  parts.push(task.reminderEnabled ? reminderText(task) : "提醒关闭");
  return parts.join(" · ");
}

function renderSettings() {
  els.notifyBeforeEnabled.checked = state.settings.focusReminderEnabled;
  els.preferGapBlocks.checked = state.settings.preferGapBlocks;

  els.notifyBeforeOptions.querySelectorAll("button").forEach((button) => {
    const active = Number(button.dataset.minutes) === state.settings.reminderBufferMinutes;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  els.planningBufferOptions.querySelectorAll("button").forEach((button) => {
    const active = Number(button.dataset.buffer) === state.settings.planningBufferMinutes;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  els.windowMorningStart.value = state.settings.planningWindows.morning.start;
  els.windowMorningEnd.value = state.settings.planningWindows.morning.end;
  els.windowAfternoonStart.value = state.settings.planningWindows.afternoon.start;
  els.windowAfternoonEnd.value = state.settings.planningWindows.afternoon.end;
  els.windowEveningStart.value = state.settings.planningWindows.evening.start;
  els.windowEveningEnd.value = state.settings.planningWindows.evening.end;

  els.soundToggle.textContent = state.settings.soundEnabled ? "已开启音效" : "已静音";
  els.soundToggle.classList.toggle("muted", !state.settings.soundEnabled);
}

function scheduleNotifications(schedule) {
  notificationTimers.forEach(clearTimeout);
  notificationTimers = [];

  if (!state.settings.focusReminderEnabled || els.planDate.value !== todayString()) return;

  const taskMap = new Map(state.tasks.map((task) => [task.id, normalizeTask(task)]));
  const now = new Date();

  for (const item of schedule.filter((entry) => !entry.completed)) {
    const task = taskMap.get(item.taskId);
    const leadMinutes = task ? taskReminderLead(task) : state.settings.reminderBufferMinutes;
    if (leadMinutes == null) continue;

    const start = new Date(`${els.planDate.value}T${formatMinutes(item.startMinutes)}:00`);
    const remindAt = new Date(start.getTime() - leadMinutes * 60 * 1000);
    const delay = remindAt.getTime() - now.getTime();
    if (delay <= 0 || delay > 2147483647) continue;

    notificationTimers.push(
      setTimeout(() => {
        notify(`即将开始：${item.title}`, `${leadMinutes} 分钟后开始。`);
      }, delay)
    );
  }
}

function notify(title, body) {
  addNotificationLog(title, body);
  playSound();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function addNotificationLog(title, body) {
  const item = document.createElement("div");
  item.textContent = `${new Date().toLocaleTimeString()} · ${title}：${body}`;
  els.notificationLog.prepend(item);
}

function playSound() {
  if (!state.settings.soundEnabled) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  } catch {
    // Ignore browsers that block audio.
  }
}

function durationText(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function kindText(kind) {
  return {
    fixed: "固定安排",
    flexible: "常规任务",
    deadline: "目标任务",
  }[kind];
}

function priorityText(priority) {
  return { 3: "高优先级", 2: "中优先级", 1: "低优先级" }[Number(priority)];
}

function priorityName(priority) {
  return { 3: "high", 2: "medium", 1: "low" }[Number(priority)];
}

function reminderText(task) {
  const lead = taskReminderLead(task);
  return lead == null ? "提醒关闭" : `提前 ${lead} 分钟提醒`;
}

function frequencyText(task) {
  if (task.kind === "deadline") return "截止驱动";
  if (task.frequency === "specific") return `特定日期 ${task.dates.join(" / ")}`;

  if (task.frequency === "daily") {
    if (task.repeatStrategy === "after_completion") {
      return task.repeatInterval === 1 ? "完成后顺延 1 天" : `完成后顺延 ${task.repeatInterval} 天`;
    }
    return task.repeatInterval === 1 ? "每日重复" : `每 ${task.repeatInterval} 天`;
  }

  if (task.frequency === "weekly") {
    const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    if (task.repeatStrategy === "after_completion" && task.weeklyMode === "same_day") {
      return task.repeatInterval === 1 ? "完成后顺延 1 周" : `完成后顺延 ${task.repeatInterval} 周`;
    }
    if (task.weeklyMode === "custom_days") {
      return `${task.repeatInterval === 1 ? "每周" : `每 ${task.repeatInterval} 周`} ${task.weekdays
        .map((day) => weekdayNames[day])
        .join(" / ")}`;
    }
    return task.repeatInterval === 1 ? "每周重复" : `每 ${task.repeatInterval} 周`;
  }

  return task.date || "单次";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function activateView(viewName) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}-view`));
}

function canUseCompletionStrategy(frequency, weeklyMode) {
  return frequency === "daily" || (frequency === "weekly" && weeklyMode === "same_day");
}

function updateFrequencyFields() {
  const frequency = els.taskKind.value === "deadline" ? "once" : els.taskFrequency.value;
  const fixedSlotEnabled = els.taskFixedSlotEnabled.checked || els.taskKind.value === "fixed";
  const weeklyMode = els.taskWeeklyMode.value;
  const recurring = frequency === "daily" || frequency === "weekly";
  const allowCompletionStrategy = canUseCompletionStrategy(frequency, weeklyMode);

  els.weeklyModeWrap.classList.toggle("hidden", frequency !== "weekly");
  els.customWeekdayWrap.classList.toggle("hidden", !(frequency === "weekly" && weeklyMode === "custom_days"));
  els.weeklyOptions.classList.toggle("hidden", !(frequency === "weekly" && weeklyMode === "custom_days"));
  els.specificDatesWrap.classList.toggle("hidden", frequency !== "specific");
  els.onceDateWrap.classList.toggle("hidden", frequency !== "once");
  els.taskTimeWindowWrap.classList.toggle("hidden", !fixedSlotEnabled);
  els.taskDurationWrap.classList.toggle("hidden", fixedSlotEnabled);
  els.repeatAdvancedWrap.classList.toggle("hidden", !recurring);
  els.repeatStrategyWrap.classList.toggle("hidden", !allowCompletionStrategy);

  if (!allowCompletionStrategy) {
    els.taskRepeatStrategy.value = "calendar";
  }
}

function syncDurationFromTimeWindow() {
  if (!els.taskFixedSlotEnabled.checked && els.taskKind.value !== "fixed") return;
  els.taskDuration.value = String(durationBetween(els.taskStart.value, els.taskEnd.value, Number(els.taskDuration.value) || 60));
}

function syncReminderFields() {
  els.taskReminderLeadWrap.classList.toggle("hidden", !els.taskReminderEnabled.checked);
}

function clearWeekdayChecks() {
  els.weeklyOptions.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
}

function resetTaskForm() {
  editingTaskId = null;
  els.taskEditorTitle.textContent = "新建任务";
  els.taskSubmitButton.textContent = "保存任务";
  els.taskForm.reset();
  clearWeekdayChecks();
  els.taskKind.value = "fixed";
  els.taskPriority.value = "2";
  els.taskFixedSlotEnabled.checked = true;
  els.taskStart.value = "09:00";
  els.taskEnd.value = "10:00";
  els.taskDuration.value = "60";
  els.taskFrequency.value = "once";
  els.taskWeeklyMode.value = "same_day";
  els.taskRepeatInterval.value = "1";
  els.taskRepeatStrategy.value = "calendar";
  els.taskDate.value = els.planDate.value || todayString();
  els.taskDeadline.value = "";
  els.taskReminderEnabled.checked = true;
  els.taskReminderLead.value = "";
  els.specificDates.value = "";
  updateFrequencyFields();
  syncDurationFromTimeWindow();
  syncReminderFields();
}

function openTaskEditor(taskId = null) {
  activateView("tasks");

  if (!taskId) {
    resetTaskForm();
  } else {
    const task = normalizeTask(state.tasks.find((item) => item.id === taskId));
    if (!task) return;

    editingTaskId = taskId;
    els.taskEditorTitle.textContent = "编辑任务";
    els.taskSubmitButton.textContent = "更新任务";
    els.taskTitle.value = task.title;
    els.taskKind.value = task.kind;
    els.taskPriority.value = String(task.priority);
    els.taskFixedSlotEnabled.checked = usesFixedSlot(task);
    els.taskStart.value = task.start;
    els.taskEnd.value = task.end || formatMinutes(parseMinutes(task.start) + task.duration);
    els.taskDuration.value = String(task.duration);
    els.taskFrequency.value = task.kind === "deadline" ? "once" : task.frequency;
    els.taskWeeklyMode.value = task.weeklyMode;
    els.taskRepeatInterval.value = String(task.repeatInterval);
    els.taskRepeatStrategy.value = task.repeatStrategy;
    els.taskDate.value = task.date || taskStartAnchor(task);
    els.taskDeadline.value = task.deadline;
    els.specificDates.value = task.dates.join(", ");
    els.taskReminderEnabled.checked = task.reminderEnabled;
    els.taskReminderLead.value = task.reminderLeadMinutes == null ? "" : String(task.reminderLeadMinutes);
    clearWeekdayChecks();
    task.weekdays.forEach((day) => {
      const input = els.weeklyOptions.querySelector(`input[value="${day}"]`);
      if (input) input.checked = true;
    });
    updateFrequencyFields();
    syncDurationFromTimeWindow();
    syncReminderFields();
  }

  els.taskEditorModal.classList.remove("hidden");
  els.taskEditorModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  queueMicrotask(() => els.taskTitle.focus());
}

function closeTaskEditor() {
  els.taskEditorModal.classList.add("hidden");
  els.taskEditorModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  resetTaskForm();
}

function normalizeWeekdays(weekdays, weeklyMode, fallbackDate) {
  if (weeklyMode === "custom_days") {
    return weekdays.length ? weekdays : [new Date(`${fallbackDate}T12:00:00`).getDay()];
  }
  return [new Date(`${fallbackDate}T12:00:00`).getDay()];
}

function normalizeSpecificDates(dates, fallbackDate) {
  return dates.length ? dates : [fallbackDate];
}

function readTaskForm() {
  const frequency = els.taskKind.value === "deadline" ? "once" : els.taskFrequency.value;
  const weeklyMode = frequency === "weekly" ? els.taskWeeklyMode.value : "same_day";
  const repeatStrategy =
    frequency === "once" || frequency === "specific" || els.taskKind.value === "deadline"
      ? "calendar"
      : els.taskRepeatStrategy.value;
  const anchorDate = editingTaskId
    ? normalizeTask(state.tasks.find((task) => task.id === editingTaskId)).date || els.planDate.value || todayString()
    : els.planDate.value || todayString();
  const weekdays = [...els.weeklyOptions.querySelectorAll("input:checked")].map((input) => Number(input.value));
  const dates = els.specificDates.value
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean);
  const fixedSlotEnabled = els.taskFixedSlotEnabled.checked || els.taskKind.value === "fixed";
  const duration = fixedSlotEnabled
    ? durationBetween(els.taskStart.value, els.taskEnd.value, Number(els.taskDuration.value) || 60)
    : Math.max(5, Number(els.taskDuration.value) || 60);

  return {
    title: els.taskTitle.value.trim(),
    kind: els.taskKind.value,
    priority: Number(els.taskPriority.value),
    fixedSlotEnabled,
    start: els.taskStart.value,
    end: fixedSlotEnabled ? els.taskEnd.value : "",
    duration,
    frequency,
    weeklyMode,
    weekdays: frequency === "weekly" ? normalizeWeekdays(weekdays, weeklyMode, anchorDate) : [],
    dates: frequency === "specific" ? normalizeSpecificDates(dates, anchorDate) : [],
    date: frequency === "once" ? (els.taskDate.value || anchorDate) : anchorDate,
    deadline: els.taskDeadline.value,
    repeatInterval: frequency === "daily" || frequency === "weekly" ? Math.max(1, Number(els.taskRepeatInterval.value) || 1) : 1,
    repeatStrategy,
    nextDate:
      repeatStrategy === "after_completion"
        ? editingTaskId
          ? normalizeTask(state.tasks.find((task) => task.id === editingTaskId)).nextDate || anchorDate
          : anchorDate
        : "",
    reminderEnabled: els.taskReminderEnabled.checked,
    reminderLeadMinutes: els.taskReminderLead.value ? Number(els.taskReminderLead.value) : null,
  };
}

function saveTaskForm(event) {
  event.preventDefault();
  const taskData = readTaskForm();
  if (!taskData.title) return;

  if (editingTaskId) {
    state.tasks = state.tasks.map((task) =>
      task.id === editingTaskId
        ? normalizeTask({
            ...task,
            ...taskData,
          })
        : task
    );
  } else {
    state.tasks.push(
      normalizeTask({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        completed: false,
        completedAt: "",
        completedDates: [],
        lastCompletedAt: "",
        ...taskData,
      })
    );
  }

  saveState();
  renderTasks();
  renderSchedule(true, false);
  closeTaskEditor();
}

function handleTaskListClick(event) {
  const completeButton = event.target.closest("[data-toggle-complete]");
  if (completeButton) {
    toggleTaskCompletion(completeButton.dataset.toggleComplete, els.planDate.value);
    renderTasks();
    renderSchedule(false, true);
    return;
  }

  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    openTaskEditor(editButton.dataset.edit);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (!deleteButton) return;

  state.tasks = state.tasks.filter((task) => task.id !== deleteButton.dataset.delete);
  saveState();
  renderTasks();
  renderSchedule(true, false);
}

function handleScheduleClick(event) {
  const completeButton = event.target.closest("[data-toggle-complete]");
  if (!completeButton) return;

  toggleTaskCompletion(completeButton.dataset.toggleComplete, els.planDate.value);
  renderTasks();
  renderSchedule(false, true);
}

function readPlanningWindowsFromForm() {
  return {
    morning: {
      start: els.windowMorningStart.value || DEFAULT_PLANNING_WINDOWS.morning.start,
      end: els.windowMorningEnd.value || DEFAULT_PLANNING_WINDOWS.morning.end,
    },
    afternoon: {
      start: els.windowAfternoonStart.value || DEFAULT_PLANNING_WINDOWS.afternoon.start,
      end: els.windowAfternoonEnd.value || DEFAULT_PLANNING_WINDOWS.afternoon.end,
    },
    evening: {
      start: els.windowEveningStart.value || DEFAULT_PLANNING_WINDOWS.evening.start,
      end: els.windowEveningEnd.value || DEFAULT_PLANNING_WINDOWS.evening.end,
    },
  };
}

function commitSettings({ announce = false } = {}) {
  state.settings = normalizeSettings({
    ...state.settings,
    focusReminderEnabled: els.notifyBeforeEnabled.checked,
    preferGapBlocks: els.preferGapBlocks.checked,
    planningWindows: readPlanningWindowsFromForm(),
  });
  saveState();
  renderSettings();
  renderSchedule(false, false);
  if (announce) {
    addNotificationLog("设置已保存", "新的规划和提醒偏好已生效。");
  }
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateView(tab.dataset.view));
});

els.openTaskEditor.addEventListener("click", () => openTaskEditor());
els.closeTaskEditor.addEventListener("click", closeTaskEditor);
els.cancelTaskEditor.addEventListener("click", closeTaskEditor);
els.taskEditorModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-modal]")) closeTaskEditor();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.taskEditorModal.classList.contains("hidden")) {
    closeTaskEditor();
  }
});

els.taskKind.addEventListener("change", () => {
  if (els.taskKind.value === "fixed") {
    els.taskFixedSlotEnabled.checked = true;
  }
  updateFrequencyFields();
});
els.taskFixedSlotEnabled.addEventListener("change", () => {
  updateFrequencyFields();
  syncDurationFromTimeWindow();
});
els.taskFrequency.addEventListener("change", updateFrequencyFields);
els.taskWeeklyMode.addEventListener("change", updateFrequencyFields);
els.taskRepeatStrategy.addEventListener("change", updateFrequencyFields);
els.taskReminderEnabled.addEventListener("change", syncReminderFields);
els.taskStart.addEventListener("change", syncDurationFromTimeWindow);
els.taskEnd.addEventListener("change", syncDurationFromTimeWindow);
els.taskForm.addEventListener("submit", saveTaskForm);
els.taskList.addEventListener("click", handleTaskListClick);
els.scheduleList.addEventListener("click", handleScheduleClick);
els.weekStrip.addEventListener("click", (event) => {
  const target = event.target.closest("[data-week-date]");
  if (!target) return;

  els.planDate.value = target.dataset.weekDate;
  if (!editingTaskId && els.taskEditorModal.classList.contains("hidden")) {
    els.taskDate.value = els.planDate.value;
  }
  renderTasks();
  renderSchedule(false, false);
});

els.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  commitSettings({ announce: true });
});

els.notifyBeforeEnabled.addEventListener("change", () => {
  state.settings.focusReminderEnabled = els.notifyBeforeEnabled.checked;
  saveState();
  renderSettings();
  renderSchedule(false, true);
});

els.notifyBeforeOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-minutes]");
  if (!button) return;
  state.settings.reminderBufferMinutes = Number(button.dataset.minutes);
  saveState();
  renderSettings();
  renderSchedule(false, true);
  addNotificationLog("任务提醒缓冲", `已设置为提前 ${state.settings.reminderBufferMinutes} 分钟。`);
});

els.planningBufferOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-buffer]");
  if (!button) return;
  state.settings.planningBufferMinutes = Number(button.dataset.buffer);
  saveState();
  renderSettings();
  renderSchedule(false, false);
  addNotificationLog("规划缓冲", `任务之间的默认缓冲更新为 ${state.settings.planningBufferMinutes} 分钟。`);
});

els.preferGapBlocks.addEventListener("change", () => {
  state.settings.preferGapBlocks = els.preferGapBlocks.checked;
  saveState();
  renderSettings();
  renderSchedule(false, false);
});

els.soundToggle.addEventListener("click", () => {
  state.settings.soundEnabled = !state.settings.soundEnabled;
  saveState();
  renderSettings();
  addNotificationLog("提示音效状态", state.settings.soundEnabled ? "已开启音效。" : "已静音。");
});

els.requestPermission.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    addNotificationLog("浏览器不支持", "当前环境无法使用系统通知。");
    return;
  }

  const permission = await Notification.requestPermission();
  addNotificationLog("通知权限", permission === "granted" ? "已启用浏览器通知。" : "未启用浏览器通知。");
});

els.generatePlan.addEventListener("click", () => renderSchedule(true, false));

els.planDate.addEventListener("change", () => {
  if (!editingTaskId && els.taskEditorModal.classList.contains("hidden")) {
    els.taskDate.value = els.planDate.value;
  }
  renderTasks();
  renderSchedule(false, false);
});

els.planDate.value = todayString();
activateView("today");
resetTaskForm();
renderSettings();
renderTasks();
renderSchedule(false, false);
