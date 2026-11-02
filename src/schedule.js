import { parse } from "yaml";

export const TYPES = {
  presentation: { label: "Presentation", color: "#a0aff0", tint: "#2d3040" },
  explanation: { label: "Explanation", color: "#e2b773", tint: "#3a3228" },
  practice: { label: "Student practice", color: "#81cbb5", tint: "#293a34" },
  discussion: { label: "Discussion", color: "#c7a3df", tint: "#382f3e" },
  break: { label: "Break", color: "#b2bdc8", tint: "#303438" },
  custom: { label: "Custom section", color: "#90bfdc", tint: "#2a3540" },
};
export const newBlock = (type = "custom") => ({
  id: crypto.randomUUID(),
  title: TYPES[type].label,
  type,
  minutes: 10,
  notes: "",
});
export function initialSchedule() {
  const blocks = [
    {
      ...newBlock("presentation"),
      title: "eCream presentation",
      minutes: 20,
      notes: "Introduce eCream and set the scene for the lab.",
    },
  ];
  for (let i = 1; i <= 3; i++) {
    if (i === 3)
      blocks.push({
        ...newBlock("break"),
        title: "A little breathing room",
        minutes: 7,
      });
    for (const [type, minutes, title, notes] of [
      [
        "explanation",
        15,
        "Introduce the exercise",
        "Explain the task and tell students where to get the files.",
      ],
      ["practice", 15, "Time to try it", "Students work through the exercise."],
      [
        "discussion",
        5,
        "Discuss & reveal",
        "Discuss approaches, then walk through the solution.",
      ],
    ])
      blocks.push({
        ...newBlock(type),
        title: `Exercise ${i} · ${title}`,
        minutes,
        notes,
      });
  }
  blocks.push({
    ...newBlock("discussion"),
    title: "Any questions?",
    minutes: 5,
  });
  return { title: "Lab structure", start: "09:00", budget: 120, blocks };
}
export const totalMinutes = (blocks) =>
  blocks.reduce((sum, block) => sum + block.minutes, 0);
export function clock(start, offset = 0) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + offset;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
export function restoreDeletedBlock(blocks, { block, index }) {
  if (blocks.some((item) => item.id === block.id)) return blocks;
  const restored = [...blocks];
  restored.splice(Math.min(index, restored.length), 0, block);
  return restored;
}
export const resizedMinutes = (minutes, heightDelta) =>
  Math.max(1, Math.min(1440, minutes + Math.round(heightDelta / 3)));

export function fitBlocks(blocks, budget) {
  if (!blocks.length || blocks.length > budget) return blocks;
  const extra = budget - blocks.length;
  const total = totalMinutes(blocks);
  const shares = blocks.map((block) => (extra * block.minutes) / total);
  const minutes = shares.map((value) => Math.floor(value) + 1);
  const order = shares
    .map((value, index) => ({ index, fraction: value % 1 }))
    .sort((a, b) => b.fraction - a.fraction);
  const remaining = budget - minutes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) minutes[order[i].index]++;
  return blocks.map((block, index) => ({ ...block, minutes: minutes[index] }));
}
export function validSchedule(value) {
  return (
    value &&
    typeof value.title === "string" &&
    typeof value.start === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value.start) &&
    Number.isInteger(value.budget) &&
    value.budget >= 1 &&
    value.budget <= 1440 &&
    (value.colors === undefined ||
      (value.colors !== null &&
        typeof value.colors === "object" &&
        !Array.isArray(value.colors) &&
        Object.entries(value.colors).every(
          ([type, color]) =>
            Object.hasOwn(TYPES, type) &&
            typeof color === "string" &&
            /^#[0-9a-f]{6}$/i.test(color),
        ))) &&
    Array.isArray(value.blocks) &&
    new Set(value.blocks.map((b) => b?.id)).size === value.blocks.length &&
    value.blocks.every(
      (b) =>
        b &&
        typeof b.id === "string" &&
        typeof b.title === "string" &&
        typeof b.notes === "string" &&
        typeof b.type === "string" &&
        Object.hasOwn(TYPES, b.type) &&
        Number.isInteger(b.minutes) &&
        b.minutes >= 1 &&
        b.minutes <= 1440,
    )
  );
}
export function parseSchedule(text) {
  const value = parse(text);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Array.isArray(value.blocks)
  ) {
    throw new Error('Expected a schedule object with a "blocks" array.');
  }
  const schedule = {
    title: value.title ?? "Imported schedule",
    start: value.start ?? "09:00",
    budget: value.budget ?? 120,
    ...(value.colors !== undefined ? { colors: value.colors } : {}),
    blocks: value.blocks.map((block, index) => {
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        throw new Error(`Section ${index + 1} must be an object.`);
      }
      return {
        id: crypto.randomUUID(),
        title: block.title,
        type: block.type ?? "custom",
        minutes: block.minutes,
        notes: block.notes ?? "",
      };
    }),
  };
  if (!validSchedule(schedule)) {
    throw new Error(
      "Use a text title, HH:MM start time, and whole-number budget (1–1440). Each block needs a text title, whole-number minutes (1–1440), a valid type, and optional text notes. Optional colors must map type names to six-digit hex colors.",
    );
  }
  return schedule;
}
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function exportSchedule(schedule, format) {
  let elapsed = 0;
  const rows = schedule.blocks.map((b) => {
    const row = [
      clock(schedule.start, elapsed),
      clock(schedule.start, elapsed + b.minutes),
      b.minutes,
      b.title,
      TYPES[b.type].label,
      b.notes,
    ];
    elapsed += b.minutes;
    return row;
  });
  const headers = ["Start", "End", "Minutes", "Section", "Type", "Notes"];
  if (format === "csv")
    return (
      "\uFEFF" +
      [headers, ...rows]
        .map((row) =>
          row
            .map((value) => {
              // Spreadsheet applications can execute formulas even in quoted CSV cells.
              const safe = /^[=+@\-\t\r\n]/.test(String(value))
                ? "'" + value
                : value;
              return '"' + String(safe).replaceAll('"', '""') + '"';
            })
            .join(","),
        )
        .join("\r\n")
    );
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(schedule.title)}</title><style>body{font:16px system-ui;color:#203039;max-width:1100px;margin:48px auto;padding:0 24px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:14px 10px;border-bottom:1px solid #ddd}td:last-child{white-space:pre-wrap}h1{letter-spacing:-1px}@media print{body{margin:0}tr{break-inside:avoid}}</style><h1>${escapeHTML(schedule.title)}</h1><p>${elapsed} / ${schedule.budget} minutes · ${elapsed > schedule.budget ? `${elapsed - schedule.budget} minutes over budget` : `${schedule.budget - elapsed} minutes available`}</p><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></html>`;
}
