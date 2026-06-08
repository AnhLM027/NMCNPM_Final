import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

/* ─── helpers ─── */
function topicLabel(id) {
  const map = {
    ChuDe_01_QuanLyThuVien: "📚 Quản lý thư viện",
    ChuDe_02_QuanLyDaoTao: "🎓 Quản lý đào tạo",
    ChuDe_03_QuanLyTourDuLich: "✈️ Quản lý tour du lịch",
    ChuDe_04_QuanLyNhaHang: "🍽️ Quản lý nhà hàng",
    ChuDe_05_QuanLyKhoVatTu: "📦 Quản lý kho vật tư",
    ChuDe_06_QuanLyGiaiDauCoVua: "♟️ Giải đấu cờ vua",
    ChuDe_07_QuanLyGiaiDuaF1: "🏎️ Giải đua F1",
    ChuDe_08_QuanLyCuaHangTruyen: "📖 Cửa hàng truyện",
    ChuDe_09_QuanLyNhanVienParttimeLotteria: "🍔 Nhân viên parttime",
    ChuDe_10_QuanLyRapChieuPhim: "🎬 Rạp chiếu phim",
    ChuDe_11_QuanLySanBongMini: "⚽ Sân bóng mini",
    ChuDe_12_QuanLyVayTraGopSaison: "💳 Vay trả góp Saison",
    ChuDe_13_QuanLyChoThueTrangPhuc: "👗 Cho thuê trang phục",
  };
  return map[id] || id;
}

function typeLabel(type) {
  const map = { class: "C1", c2: "C2", c3: "C3" };
  return map[type] || type.toUpperCase();
}

function typeColor(type) {
  const map = { class: "accent", c2: "green", c3: "amber" };
  return map[type] || "";
}

function compactProblemLines(text) {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const merged = [];
  for (const line of rawLines) {
    if (startsNewParagraph(line) || merged.length === 0) merged.push(line);
    else merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.replace(/\s+/g, " ");
  }
  return merged;
}

function startsNewParagraph(line) {
  return /^Ngân hàng/i.test(line)
    || /^Đề\s+số/i.test(line)
    || /^Thời gian/i.test(line)
    || /^Khách hàng/i.test(line)
    || /^Anh\/chị/i.test(line)
    || /^["""]?Modul/i.test(line)
    || /^["""]?module/i.test(line)
    || /^•/.test(line)
    || /^-\s+/.test(line)
    || /^\d+\./.test(line);
}

function formatRelation(rel) {
  const l = rel.fromMultiplicity ? ` "${rel.fromMultiplicity}"` : "";
  const r = rel.toMultiplicity ? ` "${rel.toMultiplicity}"` : "";
  const label = rel.label ? ` : ${rel.label}` : "";
  return `${rel.from}${l} ${rel.type}${r} ${rel.to}${label}`;
}

/* ─── components ─── */

function ProblemView({ diagram }) {
  if (!diagram?.problemText) {
    return (
      <div className="problem-empty">
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <p>Không có đề bài cho sơ đồ này.</p>
      </div>
    );
  }

  const lines = compactProblemLines(diagram.problemText);
  const titleLine = lines.find((l) => /^Đề\s+số/i.test(l)) || diagram.moduleName;
  const moduleIndex = lines.findIndex((l) => {
    const lower = l.toLowerCase();
    return lower.includes("hãy thực hiện") || lower.includes("modul") || lower.includes("module");
  });
  const questionIndex = lines.findIndex((l) => /^1\./.test(l));
  const bodyEnd = questionIndex >= 0 ? questionIndex : lines.length;
  const contentLines = lines.filter((l) => !/^Ngân hàng|^Thời gian|^Đề\s+số/i.test(l));
  const moduleLine = moduleIndex >= 0 ? lines[moduleIndex] : "";
  const moduleContentIndex = moduleLine ? contentLines.indexOf(moduleLine) : -1;
  const questionLine = questionIndex >= 0 ? lines[questionIndex] : "";
  const questionContentIndex = questionLine ? contentLines.indexOf(questionLine) : -1;
  const introEnd =
    moduleContentIndex >= 0
      ? moduleContentIndex
      : questionContentIndex >= 0
        ? questionContentIndex
        : contentLines.length;
  const introLines = contentLines.slice(0, introEnd);
  const moduleLines = moduleIndex >= 0 ? lines.slice(moduleIndex, bodyEnd) : [];
  const questionLines = questionIndex >= 0 ? lines.slice(questionIndex) : [];

  return (
    <div className="problem-content">
      <div className="problem-heading">
        <div className="topic-badge">{topicLabel(diagram.topicName)}</div>
        <h2>{titleLine}</h2>
        <div className="module-name">{diagram.moduleName}</div>
      </div>

      {introLines.length > 0 && (
        <div className="problem-card">
          <h3>Mô tả hệ thống</h3>
          <TextLines lines={introLines} />
        </div>
      )}
      {moduleLines.length > 0 && (
        <div className="problem-card highlight">
          <h3>Mô tả module</h3>
          <TextLines lines={moduleLines} />
        </div>
      )}
      {questionLines.length > 0 && (
        <div className="problem-card">
          <h3>Yêu cầu</h3>
          <TextLines lines={questionLines} />
        </div>
      )}
    </div>
  );
}

function TextLines({ lines }) {
  return (
    <div className="text-lines">
      {lines.map((line, i) => {
        const isBullet = line.startsWith("•") || line.startsWith("- ");
        const isQuestion = /^\d+\./.test(line);
        return (
          <p key={i} className={[isBullet ? "bullet" : "", isQuestion ? "question" : ""].filter(Boolean).join(" ")}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

/* ─── FLASH CARD ─── */

function FlashCard({ diagram, cardIndex, total, isFlipped, onFlip, onKnown, onUnknown, onPrev, onNext, knownSet }) {
  if (!diagram) return null;

  const imagePath = diagram.file.replace(/\.mmd$/i, ".png");

  return (
    <div className="flash-area">
      <div className="flash-card">
        <div className={`flash-card-inner ${isFlipped ? "flipped" : ""}`}>
          {/* FRONT */}
          <div className="flash-face flash-front">
            <div className="card-counter">{cardIndex + 1} / {total}</div>
            
            <div className="flash-front-scroll">
              <ProblemView diagram={diagram} />
            </div>

            <div className="flash-front-footer">
              <button className="btn btn-primary" onClick={onFlip} style={{ height: 36, padding: "0 22px", borderRadius: 10 }}>
                👁 Xem Class Diagram (Space)
              </button>
            </div>
          </div>

          {/* BACK */}
          <div className="flash-face flash-back">
            <div className="flash-back-header">
              <h3>{diagram.moduleName}</h3>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`badge ${typeColor(diagram.type)}`}>{typeLabel(diagram.type)}</span>
                <span className="badge">{diagram.classes.length} classes</span>
              </div>
            </div>

            <div className="flash-back-image-wrap">
              <img
                src={`/${imagePath}`}
                alt={`${diagram.moduleName} class diagram`}
              />
            </div>

            <div className="flash-back-footer">
              <button className="btn" onClick={onFlip} style={{ height: 36, padding: "0 22px", borderRadius: 10 }}>
                ⬅ Quay lại đề bài (Space)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flash-actions">
        <button className="flash-btn nav-btn" onClick={onPrev} title="Thẻ trước (←)">←</button>
        <button className="flash-btn unknown-btn" onClick={() => { onUnknown(); }}>
          ✗ Chưa nhớ
        </button>
        <button className="flash-btn flip-btn" onClick={onFlip}>
          {isFlipped ? "🔄 Lật lại" : "👁 Xem đáp án"}
        </button>
        <button className="flash-btn known-btn" onClick={() => { onKnown(); }}>
          ✓ Đã nhớ
        </button>
        <button className="flash-btn nav-btn" onClick={onNext} title="Thẻ sau (→)">→</button>
      </div>
    </div>
  );
}

/* ─── APP ─── */

function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("view"); // 'view' | 'flash'
  const [selectedId, setSelectedId] = useState("");
  const [openTopics, setOpenTopics] = useState({});
  const [search, setSearch] = useState("");
  const [showProblem, setShowProblem] = useState(true);
  const [imgZoom, setImgZoom] = useState(0.3);
  const [problemWidth, setProblemWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 200 && newWidth < window.innerWidth - 300) {
      setProblemWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Flash card state
  const [flashQueue, setFlashQueue] = useState([]);
  const [flashIndex, setFlashIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownSet, setKnownSet] = useState(new Set());
  const [flashFilter, setFlashFilter] = useState("all"); // 'all' | 'unknown'
  const [flashTopic, setFlashTopic] = useState("all");
  const [flashType, setFlashType] = useState("all");

  useEffect(() => {
    fetch("/diagram-data.json")
      .then((r) => r.json())
      .then((payload) => {
        setData(payload);
        // default to first c2
        const first = payload.diagrams.find((d) => d.type === "c2") || payload.diagrams[0];
        if (first) {
          setSelectedId(first.id);
          setOpenTopics({ [first.topicName]: true });
        }
      });
  }, []);

  const diagrams = data?.diagrams || [];

  const topics = useMemo(() => [...new Set(diagrams.map((d) => d.topicName))].sort(), [diagrams]);

  const filteredDiagrams = useMemo(() => {
    if (!search) return diagrams;
    const q = search.toLowerCase();
    return diagrams.filter(
      (d) =>
        topicLabel(d.topicName).toLowerCase().includes(q) ||
        d.moduleName.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q)
    );
  }, [diagrams, search]);

  const selected = diagrams.find((d) => d.id === selectedId);

  // Build flash queue
  const buildFlashQueue = useCallback(() => {
    let pool = diagrams;
    if (flashTopic !== "all") pool = pool.filter((d) => d.topicName === flashTopic);
    if (flashType !== "all") pool = pool.filter((d) => d.type === flashType);
    if (flashFilter === "unknown") pool = pool.filter((d) => !knownSet.has(d.id));
    // Shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setFlashQueue(shuffled);
    setFlashIndex(0);
    setIsFlipped(false);
  }, [diagrams, flashTopic, flashType, flashFilter, knownSet]);

  useEffect(() => {
    if (mode === "flash") buildFlashQueue();
  }, [mode]);

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (mode === "flash") {
        if (e.key === "ArrowRight") nextFlash();
        if (e.key === "ArrowLeft") prevFlash();
        if (e.key === " ") { e.preventDefault(); setIsFlipped((v) => !v); }
        if (e.key === "k" || e.key === "K") markKnown();
        if (e.key === "u" || e.key === "U") markUnknown();
      } else {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          const idx = filteredDiagrams.findIndex((d) => d.id === selectedId);
          if (idx < filteredDiagrams.length - 1) setSelectedId(filteredDiagrams[idx + 1].id);
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          const idx = filteredDiagrams.findIndex((d) => d.id === selectedId);
          if (idx > 0) setSelectedId(filteredDiagrams[idx - 1].id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedId, filteredDiagrams, flashQueue, flashIndex, isFlipped, knownSet]);

  const currentFlash = flashQueue[flashIndex];

  function nextFlash() {
    setFlashIndex((i) => Math.min(i + 1, flashQueue.length - 1));
    setIsFlipped(false);
  }

  function prevFlash() {
    setFlashIndex((i) => Math.max(i - 1, 0));
    setIsFlipped(false);
  }

  function markKnown() {
    if (!currentFlash) return;
    setKnownSet((s) => new Set([...s, currentFlash.id]));
    if (flashIndex < flashQueue.length - 1) nextFlash();
  }

  function markUnknown() {
    if (!currentFlash) return;
    setKnownSet((s) => {
      const next = new Set(s);
      next.delete(currentFlash.id);
      return next;
    });
    if (flashIndex < flashQueue.length - 1) nextFlash();
  }

  function toggleTopic(topic) {
    setOpenTopics((prev) => ({ ...prev, [topic]: !prev[topic] }));
  }

  function handleSelectDiagram(diagram) {
    setSelectedId(diagram.id);
    setImgZoom(0.3);
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Đang tải dữ liệu sơ đồ...</p>
      </div>
    );
  }

  const imagePath = selected ? selected.file.replace(/\.mmd$/i, ".png") : "";

  return (
    <div className="app">
      {/* ── TOP BAR ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="logo-icon">📐</div>
          UML Study
        </div>
        <div className="topbar-divider" />

        {mode === "view" && (
          <div className="topbar-controls">
            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>
              {selected ? `${topicLabel(selected.topicName)} › ${selected.moduleName} [${typeLabel(selected.type)}]` : "—"}
            </span>
          </div>
        )}

        {mode === "flash" && (
          <div className="topbar-controls">
            <div className="topbar-select-group">
              <label>Chủ đề</label>
              <select className="styled" value={flashTopic} onChange={(e) => setFlashTopic(e.target.value)}>
                <option value="all">Tất cả</option>
                {topics.map((t) => <option key={t} value={t}>{topicLabel(t)}</option>)}
              </select>
            </div>
            <div className="topbar-select-group">
              <label>Loại</label>
              <select className="styled" value={flashType} onChange={(e) => setFlashType(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="class">C1 - Thực thể</option>
                <option value="c2">C2 - MVC</option>
                <option value="c3">C3 - MVC Chi tiết</option>
              </select>
            </div>
            <div className="topbar-select-group">
              <label>Lọc</label>
              <select className="styled" value={flashFilter} onChange={(e) => setFlashFilter(e.target.value)}>
                <option value="all">Tất cả thẻ</option>
                <option value="unknown">Chưa nhớ</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={buildFlashQueue}>
              🔀 Tạo bộ thẻ mới
            </button>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {knownSet.size} / {diagrams.length} đã nhớ
            </span>
          </div>
        )}

        <div className="topbar-right">
          <div className="mode-tabs">
            <button className={`mode-tab ${mode === "view" ? "active" : ""}`} onClick={() => setMode("view")}>
              🖼 Xem sơ đồ
            </button>
            <button className={`mode-tab ${mode === "flash" ? "active" : ""}`} onClick={() => setMode("flash")}>
              🃏 Flash Card
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="main-content">

        {/* ═══════ VIEW MODE ═══════ */}
        {mode === "view" && (
          <div
            className={`view-layout ${showProblem ? "" : "no-problem"} ${isResizing ? "is-resizing" : ""}`}
            style={showProblem ? { gridTemplateColumns: `220px 1fr 5px ${problemWidth}px` } : undefined}
          >

            {/* LEFT: Topic/Diagram Sidebar */}
            <div className="sidebar">
              <div className="sidebar-header">Chủ đề & Sơ đồ</div>
              <div className="sidebar-search">
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {(search ? [...new Set(filteredDiagrams.map((d) => d.topicName))].sort() : topics).map((topic) => {
                const topicDiagrams = filteredDiagrams.filter((d) => d.topicName === topic);
                if (topicDiagrams.length === 0) return null;
                const isOpen = search ? true : openTopics[topic];
                const hasActive = topicDiagrams.some((d) => d.id === selectedId);
                return (
                  <div key={topic} className="topic-group">
                    <button
                      className={`topic-header ${isOpen ? "open" : ""} ${hasActive ? "active-topic" : ""}`}
                      onClick={() => toggleTopic(topic)}
                    >
                      <span className="topic-icon">{topicLabel(topic).slice(0, 2)}</span>
                      <span style={{ flex: 1, fontSize: 11.5 }}>{topicLabel(topic).slice(3)}</span>
                      <span className="badge" style={{ marginRight: 4 }}>{topicDiagrams.length}</span>
                      <span className="topic-chevron">▶</span>
                    </button>
                    {isOpen && (
                      <div className="diagram-items">
                        {topicDiagrams.map((d) => (
                          <button
                            key={d.id}
                            className={`diagram-item ${d.id === selectedId ? "active" : ""}`}
                            onClick={() => handleSelectDiagram(d)}
                          >
                            <span className={`diagram-item-type badge ${typeColor(d.type)}`}>{typeLabel(d.type)}</span>
                            <span style={{ flex: 1, fontSize: 11 }}>{d.moduleName || "Class Diagram"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CENTER: Diagram Viewer */}
            <div className="diagram-viewer">
              <div className="viewer-toolbar">
                <span className="viewer-title">
                  {selected ? `${topicLabel(selected.topicName)} › ${selected.moduleName} [${typeLabel(selected.type)}]` : "Chọn sơ đồ từ danh sách"}
                </span>
                {selected && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button className="btn btn-sm" onClick={() => setImgZoom((z) => Math.max(0.3, z - 0.15))}>−</button>
                    <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 38, textAlign: "center" }}>{Math.round(imgZoom * 100)}%</span>
                    <button className="btn btn-sm" onClick={() => setImgZoom((z) => Math.min(4, z + 0.15))}>+</button>
                    <button className="btn btn-sm" onClick={() => setImgZoom(1)}>100%</button>
                    <div className="topbar-divider" style={{ margin: "0 4px" }} />
                    <button className="btn btn-sm" onClick={() => setShowProblem((v) => !v)}>
                      {showProblem ? "⬅ Ẩn đề bài" : "Hiện đề bài ➡"}
                    </button>
                  </div>
                )}
              </div>

              <div className="viewer-image-wrap" onWheel={(e) => {
                if (e.ctrlKey) {
                  e.preventDefault();
                  setImgZoom((z) => Math.min(4, Math.max(0.3, z + (e.deltaY < 0 ? 0.1 : -0.1))));
                }
              }}>
                {selected ? (
                  <img
                    src={`/${imagePath}`}
                    alt={`${selected.moduleName} class diagram`}
                    style={{ width: `${imgZoom * 100}%`, maxWidth: "none" }}
                  />
                ) : (
                  <div className="viewer-empty">
                    <div className="empty-icon">📐</div>
                    <p>Chọn một sơ đồ từ danh sách bên trái</p>
                    <p style={{ fontSize: 11, color: "var(--text3)" }}>Ctrl + cuộn chuột để zoom</p>
                  </div>
                )}
              </div>
            </div>

            {/* RESIZER */}
            {showProblem && (
              <div className="vertical-resizer" onMouseDown={startResizing} />
            )}

            {/* RIGHT: Problem Panel */}
            {showProblem && (
              <div className="problem-panel">
                <div className="problem-panel-header">
                  <strong>📄 Đề bài</strong>
                  <button className="btn btn-sm" onClick={() => setShowProblem(false)}>✕</button>
                </div>
                <ProblemView diagram={selected} />
              </div>
            )}
          </div>
        )}

        {/* ═══════ FLASH CARD MODE ═══════ */}
        {mode === "flash" && (
          <div className="flash-layout">
            {/* LEFT: card list */}
            <div className="flash-sidebar">
              <div className="flash-sidebar-header">
                <h2>🃏 Flash Cards</h2>
                <p>{flashQueue.length} thẻ trong bộ hiện tại</p>
                <div className="flash-stat-row">
                  <div className="flash-stat stat-known">
                    <div className="stat-num">{flashQueue.filter((d) => knownSet.has(d.id)).length}</div>
                    <div className="stat-label">Đã nhớ</div>
                  </div>
                  <div className="flash-stat stat-unknown">
                    <div className="stat-num">{flashQueue.filter((d) => !knownSet.has(d.id)).length}</div>
                    <div className="stat-label">Chưa nhớ</div>
                  </div>
                </div>
              </div>

              <div className="flash-controls">
                <div style={{ height: 4, background: "var(--surface3)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: flashQueue.length ? `${((flashIndex + 1) / flashQueue.length) * 100}%` : "0%",
                    background: "linear-gradient(90deg, var(--accent), #7b6cf0)",
                    transition: "width 0.3s ease",
                    borderRadius: 2
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                  Thẻ {flashIndex + 1} / {flashQueue.length} · <span className="kbd">K</span> nhớ · <span className="kbd">U</span> chưa nhớ · <span className="kbd">Space</span> lật
                </div>
              </div>

              <div className="flash-card-list">
                {flashQueue.map((d, i) => (
                  <button
                    key={d.id}
                    className={`flash-card-thumb ${i === flashIndex ? "current" : ""} ${knownSet.has(d.id) ? "known" : ""}`}
                    onClick={() => { setFlashIndex(i); setIsFlipped(false); }}
                  >
                    <div className="thumb-status">{knownSet.has(d.id) ? "✓" : ""}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.moduleName || topicLabel(d.topicName).slice(3)}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>
                        {topicLabel(d.topicName).slice(0, 2)} · <span className={`badge ${typeColor(d.type)}`} style={{ fontSize: 9 }}>{typeLabel(d.type)}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {flashQueue.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                    Không có thẻ nào.<br />Thay đổi bộ lọc và bấm "Tạo bộ thẻ mới".
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Flash card display */}
            {flashQueue.length > 0 ? (
              <FlashCard
                diagram={currentFlash}
                cardIndex={flashIndex}
                total={flashQueue.length}
                isFlipped={isFlipped}
                onFlip={() => setIsFlipped((v) => !v)}
                onKnown={markKnown}
                onUnknown={markUnknown}
                onPrev={prevFlash}
                onNext={nextFlash}
                knownSet={knownSet}
              />
            ) : (
              <div className="flash-area" style={{ display: "grid", placeItems: "center" }}>
                <div style={{ textAlign: "center", color: "var(--text3)", gap: 12 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🃏</div>
                  <p>Chưa có thẻ nào. Chọn bộ lọc rồi bấm <strong style={{ color: "var(--accent2)" }}>Tạo bộ thẻ mới</strong>.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
