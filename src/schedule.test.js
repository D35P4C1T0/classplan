import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialSchedule,
  totalMinutes,
  resizedMinutes,
  restoreDeletedBlock,
  clock,
  fitBlocks,
  parseSchedule,
  validSchedule,
  exportSchedule,
} from "./schedule.js";

test("new plans have three independent placeholder sections and a two-hour budget", () => {
  const draft = initialSchedule();
  assert.deepEqual(
    draft.blocks.map((b) => b.title),
    ["Presentation", "Explanation", "Discussion"],
  );
  assert.equal(draft.budget, 120);
  assert.equal(draft.title, "Untitled plan");
  assert.ok(draft.blocks.every((b) => b.minutes === 10 && b.notes === ""));
  assert.notEqual(draft.blocks[0].id, initialSchedule().blocks[0].id);
  assert.equal(totalMinutes(draft.blocks), 30);
  assert.equal(clock(draft.start, totalMinutes(draft.blocks)), "09:30");
  assert.ok(validSchedule(draft));
  assert.equal(clock("23:50", 25), "00:15");
});

test("fit preserves content, assigns whole minutes and fills the exact budget", () => {
  const blocks = initialSchedule().blocks;
  for (let budget = blocks.length; budget <= 1440; budget++) {
    const fitted = fitBlocks(blocks, budget);
    assert.equal(totalMinutes(fitted), budget);
    assert.ok(
      fitted.every(
        (b, i) =>
          Number.isInteger(b.minutes) &&
          b.minutes >= 1 &&
          b.id === blocks[i].id &&
          b.notes === blocks[i].notes,
      ),
    );
  }
  assert.deepEqual(fitBlocks([], 120), []);
  assert.equal(fitBlocks(blocks, 2), blocks);
  assert.equal(totalMinutes(blocks), 30);
});

test("saved schedules reject invalid values and duplicate IDs", () => {
  const draft = initialSchedule();
  for (const patch of [
    { start: "24:00" },
    { start: "" },
    { budget: -1 },
    { budget: 1.5 },
    { blocks: [null] },
    { blocks: [draft.blocks[0], draft.blocks[0]] },
    { blocks: [{ ...draft.blocks[0], type: "__proto__" }] },
    { blocks: [{ ...draft.blocks[0], minutes: 0 }] },
  ])
    assert.ok(!validSchedule({ ...draft, ...patch }));
  assert.ok(!validSchedule(null));
});

test("exports preserve order and notes, escape HTML and neutralize CSV formulas", () => {
  const draft = initialSchedule();
  draft.title = "<script>alert(1)</script>";
  draft.blocks = [
    {
      ...draft.blocks[0],
      title: "=SUM(1,2)",
      minutes: 20,
      notes: 'A "quote", <tag>\nand another line',
    },
  ];
  const csv = exportSchedule(draft, "csv");
  assert.ok(csv.startsWith('\uFEFF"Start","End"'));
  assert.ok(csv.includes('"09:00","09:20","20"'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('A ""quote"", <tag>\nand another line'));
  const html = exportSchedule(draft, "html");
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;tag&gt;"));
  assert.ok(html.includes("20 / 120 minutes"));
});

test("imports JSON and YAML with defaults and fresh unique IDs", () => {
  const source = {
    title: "A class",
    start: "10:30",
    budget: 90,
    blocks: [
      { title: "Intro", minutes: 15, type: "presentation", notes: "Hello" },
      { title: "Activity", minutes: 30 },
    ],
  };
  const json = parseSchedule(JSON.stringify(source));
  const yaml = parseSchedule(
    'title: A class\nstart: "10:30"\nbudget: 90\nblocks:\n  - title: Intro\n    minutes: 15\n    type: presentation\n    notes: Hello\n  - title: Activity\n    minutes: 30',
  );
  const withoutIDs = (schedule) => ({
    ...schedule,
    blocks: schedule.blocks.map(({ id, ...block }) => block),
  });
  assert.deepEqual(withoutIDs(json), withoutIDs(yaml));
  assert.ok(validSchedule(json));
  assert.notEqual(json.blocks[0].id, yaml.blocks[0].id);
  assert.equal(json.blocks[1].type, "custom");
  assert.equal(json.blocks[1].notes, "");
  const defaults = parseSchedule("blocks: []");
  assert.deepEqual(
    { ...defaults },
    { title: "Imported schedule", start: "09:00", budget: 120, blocks: [] },
  );
});

test("rejects malformed imports and invalid fields without changing the current schedule", () => {
  const current = initialSchedule();
  const before = structuredClone(current);
  for (const text of [
    "",
    "{",
    "[]",
    "blocks: nope",
    "blocks: [null]",
    "blocks: [1]",
    "blocks: [[]]",
    "title: One\ntitle: Two\nblocks: []",
    "budget: -1\nblocks: []",
    'start: "25:00"\nblocks: []',
    'start: ["09:00"]\nblocks: []',
    "blocks: [{title: Intro, minutes: 0}]",
    "blocks: [{title: Intro, minutes: 2.5}]",
    'blocks: [{title: Intro, minutes: "15"}]',
    "blocks: [{title: Intro, minutes: 15, type: unknown}]",
    "blocks: [{title: Intro, minutes: 15, type: [custom]}]",
    "blocks: [{minutes: 15}]",
    "blocks: [{title: Intro, minutes: 15, notes: [text]}]",
  ]) {
    assert.throws(() => parseSchedule(text), undefined, text);
  }
  assert.deepEqual(current, before);
});

test("resize uses the original duration and absolute height delta, snapping to whole minutes", () => {
  assert.equal(resizedMinutes(20, 3), 21);
  assert.equal(resizedMinutes(20, 6), 22);
  assert.equal(resizedMinutes(20, -9), 17);
  assert.equal(resizedMinutes(20, 4), 21);
  assert.equal(resizedMinutes(20, -1000), 1);
  assert.equal(resizedMinutes(20, 10000), 1440);
  assert.equal(resizedMinutes(20, 0), 20);
});

test("type colors persist through imports and validation accepts only known types and hex colors", () => {
  const draft = initialSchedule();
  assert.ok(validSchedule(draft));
  const colors = { presentation: "#FF8844", practice: "#22aa88" };
  const imported = parseSchedule(JSON.stringify({ ...draft, colors }));
  assert.deepEqual(imported.colors, colors);
  assert.ok(validSchedule(imported));
  assert.deepEqual(
    parseSchedule('colors: {custom: "#123abc"}\nblocks: []').colors,
    { custom: "#123abc" },
  );
  for (const invalid of [
    null,
    [],
    "red",
    { custom: "red" },
    { custom: "#abc" },
    { custom: 123456 },
    { unknown: "#123456" },
  ]) {
    assert.ok(!validSchedule({ ...draft, colors: invalid }));
    assert.throws(() =>
      parseSchedule(JSON.stringify({ ...draft, colors: invalid })),
    );
  }
});

test("undo restores successive deletions at their original positions without reverting other edits", () => {
  const original = initialSchedule().blocks;
  const first = { block: original[1], index: 1 };
  const afterFirst = original.filter((b) => b.id !== first.block.id);
  const second = { block: afterFirst[1], index: 1 };
  const remaining = afterFirst
    .filter((b) => b.id !== second.block.id)
    .map((b, i) => (i === 0 ? { ...b, minutes: 7 } : b));
  const restored = restoreDeletedBlock(
    restoreDeletedBlock(remaining, second),
    first,
  );
  assert.deepEqual(
    restored.map((b) => b.id),
    original.map((b) => b.id),
  );
  assert.equal(restored[0].minutes, 7);
  assert.deepEqual(restored[1], first.block);
  assert.equal(restoreDeletedBlock(restored, first), restored);
  assert.deepEqual(restoreDeletedBlock([], { block: first.block, index: 10 }), [
    first.block,
  ]);
  assert.equal(remaining.length, original.length - 2);
});

test("JSON and YAML exports round-trip all editable schedule data", () => {
  const schedule = initialSchedule();
  schedule.title = 'Class: "Caffè"';
  schedule.start = "10:30";
  schedule.budget = 90;
  schedule.colors = { presentation: "#123abc" };
  schedule.blocks[0].notes = 'Line one\nLine two: "quoted"';
  const withoutIDs = (value) => ({
    ...value,
    blocks: value.blocks.map(({ id, ...block }) => block),
  });
  for (const format of ["json", "yaml"]) {
    const imported = parseSchedule(exportSchedule(schedule, format));
    assert.deepEqual(withoutIDs(imported), withoutIDs(schedule));
    assert.ok(validSchedule(imported));
    const empty = { ...schedule, blocks: [] };
    assert.deepEqual(parseSchedule(exportSchedule(empty, format)), empty);
  }
  assert.deepEqual(JSON.parse(exportSchedule(schedule, "json")), schedule);
});
