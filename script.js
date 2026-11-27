// =========================================================================
// AUTOCLIPPER UNIVERSAL — SINGLE DECODER ANDROID WEBVIEW SAFE
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
  aspectRatio: "9:16",
  autoTrack: true,
  manualX1: 0.5,
  targetX1: 0.5,
  targetY1: 0.45,
  smoothX1: 0.5,
  smoothY1: 0.45,
  clips: [],
  activeClipIndex: -1,
  isPlayingSequence: false,
};

const dom = {
  videoInput: document.getElementById("videoInput"),
  btnTestSample: document.getElementById("btnTestSample"),
  srtInput: document.getElementById("srtInput"),
  videoStatus: document.getElementById("videoStatus"),
  frameStage: document.getElementById("frameStage"),
  mainVideo: document.getElementById("mainVideo"),
  hookOverlay: document.getElementById("hookOverlay"),
  subOverlay: document.getElementById("subOverlay"),
  ctaOverlay: document.getElementById("ctaOverlay"),
  aspectRatioSelect: document.getElementById("aspectRatioSelect"),
  layoutModeSelect: document.getElementById("layoutModeSelect"),
  faceTrackToggle: document.getElementById("faceTrackToggle"),
  trackStatusBadge: document.getElementById("trackStatusBadge"),
  manualX1: document.getElementById("manualX1"),
  manualX1Val: document.getElementById("manualX1Val"),
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

const trackCanvas = document.createElement("canvas");
trackCanvas.width = 64;
trackCanvas.height = 36;
const trackCtx = trackCanvas.getContext("2d", { willReadFrequently: true });

let nativeFaceDetector = null;
if ("FaceDetector" in window) {
  try {
    nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
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
// 1. MEMUAT VIDEO DARI HP & TOMBOL TES VIDEO BAWAAN
// =========================================================================
dom.videoInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    dom.videoStatus.textContent = "⚠️ Pemilihan video dibatalkan atau file tidak terbaca.";
    return;
  }

  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  if (file.size === 0) {
    dom.videoStatus.textContent = "❌ File terbaca 0 MB. Saat memilih file, ketuk menu garis tiga (☰) lalu pilih 'File Saya / Pengelola File', bukan Google Photos.";
    return;
  }

  if (state.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
  }

  state.videoUrl = URL.createObjectURL(file);
  dom.videoStatus.textContent = `⏳ Membuka "${file.name}" (${sizeMB} MB | ${file.type || "video"})...`;

  dom.mainVideo.src = state.videoUrl;
  dom.mainVideo.load();
});

// Tombol Tes Video Bawaan (Generate klip 6 detik langsung di HP tanpa galeri)
dom.btnTestSample.addEventListener("click", () => {
  dom.videoStatus.textContent = "⏳ Membuat video tes 6 detik...";
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 640;
  const g = c.getContext("2d");

  const stream = c.captureStream(24);
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = URL.createObjectURL(blob);
    dom.mainVideo.src = state.videoUrl;
    dom.mainVideo.load();
    dom.videoStatus.textContent = "✅ Video Tes Bawaan siap! Tekan Play pada layar video.";
  };

  rec.start();
  let frame = 0;
  const anim = setInterval(() => {
    frame++;
    g.fillStyle = "#1e293b";
    g.fillRect(0, 0, 360, 640);
    const x = 180 + Math.sin(frame * 0.1) * 90;
    g.fillStyle = "#f59e0b";
    g.beginPath();
    g.arc(x, 260, 48, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 20px system-ui";
    g.textAlign = "center";
    g.fillText("LAYAR VIDEO AKTIF", 180, 360);
    g.fillText(`Detik ${(frame / 24).toFixed(1)}s`, 180, 395);

    if (frame >= 96) {
      clearInterval(anim);
      rec.stop();
    }
  }, 42);
});

dom.mainVideo.addEventListener("loadedmetadata", () => {
  const vw = dom.mainVideo.videoWidth;
  const vh = dom.mainVideo.videoHeight;
  const dur = dom.mainVideo.duration || 0;
  dom.videoStatus.textContent = `✅ Video Siap (${vw}×${vh} • ${formatTime(dur)})`;
  dom.mainVideo.currentTime = Math.min(0.1, dur * 0.05);
});

dom.mainVideo.addEventListener("error", () => {
  const code = dom.mainVideo.error ? dom.mainVideo.error.code : "unknown";
  dom.videoStatus.textContent = `❌ Decoder Android gagal memutar file ini (Kode: ${code}). Coba video MP4 lain dari folder Download/Camera.`;
});

dom.srtInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  dom.transcriptInput.value = await file.text();
  dom.cutStatus.textContent = `📄 Subtitle "${file.name}" dimuat.`;
});

// =========================================================================
// 2. PENGATURAN BINGKAI & AUTO FACE-TRACKING
// =========================================================================
dom.aspectRatioSelect.addEventListener("change", (e) => {
  state.aspectRatio = e.target.value;
  const ratioCls = FRAME_DIMS[state.aspectRatio]?.cls || "ratio-9-16";
  dom.frameStage.className = `frame-stage ${ratioCls}`;
});

dom.layoutModeSelect.addEventListener("change", (e) => {
  dom.mainVideo.style.objectFit = e.target.value;
});

dom.faceTrackToggle.addEventListener("change", (e) => {
  state.autoTrack = e.target.checked;
  dom.trackStatusBadge.textContent = state.autoTrack ? "🎯 Auto-Track: Aktif" : "✋ Kamera: Manual";
  dom.trackStatusBadge.className = state.autoTrack ? "pill ok" : "pill warn";
  if (!state.autoTrack) {
    state.targetX1 = state.manualX1;
  }
});

dom.manualX1.addEventListener("input", (e) => {
  const pct = Number(e.target.value);
  dom.manualX1Val.textContent = `${pct}%`;
  state.manualX1 = pct / 100;
  if (!state.autoTrack) {
    state.targetX1 = state.manualX1;
    state.smoothX1 = state.manualX1;
    dom.mainVideo.style.objectPosition = `${pct}% 45%`;
  }
});

let lastTrackTick = 0;

async function trackSubjectLoop(now) {
  if (state.autoTrack && !dom.mainVideo.paused && dom.mainVideo.readyState >= 2 && now - lastTrackTick > 250) {
    lastTrackTick = now;
    const vw = dom.mainVideo.videoWidth;
    const vh = dom.mainVideo.videoHeight;

    if (vw && vh) {
      let detected = false;
      if (nativeFaceDetector) {
        try {
          const faces = await nativeFaceDetector.detect(dom.mainVideo);
          if (faces && faces.length > 0) {
            const f1 = faces[0].boundingBox;
            state.targetX1 = clamp((f1.x + f1.width * 0.5) / vw, 0.12, 0.88);
            state.targetY1 = clamp((f1.y + f1.height * 0.45) / vh, 0.2, 0.8);
            detected = true;
          }
        } catch (_) {}
      }

      if (!detected) {
        try {
          trackCtx.drawImage(dom.mainVideo, 0, 0, 64, 36);
          const data = trackCtx.getImageData(0, 0, 64, 36).data;
          let wT = 0, xT = 0, yT = 0;

          for (let y = 3; y < 30; y++) {
            for (let x = 2; x < 62; x++) {
              const i = (y * 64 + x) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              if (r > 75 && g > 40 && b > 25 && r > g && r > b && Math.abs(r - g) > 12) {
                wT++;
                xT += x / 64;
                yT += y / 36;
              }
            }
          }
          if (wT > 6) {
            state.targetX1 = clamp(xT / wT, 0.15, 0.85);
            state.targetY1 = clamp(yT / wT, 0.2, 0.8);
          }
        } catch (_) {}
      }
    }
  }

  state.smoothX1 += (state.targetX1 - state.smoothX1) * 0.15;
  state.smoothY1 += (state.targetY1 - state.smoothY1) * 0.15;
  dom.mainVideo.style.objectPosition = `${(state.smoothX1 * 100).toFixed(1)}% ${(state.smoothY1 * 100).toFixed(1)}%`;

  if (state.isPlayingSequence && state.activeClipIndex >= 0) {
    const activeClip = state.clips[state.activeClipIndex];
    if (activeClip && dom.mainVideo.currentTime >= activeClip.end) {
      advanceSequence();
    }
  }

  requestAnimationFrame(trackSubjectLoop);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

requestAnimationFrame(trackSubjectLoop);

// =========================================================================
// 3. CUTTER OTOMATIS UNIVERSAL
// =========================================================================
dom.btnAutoCut.addEventListener("click", async () => {
  const videoDur = dom.mainVideo.duration || 0;
  const rawTranscript = dom.transcriptInput.value.trim();
  const niche = NICHE_PRESETS[dom.nicheSelect.value] || NICHE_PRESETS.general;

  if (!videoDur && !rawTranscript) {
    alert("Pilih video terlebih dahulu agar cutter bisa memotong momen!");
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
  const safeDur = Math.max(4, totalVideoDur);
  const targetTotal = clamp(Math.round((config.minDur + config.maxDur) / 2), 6, Math.floor(safeDur));

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
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

// =========================================================================
// 4. TIMELINE, PEMUTAR BERURUTAN & SIMPAN VIDEO
// =========================================================================
function renderClipTimeline(config) {
  dom.clipsContainer.innerHTML = "";
  let totalSec = 0;

  state.clips.forEach((clip, idx) => {
    const dur = Math.max(1, Math.round(clip.end - clip.start));
    if (clip.type !== "cta") totalSec += dur;

    const card = document.createElement("div");
    card.className = `clip-card role-${clip.type}`;
    card.innerHTML = `
      <div class="clip-top">
        <span class="clip-title">${clip.role}</span>
        <span class="clip-badge">${formatTime(clip.start)} - ${formatTime(clip.end)} (${dur}d)</span>
      </div>
      <p class="clip-text">${clip.text}</p>
      <div class="clip-actions">
        <button type="button" class="mini-btn" onclick="playSingleClip(${idx})">▶️ Cek</button>
        <input type="number" value="${Math.floor(clip.start)}" onchange="editClipRange(${idx}, 'start', this.value)" />
        <input type="number" value="${Math.ceil(clip.end)}" onchange="editClipRange(${idx}, 'end', this.value)" />
      </div>
    `;
    dom.clipsContainer.appendChild(card);
  });

  dom.totalDurBadge.textContent = `Total: ${totalSec}d`;
  dom.totalDurBadge.className =
    totalSec >= config.minDur && totalSec <= config.maxDur ? "pill ok" : "pill warn";

  const extraTags = (dom.rawBriefInput.value.match(/#[A-Za-z0-9_]+/g) || []).join(" ");
  dom.captionOutput.value = `${config.hook}\n\nGimana menurut kalian? Tulis di kolom komentar! 👇\n\n${extraTags || config.tags}`;
}

window.editClipRange = function (idx, field, val) {
  state.clips[idx][field] = Number(val);
  const niche = NICHE_PRESETS[dom.nicheSelect.value] || NICHE_PRESETS.general;
  renderClipTimeline({
    hook: dom.briefHook.value.trim() || niche.hook,
    minDur: Number(dom.briefMinDur.value) || 30,
    maxDur: Number(dom.briefMaxDur.value) || 60,
    tags: niche.tags,
  });
};

window.playSingleClip = function (idx) {
  state.isPlayingSequence = false;
  state.activeClipIndex = idx;
  applyClipVisuals(state.clips[idx]);
  if (dom.mainVideo.src) {
    dom.mainVideo.currentTime = state.clips[idx].start;
    dom.mainVideo.play();
  }
};

function applyClipVisuals(clip) {
  dom.hookOverlay.classList.toggle("hidden", clip.type !== "hook");
  dom.hookOverlay.textContent = clip.text;

  dom.ctaOverlay.classList.toggle("hidden", clip.type !== "cta");
  dom.ctaOverlay.textContent = clip.text;

  const showSub = dom.transcriptInput.value.trim() && (clip.type === "moment" || clip.type === "product");
  dom.subOverlay.classList.toggle("hidden", !showSub);
  dom.subOverlay.textContent = clip.text;
}

dom.btnPlayAll.addEventListener("click", () => {
  if (state.clips.length === 0) {
    alert("Tekan 'Potong Momen Otomatis Sekarang' terlebih dahulu.");
    return;
  }
  state.isPlayingSequence = true;
  startClipAt(0);
});

dom.btnStopAll.addEventListener("click", () => {
  state.isPlayingSequence = 
