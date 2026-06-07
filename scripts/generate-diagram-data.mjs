import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outFile = path.join(root, "public", "diagram-data.json");

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function listTopicDirs() {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ChuDe_"))
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function readMmdFiles(topicDir) {
  const files = [];
  const topicClass = path.join(topicDir, "Class_Diagram.mmd");
  if (fs.existsSync(topicClass)) {
    files.push({
      type: "class",
      moduleName: "Class_Diagram",
      filePath: topicClass
    });
  }

  for (const entry of fs.readdirSync(topicDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("De_")) continue;
    const moduleDir = path.join(topicDir, entry.name);
    for (const name of ["c2.mmd", "c3.mmd", "c4.mmd"]) {
      const filePath = path.join(moduleDir, name);
      if (fs.existsSync(filePath)) {
        files.push({
          type: name.replace(".mmd", ""),
          moduleName: entry.name,
          filePath,
          moduleDir
        });
      }
    }
  }

  return files;
}

function parseClassDiagram(source) {
  const classes = [];
  const relations = [];
  const lines = source.split(/\r?\n/);
  let currentClass = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%%") || line === "classDiagram") continue;

    const classStart = line.match(/^class\s+([A-Za-z_][\w]*)\s*\{\s*$/);
    if (classStart) {
      currentClass = {
        name: classStart[1],
        attributes: [],
        methods: []
      };
      classes.push(currentClass);
      continue;
    }

    if (line === "}") {
      currentClass = null;
      continue;
    }

    if (currentClass) {
      const item = line.replace(/^[+\-#~]\s*/, "").trim();
      if (!item) continue;
      if (item.includes("(") && item.includes(")")) {
        currentClass.methods.push(item);
      } else {
        currentClass.attributes.push(item);
      }
      continue;
    }

    const relation = line.match(/^([A-Za-z_][\w]*)\s+(?:"([^"]+)")?\s*([*.o]?-{1,2}|--|<\|--|--\|>)\s*(?:"([^"]+)")?\s+([A-Za-z_][\w]*)(?:\s*:\s*(.+))?$/);
    if (relation) {
      relations.push({
        from: relation[1],
        fromMultiplicity: relation[2] || "",
        type: relation[3],
        toMultiplicity: relation[4] || "",
        to: relation[5],
        label: relation[6] || ""
      });
    }
  }

  return {
    classes: dedupeClasses(classes),
    relations
  };
}

function dedupeClasses(classes) {
  const map = new Map();
  for (const cls of classes) {
    if (!map.has(cls.name)) {
      map.set(cls.name, cls);
      continue;
    }
    const old = map.get(cls.name);
    old.attributes = [...new Set([...old.attributes, ...cls.attributes])];
    old.methods = [...new Set([...old.methods, ...cls.methods])];
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const diagrams = [];

for (const topicDir of listTopicDirs()) {
  const topicName = path.basename(topicDir);
  for (const item of readMmdFiles(topicDir)) {
    const source = fs.readFileSync(item.filePath, "utf8");
    const parsed = parseClassDiagram(source);
    if (!parsed.classes.length) continue;
    diagrams.push({
      id: `${topicName}/${item.moduleName}/${item.type}`,
      topicName,
      moduleName: item.moduleName,
      type: item.type,
      file: toPosix(path.relative(root, item.filePath)),
      problemFile: getProblemFile(item.moduleDir),
      problemText: getProblemText(item.moduleDir),
      ...parsed
    });
  }
}

fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), diagrams }, null, 2), "utf8");
console.log(`Generated ${diagrams.length} diagrams -> ${toPosix(path.relative(root, outFile))}`);

function getProblemFile(moduleDir) {
  if (!moduleDir) return "";
  const filePath = path.join(moduleDir, "Debai.txt");
  return fs.existsSync(filePath) ? toPosix(path.relative(root, filePath)) : "";
}

function getProblemText(moduleDir) {
  if (!moduleDir) return "";
  const filePath = path.join(moduleDir, "Debai.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}
