import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialSchedule,
  totalMinutes,
  clock,
  fitBlocks,
  validSchedule,
  exportSchedule,
} from "./schedule.js";

test("original draft retains all sections and exposes its 17-minute overrun", () => {
  const draft = initialSchedule();
  assert.equal(draft.blocks.length, 12);
  assert.equal(totalMinutes(draft.blocks), 137);
  assert.equal(clock(draft.start, totalMinutes(draft.blocks)), "11:17");
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
  assert.equal(fitBlocks(blocks, 5), blocks);
  assert.equal(totalMinutes(blocks), 137);
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
