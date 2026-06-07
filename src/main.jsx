import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const relationTypes = ["--", "*--", "o--"];
const multiplicityOptions = ["", "1", "0..1", "0..*", "1..*", "*"];
const emptyRelationDraft = {
  from: "",
  to: "",
  type: "--",
  fromMultiplicity: "1",
  toMultiplicity: "0..*",
  label: ""
};

function normalizeRelation(relation) {
  return [
    relation.from,
    relation.type,
    relation.to,
    relation.fromMultiplicity || "",
    relation.toMultiplicity || ""
  ].join("|");
}

function sameRelation(a, b) {
  return normalizeRelation(a) === normalizeRelation(b);
}

function App() {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [placed, setPlaced] = useState([]);
  const [relations, setRelations] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [relationDraft, setRelationDraft] = useState(emptyRelationDraft);
  const [result, setResult] = useState(null);
  const [showAnswer, setShowAnswer] = useState(true);
  const [showProblem, setShowProblem] = useState(true);
  const [answerZoom, setAnswerZoom] = useState(1);
  const [sideWidth, setSideWidth] = useState(42);
  const [resizingSide, setResizingSide] = useState(false);
  const boardRef = useRef(null);
  const workareaRef = useRef(null);

  useEffect(() => {
    fetch("/diagram-data.json")
      .then((res) => res.json())
      .then((payload) => {
        setData(payload);
        const c2 = payload.diagrams.find((item) => item.type === "c2") || payload.diagrams[0];
        setSelectedId(c2?.id || "");
      });
  }, []);

  const diagrams = data?.diagrams || [];
  const selected = diagrams.find((item) => item.id === selectedId);

  const topics = useMemo(() => {
    return [...new Set(diagrams.map((item) => item.topicName))].sort();
  }, [diagrams]);

  const modules = useMemo(() => {
    if (!selected) return [];
    return diagrams.filter((item) => item.topicName === selected.topicName);
  }, [diagrams, selected]);

  const notPlaced = selected
    ? selected.classes.filter((cls) => !placed.some((item) => item.name === cls.name))
    : [];

  useEffect(() => {
    if (!selected) return;
    const saved = localStorage.getItem(`uml-board:${selected.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPlaced(parsed.placed || []);
        setRelations(parsed.relations || []);
        setResult(null);
        return;
      } catch {
        localStorage.removeItem(`uml-board:${selected.id}`);
      }
    }
    setPlaced([]);
    setRelations([]);
    setResult(null);
    setAnswerZoom(1);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(`uml-board:${selected.id}`, JSON.stringify({ placed, relations }));
  }, [placed, relations, selected]);

  function placeClass(cls) {
    if (!selected || placed.some((item) => item.name === cls.name)) return;
    const offset = placed.length * 22;
    setPlaced((current) => [
      ...current,
      {
        ...cls,
        x: 60 + offset,
        y: 60 + offset
      }
    ]);
  }

  function startDrag(event, name) {
    const item = placed.find((cls) => cls.name === name);
    if (!item || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    setDragging({
      name,
      dx: event.clientX - rect.left - item.x,
      dy: event.clientY - rect.top - item.y
    });
  }

  function moveDrag(event) {
    if (!dragging || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(8, event.clientX - rect.left - dragging.dx);
    const y = Math.max(8, event.clientY - rect.top - dragging.dy);
    setPlaced((current) => current.map((item) => item.name === dragging.name ? { ...item, x, y } : item));
  }

  function endDrag() {
    setDragging(null);
    setResizingSide(false);
  }

  function startResizeSide(event) {
    event.preventDefault();
    setResizingSide(true);
  }

  function resizeSide(event) {
    if (!resizingSide || !workareaRef.current) return;
    const rect = workareaRef.current.getBoundingClientRect();
    const next = ((rect.right - event.clientX) / rect.width) * 100;
    setSideWidth(Math.min(70, Math.max(26, next)));
  }

  function zoomAnswer(delta) {
    setAnswerZoom((value) => Math.min(3, Math.max(0.35, value + delta)));
  }

  function handleAnswerWheel(event) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomAnswer(event.deltaY < 0 ? 0.1 : -0.1);
  }

  function chooseRelationClass(side, className) {
    setRelationDraft((current) => ({ ...current, [side]: className }));
  }

  function quickPickRelationClass(className) {
    setRelationDraft((current) => {
      if (!current.from || (current.from && current.to)) {
        return { ...current, from: className, to: "" };
      }
      if (current.from === className) {
        return { ...current, to: "" };
      }
      return { ...current, to: className };
    });
  }

  function addRelationFromDraft() {
    if (!relationDraft.from || !relationDraft.to || relationDraft.from === relationDraft.to) return;
    const nextRelation = {
      ...relationDraft,
      type: relationTypes.includes(relationDraft.type) ? relationDraft.type : "--"
    };
    setRelations((current) => [...current, nextRelation]);
    setRelationDraft((current) => ({ ...current, from: "", to: "", label: "" }));
  }

  function resetBoard() {
    setPlaced([]);
    setRelations([]);
    setResult(null);
    setRelationDraft(emptyRelationDraft);
  }

  function autoLayout() {
    if (!selected) return;
    const cols = Math.max(2, Math.ceil(Math.sqrt(selected.classes.length)));
    setPlaced(selected.classes.map((cls, index) => ({
      ...cls,
      x: 36 + (index % cols) * 230,
      y: 36 + Math.floor(index / cols) * 170
    })));
    setRelations([]);
    setResult(null);
  }

  function checkAnswer() {
    if (!selected) return;
    const placedNames = new Set(placed.map((item) => item.name));
    const expectedNames = new Set(selected.classes.map((item) => item.name));
    const missingClasses = selected.classes.filter((item) => !placedNames.has(item.name)).map((item) => item.name);
    const extraClasses = placed.filter((item) => !expectedNames.has(item.name)).map((item) => item.name);
    const missingRelations = selected.relations.filter((expected) => !relations.some((actual) => sameRelation(actual, expected)));
    const extraRelations = relations.filter((actual) => !selected.relations.some((expected) => sameRelation(actual, expected)));
    setResult({ missingClasses, extraClasses, missingRelations, extraRelations });
  }

  function exportMermaid() {
    const classBlocks = placed.map((cls) => {
      const attrs = cls.attributes.map((attr) => `        +${attr}`).join("\n");
      const methods = cls.methods.map((method) => `        +${method}`).join("\n");
      return `    class ${cls.name} {\n${[attrs, methods].filter(Boolean).join("\n")}\n    }`;
    });
    const relationLines = relations.map((rel) => {
      const left = rel.fromMultiplicity ? ` "${rel.fromMultiplicity}"` : "";
      const right = rel.toMultiplicity ? ` "${rel.toMultiplicity}"` : "";
      const label = rel.label ? ` : ${rel.label}` : "";
      return `    ${rel.from}${left} ${rel.type}${right} ${rel.to}${label}`;
    });
    const output = ["classDiagram", ...classBlocks, ...relationLines].join("\n");
    navigator.clipboard?.writeText(output);
    window.alert("Đã copy Mermaid vào clipboard.");
  }

  if (!data || !selected) {
    return <main className="loading">Đang tải dữ liệu sơ đồ...</main>;
  }

  const answerImagePath = selected.file.replace(/\.mmd$/i, ".png");
  const hasSidePanel = showAnswer || showProblem;
  const workareaStyle = hasSidePanel
    ? { gridTemplateColumns: `minmax(320px, 1fr) 7px minmax(280px, ${sideWidth}%)` }
    : undefined;

  return (
    <main className="app">
      <aside className="sidebar">
        <section className="panel controls">
          <label>
            Chủ đề
            <select
              value={selected.topicName}
              onChange={(event) => {
                const next = diagrams.find((item) => item.topicName === event.target.value && item.type === "c2")
                  || diagrams.find((item) => item.topicName === event.target.value);
                setSelectedId(next.id);
              }}
            >
              {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </label>
          <label>
            Sơ đồ
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {modules.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.moduleName} / {item.type}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">
            <span>Class chưa đặt</span>
            <small>{notPlaced.length}</small>
          </div>
          <div className="class-list">
            {notPlaced.map((cls) => (
              <button key={cls.name} className="class-chip" type="button" onClick={() => placeClass(cls)}>
                {cls.name}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <span>Quan hệ đã nối</span>
            <small>{relations.length}</small>
          </div>
          <div className="relation-list">
            {relations.map((rel, index) => (
              <button
                key={`${normalizeRelation(rel)}:${index}`}
                type="button"
                className="relation-item"
                onClick={() => setRelations((current) => current.filter((_, i) => i !== index))}
              >
                <strong>{formatRelation(rel)}</strong>
                {rel.label && <span>{rel.label}</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="panel relation-builder">
          <div className="panel-title">
            <span>Tạo quan hệ</span>
          </div>
          <RelationEndpoint
            title="Class trái"
            value={relationDraft.from}
            classes={placed}
            onChange={(value) => chooseRelationClass("from", value)}
          />
          <MultiplicityPicker
            title="Bội số trái"
            value={relationDraft.fromMultiplicity}
            onChange={(value) => setRelationDraft((current) => ({ ...current, fromMultiplicity: value }))}
          />
          <label>
            Loại quan hệ
            <select
              value={relationDraft.type}
              onChange={(event) => setRelationDraft((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="--">Association (--)</option>
              <option value="*--">Composition (*--)</option>
              <option value="o--">Aggregation (o--)</option>
            </select>
          </label>
          <RelationEndpoint
            title="Class phải"
            value={relationDraft.to}
            classes={placed}
            onChange={(value) => chooseRelationClass("to", value)}
          />
          <MultiplicityPicker
            title="Bội số phải"
            value={relationDraft.toMultiplicity}
            onChange={(value) => setRelationDraft((current) => ({ ...current, toMultiplicity: value }))}
          />
          <label>
            Nhãn quan hệ
            <input
              value={relationDraft.label}
              placeholder="VD: gồm, mượn sách..."
              onChange={(event) => setRelationDraft((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <div className="relation-preview">
            {relationDraft.from || "Class trái"} "{relationDraft.fromMultiplicity}" {relationDraft.type} "{relationDraft.toMultiplicity}" {relationDraft.to || "Class phải"}
          </div>
          <div className="builder-actions">
            <button type="button" onClick={addRelationFromDraft}>Thêm quan hệ</button>
            <button type="button" onClick={() => setRelationDraft(emptyRelationDraft)}>Xóa chọn</button>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>UML Drag Practice</h1>
            <p>{selected.file}</p>
          </div>
          <div className="actions">
            <button type="button" onClick={() => setShowAnswer((value) => !value)}>
              {showAnswer ? "Ẩn ảnh đáp án" : "Hiện ảnh đáp án"}
            </button>
            <button type="button" onClick={() => setShowProblem((value) => !value)}>
              {showProblem ? "Ẩn đề bài" : "Hiện đề bài"}
            </button>
            <button type="button" onClick={autoLayout}>Đặt tất cả</button>
            <button type="button" onClick={checkAnswer}>Kiểm tra</button>
            <button type="button" onClick={exportMermaid}>Xuất Mermaid</button>
            <button type="button" onClick={resetBoard}>Reset</button>
          </div>
        </header>

        <div
          ref={workareaRef}
          className={`workarea ${hasSidePanel ? "with-answer" : ""}`}
          style={workareaStyle}
          onMouseMove={(event) => {
            moveDrag(event);
            resizeSide(event);
          }}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          <div
            ref={boardRef}
            className="board"
          >
            <svg className="lines">
              <defs>
                <marker id="dot" markerWidth="6" markerHeight="6" refX="3" refY="3">
                  <circle cx="3" cy="3" r="2" />
                </marker>
              </defs>
              {relations.map((rel, index) => {
                const from = placed.find((item) => item.name === rel.from);
                const to = placed.find((item) => item.name === rel.to);
                if (!from || !to) return null;
                const x1 = from.x + 90;
                const y1 = from.y + 44;
                const x2 = to.x + 90;
                const y2 = to.y + 44;
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                return (
                  <g key={`${normalizeRelation(rel)}:${index}`}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} />
                    <text x={mx} y={my - 8}>{rel.label || rel.type}</text>
                    <text x={x1 + 8} y={y1 - 8}>{rel.fromMultiplicity}</text>
                    <text x={x2 + 8} y={y2 - 8}>{rel.toMultiplicity}</text>
                  </g>
                );
              })}
            </svg>

            {placed.map((cls) => (
              <article
                key={cls.name}
                className={`class-card ${relationDraft.from === cls.name || relationDraft.to === cls.name ? "linking" : ""}`}
                style={{ left: cls.x, top: cls.y }}
                onMouseDown={(event) => startDrag(event, cls.name)}
                onDoubleClick={() => quickPickRelationClass(cls.name)}
              >
                <header>
                  <strong>{cls.name}</strong>
                  <div className="card-relation-buttons">
                    <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={() => chooseRelationClass("from", cls.name)}>
                      Trái
                    </button>
                    <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={() => chooseRelationClass("to", cls.name)}>
                      Phải
                    </button>
                  </div>
                </header>
                <ul>
                  {cls.attributes.slice(0, 7).map((attr) => <li key={attr}>{attr}</li>)}
                  {cls.attributes.length > 7 && <li>+{cls.attributes.length - 7} thuộc tính</li>}
                </ul>
              </article>
            ))}
          </div>

          {hasSidePanel && (
            <div className="vertical-resizer" onMouseDown={startResizeSide} title="Kéo để đổi độ rộng" />
          )}

          {hasSidePanel && (
            <aside className={`answer-panel ${showAnswer && showProblem ? "" : "single-section"}`}>
              {showAnswer && (
                <section className="answer-section image-section">
                  <header>
                    <strong>Ảnh đáp án</strong>
                    <div className="zoom-tools">
                      <button type="button" onClick={() => zoomAnswer(-0.15)}>-</button>
                      <span>{Math.round(answerZoom * 100)}%</span>
                      <button type="button" onClick={() => zoomAnswer(0.15)}>+</button>
                      <button type="button" onClick={() => setAnswerZoom(1)}>100%</button>
                    </div>
                  </header>
                  <div
                    className="answer-image-wrap"
                    onWheel={handleAnswerWheel}
                    title="Ctrl + lăn chuột để thu phóng ảnh"
                  >
                    <img
                      src={`/${answerImagePath}`}
                      alt="Ảnh đáp án"
                      style={{ width: `${answerZoom * 100}%` }}
                    />
                  </div>
                </section>
              )}
              {showProblem && (
                <section className="answer-section problem-section">
                  <header>
                    <strong>Đề bài</strong>
                  </header>
                  <ProblemView diagram={selected} />
                </section>
              )}
            </aside>
          )}
        </div>

        {result && (
          <footer className="result">
            <ResultColumn title="Thiếu class" items={result.missingClasses} />
            <ResultColumn title="Thừa class" items={result.extraClasses} />
            <ResultColumn title="Thiếu quan hệ" items={result.missingRelations.map(formatRelation)} />
            <ResultColumn title="Thừa quan hệ" items={result.extraRelations.map(formatRelation)} />
          </footer>
        )}
      </section>
    </main>
  );
}

function formatRelation(rel) {
  const left = rel.fromMultiplicity ? ` "${rel.fromMultiplicity}"` : "";
  const right = rel.toMultiplicity ? ` "${rel.toMultiplicity}"` : "";
  const label = rel.label ? ` : ${rel.label}` : "";
  return `${rel.from}${left} ${rel.type}${right} ${rel.to}${label}`;
}

function RelationEndpoint({ title, value, classes, onChange }) {
  return (
    <label>
      {title}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chọn class</option>
        {classes.map((cls) => <option key={cls.name} value={cls.name}>{cls.name}</option>)}
      </select>
    </label>
  );
}

function MultiplicityPicker({ title, value, onChange }) {
  return (
    <div className="multiplicity-picker">
      <span>{title}</span>
      <div>
        {multiplicityOptions.map((option) => (
          <button
            key={option || "empty"}
            type="button"
            className={value === option ? "active" : ""}
            onClick={() => onChange(option)}
          >
            {option || "-"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultColumn({ title, items }) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length ? (
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <p>Không có</p>
      )}
    </section>
  );
}

function ProblemView({ diagram }) {
  if (!diagram.problemText) {
    return (
      <section className="problem-view empty">
        <h2>Chưa có đề bài</h2>
        <p>Sơ đồ này không nằm trong một thư mục đề cụ thể hoặc thiếu file Debai.txt.</p>
      </section>
    );
  }

  const lines = compactProblemLines(diagram.problemText);
  const titleLine = lines.find((line) => /^Đề\s+số/i.test(line)) || diagram.moduleName;
  const moduleIndex = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return lower.includes("hãy thực hiện") || lower.includes("modul") || lower.includes("module");
  });
  const questionIndex = lines.findIndex((line) => /^1\./.test(line));
  const bodyEnd = questionIndex >= 0 ? questionIndex : lines.length;
  const contentLines = lines.filter((line) => !/^Ngân hàng|^Thời gian|^Đề\s+số/i.test(line));
  const moduleLine = moduleIndex >= 0 ? lines[moduleIndex] : "";
  const moduleContentIndex = moduleLine ? contentLines.indexOf(moduleLine) : -1;
  const questionLine = questionIndex >= 0 ? lines[questionIndex] : "";
  const questionContentIndex = questionLine ? contentLines.indexOf(questionLine) : -1;
  const introEnd = moduleContentIndex >= 0
    ? moduleContentIndex
    : questionContentIndex >= 0 ? questionContentIndex : contentLines.length;
  const introLines = contentLines.slice(0, introEnd);
  const moduleLines = moduleIndex >= 0 ? lines.slice(moduleIndex, bodyEnd) : [];
  const questionLines = questionIndex >= 0 ? lines.slice(questionIndex) : [];

  return (
    <section className="problem-view">
      <div className="problem-heading">
        <span>{diagram.topicName}</span>
        <h2>{titleLine}</h2>
        <p>{diagram.moduleName}</p>
      </div>

      {introLines.length > 0 && (
        <article className="problem-card">
          <h3>Mô tả hệ thống</h3>
          <TextLines lines={introLines} />
        </article>
      )}

      {moduleLines.length > 0 && (
        <article className="problem-card highlight">
          <h3>Mô tả module</h3>
          <TextLines lines={moduleLines} />
        </article>
      )}

      {questionLines.length > 0 && (
        <article className="problem-card">
          <h3>Yêu cầu</h3>
          <TextLines lines={questionLines} />
        </article>
      )}
    </section>
  );
}

function compactProblemLines(text) {
  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const merged = [];

  for (const line of rawLines) {
    if (startsNewProblemParagraph(line) || merged.length === 0) {
      merged.push(line);
    } else {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.replace(/\s+/g, " ");
    }
  }

  return merged;
}

function startsNewProblemParagraph(line) {
  return /^Ngân hàng/i.test(line)
    || /^Đề\s+số/i.test(line)
    || /^Thời gian/i.test(line)
    || /^Khách hàng/i.test(line)
    || /^Anh\/chị/i.test(line)
    || /^Modul/i.test(line)
    || /^module/i.test(line)
    || /^["“]?Modul/i.test(line)
    || /^["“]?module/i.test(line)
    || /^•/.test(line)
    || /^-\s+/.test(line)
    || /^\d+\./.test(line);
}

function TextLines({ lines }) {
  return (
    <div className="text-lines">
      {lines.map((line, index) => {
        const isBullet = line.startsWith("•") || line.startsWith("- ");
        const isQuestion = /^\d+\./.test(line);
        return (
          <p
            key={`${line}:${index}`}
            className={`${isBullet ? "bullet" : ""} ${isQuestion ? "question" : ""}`.trim()}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
