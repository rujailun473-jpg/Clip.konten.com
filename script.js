// =========================================================================
// AUTOCLIPPER UNIVERSAL — ANDROID WEBVIEW SAFE ENGINE
// =========================================================================

const FRAME_PRESETS = {
  "9:16": { w: 540, h: 960 },
  "9:14": { w: 540, h: 840 },
  "4:5":  { w: 540, h: 675 },
  "1:1":  { w: 540, h: 540 },
  "16:9": { w: 960, h: 540 },
};

const NICHE_PRESETS = {
  general:    { hook: "MOMEN PALING SERU!", tags: "#fyp #viral #klip #reels" },
  automotive: { hook: "DETAIL & SUARA MESINNYA!", tags: "#otomotif #modifikasi #reviewmotor #fyp" },
  product:    { hook: "JUJUR REVIEW PRODUK INI!", tags: "#skincare #reviewjujur #racunbelanja #fyp" },
  gaming:     { hook: "CLUTCH PALING GILA!", tags: "#gaming #highlight #gameplay #fyp" },
  podcast:    { hook: "TOP 3 MOMEN NGAKAK!", tags: "#podcast #komedi #obrolanseru #fyp" },
};

const state = {
  videoUrl: null,
  aspectRatio: "9:16",
  layoutMode: "single",
  autoTrack: true,
  manualX1: 0.5,
  manualX2: 0.75,
  targetX1: 0.5,
  targetY1: 0.45,
  smoothX1: 0.5,
  smoothY1: 0.45,
  targetX2: 0.75,
  smoothX2: 0.75,
  clips: [],
  activeClipIndex: -1,
  isPlayingSequence: false,
  overlayHook: "",
  overlaySub: "",
  overlayCta: "",
};

const dom = {
  videoInput: document.getElementById("videoInput"),
  srtInput: document.getElementById("srtInput"),
  videoStatus: document.getElementById("videoStatus"),
  sourceVideo: document.getElementById("sourceVideo"),
  stageCanvas: document.getElementById("stageCanvas"),
  aspectRatioSelect: document.getElementById("aspectRatioSelect"),
  layoutModeSelect: document.getElementById("layoutModeSelect"),
  faceTrackToggle: document.getElementById("faceTrackToggle"),
  trackStatusBadge: document.getElementById("trackStatusBadge"),
  btnTogglePlay: document.getElementById("btnTogglePlay"),
  videoSeekBar: document.getElementById("videoSeekBar"),
  timeDisplay: document.getElementById("timeDisplay"),
  manualX1: document.getElementById("manualX1"),
  manualX1Val: document.getElementById("manualX1Val"),
  manualX2: document.getElementById("manualX2"),
  manualX2Val: document.getElementById("manualX2Val"),
  splitControlGroup: document.getElementById("splitControlGroup"),
  nicheSelect: document.getElementById("nicheSelect"),
  briefMinDur: document.getElementById("briefMinDur"),
  briefMaxDur: document.getElementById("briefMaxDur"),
  briefHook: document.getElementById("briefHook"),
  briefCta: document.getElementById("briefCta"),
  briefBrand: document.getElementById("briefBrand"),
  rawBriefInput: document.getElementById("rawBriefInput"),
  transcriptInput: document.getElementById("transcriptInput"),
  geminiKey: document.getElementById("geminiKey"),
  btnAutoCut: document.getElementById("btnAutoCut"),
  cutStatus: document.getElementById("cutStatus"),
  clipsContainer: document.getElementById("clipsContainer"),
  totalDurBadge: document.getElementById("totalDurBadge"),
  btnPlayAll: document.getElementById("btnPlayAll"),
  btnStopAll: document.getElementById("btnStopAll"),
  btnExportClip: document.getElementById("btnExportClip"),
  exportStatus: document.getElementById("exportStatus"),
  captionOutput: document.getElementById("captionOutput"),
  btnCopyCaption: document.getElementById("btnCopyCaption"),
};

const ctx = dom.stageCanvas.getContext("2d", { alpha: false });

// Micro-canvas 64x36 untuk deteksi wajah & objek ringan (RAM 4GB safe)
const trackCanvas = document.createElement("canvas");
trackCanvas.width = 64;
trackCanvas.height = 36;
const trackCtx = trackCanvas.getContext("2d", { willReadFrequently: true });

let nativeFaceDetector = null;
if ("FaceDetector" in window) {
  try {
    nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
  } catch (_) {
    nativeFaceDetector = null;
  }
}

if (localStorage.getItem("ac_gemini_key")) {
  dom.geminiKey.value = localStorage.getItem("ac_gemini_key");
}
dom.geminiKey.addEventListener("change", () => {
  localStorage.setItem("ac_gemini_key", dom.geminiKey.value.trim());
});

// =========================================================================
// 1. MEMUAT VIDEO LOKAL (PERBAIKAN ANDROID WEBVIEW / APK)
// =========================================================================
dom.videoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (state.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
  }

  state.videoUrl = URL.createObjectURL(file);
  dom.sourceVideo.src = state.videoUrl;
  dom.sourceVideo.load();
  dom.videoStatus.textContent = `⏳ Memuat "${file.name}"...`;
});

dom.sourceVideo.addEventListener("loadedmetadata", () => {
  const vw = dom.sourceVideo.videoWidth;
  const vh = dom.sourceVideo.videoHeight;
  const dur = dom.sourceVideo.duration || 0;

  dom.videoSeekBar.max = Math.max(1, dur);
  dom.timeDisplay.textContent = `00:00 / ${formatTime(dur)}`;
  dom.videoStatus.textContent = `✅ Video siap (${vw}×${vh} • ${formatTime(dur)})`;

  // Pancing frame pertama agar langsung tampil di kanvas meski sedang pause
  dom.sourceVideo.currentTime = Math.min(0.2, dur * 0.1);
});

dom.sourceVideo.addEventListener("seeked", () => {
  drawFrameOnce();
});

dom.sourceVideo.addEventListener("loadeddata", () => {
  drawFrameOnce();
});

dom.sourceVideo.addEventListener("error", () => {
  dom.videoStatus.textContent = "❌ Format video tidak didukung WebView Android. Gunakan MP4 (H.264).";
});

dom.srtInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  dom.transcriptInput.value = await file.text();
  dom.cutStatus.textContent = `📄 Subtitle "${file.name}" berhasil dimuat.`;
});

// Kontrol Play/Pause & Seekbar
dom.btnTogglePlay.addEventListener("click", () => {
  if (!dom.sourceVideo.src) return;
  if (dom.sourceVideo.paused) {
    dom.sourceVideo.play();
  } else {
    dom.sourceVideo.pause();
  }
});

dom.videoSeekBar.addEventListener("input", (e) => {
  if (!dom.sourceVideo.src) return;
  dom.sourceVideo.currentTime = Number(e.target.value);
});

// =========================================================================
// 2. PENGATURAN BINGKAI, MODE & AUTO-TRACK
// =========================================================================
dom.aspectRatioSelect.addEventListener("change", (e) => {
  state.aspectRatio = e.target.value;
  const p = FRAME_PRESETS[state.aspectRatio] || FRAME_PRESETS["9:16"];
  dom.stageCanvas.width = p.w;
  dom.stageCanvas.height = p.h;
  drawFrameOnce();
});

dom.layoutModeSelect.addEventListener("change", (e) => {
  state.layoutMode = e.target.value;
  dom.splitControlGroup.classList.toggle("hidden", state.layoutMode !== "split");
  drawFrameOnce();
});

dom.faceTrackToggle.addEventListener("change", (e) => {
  state.autoTrack = e.target.checked;
  dom.trackStatusBadge.textContent = state.autoTrack ? "🎯 Auto-Track: Aktif" : "✋ Kamera: Manual";
  dom.trackStatusBadge.className = state.autoTrack ? "pill ok" : "pill warn";
  if (!state.autoTrack) {
    state.targetX1 = state.manualX1;
    state.targetX2 = state.manualX2;
  }
});

dom.manualX1.addEventListener("input", (e) => {
  const pct = Number(e.target.value);
  dom.manualX1Val.textContent = `${pct}%`;
  state.manualX1 = pct / 100;
  if (!state.autoTrack) {
    state.targetX1 = state.manualX1;
    state.smoothX1 = state.manualX1;
    drawFrameOnce();
  }
});

dom.manualX2.addEventListener("input", (e) => {
  const pct = Number(e.target.value);
  dom.manualX2Val.textContent = `${pct}%`;
  state.manualX2 = pct / 100;
  if (!state.autoTrack) {
    state.targetX2 = state.manualX2;
    state.smoothX2 = state.manualX2;
    drawFrameOnce();
  }
});

// =========================================================================
// 3. PELACAK WAJAH & SUBJEK OTOMATIS
// =========================================================================
let lastDetectTime = 0;

async function detectFocusPoint(now) {
  if (!state.autoTrack || state.layoutMode === "blur") return;
  if (dom.sourceVideo.readyState < 2 || dom.sourceVideo.paused) return;
  if (now - lastDetectTime < 200) return;
  lastDetectTime = now;

  const vw = dom.sourceVideo.videoWidth;
  const vh = dom.sourceVideo.videoHeight;
  if (!vw || !vh) return;

  if (nativeFaceDetector) {
    try {
      const faces = await nativeFaceDetector.detect(dom.sourceVideo);
      if (faces && faces.length > 0) {
        faces.sort((a, b) => a.boundingBox.x - b.boundingBox.x);
        const f1 = faces[0].boundingBox;
        state.targetX1 = clamp((f1.x + f1.width * 0.5) / vw, 0.15, 0.85);
        state.targetY1 = clamp((f1.y + f1.height * 0.45) / vh, 0.2, 0.8);
        if (faces.length > 1) {
          const f2 = faces[faces.length - 1].boundingBox;
          state.targetX2 = clamp((f2.x + f2.width * 0.5) / vw, 0.15, 0.85);
        }
        return;
      }
    } catch (_) {}
  }

  // Fallback centroid warna kulit & area fokus tengah-atas
  trackCtx.drawImage(dom.sourceVideo, 0, 0, 64, 36);
  const data = trackCtx.getImageData(0, 0, 64, 36).data;
  let wL = 0, xL = 0, wR = 0, xR = 0, wT = 0, xT = 0, yT = 0;

  for (let y = 3; y < 30; y++) {
    for (let x = 2; x < 62; x++) {
      const i = (y * 64 + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 75 && g > 40 && b > 25 && r > g && r > b && Math.abs(r - g) > 12) {
        const nx = x / 64;
        const ny = y / 36;
        wT++; xT += nx; yT += ny;
        if (nx < 0.5) { wL++; xL += nx; } else { wR++; xR += nx; }
      }
    }
  }

  if (wT > 6) {
    if (state.layoutMode === "split" && wL > 3 && wR > 3) {
      state.targetX1 = clamp(xL / wL, 0.15, 0.45);
      state.targetX2 = clamp(xR / wR, 0.55, 0.85);
    } else {
      state.targetX1 = clamp(xT / wT, 0.15, 0.85);
      state.targetY1 = clamp(yT / wT, 0.2, 0.8);
    }
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// =========================================================================
// 4. RENDER LOOP KANVAS
// =========================================================================
function drawFrameOnce() {
  const cw = dom.stageCanvas.width;
  const ch = dom.stageCanvas.height;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);

  if (dom.sourceVideo.readyState >= 2 && dom.sourceVideo.videoWidth > 0) {
    if (state.layoutMode === "blur") {
      drawFullWithBlurBackdrop(dom.sourceVideo, cw, ch);
    } else if (state.layoutMode === "split") {
      const halfH = Math.floor(ch / 2);
      drawCroppedVideo(dom.sourceVideo, 0, 0, cw, halfH - 2, state.smoothX1, 0.45);
      drawCroppedVideo(dom.sourceVideo, 0, halfH + 2, cw, halfH - 2, state.smoothX2, 0.45);
    } else {
      drawCroppedVideo(dom.sourceVideo, 0, 0, cw, ch, state.smoothX1, state.smoothY1);
    }
  } else {
    ctx.fillStyle = "#141923";
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Bingkai ${state.aspectRatio} (${cw}×${ch})`, cw / 2, ch / 2 - 12);
    ctx.font = "15px system-ui";
    ctx.fillText("Ketuk 'Masukkan Video' di atas", cw / 2, ch / 2 + 18);
  }

  drawOverlays(cw, ch);
}

function renderLoop(now) {
  detectFocusPoint(now);

  const ease = 0.15;
  state.smoothX1 += (state.targetX1 - state.smoothX1) * ease;
  state.smoothY1 += (state.targetY1 - state.smoothY1) * ease;
  state.smoothX2 += (state.targetX2 - state.smoothX2) * ease;

  if (!dom.sourceVideo.paused && dom.sourceVideo.readyState >= 2) {
    drawFrameOnce();
    const cur = dom.sourceVideo.currentTime || 0;
    const dur = dom.sourceVideo.duration || 0;
    dom.videoSeekBar.value = cur;
    dom.timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  }

  if (state.isPlayingSequence && state.activeClipIndex >= 0) {
    const activeClip = state.clips[state.activeClipIndex];
    if (activeClip && dom.sourceVideo.currentTime >= activeClip.end) {
      advanceSequence();
    }
  }

  requestAnimationFrame(renderLoop);
}

function drawCroppedVideo(video, dx, dy, dw, dh, focusX, focusY) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const targetRatio = dw / dh;
  const sourceRatio = vw / vh;
  let sw, sh, sx, sy;

  if (sourceRatio > targetRatio) {
    sh = vh;
    sw = vh * targetRatio;
    sx = clamp(focusX * vw - sw / 2, 0, vw - sw);
    sy = 0;
  } else {
    sw = vw;
    sh = vw / targetRatio;
    sx = 0;
    sy = clamp(focusY * vh - sh / 2, 0, vh - sh);
  }

  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawFullWithBlurBackdrop(video, cw, ch) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  // 1. Latar belakang penuh dengan blur & redup
  ctx.save();
  try { ctx.filter = "blur(16px) brightness(0.55)"; } catch (_) {}
  drawCroppedVideo(video, 0, 0, cw, ch, 0.5, 0.5);
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(0, 0, cw, ch);

  // 2. Video asli utuh di tengah (tidak terpotong)
  const scale = Math.min(cw / vw, ch / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const drawX = (cw - drawW) / 2;
  const drawY = (ch - drawH) / 2;
  ctx.drawImage(video, 0, 0, vw, vh, drawX, drawY, drawW, drawH);
}

function drawOverlays(cw, ch) {
  if (state.overlayHook) {
    const boxY = Math.round(ch * 0.06);
    ctx.fillStyle = "#facc15";
    roundRect(ctx, 24, boxY, cw - 48, 58, 10, true);
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.overlayHook.toUpperCase().slice(0, 36), cw / 2, boxY + 36);
  }

  if (state.overlaySub) {
    const subY = Math.round(ch * 0.80);
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    roundRect(ctx, 24, subY - 30, cw - 48, 50, 8, true);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 17px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.overlaySub.slice(0, 46), cw / 2, subY + 2);
  }

  if (state.overlayCta) {
    const ctaY = Math.round(ch * 0.89);
    ctx.fillStyle = "#ef4444";
    roundRect(ctx, 24, ctaY - 28, cw - 48, 48, 8, true);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.overlayCta.slice(0, 44), cw / 2, ctaY + 2);
  }
}

function roundRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  if (fill) context.fill();
}

requestAnimationFrame(renderLoop);

// =========================================================================
// 5. CUTTER OTOMATIS UNIVERSAL (BISA TANPA TRANSKRIP MAUPUN PAKAI BRIEF/AI)
// =========================================================================
dom.rawBriefInput.addEventListener("blur", extractBriefRules);

function extractBriefRules() {
  const raw = dom.rawBriefInput.value;
  if (!raw.trim()) return;

  const durMatch = raw.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})\s*detik/i);
  if (durMatch) {
    dom.briefMinDur.value = durMatch[1];
    dom.briefMaxDur.value = durMatch[2];
  }
  const titleMatch = raw.match(/Judul[:\s]*["“]([^"”]+)["”]/i);
  if (titleMatch) dom.briefHook.value = titleMatch[1];

  const ctaMatch = raw.match(/CTA[:\s]*["“]([^"”]+)["”]/i);
  if (ctaMatch) dom.briefCta.value = ctaMatch[1];

  const prodMatch = raw.match(/produk\s+([A-Za-z0-9\s]+?)(?:\s+secara|\n|$)/i);
  if (prodMatch) dom.briefBrand.value = prodMatch[1].trim();
}

dom.btnAutoCut.addEventListener("click", async () => {
  extractBriefRules();

  const videoDur = dom.sourceVideo.duration || 0;
  const rawTranscript = dom.transcriptInput.value.trim();
  const niche = NICHE_PRESETS[dom.nicheSelect.value] || NICHE_PRESETS.general;

  if (!videoDur && !rawTranscript) {
    alert("Masukkan video terlebih dahulu agar cutter bisa memotong momen!");
    return;
  }

  const config = {
    brand: dom.briefBrand.value.trim(),
    hook: dom.briefHook.value.trim() || niche.hook,
    cta: dom.briefCta.value.trim(),
    minDur: Number(dom.briefMinDur.value) || 30,
    maxDur: Number(dom.briefMaxDur.value) || 60,
    tags: niche.tags,
  };

  const apiKey = dom.geminiKey.value.trim();

  // Mode 1: Jika ada transkrip/SRT -> potong berdasarkan dialog/briefing
  if (rawTranscript) {
    const entries = parseTranscriptLines(rawTranscript);
    if (entries.length > 0) {
      if (apiKey) {
        dom.cutStatus.textContent = "🤖 Memotong momen cerdas dengan Gemini AI...";
        try {
          state.clips = await cutWithGeminiAI(apiKey, entries, config);
        } catch (_) {
          state.clips = cutFromTranscriptLocal(entries, config);
        }
      } else {
        state.clips = cutFromTranscriptLocal(entries, config);
      }
      renderClipTimeline(config);
      dom.cutStatus.textContent = `✅ ${state.clips.length} potongan momen ditemukan dari transkrip!`;
      return;
    }
  }

  // Mode 2: Auto-Scan Video Langsung (Cocok untuk Otomotif, Gaming, Review Produk, Vlog tanpa SRT)
  state.clips = cutVideoTimelineAutomatically(videoDur, config);
  renderClipTimeline(config);
  dom.cutStatus.textContent = `✅ Video (${formatTime(videoDur)}) otomatis dipotong menjadi ${state.clips.length} segmen highlight!`;
});

function cutVideoTimelineAutomatically(totalVideoDur, config) {
  const safeDur = Math.max(6, totalVideoDur);
  const targetTotal = clamp(Math.round((config.minDur + config.maxDur) / 2), 10, Math.floor(safeDur));

  // Jika video pendek (<= target durasi), ambil utuh + hook + CTA
  if (safeDur <= config.maxDur) {
    const cuts = [];
    if (dom.briefHook.value.trim()) {
      cuts.push({
        role: "Hook Pembuka (0-3d)",
        type: "hook",
        start: 0,
        end: Math.min(3, safeDur),
        text: config.hook,
      });
    }
    cuts.push({
      role: "Klip Utama Utuh",
      type: "moment",
      start: 0,
      end: Math.floor(safeDur),
      text: "Bagian utama video",
    });
    if (config.cta) {
      cuts.push({
        role: "CTA Akhir",
        type: "cta",
        start: Math.max(0, Math.floor(safeDur) - 3),
        end: Math.floor(safeDur),
        text: config.cta,
      });
    }
    return cuts;
  }

  // Bagi video panjang menjadi 3 bagian highlight (Pembuka Aksi, Puncak Tengah, Penutup)
  const segLen = Math.max(5, Math.floor(targetTotal / 3));
  const p1 = Math.floor(safeDur * 0.12);
  const p2 = Math.floor(safeDur * 0.48);
  const p3 = Math.max(p2 + segLen + 2, Math.floor(safeDur * 0.80));

  const cuts = [
    {
      role: "Hook Pembuka (0-3d)",
      type: "hook",
      start: p2,
      end: Math.min(safeDur, p2 + 3),
      text: config.hook,
    },
    {
      role: "Highlight #1 (Awal)",
      type: "moment",
      start: p1,
      end: Math.min(safeDur, p1 + segLen),
      text: "Momen pembuka pilihan",
    },
    {
      role: "Highlight #2 (Klimaks)",
      type: "moment",
      start: p2,
      end: Math.min(safeDur, p2 + segLen),
      text: "Momen puncak utama",
    },
    {
      role: "Highlight #3 (Penutup)",
      type: "product",
      start: Math.min(safeDur - segLen, p3),
      end: Math.min(safeDur, p3 + segLen),
      text: "Momen penutup / detail akhir",
    },
  ];

  if (config.cta) {
    const last = cuts[cuts.length - 1];
    cuts.push({
      role: "CTA Akhir",
      type: "cta",
      start: Math.max(last.start, last.end - 3),
      end: last.end,
      text: config.cta,
    });
  }

  return cuts;
}

function parseTranscriptLines(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result = [];
  const s
