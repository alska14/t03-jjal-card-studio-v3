"use strict";

/* ---------- Constants ---------- */
const RATIOS = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};
const TEMPLATE_KEY = "aleph_t03_templates_v1";
const SUPPORTED_TYPES = ["image/png", "image/jpeg"];

/* ---------- State ---------- */
let state = {
  image: null,        // HTMLImageElement
  imageName: "",
  text: "",
  posX: 50,
  posY: 85,
  fontSize: 7,
  color: "#ffffff",
  align: "center",
  stroke: true,
  ratio: "1:1",
};

let editingTemplateId = null; // if set, "save" updates this template instead of creating new

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const canvas = $("previewCanvas");
const ctx = canvas.getContext("2d");

const imageInput = $("imageInput");
const imageError = $("imageError");
const textInput = $("textInput");
const posX = $("posX"), posXVal = $("posXVal");
const posY = $("posY"), posYVal = $("posYVal");
const fontSize = $("fontSize"), fontSizeVal = $("fontSizeVal");
const textColor = $("textColor");
const textAlign = $("textAlign");
const textStroke = $("textStroke");
const ratioButtons = document.querySelectorAll(".ratio-btn");
const canvasInfo = $("canvasInfo");

const ownWork = $("ownWork");
const sourceBlock = $("sourceBlock");
const sourceUrl = $("sourceUrl");
const licenseNote = $("licenseNote");
const exportFormat = $("exportFormat");
const downloadBtn = $("downloadBtn");

const templateName = $("templateName");
const saveTemplateBtn = $("saveTemplateBtn");
const templateList = $("templateList");
const exportJsonBtn = $("exportJsonBtn");
const importJsonInput = $("importJsonInput");
const jsonError = $("jsonError");
const jsonSuccess = $("jsonSuccess");

/* ---------- Rendering ---------- */
function draw() {
  const { w, h } = RATIOS[state.ratio];
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);

  // background
  ctx.fillStyle = "#111318";
  ctx.fillRect(0, 0, w, h);

  if (state.image) {
    drawCoverImage(state.image, w, h);
  }

  if (state.text && state.text.trim().length > 0) {
    drawText(w, h);
  }

  canvasInfo.textContent = `${w}×${h}px (${state.ratio})`;
}

function drawCoverImage(img, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sy = 0;
    sx = (img.width - sw) / 2;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function breakLongWord(word, maxWidth) {
  // A single word with no spaces (e.g. a URL) can be wider than maxWidth
  // on its own; split it character-by-character so it never overflows.
  const chunks = [];
  let chunk = "";
  for (const ch of word) {
    const test = chunk + ch;
    if (ctx.measureText(test).width > maxWidth && chunk) {
      chunks.push(chunk);
      chunk = ch;
    } else {
      chunk = test;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapLines(text, maxWidth) {
  const rawLines = String(text).split("\n");
  const out = [];
  for (const raw of rawLines) {
    if (raw.length === 0) { out.push(""); continue; }
    const words = raw.split(" ");
    let line = "";
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) { out.push(line); line = ""; }
        const pieces = breakLongWord(word, maxWidth);
        pieces.forEach((p, i) => {
          if (i === pieces.length - 1) line = p;
          else out.push(p);
        });
        continue;
      }
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

function drawText(w, h) {
  const fsPx = Math.max(8, (state.fontSize / 100) * w);
  ctx.font = `bold ${fsPx}px -apple-system, "Malgun Gothic", sans-serif`;
  ctx.textAlign = state.align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = state.color;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = Math.max(2, fsPx * 0.12);

  const maxWidth = w * 0.9;
  const lines = wrapLines(state.text, maxWidth);
  const lineHeight = fsPx * 1.25;
  const totalHeight = lineHeight * lines.length;

  const cx = (state.posX / 100) * w;
  let cy = (state.posY / 100) * h - totalHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    if (state.stroke) ctx.strokeText(line, cx, cy);
    ctx.fillText(line, cx, cy);
    cy += lineHeight;
  }
}

/* ---------- Image load ---------- */
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  imageError.hidden = true;

  if (!SUPPORTED_TYPES.includes(file.type)) {
    imageError.textContent = `지원하지 않는 파일 형식입니다 (${file.type || "알 수 없음"}). PNG 또는 JPEG 파일만 불러올 수 있습니다. 기존 작업은 유지됩니다.`;
    imageError.hidden = false;
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.imageName = file.name;
      draw();
    };
    img.onerror = () => {
      imageError.textContent = "파일을 이미지로 읽을 수 없습니다. 손상되었거나 잘못된 파일일 수 있습니다. 기존 작업은 유지됩니다.";
      imageError.hidden = false;
    };
    img.src = ev.target.result;
  };
  reader.onerror = () => {
    imageError.textContent = "파일을 읽는 중 오류가 발생했습니다. 기존 작업은 유지됩니다.";
    imageError.hidden = false;
  };
  reader.readAsDataURL(file);
});

/* ---------- Text / style controls ---------- */
textInput.addEventListener("input", () => {
  state.text = textInput.value;
  draw();
});
posX.addEventListener("input", () => {
  state.posX = Number(posX.value);
  posXVal.textContent = state.posX;
  draw();
});
posY.addEventListener("input", () => {
  state.posY = Number(posY.value);
  posYVal.textContent = state.posY;
  draw();
});
fontSize.addEventListener("input", () => {
  state.fontSize = Number(fontSize.value);
  fontSizeVal.textContent = state.fontSize;
  draw();
});
textColor.addEventListener("input", () => {
  state.color = textColor.value;
  draw();
});
textAlign.addEventListener("change", () => {
  state.align = textAlign.value;
  draw();
});
textStroke.addEventListener("change", () => {
  state.stroke = textStroke.checked;
  draw();
});

ratioButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    ratioButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.ratio = btn.dataset.ratio;
    draw();
  });
});

ownWork.addEventListener("change", () => {
  sourceBlock.style.display = ownWork.checked ? "none" : "block";
});
sourceBlock.style.display = ownWork.checked ? "none" : "block";

/* ---------- Download ---------- */
downloadBtn.addEventListener("click", () => {
  if (!ownWork.checked) {
    if (!sourceUrl.value.trim() || !licenseNote.value) {
      alert("본인 제작이 아닌 경우, 원본 출처 URL과 사용 허가 근거를 입력해야 합니다.");
      return;
    }
  }
  const format = exportFormat.value;
  const ext = format === "image/png" ? "png" : "jpg";
  canvas.toBlob((blob) => {
    if (!blob) {
      alert("이미지 생성에 실패했습니다.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `card_${state.ratio.replace(":", "x")}_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, format, 0.95);
});

/* ---------- Templates (CRUD, localStorage) ---------- */
function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveTemplates(list) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
}

function currentStateAsTemplate(name, id) {
  return {
    id: id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    text: state.text,
    posX: state.posX,
    posY: state.posY,
    fontSize: state.fontSize,
    color: state.color,
    align: state.align,
    stroke: state.stroke,
    ratio: state.ratio,
  };
}

const REQUIRED_TEMPLATE_FIELDS = ["id", "name", "text", "posX", "posY", "fontSize", "color", "align", "ratio"];

function isValidTemplate(t) {
  if (!t || typeof t !== "object") return false;
  return REQUIRED_TEMPLATE_FIELDS.every((f) => Object.prototype.hasOwnProperty.call(t, f));
}

function renderTemplateList() {
  const templates = loadTemplates();
  templateList.innerHTML = "";
  if (templates.length === 0) {
    const li = document.createElement("li");
    li.className = "t-empty";
    li.textContent = "저장된 템플릿이 없습니다.";
    templateList.appendChild(li);
    return;
  }
  templates.forEach((t) => {
    const li = document.createElement("li");
    const nameEl = document.createElement("span");
    nameEl.className = "t-name";
    nameEl.textContent = t.name;
    const actions = document.createElement("div");
    actions.className = "t-actions";

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "불러오기";
    loadBtn.addEventListener("click", () => applyTemplate(t));

    const editBtn = document.createElement("button");
    editBtn.textContent = "수정 모드";
    editBtn.addEventListener("click", () => {
      applyTemplate(t);
      editingTemplateId = t.id;
      templateName.value = t.name;
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      if (!confirm(`템플릿 "${t.name}"을(를) 삭제할까요?`)) return;
      const list = loadTemplates().filter((x) => x.id !== t.id);
      saveTemplates(list);
      if (editingTemplateId === t.id) editingTemplateId = null;
      renderTemplateList();
    });

    actions.append(loadBtn, editBtn, delBtn);
    li.append(nameEl, actions);
    templateList.appendChild(li);
  });
}

function applyTemplate(t) {
  state.text = t.text;
  state.posX = t.posX;
  state.posY = t.posY;
  state.fontSize = t.fontSize;
  state.color = t.color;
  state.align = t.align;
  state.stroke = t.stroke !== undefined ? t.stroke : true;
  state.ratio = RATIOS[t.ratio] ? t.ratio : "1:1";

  textInput.value = state.text;
  posX.value = state.posX; posXVal.textContent = state.posX;
  posY.value = state.posY; posYVal.textContent = state.posY;
  fontSize.value = state.fontSize; fontSizeVal.textContent = state.fontSize;
  textColor.value = state.color;
  textAlign.value = state.align;
  textStroke.checked = state.stroke;
  ratioButtons.forEach((b) => b.classList.toggle("active", b.dataset.ratio === state.ratio));

  draw();
}

saveTemplateBtn.addEventListener("click", () => {
  const name = templateName.value.trim();
  if (!name) {
    alert("템플릿 이름을 입력하세요.");
    return;
  }
  const list = loadTemplates();
  if (editingTemplateId) {
    const idx = list.findIndex((x) => x.id === editingTemplateId);
    if (idx !== -1) {
      list[idx] = currentStateAsTemplate(name, editingTemplateId);
    } else {
      list.push(currentStateAsTemplate(name));
    }
    editingTemplateId = null;
  } else {
    list.push(currentStateAsTemplate(name));
  }
  saveTemplates(list);
  templateName.value = "";
  renderTemplateList();
});

/* ---------- JSON export / import ---------- */
exportJsonBtn.addEventListener("click", () => {
  const templates = loadTemplates();
  const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `templates_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importJsonInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  jsonError.hidden = true;
  jsonSuccess.hidden = true;

  const reader = new FileReader();
  reader.onload = (ev) => {
    let parsed;
    try {
      parsed = JSON.parse(ev.target.result);
    } catch {
      jsonError.textContent = "JSON 문법이 손상되었습니다. 저장하지 않았습니다. 기존 템플릿을 유지합니다.";
      jsonError.hidden = false;
      importJsonInput.value = "";
      return;
    }
    if (!Array.isArray(parsed)) {
      jsonError.textContent = "JSON 형식이 올바르지 않습니다(배열이 아님). 저장하지 않았습니다. 기존 템플릿을 유지합니다.";
      jsonError.hidden = false;
      importJsonInput.value = "";
      return;
    }
    const allValid = parsed.every(isValidTemplate);
    if (!allValid) {
      jsonError.textContent = "필수 항목이 빠진 템플릿이 있습니다. 저장하지 않았습니다. 기존 템플릿을 유지합니다.";
      jsonError.hidden = false;
      importJsonInput.value = "";
      return;
    }
    saveTemplates(parsed);
    jsonSuccess.textContent = `템플릿 ${parsed.length}개를 복원했습니다.`;
    jsonSuccess.hidden = false;
    renderTemplateList();
    importJsonInput.value = "";
  };
  reader.onerror = () => {
    jsonError.textContent = "파일을 읽는 중 오류가 발생했습니다. 기존 템플릿을 유지합니다.";
    jsonError.hidden = false;
    importJsonInput.value = "";
  };
  reader.readAsText(file);
});

/* ---------- Init ---------- */
function init() {
  posXVal.textContent = posX.value;
  posYVal.textContent = posY.value;
  fontSizeVal.textContent = fontSize.value;
  renderTemplateList();
  draw();
}
init();
