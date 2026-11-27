// =========================================================================
// AUTOCLIPPER STUDIO — CORE ENGINE
// 1. Multi-Aspect Ratio Frame (9:16, 9:14, 4:5, 1:1, 16:9) + Single/Split
// 2. Auto Face-Tracking (Native FaceDetector + Lightweight Skin/Motion Fallback)
// 3. Auto-Cutter (Briefing Parser + Smart Local Matcher / Gemini AI)
// 4. Direct Canvas Video Export (MediaRecorder)
// =========================================================================

const FRAME_PRESETS = {
  "9:16": { w: 540, h: 960 },
  "9:14": { w: 540, h: 840 },
  "4:5":  { w: 540, h: 675 },
  "1:1":  { w: 540, h: 540 },
  "16:9": { w: 960, h: 540 },
};

const state = {
  aspectRatio: "9:16",
  layoutMode: "single",
  autoTrack: true,
  manualX1: 0.5,
  manualX2: 0.75,
  // Target & smoothed focus coordinates (0.0 - 1.0)
  targetX1: 0.5,
  targetY1: 0.45,
  smoothX1: 0.5,
  smoothY1: 0.45,
  targetX2: 0.75,
  smoothX2: 0.75,
  // Timeline & overlays
  clips: [],
  activeClipIndex: -1,
  isPlayingSequence: false,
  isRecording: false,
  overlayHook: "",
  overlaySub: "",
  overlayCta: "",
};

const dom = {
  aspectRatioSelect: document.getElementById("aspectRatioSelect"),
  layoutModeSelect: document.getElementById("layoutModeSelect"),
  faceTrackToggle: document.getElementById("faceTrackToggle"),
  trackStatusBadge: document.getElementById("trackStatusBadge"),
  manualX1: document.getElementById("manualX1"),
  manualX1Val: document.getElementById("manualX1Val"),
  manualX2: document.getElementById("manualX2"),
  manualX2Val: document.getElementById("manualX2Val"),
  splitControlGroup: document.getElementById("splitControlGroup"),
  stageCanvas: document.getElementById("stageCanvas"),
  sourceVideo: document.getElementById("sourceVideo"),
  videoInput: document.getElementById("videoInput"),
  srtInput: document.getElementById("srtInput"),
  videoStatus: document.getElementById("videoStatus"),
  transcriptInput: document.getElementById("transcriptInput"),
  rawBriefInput: document.getElementById("rawBriefInput"),
  btnLoadDemo: document.getElementById("btnLoadDemo"),
  briefBrand: document.getElementById("briefBrand"),
  briefHook: document.getElementById("briefHook"),
  briefMinDur: document.getElementById("briefMinDur"),
  briefMaxDur: document.getElementById("briefMaxDur"),
  briefCta: document.getElementById("briefCta"),
  briefHashtags: document.getElementById("briefHashtags"),
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

// Offscreen micro-canvas untuk deteksi wajah fallback (hemat RAM & CPU)
const trackCanvas = document.createElement("canvas");
trackCanvas.width = 64;
trackCanvas.height = 36;
const trackCtx = trackCanvas.getContext("2d", { willReadFrequently: true });

let nativeFaceDetector = null;
if ("FaceDetector" in window) {
  try {
    nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
  } catch (e) {
    nativeFaceDetector = null;
  }
}

// Simpan / Muat Gemini API Key lokal
if (localStorage.getItem("ac_gemini_key")) {
  dom.geminiKey.value = localStorage.getItem("ac_gemini_key");
}
dom.geminiKey.addEventListener("change", () => {
  localStorage.setItem("ac_gemini_key", dom.geminiKey.value.trim());
});

// =========================================================================
// 1. KONTROL UKURAN BINGKAI & TATA LETAK
// =========================================================================
dom.aspectRatioSelect.addEventListener("change", (e) => {
  state.aspectRatio = e.target.value;
  const preset = FRAME_PRESETS[state.aspectRatio] || FRAME_PRESETS["9:16"];
  dom.stageCanvas.width = preset.w;
  dom.stageCanvas.height = preset.h;
});

dom.layoutModeSelect.addEventListener("change", (e) => {
  state.layoutMode = e.target.value;
  if (state.layoutMode === "split") {
    dom.splitControlGroup.classList.remove("hidden");
  } else {
    dom.splitControlGroup.classList.add("hidden");
  }
});

dom.faceTrackToggle.addEventListener("change", (e) => {
  state.autoTrack = e.target.checked;
  dom.trackStatusBadge.textContent = state.autoTrack
    ? "🎯 Face-Track: Aktif"
    : "✋ Face-Track: Manual";
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
  if (!state.autoTrack) state.targetX1 = state.manualX1;
});

dom.manualX2.addEventListener("input", (e) => {
  const pct = Number(e.target.value);
  dom.manualX2Val.textContent = `${pct}%`;
  state.manualX2 = pct / 100;
  if (!state.autoTrack) state.targetX2 = state.manualX2;
});

// =========================================================================
// 2. MUAT VIDEO LOKAL & FILE SUBTITLE
// =========================================================================
dom.videoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  dom.sourceVideo.src = url;
  dom.sourceVideo.muted = false;
  dom.videoStatus.textContent = `✅ Video siap: ${file.name}`;
  dom.sourceVideo.onloadeddata = () => {
    dom.sourceVideo.currentTime = 0.5;
  };
});

dom.srtInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  dom.transcriptInput.value = await file.text();
  dom.cutStatus.textContent = `📄 Subtitle "${file.name}" siap dianalisis.`;
});

// =========================================================================
// 3. ENGINE PELACAK WAJAH OTOMATIS (AUTO FACE-TRACKING)
// =========================================================================
let lastDetectTime = 0;

async function detectFacesInVideo(now) {
  if (!state.autoTrack) return;
  if (dom.sourceVideo.readyState < 2 || dom.sourceVideo.paused) return;
  if (now - lastDetectTime < 180) return; // Jalankan ~5.5x/detik agar ringan di RAM 4GB
  lastDetectTime = now;

  const vw = dom.sourceVideo.videoWidth;
  const vh = dom.sourceVideo.videoHeight;
  if (!vw || !vh) return;

  // Metode A: Native Chromium Hardware FaceDetector (Akurasi tinggi & nol beban RAM)
  if (nativeFaceDetector) {
    try {
      const faces = await nativeFaceDetector.detect(dom.sourceVideo);
      if (faces && faces.length > 0) {
        // Urutkan wajah dari kiri ke kanan
        faces.sort((a, b) => a.boundingBox.x - b.boundingBox.x);
        const f1 = faces[0].boundingBox;
        state.targetX1 = clamp((f1.x + f1.width * 0.5) / vw, 0.15, 0.85);
        state.targetY1 = clamp((f1.y + f1.height * 0.45) / vh, 0.2, 0.8);

        if (faces.length > 1) {
          const f2 = faces[faces.length - 1].boundingBox;
          state.targetX2 = clamp((f2.x + f2.width * 0.5) / vw, 0.15, 0.85);
        }
        dom.trackStatusBadge.textContent = `🎯 Terkunci (${faces.length} Wajah)`;
        return;
      }
    } catch (_) {
      // Lanjut ke Metode B jika browser membatasi FaceDetector
    }
  }

  // Metode B: Fallback Mikro Skin-Tone & Upper-Body Centroid Tracker (64x36 px)
  trackCtx.drawImage(dom.sourceVideo, 0, 0, 64, 36);
  const imgData = trackCtx.getImageData(0, 0, 64, 36).data;

  let leftWeight = 0, leftSumX = 0;
  let rightWeight = 0, rightSumX = 0;
  let totalWeight = 0, totalSumX = 0, totalSumY = 0;

  // Fokus pada area wajah/kepala (y: 10% - 75% tinggi frame)
  for (let y = 4; y < 28; y++) {
    for (let x = 2; x < 62; x++) {
      const i = (y * 64 + x) * 4;
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      // Deteksi spektrum warna kulit natural (YCbCr / RGB heuristic)
      const isSkin =
        r > 75 && g > 40 && b > 25 &&
        r > g && r > b &&
        Math.abs(r - g) > 12;

      if (isSkin) {
        const nx = x / 64;
        const ny = y / 36;
        totalWeight++;
        totalSumX += nx;
        totalSumY += ny;

        if (nx < 0.5) {
          leftWeight++;
          leftSumX += nx;
        } else {
          rightWeight++;
          rightSumX += nx;
        }
      }
    }
  }

  if (totalWeight > 8) {
    if (state.layoutMode === "split" && leftWeight > 4 && rightWeight > 4) {
      state.targetX1 = clamp(leftSumX / leftWeight, 0.15, 0.45);
      state.targetX2 = clamp(rightSumX / rightWeight, 0.55, 0.85);
    } else {
      state.targetX1 = clamp(totalSumX / totalWeight, 0.18, 0.82);
      state.targetY1 = clamp(totalSumY / totalWeight, 0.25, 0.75);
    }
    dom.trackStatusBadge.textContent = "🎯 Tracking Wajah Aktif";
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// =========================================================================
// 4. RENDER LOOP KANVAS (30/60 FPS SMOOTH CAMERA + OVERLAYS)
// =========================================================================
function renderLoop(now) {
  detectFacesInVideo(now);

  // Smooth gimbal interpolation (lerp)
  const ease = 0.14;
  state.smoothX1 += (state.targetX1 - state.smoothX1) * ease;
  state.smoothY1 += (state.targetY1 - state.smoothY1) * ease;
  state.smoothX2 += (state.targetX2 - state.smoothX2) * ease;

  const cw = dom.stageCanvas.width;
  const ch = dom.stageCanvas.height;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);

  if (dom.sourceVideo.readyState >= 2) {
    if (state.layoutMode === "split") {
      // Split Atas (Pembicara 1) & Bawah (Pembicara 2)
      const halfH = Math.floor(ch / 2);
      drawCroppedVideo(dom.sourceVideo, 0, 0, cw, halfH - 2, state.smoothX1, 0.45);
      drawCroppedVideo(dom.sourceVideo, 0, halfH + 2, cw, halfH - 2, state.smoothX2, 0.45);
    } else {
      // Single Full Frame mengikuti wajah utama
      drawCroppedVideo(dom.sourceVideo, 0, 0, cw, ch, state.smoothX1, state.smoothY1);
    }
  } else {
    // Placeholder panduan sebelum video dimuat
    ctx.fillStyle = "#141923";
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Bingkai ${state.aspectRatio} (${cw}×${ch})`, cw / 2, ch / 2 - 14);
    ctx.font = "16px system-ui";
    ctx.fillText("Pilih video MP4 untuk mulai clipping", cw / 2, ch / 2 + 18);
  }

  // Gambar Overlays (Hook 0-3d, Subtitle, & CTA Akhir) langsung ke kanvas
  drawCanvasOverlays(cw, ch);

  // Cek apakah klip sedang berjalan dalam mode sequence
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
    // Video lebih lebar dari bingkai -> potong kiri/kanan mengikuti focusX wajah
    sh = vh;
    sw = vh * targetRatio;
    const centerX = focusX * vw;
    sx = clamp(centerX - sw / 2, 0, vw - sw);
    sy = 0;
  } else {
    // Video lebih tinggi dari bingkai -> potong atas/bawah mengikuti focusY wajah
    sw = vw;
    sh = vw / targetRatio;
    const centerY = focusY * vh;
    sx = 0;
    sy = clamp(centerY - sh / 2, 0, vh - sh);
  }

  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawCanvasOverlays(cw, ch) {
  // 1. Hook Banner di bagian atas
  if (state.overlayHook) {
    const padX = 28;
    const boxW = cw - padX * 2;
    const boxY = Math.round(ch * 0.06);
    ctx.fillStyle = "#facc15";
    roundRect(ctx, padX, boxY, boxW, 64, 12, true);

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.overlayHook.toUpperCase().slice(0, 38), cw / 2, boxY + 40);
  }

  // 2. Subtitle Dialog
  if (state.overlaySub) {
    const subY = Math.round(ch * 0.80);
    const boxW = cw - 48;
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    roundRect(ctx, 24, subY - 32, boxW, 56, 10, true);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.overlaySub.slice(0, 48), cw / 2, subY + 2);
  }

  // 3. Soft CTA Akhir
  if (state.overlayCta) {
    const ctaY = Math.round(ch * 0.89);
    const boxW = cw - 48;
    ctx.fillStyle = "#ef4444";
    roundRect(ctx, 24, ctaY - 30, boxW, 52, 10, true);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 17px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.overlayCta.slice(0, 46), cw / 2, ctaY + 2);
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

// Mulai loop render kanvas
requestAnimationFrame(renderLoop);

// =========================================================================
// 5. AUTO-CUTTER PENCARI MOMEN (BRIEFING + AI)
// =========================================================================
dom.btnLoadDemo.addEventListener("click", () => {
  dom.rawBriefInput.value = `Durasi video 30 - 90 detik
Judul: "TOP 3 MOMEN PALING PECAH DI PODCAST"
Penutup: Momen bahas produk Herborist secara utuh jangan dipotong di tengah kalimat
CTA: "Cek produknya di official store sekarang"
Hashtag: #podcast #klipviral #kontencom`;

  if (!dom.transcriptInput.value.trim()) {
    dom.transcriptInput.value = `00:12 Host: Lu pernah nggak sih salah naik motor orang di parkiran minimarket?
00:18 Tamu: Pernah bang! Gue udah pasang helm, nyalain mesin, eh yang punya motor keluar bawa es teh! [tertawa]
00:25 Host: Ngakak banget terus lu bilang apa?!
01:40 Tamu: Yang paling absurd waktu gue disangka tukang parkir sama emak-emak, dikasih dua ribu langsung gue terima! [ketawa]
01:49 Host: Anjir gila malah lu kantongin duitnya!
03:10 Tamu: Eh tapi serius, habis panas-panasan di jalan gue selalu pakai Herborist Body Scrub biar kulit tetap halus dan wanginya seger banget.
03:20 Host: Bener sih, butiran scrub-nya lembut dan aromanya tahan lama dipakai rutin.`;
  }

  extractBriefRules();
  dom.cutStatus.textContent = "✅ Contoh briefing & transkrip dimuat. Klik 'Potong & Cari Momen Otomatis'.";
});

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

  const tags = raw.match(/#[A-Za-z0-9_]+/g);
  if (tags) dom.briefHashtags.value = [...new Set(tags)].join(" ");
}

dom.btnAutoCut.addEventListener("click", async () => {
  extractBriefRules();
  const entries = parseTranscriptLines(dom.transcriptInput.value);
  if (entries.length === 0) {
    alert("Masukkan transkrip / file .SRT terlebih dahulu agar cutter bisa membaca momen.");
    return;
  }

  const config = {
    brand: dom.briefBrand.value.trim(),
    hook: dom.briefHook.value.trim() || "TOP MOMEN PODCAST",
    cta: dom.briefCta.value.trim() || "Cek selengkapnya sekarang!",
    minDur: Number(dom.briefMinDur.value) || 30,
    maxDur: Number(dom.briefMaxDur.value) || 90,
    hashtags: dom.briefHashtags.value.trim(),
  };

  const key = dom.geminiKey.value.trim();
  dom.cutStatus.textContent = key
    ? "🤖 AI sedang menganalisis transkrip & menyusun potongan momen..."
    : "✂️ Memotong momen otomatis berdasarkan aturan briefing...";

  try {
    if (key) {
      state.clips = await cutWithGeminiAI(key, entries, config);
    } else {
      state.clips = cutWithLocalRules(entries, config);
    }
    renderClipTimeline(config);
    dom.cutStatus.textContent = `✅ Ditemukan ${state.clips.length} potongan siap putar & simpan!`;
  } catch (err) {
    console.error(err);
    state.clips = cutWithLocalRules(entries, config);
    renderClipTimeline(config);
    dom.cutStatus.textContent = "✅ Potongan disusun dengan Smart Local Cutter.";
  }
});

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

  for (let i = 0; i < result.length - 1; i++) {
    const diff = result[i + 1].start - result[i].start;
    if (diff > 0 && diff <= 12) result[i].end = result[i + 1].start;
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

// Cutter Offline Cerdas (Skoring Komedi + Deteksi Penutup Produk Utuh)
function cutWithLocalRules(entries, config) {
  const brandKeywords = config.brand.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const hypeRegex = /(ngakak|tertawa|ketawa|wkwk|haha|anjir|gila|kocak|absurd|sumpah|parah|!|\?)/gi;

  // Cari momen produk/topik wajib (utuh satu rangkaian kalimat)
  let prodIdx = -1;
  if (brandKeywords.length > 0) {
    entries.forEach((e, idx) => {
      const low = e.text.toLowerCase();
      if (brandKeywords.some((kw) => low.includes(kw)) && prodIdx === -1) {
        prodIdx = idx;
      }
    });
  }

  let prodSegment = null;
  if (prodIdx !== -1) {
    let endIdx = prodIdx;
    while (endIdx < entries.length - 1 && entries[endIdx + 1].end - entries[prodIdx].start <= 20) {
      endIdx++;
    }
    prodSegment = {
      role: "Penutup: Bahasan Utama Utuh",
      type: "product",
      start: entries[prodIdx].start,
      end: entries[endIdx].end,
      text: entries.slice(prodIdx, endIdx + 1).map((x) => x.text).join(" "),
    };
  }

  // Cari momen seru/lucu yang terpisah jaraknya
  const scored = entries
    .map((e, idx) => {
      if (prodSegm
