import React, { useEffect, useRef, useState } from "react";
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
  Upload,
  Undo2,
  Redo2,
  GripVertical,
  Clock3,
  ArrowUpRight,
  Check,
  AlertTriangle,
  Copy,
  Pencil,
  Trash2,
  X,
  WandSparkles,
  Layers,
  ChevronDown,
} from "lucide-react";
import {
  TYPES,
  newBlock,
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
function Block({ block, start, selected, select, resize, remove, color }) {
  const [previewMinutes, setPreviewMinutes] = useState(null);
  const resizeFrame = useRef(null);
  const pendingMinutes = useRef(block.minutes);
  const minutes = previewMinutes ?? block.minutes;
  useEffect(
    () => () => {
      if (resizeFrame.current !== null)
        cancelAnimationFrame(resizeFrame.current);
    },
    [],
  );
  function previewResize(_, __, ___, delta) {
    pendingMinutes.current = resizedMinutes(block.minutes, delta.height);
    if (resizeFrame.current !== null) return;
    resizeFrame.current = requestAnimationFrame(() => {
      resizeFrame.current = null;
      setPreviewMinutes(pendingMinutes.current);
    });
  }
  function finishResize(_, __, ___, delta) {
    if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
    resizeFrame.current = null;
    setPreviewMinutes(null);
    resize(resizedMinutes(block.minutes, delta.height));
  }
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
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 3 : undefined,
      }}
      className={`slot ${isDragging ? "dragging" : ""}`}
    >
      <div className="slot-time">
        <strong>{start}</strong>
        <span>{clock(start, minutes)}</span>
      </div>
      {/* Keep percentage measurements inside the block's grid cell. */}
      <div className="block-container">
        <Resizable
          size={{ width: "100%", height: 60 + block.minutes * 3 }}
          maxWidth="100%"
          minHeight={63}
          maxHeight={4380}
          grid={[1, 3]}
          enable={{ bottom: true }}
          onResize={previewResize}
          onResizeStop={finishResize}
          handleComponent={{ bottom: <span className="resize-mark" /> }}
          handleStyles={{ bottom: { height: 12, bottom: 0 } }}
          className={`block ${selected ? "selected" : ""}`}
          style={{
            "--accent": color ?? type.color,
            "--tint": color
              ? `color-mix(in srgb, ${color} 12%, #2c2c2c)`
              : type.tint,
          }}
        >
          <button
            className="drag-handle icon"
            aria-label={`Reorder ${block.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
          <div className="block-main">
            <span className="block-type">{type.label}</span>
            <strong>{block.title || "Untitled section"}</strong>
            {minutes >= 8 && block.notes && (
              <span className="block-notes">{block.notes}</span>
            )}
          </div>
          <div className="duration-control">
            <button
              className="duration"
              aria-label={`Adjust duration of ${block.title || "Untitled section"}, ${minutes} minutes`}
            >
              {minutes}
              <span> min</span>
            </button>
            <div
              className="duration-tools"
              role="group"
              aria-label="Adjust duration"
            >
              <button
                disabled={block.minutes < 6}
                onClick={() => resize(block.minutes - 5)}
                aria-label="Subtract 5 minutes"
              >
                −5 min
              </button>
              <button
                disabled={block.minutes > 1435}
                onClick={() => resize(block.minutes + 5)}
                aria-label="Add 5 minutes"
              >
                +5 min
              </button>
            </div>
          </div>
          <button
            className="icon section-action"
            onClick={select}
            aria-label={`Edit ${block.title || "Untitled section"}`}
            aria-haspopup="dialog"
            title="Edit section"
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon delete section-action"
            onClick={remove}
            aria-label={`Delete ${block.title || "Untitled section"}`}
            title="Delete section"
          >
            <Trash2 size={16} />
          </button>
        </Resizable>
      </div>
    </div>
  );
}
function TypePicker({ colors, onAdd }) {
  return (
    <div className="block-library">
      {Object.entries(TYPES).map(([key, type]) => (
        <button key={key} onClick={() => onAdd(key)}>
          <span
            className="type-dot"
            style={{ background: colors[key] ?? type.color }}
          />
          {type.label}
          <Plus size={14} />
        </button>
      ))}
    </div>
  );
}
function App() {
  const [schedule, setSchedule] = useState(load);
  const [selected, setSelected] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const editor = useRef(null);
  const addDialog = useRef(null);
  const deleteDialog = useRef(null);
  const [deletions, setDeletions] = useState({ undo: [], redo: [] });
  const [pendingDelete, setPendingDelete] = useState(null);
  const fitDialog = useRef(null);
  const importDialog = useRef(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [proposal, setProposal] = useState(null);
  useEffect(() => {
    if (proposal && !fitDialog.current.open) fitDialog.current.showModal();
  }, [proposal]);
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
  const { blocks, budget, start, colors = {} } = schedule;
  const total = totalMinutes(blocks),
    over = total > budget;
  const active = blocks.find((block) => block.id === selected);
  const deleting = blocks.find((block) => block.id === pendingDelete);
  useEffect(() => {
    if (deleting && !deleteDialog.current.open)
      deleteDialog.current.showModal();
  }, [deleting?.id]);
  function undoDeletion() {
    const deleted = deletions.undo.at(-1);
    if (!deleted) return;
    setSchedule((s) => ({
      ...s,
      blocks: restoreDeletedBlock(s.blocks, deleted),
    }));
    setDeletions({
      undo: deletions.undo.slice(0, -1),
      redo: [...deletions.redo, deleted],
    });
  }
  function redoDeletion() {
    const restored = deletions.redo.at(-1);
    if (!restored) return;
    const index = blocks.findIndex((block) => block.id === restored.block.id);
    if (index < 0) return;
    setDeletions({
      undo: [...deletions.undo, { block: blocks[index], index }],
      redo: deletions.redo.slice(0, -1),
    });
    setSchedule((s) => ({
      ...s,
      blocks: s.blocks.filter((block) => block.id !== restored.block.id),
    }));
  }
  useEffect(() => {
    function handleUndoKey(event) {
      if (
        event.defaultPrevented ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "z" ||
        event.target.closest("input, textarea, select") ||
        event.target.isContentEditable ||
        document.querySelector("dialog[open]") ||
        !deletions.undo.length
      )
        return;
      event.preventDefault();
      undoDeletion();
    }
    document.addEventListener("keydown", handleUndoKey);
    return () => document.removeEventListener("keydown", handleUndoKey);
  }, [deletions]);
  useEffect(() => {
    if (active && !editor.current.open) {
      editor.current.showModal();
      editor.current.querySelector("input")?.focus();
    }
    if (!active && editor.current.open) editor.current.close();
  }, [active?.id]);
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
    addDialog.current.close();
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
        <span className={`save-status ${saveError ? "error" : ""}`}>
          <span className="status-dot" />
          {saveError
            ? "Storage unavailable — export to save"
            : "Saved on this device"}
        </span>
      </header>
      <main>
        <div className="page-heading">
          <h1>Lesson planner</h1>
          <div className="export-actions">
            <button
              onClick={undoDeletion}
              disabled={!deletions.undo.length}
              title="Undo section deletion (Ctrl+Z / ⌘Z)"
            >
              <Undo2 size={15} /> Undo
            </button>
            <button
              onClick={redoDeletion}
              disabled={!deletions.redo.length}
              title="Redo section deletion"
            >
              <Redo2 size={15} /> Redo
            </button>
            <button
              aria-haspopup="dialog"
              onClick={() => importDialog.current.showModal()}
            >
              <Upload size={15} /> Import
            </button>
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
                <strong>Time budget</strong>
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
                  background: colors[b.type] ?? TYPES[b.type].color,
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
                </div>
                <span className="muted">
                  {blocks.length} sections <span className="separator">/</span>{" "}
                  Drag to reorder · pull a block’s bottom edge to resize
                </span>
              </div>
              <button
                className="primary"
                aria-haspopup="dialog"
                onClick={() => addDialog.current.showModal()}
              >
                <Plus size={16} />
                Add section
              </button>
            </div>
            <div className="schedule-columns">
              <span>TIME</span>
              <span>SECTION</span>
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
                        color={colors[block.type]}
                        start={clock(start, from)}
                        selected={selected === block.id}
                        select={() => {
                          setSelected(block.id);
                        }}
                        resize={(minutes) => edit(block.id, { minutes })}
                        remove={() => setPendingDelete(block.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {!blocks.length && (
              <div className="empty-state">
                <Layers size={30} />
                <h3>No sections</h3>
              </div>
            )}
            <button
              className="add-bottom"
              aria-haspopup="dialog"
              onClick={() => addDialog.current.showModal()}
            >
              <Plus size={16} /> Add section
            </button>
            <div className="finish-line">
              <span>{clock(start, total)}</span>
              <span>End</span>
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
              <button
                className="fit-button"
                disabled={
                  !blocks.length || blocks.length > budget || total === budget
                }
                aria-haspopup="dialog"
                onClick={() => setProposal(fitBlocks(blocks, budget))}
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
            </section>
            <details className="side-card type-library">
              <summary className="side-heading">
                <h2>Section types</h2>
                <ChevronDown size={17} />
              </summary>
              <TypePicker colors={colors} onAdd={add} />
            </details>
          </aside>
        </div>
      </main>
      <dialog
        ref={deleteDialog}
        className="side-card editor"
        role="alertdialog"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        onClose={() => setPendingDelete(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget)
            deleteDialog.current.close();
        }}
      >
        {deleting && (
          <div>
            <div className="side-heading">
              <h2 id="delete-title">Delete section?</h2>
              <button
                className="icon"
                aria-label="Cancel deletion"
                onClick={() => deleteDialog.current.close()}
              >
                <X size={17} />
              </button>
            </div>
            <p id="delete-description" className="delete-description">
              Remove “{deleting.title || "Untitled section"}” (
              {deleting.minutes} min)? You can undo with Ctrl+Z or ⌘Z.
            </p>
            <div className="editor-actions">
              <button autoFocus onClick={() => deleteDialog.current.close()}>
                Cancel
              </button>
              <button
                className="delete-confirm"
                onClick={() => {
                  setDeletions((history) => ({
                    undo: [
                      ...history.undo,
                      {
                        block: deleting,
                        index: blocks.findIndex(
                          (block) => block.id === deleting.id,
                        ),
                      },
                    ],
                    redo: [],
                  }));
                  setSchedule((s) => ({
                    ...s,
                    blocks: s.blocks.filter(
                      (block) => block.id !== deleting.id,
                    ),
                  }));
                  if (selected === deleting.id) setSelected(null);
                  deleteDialog.current.close();
                }}
              >
                Delete section
              </button>
            </div>
          </div>
        )}
      </dialog>
      <dialog
        ref={addDialog}
        className="side-card editor"
        aria-labelledby="add-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) addDialog.current.close();
        }}
      >
        <div>
          <div className="side-heading">
            <h2 id="add-title">Add section</h2>
            <button
              className="icon"
              aria-label="Close section picker"
              onClick={() => addDialog.current.close()}
            >
              <X size={17} />
            </button>
          </div>
          <TypePicker colors={colors} onAdd={add} />
        </div>
      </dialog>
      <dialog
        ref={importDialog}
        className="side-card editor import-dialog"
        aria-labelledby="import-title"
        onClose={() => {
          setImportPreview(null);
          setImportError("");
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget)
            importDialog.current.close();
        }}
      >
        <div>
          <div className="side-heading">
            <h2 id="import-title">
              {importPreview ? "Confirm import" : "Import YAML / JSON"}
            </h2>
            <button
              className="icon"
              aria-label="Close import"
              onClick={() => importDialog.current.close()}
            >
              <X size={17} />
            </button>
          </div>
          {importPreview ? (
            <>
              <h3>{importPreview.title}</h3>
              <p className="import-summary">
                {importPreview.blocks.length} sections ·{" "}
                {totalMinutes(importPreview.blocks)} / {importPreview.budget}{" "}
                min · starts {importPreview.start}
              </p>
              {blocks.length > 0 && (
                <p className="import-warning" role="alert">
                  This will replace your current schedule ({blocks.length}{" "}
                  sections). Continue?
                </p>
              )}
              <div className="editor-actions">
                <button onClick={() => setImportPreview(null)}>Back</button>
                <button onClick={() => importDialog.current.close()}>
                  Cancel
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setDeletions({ undo: [], redo: [] });
                    setSchedule(importPreview);
                    setSelected(null);
                    setImportText("");
                    importDialog.current.close();
                  }}
                >
                  {blocks.length ? "Replace schedule" : "Import schedule"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label>
                Schedule text
                <textarea
                  autoFocus
                  className="import-text"
                  rows="12"
                  spellCheck={false}
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImportError("");
                  }}
                  placeholder={
                    'title: My class\nstart: "09:00"\nbudget: 120\nblocks:\n  - title: Introduction\n    type: presentation\n    minutes: 20\n    notes: Welcome and overview'
                  }
                  aria-invalid={Boolean(importError)}
                  aria-describedby={
                    importError ? "import-error" : "import-help"
                  }
                />
              </label>
              <p id="import-help" className="muted">
                Types: {Object.keys(TYPES).join(", ")}. Schedule title, start,
                budget, type, and notes have defaults; each block needs title
                and minutes.
              </p>
              {importError && (
                <p id="import-error" className="import-warning" role="alert">
                  {importError}
                </p>
              )}
              <div className="editor-actions">
                <button onClick={() => importDialog.current.close()}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={!importText.trim()}
                  onClick={() => {
                    try {
                      setImportPreview(parseSchedule(importText));
                      setImportError("");
                    } catch (error) {
                      setImportError(error.message);
                    }
                  }}
                >
                  Review import
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
      <dialog
        ref={fitDialog}
        className="side-card editor fit-dialog"
        aria-labelledby="fit-title"
        aria-describedby="fit-description"
        onClose={() => setProposal(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) fitDialog.current.close();
        }}
      >
        {proposal && (
          <div>
            <div className="side-heading">
              <h2 id="fit-title">Fit to {budget} minutes</h2>
              <button
                className="icon"
                aria-label="Close preview"
                onClick={() => fitDialog.current.close()}
              >
                <X size={17} />
              </button>
            </div>
            <p id="fit-description" className="muted">
              All sections, including breaks, are adjusted proportionally.
            </p>
            <table className="fit-table">
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Current</th>
                  <th scope="col">Proposed</th>
                </tr>
              </thead>
              <tbody>
                {proposal.map((block, index) => (
                  <tr key={block.id}>
                    <th scope="row">{block.title || "Untitled section"}</th>
                    <td>{blocks[index].minutes} min</td>
                    <td
                      className={
                        block.minutes !== blocks[index].minutes ? "changed" : ""
                      }
                    >
                      {block.minutes} min
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{total} min</td>
                  <td>{totalMinutes(proposal)} min</td>
                </tr>
                <tr>
                  <th scope="row">Finish</th>
                  <td>{clock(start, total)}</td>
                  <td>{clock(start, totalMinutes(proposal))}</td>
                </tr>
              </tfoot>
            </table>
            <div className="editor-actions">
              <button autoFocus onClick={() => fitDialog.current.close()}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  update({ blocks: proposal });
                  fitDialog.current.close();
                }}
              >
                Apply changes
              </button>
            </div>
          </div>
        )}
      </dialog>
      <dialog
        ref={editor}
        className="side-card editor"
        aria-labelledby="editor-title"
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) editor.current.close();
        }}
      >
        {active && (
          <div>
            <div className="side-heading">
              <h2 id="editor-title">Edit section</h2>
              <button
                className="icon"
                aria-label="Close editor"
                onClick={() => editor.current.close()}
              >
                <X size={17} />
              </button>
            </div>
            <label>
              Section title
              <input
                autoFocus
                value={active.title}
                onChange={(e) => edit(active.id, { title: e.target.value })}
              />
            </label>
            <div className="settings-row">
              <div className="type-field">
                <label>
                  Type
                  <select
                    value={active.type}
                    onChange={(e) => edit(active.id, { type: e.target.value })}
                  >
                    {Object.entries(TYPES).map(([key, type]) => (
                      <option key={key} value={key}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={colors[active.type] ?? TYPES[active.type].color}
                    aria-label={`Color for all ${TYPES[active.type].label} sections`}
                    title={`Applies to all ${TYPES[active.type].label} sections`}
                    onChange={(event) =>
                      setSchedule((s) => ({
                        ...s,
                        colors: {
                          ...s.colors,
                          [active.type]: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
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
                rows="3"
                placeholder="Add notes…"
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
                className="primary"
                onClick={() => editor.current.close()}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
