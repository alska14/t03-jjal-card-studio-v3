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
  imageDims: "",
  text: "",
  posX: 50,
  posY: 85,
  fontSize: 7,
  fontFamily: "system",
  color: "#ffffff",
  align: "center",
  stroke: true,
  glow: false,
  opacity: 100,
  overlayEnabled: false,
  overlayDirection: "bottom",
  overlayOpacity: 55,
  bgColor: "#111318",
  ratio: "1:1",
};

const DEFAULT_STATE = JSON.parse(JSON.stringify(state));

let editingTemplateId = null; // if set, "save" updates this template instead of creating new

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const canvas = $("previewCanvas");
const ctx = canvas.getContext("2d");

const imageInput = $("imageInput");
const imageError = $("imageError");
const imagePreview = $("imagePreview");
const imagePreviewThumb = $("imagePreviewThumb");
const imagePreviewName = $("imagePreviewName");
const imagePreviewDims = $("imagePreviewDims");
const imageRemoveBtn = $("imageRemoveBtn");
const imageHint = $("imageHint");

const textInput = $("textInput");
const textCharCount = $("textCharCount");
const quickPhrases = $("quickPhrases");
const posX = $("posX"), posXVal = $("posXVal");
const posY = $("posY"), posYVal = $("posYVal");
const fontSize = $("fontSize"), fontSizeVal = $("fontSizeVal");
const fontFamily = $("fontFamily");
const textColor = $("textColor");
const textColorHex = $("textColorHex");
const textAlign = $("textAlign");
const textOpacity = $("textOpacity"), textOpacityVal = $("textOpacityVal");
const textStroke = $("textStroke");
const overlayEnabled = $("overlayEnabled");
const overlayOptions = $("overlayOptions");
const overlayDirection = $("overlayDirection");
const overlayOpacity = $("overlayOpacity"), overlayOpacityVal = $("overlayOpacityVal");
const textGlow = $("textGlow");
const bgColor = $("bgColor");
const resetBtn = $("resetBtn");
const ratioButtons = document.querySelectorAll(".ratio-btn");
const canvasInfo = $("canvasInfo");
const toastContainer = $("toastContainer");

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
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, w, h);

  if (state.image) {
    drawCoverImage(state.image, w, h);
  }

  if (state.overlayEnabled) {
    drawOverlay(w, h);
  }

  if (state.text && state.text.trim().length > 0) {
    drawText(w, h);
  }

  canvasInfo.textContent = `${w}×${h}px (${state.ratio})`;
}

function drawOverlay(w, h) {
  const alpha = state.overlayOpacity / 100;
  let grad;
  if (state.overlayDirection === "top") {
    grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
  } else if (state.overlayDirection === "full") {
    grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(0,0,0,${alpha * 0.5})`);
    grad.addColorStop(0.5, `rgba(0,0,0,${alpha * 0.25})`);
    grad.addColorStop(1, `rgba(0,0,0,${alpha * 0.5})`);
  } else {
    grad = ctx.createLinearGradient(0, h * 0.45, 0, h);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
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
  const family = state.fontFamily === "system"
    ? '-apple-system, "Malgun Gothic", sans-serif'
    : state.fontFamily;
  ctx.font = `bold ${fsPx}px ${family}`;
  ctx.textAlign = state.align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = state.color;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = Math.max(2, fsPx * 0.12);
  ctx.globalAlpha = Math.max(0, Math.min(1, state.opacity / 100));
  if (state.glow) {
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = fsPx * 0.25;
    ctx.shadowOffsetY = fsPx * 0.06;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

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
  ctx.globalAlpha = 1;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
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
      state.imageDims = `${img.width}×${img.height}px`;
      showImagePreview(ev.target.result, file, img);
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

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function showImagePreview(dataUrl, file, img) {
  imagePreviewThumb.src = dataUrl;
  imagePreviewThumb.alt = file.name;
  imagePreviewName.textContent = file.name;
  imagePreviewDims.textContent = `${img.width}×${img.height}px · ${formatFileSize(file.size)}`;
  imagePreview.hidden = false;
  imageHint.hidden = true;
}

imageRemoveBtn.addEventListener("click", () => {
  state.image = null;
  state.imageName = "";
  state.imageDims = "";
  imageInput.value = "";
  imagePreview.hidden = true;
  imageHint.hidden = false;
  imageError.hidden = true;
  draw();
});

/* ---------- Text / style controls ---------- */
textInput.addEventListener("input", () => {
  state.text = textInput.value;
  textCharCount.textContent = state.text.length;
  draw();
});
quickPhrases.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  textInput.value = chip.dataset.text;
  state.text = chip.dataset.text;
  textCharCount.textContent = state.text.length;
  draw();
  textInput.focus();
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
fontFamily.addEventListener("change", () => {
  state.fontFamily = fontFamily.value;
  draw();
});
textColor.addEventListener("input", () => {
  state.color = textColor.value;
  textColorHex.textContent = state.color.toUpperCase();
  draw();
});
textAlign.addEventListener("change", () => {
  state.align = textAlign.value;
  draw();
});
textOpacity.addEventListener("input", () => {
  state.opacity = Number(textOpacity.value);
  textOpacityVal.textContent = state.opacity;
  draw();
});
textStroke.addEventListener("change", () => {
  state.stroke = textStroke.checked;
  draw();
});
overlayEnabled.addEventListener("change", () => {
  state.overlayEnabled = overlayEnabled.checked;
  overlayOptions.hidden = !state.overlayEnabled;
  draw();
});
overlayDirection.addEventListener("change", () => {
  state.overlayDirection = overlayDirection.value;
  draw();
});
overlayOpacity.addEventListener("input", () => {
  state.overlayOpacity = Number(overlayOpacity.value);
  overlayOpacityVal.textContent = state.overlayOpacity;
  draw();
});
textGlow.addEventListener("change", () => {
  state.glow = textGlow.checked;
  draw();
});
bgColor.addEventListener("input", () => {
  state.bgColor = bgColor.value;
  draw();
});

/* ---------- Toast notifications ---------- */
function showToast(message, type) {
  const el = document.createElement("div");
  el.className = `toast toast-${type || "info"}`;
  el.textContent = message;
  el.setAttribute("role", "status");
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

/* ---------- Reset ---------- */
resetBtn.addEventListener("click", () => {
  if (!confirm("모든 편집 내용을 초기화할까요? 저장된 템플릿은 유지됩니다.")) return;
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  imageInput.value = "";
  imagePreview.hidden = true;
  imageHint.hidden = false;
  imageError.hidden = true;
  textInput.value = "";
  textCharCount.textContent = "0";
  posX.value = state.posX; posXVal.textContent = state.posX;
  posY.value = state.posY; posYVal.textContent = state.posY;
  fontSize.value = state.fontSize; fontSizeVal.textContent = state.fontSize;
  fontFamily.value = state.fontFamily;
  textColor.value = state.color; textColorHex.textContent = state.color.toUpperCase();
  textAlign.value = state.align;
  textStroke.checked = state.stroke;
  textGlow.checked = state.glow;
  textOpacity.value = state.opacity; textOpacityVal.textContent = state.opacity;
  overlayEnabled.checked = state.overlayEnabled;
  overlayOptions.hidden = true;
  overlayDirection.value = state.overlayDirection;
  overlayOpacity.value = state.overlayOpacity; overlayOpacityVal.textContent = state.overlayOpacity;
  bgColor.value = state.bgColor;
  ratioButtons.forEach((b) => b.classList.toggle("active", b.dataset.ratio === state.ratio));
  draw();
  showToast("초기화했습니다.", "info");
});

/* ---------- Drag text directly on canvas ---------- */
let dragging = false;
function canvasPointToPercent(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = ((clientX - rect.left) / rect.width) * 100;
  const py = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.max(0, Math.min(100, px)),
    y: Math.max(0, Math.min(100, py)),
  };
}
canvas.addEventListener("pointerdown", (e) => {
  if (!state.text) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("dragging");
  const p = canvasPointToPercent(e.clientX, e.clientY);
  state.posX = Math.round(p.x);
  state.posY = Math.round(p.y);
  posX.value = state.posX; posXVal.textContent = state.posX;
  posY.value = state.posY; posYVal.textContent = state.posY;
  draw();
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const p = canvasPointToPercent(e.clientX, e.clientY);
  state.posX = Math.round(p.x);
  state.posY = Math.round(p.y);
  posX.value = state.posX; posXVal.textContent = state.posX;
  posY.value = state.posY; posYVal.textContent = state.posY;
  draw();
});
function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove("dragging");
  if (e && e.pointerId !== undefined) {
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  }
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ---------- Keyboard shortcut ---------- */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    downloadBtn.click();
  }
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
      showToast("본인 제작이 아닌 경우, 원본 출처 URL과 사용 허가 근거를 입력해야 합니다.", "error");
      sourceUrl.focus();
      return;
    }
  }
  const format = exportFormat.value;
  const ext = format === "image/png" ? "png" : "jpg";
  downloadBtn.disabled = true;
  canvas.toBlob((blob) => {
    downloadBtn.disabled = false;
    if (!blob) {
      showToast("이미지 생성에 실패했습니다.", "error");
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
    showToast("다운로드했습니다.", "success");
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
    fontFamily: state.fontFamily,
    color: state.color,
    align: state.align,
    stroke: state.stroke,
    glow: state.glow,
    opacity: state.opacity,
    overlayEnabled: state.overlayEnabled,
    overlayDirection: state.overlayDirection,
    overlayOpacity: state.overlayOpacity,
    bgColor: state.bgColor,
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
    loadBtn.className = "icon-btn";
    loadBtn.innerHTML = '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>불러오기</span>';
    loadBtn.setAttribute("aria-label", `${t.name} 템플릿 불러오기`);
    loadBtn.addEventListener("click", () => applyTemplate(t));

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.innerHTML = '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20l4.5-1 10-10a1.5 1.5 0 000-2.1l-1.4-1.4a1.5 1.5 0 00-2.1 0l-10 10L4 20z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>수정</span>';
    editBtn.setAttribute("aria-label", `${t.name} 템플릿 수정 모드`);
    editBtn.addEventListener("click", () => {
      applyTemplate(t);
      editingTemplateId = t.id;
      templateName.value = t.name;
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn danger";
    delBtn.innerHTML = '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>삭제</span>';
    delBtn.setAttribute("aria-label", `${t.name} 템플릿 삭제`);
    delBtn.addEventListener("click", () => {
      if (!confirm(`템플릿 "${t.name}"을(를) 삭제할까요?`)) return;
      const list = loadTemplates().filter((x) => x.id !== t.id);
      saveTemplates(list);
      if (editingTemplateId === t.id) editingTemplateId = null;
      renderTemplateList();
      showToast(`"${t.name}" 템플릿을 삭제했습니다.`, "info");
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
  state.fontFamily = t.fontFamily || "system";
  state.color = t.color;
  state.align = t.align;
  state.stroke = t.stroke !== undefined ? t.stroke : true;
  state.glow = t.glow !== undefined ? t.glow : false;
  state.opacity = t.opacity !== undefined ? t.opacity : 100;
  state.overlayEnabled = t.overlayEnabled !== undefined ? t.overlayEnabled : false;
  state.overlayDirection = t.overlayDirection || "bottom";
  state.overlayOpacity = t.overlayOpacity !== undefined ? t.overlayOpacity : 55;
  state.bgColor = t.bgColor || "#111318";
  state.ratio = RATIOS[t.ratio] ? t.ratio : "1:1";

  textInput.value = state.text;
  textCharCount.textContent = state.text.length;
  posX.value = state.posX; posXVal.textContent = state.posX;
  posY.value = state.posY; posYVal.textContent = state.posY;
  fontSize.value = state.fontSize; fontSizeVal.textContent = state.fontSize;
  fontFamily.value = state.fontFamily;
  textColor.value = state.color;
  textColorHex.textContent = state.color.toUpperCase();
  textAlign.value = state.align;
  textStroke.checked = state.stroke;
  textGlow.checked = state.glow;
  textOpacity.value = state.opacity; textOpacityVal.textContent = state.opacity;
  overlayEnabled.checked = state.overlayEnabled;
  overlayOptions.hidden = !state.overlayEnabled;
  overlayDirection.value = state.overlayDirection;
  overlayOpacity.value = state.overlayOpacity; overlayOpacityVal.textContent = state.overlayOpacity;
  bgColor.value = state.bgColor;
  ratioButtons.forEach((b) => b.classList.toggle("active", b.dataset.ratio === state.ratio));

  draw();
}

saveTemplateBtn.addEventListener("click", () => {
  const name = templateName.value.trim();
  if (!name) {
    showToast("템플릿 이름을 입력하세요.", "error");
    templateName.focus();
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
    showToast(`"${name}" 템플릿을 수정했습니다.`, "success");
  } else {
    list.push(currentStateAsTemplate(name));
    showToast(`"${name}" 템플릿을 저장했습니다.`, "success");
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
  textColorHex.textContent = textColor.value.toUpperCase();
  textOpacityVal.textContent = textOpacity.value;
  overlayOpacityVal.textContent = overlayOpacity.value;
  textCharCount.textContent = textInput.value.length;
  renderTemplateList();
  draw();
}
init();
