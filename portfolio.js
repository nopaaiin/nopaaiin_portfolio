// 작품의 순서, 대표 이미지, 설명은 이 목록에서 수정합니다.
const projects = [
  { id:'01', poster:'thumb_audio.png', coverClass:'cover-dark', category:'Moving image', title:'RADIUS',
    files:[{src:'audio_reactive.mov', type:'vid'}],
    desc:'TouchDesigner를 통해 구현한 오디오 리액티브 비주얼. 음악의 킥 신호를 실시간으로 분석해 원형 그래픽이 비트에 반응하며 변형된다. 소리의 물리적 진동을 기하학적 형태로 번역한 작업.' },
  { id:'02', poster:'HIPS_1.jpeg', coverClass:'cover-photo', category:'Photography', title:'청결강박',
    files:[{src:'HIPS_1.jpeg', type:'img'}],
    desc:'손 씻기 행위를 495회 반복한 뒤, 그 순서를 제거해 배열했다. 반복된 행위는 강박의 불안과 통제 욕구를 시각적 구조로 드러낸다. HIPS 새끼전 [보행]에 전시된 작품.' },
  { id:'03', poster:'rice.png', coverClass:'cover-poster', category:'Graphic design', title:'RICE',
    files:[{src:'rice.png', type:'img'}],
    desc:'소비의 과정에서 재료의 원형은 지워진다. 쌀국수 안에서 쌀알은 더 이상 쌀의 형태를 갖지 않는다. 이 은폐된 변환을 가시화하기 위해, 쌀국수의 실루엣을 왜곡하고 해체하는 그래픽 작업을 진행했다.' },
  { id:'04', poster:'thumb_rage.png', coverClass:'cover-dark', category:'Moving image', title:'RAGE',
    files:[{src:'ragebeat.mov', type:'vid'}],
    desc:'레이지 장르가 내포한 음향적 공격성과 파열의 질감을 시각 언어로 번역했다. TouchDesigner를 기반으로 음악의 충돌과 찢김을 실시간 그래픽으로 구현한 작업.' },
  { id:'05', poster:'effie.png', coverClass:'cover-album', category:'Graphic design', title:'album E',
    files:[{src:'effie.png', type:'img'}, {src:'effie_in.png', type:'img'}],
    desc:'effie의 앨범 E를 위한 커버 아트와 수록곡 부클릿 디자인. 그녀의 음악이 품은 노스탤직한 정서를 닌텐도 게임팩의 물성과 형태로 치환해, 디지털 감성과 아날로그 매체 사이의 간극을 시각화했다.' },
  { id:'06', poster:'thumb_key.png', coverClass:'cover-dark', category:'Interactive', title:'GRID',
    files:[{src:'keyboardreactive.mov', type:'vid'}],
    desc:'균일한 사각형 그리드를 기반으로, 비정형 그래픽이 실시간으로 생성되는 인터랙티브 비주얼 시스템. 키보드 입력을 이벤트로 받아 루프 주기, 분포 패턴 등의 주요 파라미터를 즉각적으로 변경한다. 동일한 구조 위에서 매 순간 다른 시각적 상태를 생성하는 시스템으로 설계되었다.' },
];

// 첫 화면 오른쪽 격자 뒤에 들어갈 원본 사진입니다.
// 사진을 backgrounds 폴더에 넣은 뒤 아래 경로를 지정하세요.
// 현재 사진: pink_found-12.tif의 웹용 sRGB 사본.
const heroImage = 'backgrounds/hero.webp';

if (heroImage) {
  const heroPhoto = new Image();
  heroPhoto.addEventListener('load', () => {
    document.body.style.setProperty('--hero-image', `url("${heroPhoto.src}")`);
  });
  heroPhoto.src = heroImage;
}

// 여러 주기의 곡선을 겹쳐 흰색 경계가 파도처럼 흐르게 합니다.
const hero = document.querySelector('.hero');
const wavePaths = [...document.querySelectorAll('.hero-wave')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let heroVisible = true;
let waveFrame = null;
let previousWaveTime = null;
let waveTime = 0;

function drawHeroWaves(time) {
  wavePaths.forEach((path, layer) => {
    const offset = (2 - layer) * 84;
    const phase = time + layer * .75;
    let shape = 'M -240 -180';
    for (let y = -180; y <= 1180; y += 34) {
      const x = 510 + offset
        + 87 * Math.sin(y / 180 - phase * .8)
        + 34 * Math.sin(y / 93 + phase * .53)
        + 24 * Math.sin(phase * .67);
      shape += ` L ${x.toFixed(1)} ${y}`;
    }
    path.setAttribute('d', `${shape} L -240 1180 Z`);
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

const grid = document.getElementById('work-grid');
const index = document.getElementById('project-index');
const contact = document.getElementById('contact');
const dialog = document.getElementById('project-dialog');
const detailMedia = document.getElementById('detail-media');
let openedFrom = null;
let backdropPointerDown = false;

projects.forEach(project => {
  const indexButton = document.createElement('button');
  indexButton.type = 'button';
  indexButton.className = 'index-link';
  indexButton.setAttribute('aria-haspopup', 'dialog');
  const indexNumber = document.createElement('span');
  indexNumber.className = 'index-number';
  indexNumber.textContent = project.id;
  const indexTitle = document.createElement('span');
  indexTitle.textContent = project.title;
  indexButton.append(indexNumber, indexTitle);
  indexButton.addEventListener('click', () => openProject(project, indexButton));
  index.append(indexButton);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'project-card';
  card.dataset.project = project.id;
  card.setAttribute('aria-label', `${project.id} ${project.title} — 작품 보기`);
  card.setAttribute('aria-haspopup', 'dialog');

  const cover = document.createElement('span');
  cover.className = `project-cover ${project.coverClass}`;
  const image = document.createElement('img');
  image.src = project.poster;
  image.alt = project.title;
  image.decoding = 'async';
  image.loading = Number(project.id) <= 3 ? 'eager' : 'lazy';
  cover.append(image);

  const caption = document.createElement('span');
  caption.className = 'project-caption';
  const number = document.createElement('span');
  number.className = 'project-number';
  number.textContent = project.id;
  const title = document.createElement('span');
  title.className = 'project-name';
  title.textContent = project.title;
  const arrow = document.createElement('span');
  arrow.className = 'project-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  caption.append(number, title, arrow);
  card.append(cover, caption);
  card.addEventListener('click', () => openProject(project, card));
  grid.insertBefore(card, contact);
});

function openProject(project, trigger) {
  openedFrom = trigger;
  document.getElementById('detail-number').textContent = `${project.id} / 06`;
  document.getElementById('detail-category').textContent = project.category;
  document.getElementById('detail-title').textContent = project.title;
  document.getElementById('detail-description').textContent = project.desc;
  detailMedia.replaceChildren();

  project.files.forEach((file, position) => {
    if (file.type === 'img') {
      const image = document.createElement('img');
      image.src = file.src;
      image.alt = project.files.length > 1 ? `${project.title} — ${position + 1}` : project.title;
      image.decoding = 'async';
      detailMedia.append(image);
      return;
    }
    const video = document.createElement('video');
    video.src = file.src;
    video.poster = project.poster;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', `${project.title} 영상`);
    const fallback = document.createElement('a');
    fallback.href = file.src;
    fallback.textContent = `${project.title} 영상 열기`;
    video.append(fallback);
    detailMedia.append(video);
  });

  document.body.classList.add('dialog-open');
  dialog.showModal();
  dialog.scrollTop = 0;
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
  detailMedia.querySelectorAll('video').forEach(video => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  detailMedia.replaceChildren();
  document.body.classList.remove('dialog-open');
  openedFrom?.focus({ preventScroll: true });
});

function isOutsideDialog(event) {
  const rect = dialog.getBoundingClientRect();
  return event.target === dialog &&
    (event.clientX < rect.left || event.clientX > rect.right ||
     event.clientY < rect.top || event.clientY > rect.bottom);
}
