// 화면을 그리는 파일입니다. 작품 내용은 content.js 에서 관리합니다.
// 관리자 모드(admin.js)가 이 파일이 내보내는 window.Portfolio 를 사용합니다.

const DRAFT_KEY = 'nopaaiin:portfolio-draft:v1';
const DB_NAME = 'nopaaiin-portfolio';
const DB_STORE = 'media';
const LOCAL_PREFIX = 'local:';
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// 관리자 모드의 "커버 배경" 선택지와 동일한 목록입니다.
const COVER_OPTIONS = [
  { value: 'cover-dark', label: '어두운 배경 (영상)' },
  { value: 'cover-photo', label: '사진 (꽉 채움)' },
  { value: 'cover-poster', label: '흰 배경 (포스터)' },
  { value: 'cover-album', label: '연한 하늘색 (앨범)' },
];

/* ---------------------------------------------------------------- 내용 정리 */

function asText(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeProject(raw, position, usedKeys) {
  const item = raw && typeof raw === 'object' ? raw : {};
  let key = asText(item.key).trim();
  if (!key || usedKeys.has(key)) key = `project-${position + 1}-${usedKeys.size}`;
  usedKeys.add(key);
  const files = Array.isArray(item.files) ? item.files : [];
  return {
    key,
    title: asText(item.title),
    category: asText(item.category),
    desc: asText(item.desc),
    poster: asText(item.poster),
    coverClass: COVER_OPTIONS.some(option => option.value === item.coverClass) ? item.coverClass : 'cover-dark',
    files: files
      .filter(file => file && typeof file === 'object' && asText(file.src))
      .map(file => ({ src: asText(file.src), type: file.type === 'vid' ? 'vid' : 'img' })),
  };
}

function normalizeContent(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const hero = source.hero && typeof source.hero === 'object' ? source.hero : {};
  const projects = Array.isArray(source.projects) ? source.projects : [];
  const usedKeys = new Set();
  return {
    hero: {
      title: asText(hero.title) || 'nopaaiin',
      image: asText(hero.image),
    },
    projects: projects.map((project, position) => normalizeProject(project, position, usedKeys)),
  };
}

function cloneContent(content) {
  return JSON.parse(JSON.stringify(content));
}

/* ------------------------------------------------------- 임시 저장 (이 브라우저) */

const draftStore = {
  read() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? normalizeContent(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  },
  write(content) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(content));
      return true;
    } catch (error) {
      return false;
    }
  },
  clear() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      /* 저장소를 못 쓰는 환경이면 무시합니다. */
    }
  },
};

/* ----------------------------------------- 사진·영상 보관 (IndexedDB, 없으면 메모리) */

const memoryMedia = new Map();
let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window) || !window.indexedDB) {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('indexedDB blocked'));
  });
  dbPromise = dbPromise.catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function runTransaction(mode, work) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, mode);
    const store = transaction.objectStore(DB_STORE);
    let result;
    try {
      result = work(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result && result.__request ? result.__request.result : result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

const mediaStore = {
  usingMemory: false,
  async all() {
    try {
      const request = await runTransaction('readonly', store => ({ __request: store.getAll() }));
      return Array.isArray(request) ? request : [];
    } catch (error) {
      this.usingMemory = true;
      return [...memoryMedia.values()];
    }
  },
  async put(record) {
    memoryMedia.set(record.key, record);
    try {
      await runTransaction('readwrite', store => store.put(record));
    } catch (error) {
      this.usingMemory = true;
    }
    return record;
  },
  async remove(key) {
    memoryMedia.delete(key);
    try {
      await runTransaction('readwrite', store => store.delete(key));
    } catch (error) {
      this.usingMemory = true;
    }
  },
};

/* ------------------------------------------------------------- 주소 만들기 */

const mediaUrls = new Map();

function isLocalSource(src) {
  return typeof src === 'string' && src.startsWith(LOCAL_PREFIX);
}

function resolveSource(src) {
  if (!src) return '';
  if (isLocalSource(src)) return mediaUrls.get(src) || '';
  return src;
}

function contentUsesLocalMedia(content) {
  if (isLocalSource(content.hero.image)) return true;
  return content.projects.some(project =>
    isLocalSource(project.poster) || project.files.some(file => isLocalSource(file.src)));
}

function registerMediaUrl(key, blob) {
  const existing = mediaUrls.get(key);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(blob);
  mediaUrls.set(key, url);
  return url;
}

function forgetMediaUrl(key) {
  const existing = mediaUrls.get(key);
  if (existing) URL.revokeObjectURL(existing);
  mediaUrls.delete(key);
}

async function loadStoredMedia() {
  const records = await mediaStore.all();
  records.forEach(record => {
    if (record && record.key && record.blob) registerMediaUrl(record.key, record.blob);
  });
  return records;
}

/* --------------------------------------------------------------- 첫 화면 파도 */

const hero = document.querySelector('.hero');
const wavePaths = [...document.querySelectorAll('.hero-wave')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let heroVisible = true;
let waveFrame = null;
let previousWaveTime = null;
let waveTime = 0;

function drawHeroWaves(time) {
  wavePaths.forEach((path, layer) => {
    const offset = (2 - layer) * 75;
    const phase = time + layer * .75;
    let shape = 'M -180 1180';
    for (let x = -180; x <= 1380; x += 30) {
      const y = 850 - offset
        + 85 * Math.sin(x / 185 - phase * .8)
        + 30 * Math.sin(x / 97 + phase * .53)
        + 18 * Math.sin(phase * .67);
      shape += ` L ${x} ${y.toFixed(1)}`;
    }
    path.setAttribute('d', `${shape} L 1380 1180 Z`);
  });
}

function animateHeroWaves(now) {
  if (previousWaveTime === null) previousWaveTime = now;
  const elapsed = now - previousWaveTime;
  // 30fps면 충분히 부드럽고 모바일의 불필요한 재그리기를 줄일 수 있습니다.
  if (elapsed >= 1000 / 30) {
    waveTime += Math.min(elapsed, 100) / 1000;
    previousWaveTime = now;
    drawHeroWaves(waveTime);
  }
  waveFrame = requestAnimationFrame(animateHeroWaves);
}

function syncHeroMotion() {
  const shouldAnimate = heroVisible && !document.hidden && !reducedMotion.matches;
  hero.classList.toggle('is-offscreen', !heroVisible || document.hidden);
  if (waveFrame !== null) cancelAnimationFrame(waveFrame);
  waveFrame = null;
  previousWaveTime = null;
  if (reducedMotion.matches) drawHeroWaves(0);
  if (shouldAnimate) waveFrame = requestAnimationFrame(animateHeroWaves);
}

drawHeroWaves(0);
syncHeroMotion();
reducedMotion.addEventListener('change', syncHeroMotion);
document.addEventListener('visibilitychange', syncHeroMotion);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    syncHeroMotion();
  }).observe(hero);
}

/* ------------------------------------------------------------------ 그리기 */

const grid = document.getElementById('work-grid');
const index = document.getElementById('project-index');
const contact = document.getElementById('contact');
const dialog = document.getElementById('project-dialog');
const detailMedia = document.getElementById('detail-media');
const heroTitle = document.getElementById('hero-title');
const workCount = document.getElementById('work-count');
const indexRange = document.getElementById('index-range');

const cardCache = new Map();
let content = normalizeContent(draftStore.read() || window.PORTFOLIO_CONTENT);
let openProjectKey = null;
let openedFrom = null;
let backdropPointerDown = false;
const renderListeners = new Set();

function pad(value) {
  return String(Math.max(value, 0)).padStart(2, '0');
}

function projectNumber(position) {
  return pad(position + 1);
}

function findProject(key) {
  return content.projects.find(project => project.key === key) || null;
}

function setImageSource(image, src) {
  const resolved = resolveSource(src) || BLANK_IMAGE;
  if (image.getAttribute('src') !== resolved) image.src = resolved;
}

function buildCard(project) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'project-card';
  card.setAttribute('aria-haspopup', 'dialog');

  const cover = document.createElement('span');
  const image = document.createElement('img');
  image.decoding = 'async';
  cover.append(image);

  const caption = document.createElement('span');
  caption.className = 'project-caption';
  const number = document.createElement('span');
  number.className = 'project-number';
  const title = document.createElement('span');
  title.className = 'project-name';
  const arrow = document.createElement('span');
  arrow.className = 'project-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  caption.append(number, title, arrow);
  card.append(cover, caption);
  card.addEventListener('click', () => {
    const current = findProject(project.key);
    if (current) openProject(current, card);
  });

  const indexButton = document.createElement('button');
  indexButton.type = 'button';
  indexButton.className = 'index-link';
  indexButton.setAttribute('aria-haspopup', 'dialog');
  const indexNumber = document.createElement('span');
  indexNumber.className = 'index-number';
  const indexTitle = document.createElement('span');
  indexButton.append(indexNumber, indexTitle);
  indexButton.addEventListener('click', () => {
    const current = findProject(project.key);
    if (current) openProject(current, indexButton);
  });

  return { card, cover, image, number, title, indexButton, indexNumber, indexTitle };
}

function render() {
  const total = content.projects.length;

  heroTitle.textContent = content.hero.title;
  document.title = content.hero.title || 'nopaaiin';
  const heroUrl = resolveSource(content.hero.image);
  document.body.style.setProperty('--hero-image', heroUrl ? `url("${heroUrl}")` : '');

  if (workCount) workCount.textContent = `(${pad(total)})`;
  if (indexRange) indexRange.textContent = total ? `01—${pad(total)}` : '—';

  const liveKeys = new Set();
  content.projects.forEach((project, position) => {
    liveKeys.add(project.key);
    let nodes = cardCache.get(project.key);
    if (!nodes) {
      nodes = buildCard(project);
      cardCache.set(project.key, nodes);
    }
    const number = projectNumber(position);
    nodes.card.dataset.project = number;
    nodes.card.setAttribute('aria-label', `${number} ${project.title} — 작품 보기`);
    nodes.cover.className = `project-cover ${project.coverClass}`;
    nodes.image.alt = project.title;
    nodes.image.loading = position <= 2 ? 'eager' : 'lazy';
    setImageSource(nodes.image, project.poster);
    nodes.number.textContent = number;
    nodes.title.textContent = project.title;
    nodes.indexNumber.textContent = number;
    nodes.indexTitle.textContent = project.title;
    grid.insertBefore(nodes.card, contact);
    index.append(nodes.indexButton);
  });

  cardCache.forEach((nodes, key) => {
    if (liveKeys.has(key)) return;
    nodes.card.remove();
    nodes.indexButton.remove();
    cardCache.delete(key);
  });

  if (dialog.open) {
    const current = findProject(openProjectKey);
    if (current) {
      fillDialog(current);
    } else {
      dialog.close();
    }
  }

  renderListeners.forEach(listener => listener(content));
}

function fillDialog(project) {
  const position = content.projects.indexOf(project);
  const total = content.projects.length;
  document.getElementById('detail-number').textContent = `${projectNumber(position)} / ${pad(total)}`;
  document.getElementById('detail-category').textContent = project.category;
  document.getElementById('detail-title').textContent = project.title;
  document.getElementById('detail-description').textContent = project.desc;

  const signature = JSON.stringify({ poster: project.poster, files: project.files });
  if (detailMedia.dataset.signature === signature) return;
  detailMedia.dataset.signature = signature;
  releaseDialogVideos();
  detailMedia.replaceChildren();

  project.files.forEach((file, position2) => {
    const source = resolveSource(file.src);
    if (!source) return;
    if (file.type === 'img') {
      const image = document.createElement('img');
      image.src = source;
      image.alt = project.files.length > 1 ? `${project.title} — ${position2 + 1}` : project.title;
      image.decoding = 'async';
      detailMedia.append(image);
      return;
    }
    const video = document.createElement('video');
    video.src = source;
    const poster = resolveSource(project.poster);
    if (poster) video.poster = poster;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', `${project.title} 영상`);
    const fallback = document.createElement('a');
    fallback.href = source;
    fallback.textContent = `${project.title} 영상 열기`;
    video.append(fallback);
    detailMedia.append(video);
  });
}

function openProject(project, trigger) {
  openedFrom = trigger;
  openProjectKey = project.key;
  fillDialog(project);
  document.body.classList.add('dialog-open');
  dialog.showModal();
  dialog.scrollTop = 0;
}

function releaseDialogVideos() {
  detailMedia.querySelectorAll('video').forEach(video => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
}

document.getElementById('close-project').addEventListener('click', () => dialog.close());
dialog.addEventListener('pointerdown', event => {
  backdropPointerDown = isOutsideDialog(event);
});
dialog.addEventListener('click', event => {
  if (backdropPointerDown && isOutsideDialog(event)) dialog.close();
  backdropPointerDown = false;
});
dialog.addEventListener('close', () => {
  releaseDialogVideos();
  detailMedia.replaceChildren();
  delete detailMedia.dataset.signature;
  document.body.classList.remove('dialog-open');
  openProjectKey = null;
  openedFrom?.focus({ preventScroll: true });
});

function isOutsideDialog(event) {
  const rect = dialog.getBoundingClientRect();
  return event.target === dialog &&
    (event.clientX < rect.left || event.clientX > rect.right ||
     event.clientY < rect.top || event.clientY > rect.bottom);
}

render();

if (contentUsesLocalMedia(content)) {
  loadStoredMedia().then(render).catch(() => render());
}

/* ------------------------------------------------- 관리자 모드가 사용하는 창구 */

window.Portfolio = {
  COVER_OPTIONS,
  LOCAL_PREFIX,
  BLANK_IMAGE,
  get base() {
    return normalizeContent(window.PORTFOLIO_CONTENT);
  },
  get current() {
    return content;
  },
  hasDraft() {
    return draftStore.read() !== null;
  },
  set(next, { persist = true } = {}) {
    content = normalizeContent(next);
    render();
    return persist ? draftStore.write(content) : true;
  },
  clearDraft() {
    draftStore.clear();
    content = normalizeContent(window.PORTFOLIO_CONTENT);
    render();
  },
  render,
  cloneContent,
  normalizeContent,
  isLocalSource,
  resolveSource,
  onRender(listener) {
    renderListeners.add(listener);
    return () => renderListeners.delete(listener);
  },
  media: {
    store: mediaStore,
    urls: mediaUrls,
    load: loadStoredMedia,
    register: registerMediaUrl,
    forget: forgetMediaUrl,
  },
  closeDialog() {
    if (dialog.open) dialog.close();
  },
  isDialogOpen() {
    return dialog.open === true;
  },
};
