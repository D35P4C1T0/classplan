import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Resizable } from "re-resizable";
import {
  BookOpen,
  Plus,
  Download,
  GripVertical,
  Clock3,
  ArrowUpRight,
  Check,
  AlertTriangle,
  Copy,
  Trash2,
  X,
  WandSparkles,
  Layers,
} from "lucide-react";
import {
  TYPES,
  newBlock,
  initialSchedule,
  totalMinutes,
  clock,
  fitBlocks,
  validSchedule,
  exportSchedule,
} from "./schedule.js";
import "./style.css";

const STORAGE_KEY = "classplan-v1";
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (validSchedule(saved)) return saved;
  } catch {
    /* Fall back when local storage is unavailable or invalid. */
  }
  return initialSchedule();
}
function Block({ block, start, end, selected, select, resize }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const type = TYPES[block.type];
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 3 : undefined,
      }}
      className={`slot ${isDragging ? "dragging" : ""}`}
    >
      <div className="slot-time">
        <strong>{start}</strong>
        <span>{end}</span>
      </div>
      <Resizable
        size={{ width: "100%", height: 60 + block.minutes * 3 }}
        minHeight={63}
        maxHeight={4380}
        grid={[1, 3]}
        enable={{ bottom: true }}
        onResizeStop={(_, __, ___, delta) =>
          resize(
            Math.max(
              1,
              Math.min(1440, block.minutes + Math.round(delta.height / 3)),
            ),
          )
        }
        handleComponent={{ bottom: <span className="resize-mark" /> }}
        handleStyles={{ bottom: { height: 12, bottom: 0 } }}
        className={`block ${selected ? "selected" : ""}`}
        style={{ "--accent": type.color, "--tint": type.tint }}
      >
        <button
          className="drag-handle icon"
          aria-label={`Reorder ${block.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>
        <button
          className="block-main"
          onClick={select}
          aria-label={`Edit ${block.title}`}
        >
          <span className="block-type">{type.label}</span>
          <strong>{block.title || "Untitled section"}</strong>
          {block.minutes >= 8 && (
            <span className="block-notes">
              {block.notes || "Click to add notes for this section"}
            </span>
          )}
        </button>
        <button
          className="duration"
          onClick={select}
          aria-label={`Edit duration, ${block.minutes} minutes`}
        >
          {block.minutes}
          <span> min</span>
        </button>
      </Resizable>
    </div>
  );
}
function App() {
  const [schedule, setSchedule] = useState(load);
  const [selected, setSelected] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [schedule]);
  const { blocks, budget, start } = schedule;
  const total = totalMinutes(blocks),
    over = total > budget;
  const active = blocks.find((block) => block.id === selected);
  const update = (values) => setSchedule((s) => ({ ...s, ...values }));
  const edit = (id, values) =>
    setSchedule((s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...values } : b)),
    }));
  const add = (type) => {
    const block = newBlock(type);
    setSchedule((s) => ({ ...s, blocks: [...s.blocks, block] }));
    setSelected(block.id);
    setAdding(false);
  };
  function download(format) {
    const url = URL.createObjectURL(
      new Blob([exportSchedule(schedule, format)], {
        type:
          format === "csv"
            ? "text/csv;charset=utf-8"
            : "text/html;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schedule.title.replace(/[^a-z0-9-]/gi, "-").slice(0, 80) || "schedule"}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let elapsed = 0;
  return (
    <>
      <header className="topbar">
        <a className="brand" href="./">
          <span className="brand-icon">
            <BookOpen size={21} />
          </span>
          classplan<span className="brand-dot">.</span>
        </a>
        <span className="topbar-caption">
          A little structure. A better class.
        </span>
        <span className={`save-status ${saveError ? "error" : ""}`}>
          <span className="status-dot" />
          {saveError
            ? "Storage unavailable — export to save"
            : "Saved on this device"}
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR TEACHING, WELL TIMED</div>
            <h1>
              Make room for learning<span>.</span>
            </h1>
            <p>
              Shape your class, section by section. Keep the good stuff on time.
            </p>
          </div>
          <div className="export-actions">
            <button onClick={() => download("csv")}>
              <Download size={15} />
              CSV
            </button>
            <button onClick={() => download("html")}>
              <Download size={15} />
              Export HTML
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <section
          className={`budget-panel ${over ? "over" : ""}`}
          aria-label="Time budget"
        >
          <div className="budget-top">
            <div className="budget-label">
              <span className="clock-badge">
                <Clock3 size={20} />
              </span>
              <div>
                <strong>The time check</strong>
                <span>Every minute has a place.</span>
              </div>
            </div>
            <div className="budget-numbers">
              <strong>
                {total}
                <small> / {budget} min</small>
              </strong>
              <span className="budget-state" role="status">
                {over ? <AlertTriangle size={14} /> : <Check size={14} />}{" "}
                {over
                  ? `${total - budget} min over budget`
                  : total === budget
                    ? "A perfect fit"
                    : `${budget - total} min to spare`}
              </span>
            </div>
          </div>
          <div
            className="time-track"
            aria-label={`${total} of ${budget} minutes planned`}
          >
            {blocks.map((b) => (
              <div
                key={b.id}
                title={`${b.title}: ${b.minutes} min`}
                style={{
                  width: `${(b.minutes / Math.max(total, budget)) * 100}%`,
                  background: TYPES[b.type].color,
                }}
              />
            ))}
          </div>
          <div className="budget-bottom">
            <span>
              {clock(start)}
              <span className="timeline-end">
                Target finish <strong>{clock(start, budget)}</strong>
              </span>
            </span>
            <span>
              Planned finish <strong>{clock(start, total)}</strong>
            </span>
          </div>
        </section>
        <div className="workspace">
          <section className="schedule-panel">
            <div className="section-heading">
              <div>
                <div className="title-row">
                  <input
                    className="schedule-title"
                    aria-label="Schedule title"
                    value={schedule.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <span className="draft-tag">DRAFT</span>
                </div>
                <span className="muted">
                  {blocks.length} sections <span className="separator">/</span>{" "}
                  Drag to reorder · pull a block’s bottom edge to resize
                </span>
              </div>
              <button className="primary" onClick={() => setAdding(!adding)}>
                <Plus size={16} />
                Add section
              </button>
            </div>
            <div className="schedule-columns">
              <span>TIME</span>
              <span>THE RUN OF SHOW</span>
              <span>DURATION</span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id)
                  setSchedule((s) => ({
                    ...s,
                    blocks: arrayMove(
                      s.blocks,
                      s.blocks.findIndex((b) => b.id === active.id),
                      s.blocks.findIndex((b) => b.id === over.id),
                    ),
                  }));
              }}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="blocks">
                  {blocks.map((block) => {
                    const from = elapsed;
                    elapsed += block.minutes;
                    return (
                      <Block
                        key={block.id}
                        block={block}
                        start={clock(start, from)}
                        end={clock(start, elapsed)}
                        selected={selected === block.id}
                        select={() => {
                          setSelected(block.id);
                          setAdding(false);
                        }}
                        resize={(minutes) => edit(block.id, { minutes })}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {!blocks.length && (
              <div className="empty-state">
                <Layers size={30} />
                <h3>A fresh start</h3>
                <p>Add your first section to start shaping the class.</p>
              </div>
            )}
            <button className="add-bottom" onClick={() => setAdding(true)}>
              <Plus size={16} /> Make space for another section
            </button>
            <div className="finish-line">
              <span>{clock(start, total)}</span>
              <span>
                That’s a wrap <span>✦</span>
              </span>
            </div>
          </section>
          <aside>
            <section className="side-card">
              <div className="side-heading">
                <h2>Class settings</h2>
                <Clock3 size={17} />
              </div>
              <div className="settings-row">
                <label>
                  Start time
                  <input
                    type="time"
                    required
                    value={start}
                    onChange={(e) => {
                      if (e.target.value) update({ start: e.target.value });
                    }}
                  />
                </label>
                <label>
                  Timeframe <span className="unit">min</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={budget}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= 1440)
                        update({ budget: n });
                    }}
                  />
                </label>
              </div>
              <div className={`fit-message ${over ? "warning" : ""}`}>
                <span>
                  {over ? <AlertTriangle size={17} /> : <Check size={17} />}
                </span>
                <p>
                  {over ? (
                    <>
                      A little too much on the agenda.
                      <br />
                      <strong>
                        Trim {total - budget} minutes to stay on track.
                      </strong>
                    </>
                  ) : (
                    <>
                      Room for a great class.
                      <br />
                      <strong>
                        {total === budget
                          ? "Your schedule fits the timeframe."
                          : `${budget - total} minutes left in your timeframe.`}
                      </strong>
                    </>
                  )}
                </p>
              </div>
              <button
                className="fit-button"
                disabled={
                  !blocks.length || blocks.length > budget || total === budget
                }
                onClick={() => {
                  update({ blocks: fitBlocks(blocks, budget) });
                  setNotice(
                    "Durations adjusted proportionally to your timeframe.",
                  );
                }}
              >
                <WandSparkles size={15} />
                Fit to timeframe
              </button>
              {blocks.length > budget && (
                <p className="muted">
                  Each section needs at least 1 minute. Remove sections or
                  increase the timeframe.
                </p>
              )}
              {notice && (
                <p className="notice" role="status">
                  {notice}
                </p>
              )}
            </section>
            {active && !adding ? (
              <section className="side-card editor">
                <div className="side-heading">
                  <h2>Edit section</h2>
                  <button
                    className="icon"
                    aria-label="Close editor"
                    onClick={() => setSelected(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <label>
                  Section title
                  <input
                    value={active.title}
                    onChange={(e) => edit(active.id, { title: e.target.value })}
                  />
                </label>
                <div className="settings-row">
                  <label>
                    Type
                    <select
                      value={active.type}
                      onChange={(e) =>
                        edit(active.id, { type: e.target.value })
                      }
                    >
                      {Object.entries(TYPES).map(([key, type]) => (
                        <option key={key} value={key}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Minutes
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={active.minutes}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= 1440)
                          edit(active.id, { minutes: n });
                      }}
                    />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    rows="4"
                    placeholder="What should happen in this section?"
                    value={active.notes}
                    onChange={(e) => edit(active.id, { notes: e.target.value })}
                  />
                </label>
                <div className="editor-actions">
                  <button
                    onClick={() => {
                      const clone = {
                        ...active,
                        id: crypto.randomUUID(),
                        title: `${active.title} (copy)`,
                      };
                      update({
                        blocks: blocks.flatMap((b) =>
                          b.id === active.id ? [b, clone] : [b],
                        ),
                      });
                      setSelected(clone.id);
                    }}
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <button
                    className="delete"
                    onClick={() => {
                      update({
                        blocks: blocks.filter((b) => b.id !== active.id),
                      });
                      setSelected(null);
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </section>
            ) : (
              <section className="side-card">
                <div className="side-heading">
                  <h2>{adding ? "Add a section" : "Your building blocks"}</h2>
                  {adding ? (
                    <button
                      className="icon"
                      aria-label="Close add section"
                      onClick={() => setAdding(false)}
                    >
                      <X size={17} />
                    </button>
                  ) : (
                    <Layers size={17} />
                  )}
                </div>
                <p className="muted library-description">
                  A good class has a little variety.
                  <br />
                  Pick a type to add it to your plan.
                </p>
                <div className="block-library">
                  {Object.entries(TYPES).map(([key, type]) => (
                    <button key={key} onClick={() => add(key)}>
                      <span
                        className="type-dot"
                        style={{ background: type.color }}
                      />
                      {type.label}
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="tip">
              <span>✦</span>
              <div>
                <strong>Leave a little breathing room.</strong>
                <p>
                  A few spare minutes make space for a good question, a tricky
                  concept, or a well-earned break.
                </p>
              </div>
            </div>
          </aside>
        </div>
        <footer>
          <span>Made for the moments when learning clicks.</span>
          <span>Plan thoughtfully. Teach confidently.</span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
