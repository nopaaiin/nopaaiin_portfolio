// Shared helpers for the MediaPipe Practice pages
export const MP_VER = '0.10.14';
export const params = new URLSearchParams(location.search);
export const LIB = params.get('lib') || `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
export const MOCK = params.has('mock'); // test mode: synthetic landmarks, no model download

const G = 'https://storage.googleapis.com/mediapipe-models';
export const MODELS = {
  hand: `${G}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
  pose: `${G}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
  face: `${G}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  seg: `${G}/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`
};

let modP = null;
export function vision() {
  if (!modP) modP = (async () => {
    const mod = await import(`${LIB}/vision_bundle.mjs`);
    const files = await mod.FilesetResolver.forVisionTasks(`${LIB}/wasm`);
    return { mod, files };
  })();
  return modP;
}

// Create a task with GPU first, CPU if GPU fails
export async function createTask(name, options) {
  const { mod, files } = await vision();
  const Klass = mod[name];
  const make = delegate => Klass.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate } });
  try { return { task: await make('GPU'), Klass, cpu: false, make }; }
  catch (e) { console.warn(name, 'GPU failed, using CPU', e); return { task: await make('CPU'), Klass, cpu: true, make }; }
}

// Run detection safely; on a GPU runtime error rebuild the task on CPU once
export function safeRunner(holder, fnName) {
  let rebuilding = false;
  return (...args) => {
    if (!holder.task || rebuilding) return null;
    try { return holder.task[fnName](...args); }
    catch (e) {
      console.warn(e);
      if (!holder.cpu) {
        rebuilding = true;
        holder.make('CPU').then(t => { holder.task = t; holder.cpu = true; rebuilding = false; });
      }
      return null;
    }
  };
}

// Camera with auto start and a text free retry icon
const camIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg>';
export async function startCamera(video, { width = 1280, height = 720 } = {}) {
  const run = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: width }, height: { ideal: height } }, audio: false });
    video.srcObject = s; video.muted = true; video.playsInline = true;
    await video.play().catch(() => {});
    addEventListener('pagehide', () => s.getTracks().forEach(t => t.stop()), { once: true });
    return s;
  };
  try { return await run(); }
  catch (e) {
    console.warn('camera', e);
    return new Promise(resolve => {
      const b = document.createElement('button');
      b.className = 'cam-retry'; b.setAttribute('aria-label', 'Start camera'); b.innerHTML = camIcon;
      document.body.appendChild(b);
      b.onclick = async () => { try { const s = await run(); b.remove(); resolve(s); } catch (err) { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); } };
    });
  }
}

export const COMMON_CSS = `
.back{position:fixed;top:18px;left:18px;z-index:20;text-decoration:none;font:28px/1 Arial,sans-serif;padding:8px 12px;border-radius:999px;color:inherit}
.back:focus-visible{outline:2px solid currentColor}
.cam-retry{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;border:0;background:#111;color:#fff;cursor:pointer;z-index:30;display:grid;place-items:center}
.cam-retry.shake{animation:sh .35s}@keyframes sh{25%{transform:translate(-56%,-50%)}75%{transform:translate(-44%,-50%)}}
`;
export function injectCSS() { const s = document.createElement('style'); s.textContent = COMMON_CSS; document.head.appendChild(s); }

// Draw a video mirrored and cropped (cover) into a rect; returns mapping for normalized landmarks
// overlay: optional image (e.g. a mask canvas) drawn with the same mapping over the video
export function drawCover(ctx, video, x, y, w, h, overlay = null, overlayAlpha = 1) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return null;
  const sc = Math.max(w / vw, h / vh);
  const dw = vw * sc, dh = vh * sc, ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(ox + dw, oy); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, dw, dh);
  if (overlay) { ctx.globalAlpha = overlayAlpha; ctx.drawImage(overlay, 0, 0, dw, dh); }
  ctx.restore();
  // mirrored mapping
  return p => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh });
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
