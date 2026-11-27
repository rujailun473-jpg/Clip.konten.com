// =========================================================================
// AUTOCLIPPER UNIVERSAL — NATIVE VIDEO STAGE + AUTO-TRACK + AUTO-CUT
// =========================================================================

const FRAME_DIMS = {
  "9:16": { w: 540, h: 960, cls: "ratio-9-16" },
  "9:14": { w: 540, h: 840, cls: "ratio-9-14" },
  "4:5":  { w: 540, h: 675, cls: "ratio-4-5" },
  "1:1":  { w: 540, h: 540, cls: "ratio-1-1" },
  "16:9": { w: 960, h: 540, cls: "ratio-16-9" },
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
  currentFile: null,
  usedFallbackDataUrl: false,
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
};

const dom = {
  videoInput: document.getElementById("videoInput"),
  srtInput: document.getElementById("srtInput"),
  videoStatus: document.getElementById("videoStatus"),
  frameStage: document.getElementById("frameStage"),
  mainVideo: document.getElementById("mainVideo"),
  bgBlurVideo: document.getElementById("bgBlurVideo"),
  splitBottomVideo: document.getElementById("splitBottomVideo"),
  hookOverlay: document.getElementById("hookOverlay"),
  subOverlay: document.getElementById("subOverlay"),
  ctaOverlay: document.getElementById("ctaOverlay"),
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

// Offscreen micro-canvas (64x36) untuk tracking wajah hemat RAM 4GB
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
// 1. MEMUAT VIDEO + DIAGNOSTIK & FALLBACK DATA-URL ANDROID
// =========================================================================
dom.videoInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    dom.videoStatus.textContent = "⚠️ Tidak ada file video yang diterima dari galeri.";
    return;
  }

  state.currentFile = file;
  state.usedFallbackDataUrl = false;
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

  if (file.size === 0) {
    dom.videoStatus.textContent = "❌ Ukuran file terbaca 0 MB. Coba pilih video lewat menu 'File Saya / Documents'.";
    return;
  }

  if (state.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
  }

  state.videoUrl = URL.createObjectURL(file);
  dom.videoStatus.textContent = `⏳ Membuka "${file.name}" (${sizeMB} MB)...`;
  applyVideoSource(state.videoUrl);

  // Watchdog 2.5 detik: jika WebView Android menolak blob:, otomatis pakai DataURL (untuk file < 55MB)
  setTimeout(() => {
    if (dom.mainVideo.readyState === 0 && !state.usedFallbackDataUrl && file.size < 55 * 1024 * 1024) {
      fallbackToDataUrl(file);
    }
  }, 2500);
});

function applyVideoSource(srcUrl) {
  dom.mainVideo.src = srcUrl;
  dom.bgBlurVideo.src = srcUrl;
  dom.splitBottomVideo.src = srcUrl;
  dom.mainVideo.load();
  dom.bgBlurVideo.load();
  dom.splitBottomVideo.load();
}

function fallbackToDataUrl(file) {
  state.usedFallbackDataUrl = true;
  dom.videoStatus.textContent = "🔄 Mengonversi stream untuk WebView Android...";
  const reader = new FileReader();
  reader.onload = (ev) => {
    applyVideoSource(ev.target.result);
  };
  reader.onerror = () => {
    dom.videoStatus.textContent = "❌ Gagal membaca file video dari penyimpanan HP.";
  };
  reader.readAsDataURL(file);
}

dom.mainVideo.addEventListener("loadedmetadata", () => {
  const vw = dom.mainVideo.videoWidth;
  const vh = dom.mainVideo.videoHeight;
  const dur = dom.mainVideo.duration || 0;

  dom.videoSeekBar.max = Math.max(1, dur);
  dom.timeDisplay.textContent = `00:00 / ${formatTime(dur)}`;
  dom.videoStatus.textContent = `✅ Video Aktif: ${vw}×${vh} • Durasi ${formatTime(dur)}`;

  // Lompat ke 0.1 detik agar thumbnail frame langsung muncul di layar
  dom.mainVideo.currentTime = Math.min(0.1, dur * 0.05);
  dom.splitBottomVideo.currentTime = dom.mainVideo.currentTime;
});

dom.mainVideo.addEventListener("error", () => {
  const errCode = dom.mainVideo.error ? dom.mainVideo.error.code : 0;
  if (!state.usedFallbackDataUrl && state.currentFile && state.currentFile.size < 55 * 1024 * 1024) {
    fallbackToDataUrl(state.currentFile);
  } else {
    dom.videoStatus.textContent = `❌ Video tidak bisa diputar (Kode Error: ${errCode}). Pastikan format MP4 H.264.`;
  }
});

dom.srtInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  dom.transcriptInput.value = await file.text();
  dom.cutStatus.textContent = `📄 Subtitle "${file.name}" dimuat.`;
});

// =========================================================================
// 2. KONTROL PEMUTAR & SINKRONISASI 3 LAYER VIDEO
// =========================================================================
dom.btnTogglePlay.addEventListener("click", () => {
  if (!dom.mainVideo.src) return;
  if (dom.mainVideo.paused) {
    playSyncedVideos();
  } else {
    pauseSyncedVideos();
  }
});

function playSyncedVideos() {
  dom.mainVideo.play();
  if (state.layoutMode === "fit") dom.bgBlurVideo.play().catch(() => {});
  if (state.layoutMode === "split") {
    dom.splitBottomVideo.currentTime = dom.mainVideo.currentTime;
    dom.splitBottomVideo.play().catch(() => {});
  }
  dom.btnTogglePlay.textContent = "⏸️ Pause";
}

function pauseSyncedVideos() {
  dom.mainVideo.pause();
  dom.bgBlurVideo.pause();
  dom.splitBottomVideo.pause();
  dom.btnTogglePlay.textContent = "▶️ Play";
}

dom.videoSeekBar.addEventListener("input", (e) => {
  if (!dom.mainVideo.src) return;
  const t = Number(e.target.value);
  dom.mainVideo.currentTime = t;
  dom.bgBlurVideo.currentTime = t;
  dom.splitBottomVideo.currentTime = t;
});

// =========================================================================
// 3. PENGATURAN BINGKAI & AUTO FACE-TRACKING
// =========================================================================
dom.aspectRatioSelect.addEventListener("change", (e) => {
  state.aspectRatio = e.target.value;
  updateStageClasses();
});

dom.layoutModeSelect.addEventListener("change", (e) => {
  state.layoutMode = e.target.value;
  dom.splitControlGroup.classList.toggle("hidden", state.layoutMode !== "split");
  updateStageClasses();
  if (!dom.mainVideo.paused) playSyncedVideos();
});

function updateStageClasses() {
  const ratioCls = FRAME_DIMS[state.aspectRatio]?.cls || "ratio-9-16";
  dom.frameStage.className = `frame-stage ${ratioCls} mode-${state.layoutMode}`;
}

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
    applyCameraPosition();
  }
});

dom.manualX2.addEventListener("input", (e) => {
  const pct = Number(e.target.value);
  dom.manualX2Val.textContent = `${pct}%`;
  state.manualX2 = pct / 100;
  if (!state.autoTrack) {
    state.targetX2 = state.manualX2;
    state.smoothX2 = state.manualX2;
    applyCameraPosition();
  }
});

let lastTrackTick = 0;

async function trackSubjectLoop(now) {
  if (state.autoTrack && !dom.mainVideo.paused && dom.mainVideo.readyState >= 2 && now - lastTrackTick > 220) {
    lastTrackTick = now;
    const vw = dom.mainVideo.videoWidth;
    const vh = dom.mainVideo.videoHeight;

    if (vw && vh) {
      let detected = false;
      if (nativeFaceDetector) {
        try {
          const faces = await nativeFaceDetector.detect(dom.mainVideo);
          if (faces && faces.length > 0) {
            faces.sort((a, b) => a.boundingBox.x - b.boundingBox.x);
            const f1 = faces[0].boundingBox;
            state.targetX1 = clamp((f1.x + f1.width * 0.5) / vw, 0.12, 0.88);
            state.targetY1 = clamp((f1.y + f1.height * 0.45) / vh, 0.2, 0.8);
            if (faces.length > 1) {
              const f2 = faces[faces.length - 1].boundingBox;
              state.targetX2 = clamp((f2.x + f2.width * 0.5) / vw, 0.12, 0.88);
            }
            detected = true;
          }
        } catch (_) {}
      }

      if (!detected) {
        try {
          trackCtx.drawImage(dom.mainVideo, 0, 0, 64, 36);
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
              state.targetX1 = clamp(xL / wL, 0.12, 0.48);
              state.targetX2 = clamp(xR / wR, 0.52, 0.88);
            } else {
              state.targetX1 = clamp(xT / wT, 0.15, 0.85);
              state.targetY1 = clamp(yT / wT, 0.2, 0.8);
            }
          }
        } catch (_) {}
      }
    }
  }

  // Smooth gimbal movement
  state.smoothX1 += (state.targetX1 - state.smoothX1) * 0.15;
  state.smoothY1 += (state.targetY1 - state.smoothY1) * 0.15;
  state.smoothX2 += (state.targetX2 - state.smoothX2) * 0.15;
  applyCameraPosition();

  if (!dom.mainVideo.paused && dom.mainVideo.readyState >= 2) {
    const cur = dom.mainVideo.currentTime || 0;
    const dur = dom.mainVideo.duration || 0;
    dom.videoSeekBar.value = cur;
    dom.timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  }

  if (state.isPlayingSequence && state.activeClipIndex >= 0) {
    const activeClip = state.clips[state.activeClipIndex];
    if (activeClip && dom.mainVideo.currentTime >= activeClip.end) {
      advanceSequence();
    }
  }

  requestAnimationFrame(trackSubjectLoop);
}

function applyCameraPosition() {
  dom.mainVideo.style.objectPosition = `${(state.smoothX1 * 100).toFixed(1)}% ${(state.smoothY1 * 100).toFixed(1)}%`;
  dom.splitBottomVideo.style.objectPosition = `${(state.smoothX2 * 100).toFixed(1)}% 45%`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

requestAnimationFrame(trackSubjectLoop);

// =========================================================================
// 4. CUTTER OTOMATIS UNIVERSAL
// =========================================================================
dom.btnAutoCut.addEventListener("click", async () => {
  const videoDur = dom.mainVideo.duration || 0;
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

  if (rawTranscript) {
    const entries = parseTranscriptLines(rawTranscript);
    if (entries.length > 0) {
      if (apiKey) {
        dom.cutStatus.textContent = "🤖 AI sedang menganalisis transkrip...";
        try {
          state.clips = await cutWithGeminiAI(apiKey, entries, config);
        } catch (_) {
          state.clips = cutFromTranscriptLocal(entries, config);
        }
      } else {
        state.clips = cutFromTranscriptLocal(entries, config);
      }
      renderClipTimeline(config);
      dom.cutStatus.textContent = `✅ ${state.clips.length} potongan ditemukan dari transkrip!`;
      return;
    }
  }

  state.clips = cutVideoTimelineAutomatically(videoDur, config);
  renderClipTimeline(config);
  dom.cutStatus.textContent = `✅ Video (${formatTime(videoDur)}) otomatis dipotong menjadi ${state.clips.length} segmen!`;
});

function cutVideoTimelineAutomatically(totalVideoDur, config) {
  const safeDur = Math.max(6, totalVideoDur);
  const targetTotal = clamp(Math.round((config.minDur + config.maxDur) / 2), 10, Math.floor(safeDur));

  if (safeDur <= config.maxDur) {
    const cuts = [];
    if (dom.briefHook.value.trim()) {
      cuts.push({ role: "Hook Pembuka (0-3d)", type: "hook", start: 0, end: Math.min(3, safeDur), text: config.hook });
    }
    cuts.push({ role: "Klip Utama Utuh", type: "moment", start: 0, end: Math.floor(safeDur), text: "Bagian utama video" });
    if (config.cta) {
      cuts.push({ role: "CTA Akhir", type: "cta", start: Math.max(0, Math.floor(safeDur) - 3), end: Math.floor(safeDur), text: config.cta });
    }
    return cuts;
  }

  const segLen = Math.max(5, Math.floor(targetTotal / 3));
  const p1 = Math.floor(safeDur * 0.12);
  const p2 = Math.floor(safeDur * 0.48);
  const p3 = Math.max(p2 + segLen + 2, Math.floor(safeDur * 0.80));

  const cuts = [
    { role: "Hook Pembuka (0-3d)", type: "hook", start: p2, end: Math.min(safeDur, p2 + 3), text: config.hook },
    { role: "Highlight #1 (Awal)", type: "moment", start: p1, end: Math.min(safeDur, p1 + segLen), text: "Momen pembuka pilihan" },
    { role: "Highlight #2 (Klimaks)", type: "moment", start: p2, end: Math.min(safeDur, p2 + segLen), text: "Momen puncak utama" },
    { role: "Highlight #3 (Penutup)", type: "product", start: Math.min(safeDur - segLen, p3), end: Math.min(safeDur, p3 + segLen), text: "Momen penutup / detail akhir" },
  ];

  if (config.cta) {
    const last = cuts[cuts.length - 1];
    cuts.push({ role: "CTA Akhir", type: "cta", start: Math.max(last.start, last.end - 3), end: last.end, text: config.cta });
  }
  return cuts;
}

function parseTranscriptLines(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result = [];
  const srtTime = /(\d{1,2}:\d{2}:\d{2})[,.]\d+\s*-->\s*(\d{1,2}:\d{2}:\d{2})[,.]\d+/;

  for (let i = 0; i < lines.length; i++) {
    const mSrt = lines[i].match(srtTime);
    if (mSrt) {
      const start = toSeconds(mSrt[1]);
      const end = Math.max(toSeconds(mSrt[2]), start + 4);
      const text = lines[i + 1] || "";
      if (text) result.push({ start, end, text });
      continue;
    }
    const mSimple = lines[i].match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (mSimple) {
      const start = toSeconds(mSimple[1]);
      result.push({ start, end: start + 7, text: mSimple[2] });
    }
  }
  return result;
}

function toSeconds(str) {
  const p = str.split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function cutFromTranscriptLocal(entries, config) {
  const keywords = config.brand.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  let prodIdx = keywords.length > 0
    ? entries.findIndex((e) => keywords.some((kw) => e.text.toLowerCase().includes(kw)))
    : -1;

  const cuts = [
    { role: "Hook Pembuka (0-3d)", type: "hook", start: entries[0].start, end: entries[0].start + 3, text: config.hook },
  ];

  entries.slice(0, 3).forEach((e, i) => {
    cuts.push({ role: `Momen #${i + 1}`, type: "moment", start: e.start, end: e.end, text: e.text });
  });

  if (prodIdx !== -1) {
    cuts.push({
      role: "Penutup Produk / Topik Wajib",
      type: "product",
      start: entries[prodIdx].start,
      end: entries[Math.min(entries.length - 1, prodIdx + 1)].end,
      text: entries[prodIdx].text,
    });
  }

  if (config.cta) {
    const last = cuts[cuts.length - 1];
    cuts.push({ role: "CTA Akhir", type: "cta", start: Math.max(last.start, last.end - 3), end: last.end, text: config.cta });
  }
  return cuts;
}

async function cutWithGeminiAI(apiKey, entries, config) {
  const scriptText = entries.map((e) => `[${formatTime(e.start)}-${formatTime(e.end)}] ${e.text}`).join("\n");
  const prompt = `Pilih potongan klip terbaik dari transkrip berikut:
Topik/Produk: ${config.brand}
Durasi total: ${config.minDur}-${config.maxDur} detik.
Transkrip:\n${scriptText}
Balas JSON array murni: [{"role":"...","type":"hook|moment|product|cta","start":10,"end":22,"text":"..."}]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
    
