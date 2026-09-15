// 관리자 모드: 숫자 1을 빠르게 다섯 번 누르면 열립니다.
// 여기서 고친 내용은 이 브라우저에만 임시 저장되고,
// "내보내기"로 받은 content.js 를 프로젝트 폴더에 덮어써야 실제 사이트에 반영됩니다.
(function () {
  const Portfolio = window.Portfolio;
  if (!Portfolio) return;

  const TRIGGER_KEY = '1';
  const TRIGGER_COUNT = 5;
  const TRIGGER_WINDOW = 1500;
  const HISTORY_LIMIT = 60;
  const LOCAL_PREFIX = Portfolio.LOCAL_PREFIX;

  let draft = null;
  let panel = null;
  let nodes = {};
  let open = false;
  let hiddenForPreview = false;
  let busy = false;
  const history = [];
  const expanded = new Set();
  const mediaMeta = new Map();
  let toastTimer = null;
  let statusTimer = null;

  /* ------------------------------------------------------------ 작은 도구들 */

  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([name, value]) => {
      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else if (name === 'html') node.innerHTML = value;
      else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
      else if (value === true) node.setAttribute(name, '');
      else if (value !== false && value !== null && value !== undefined) node.setAttribute(name, value);
    });
    children.flat().forEach(child => {
      if (child === null || child === undefined || child === false) return;
      node.append(child);
    });
    return node;
  }

  function button(label, options) {
    const config = options || {};
    return h('button', {
      type: 'button',
      class: `np-btn${config.variant ? ` np-btn-${config.variant}` : ''}${config.icon ? ' np-btn-icon' : ''}`,
      title: config.title || label,
      'aria-label': config.title || label,
      disabled: config.disabled ? true : false,
      onclick: config.onClick,
    }, label);
  }

  // 포커스 복원용 선택자에 쓰이므로 특수문자는 빼 둡니다.
  function focusKey(key, field) {
    return `${String(key).replace(/[^\w-]/g, '_')}:${field}`;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function stamp() {
    const now = new Date();
    const part = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}`;
  }

  function toast(message, duration) {
    if (!nodes.toast) return;
    nodes.toast.textContent = message;
    nodes.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { nodes.toast.hidden = true; }, duration || 3600);
  }

  function setStatus(message, state) {
    if (!nodes.status) return;
    nodes.status.textContent = message;
    nodes.status.dataset.state = state || '';
    clearTimeout(statusTimer);
    if (state === 'dirty') {
      statusTimer = setTimeout(() => {
        nodes.status.textContent = '이 브라우저에 임시 저장됨';
        nodes.status.dataset.state = '';
      }, 1600);
    }
  }

  function setBusy(value) {
    busy = value;
    if (nodes.exportButton) nodes.exportButton.disabled = value;
  }

  /* --------------------------------------------------------- 파일 고르기·저장 */

  function pickFile(accept, multiple) {
    return new Promise(resolve => {
      const input = h('input', { type: 'file', accept, multiple: multiple ? true : false });
      input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      let settled = false;
      const finish = files => {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', onFocus);
        input.remove();
        resolve(multiple ? files : (files[0] || null));
      };
      const onFocus = () => setTimeout(() => {
        if (!settled && (!input.files || !input.files.length)) finish([]);
      }, 700);
      input.addEventListener('change', () => finish([...(input.files || [])]), { once: true });
      document.body.append(input);
      window.addEventListener('focus', onFocus);
      input.click();
    });
  }

  async function storeFile(file) {
    const key = LOCAL_PREFIX + uid();
    const record = { key, name: file.name || 'media', mime: file.type || '', blob: file };
    await Portfolio.media.store.put(record);
    Portfolio.media.register(key, file);
    mediaMeta.set(key, { name: record.name, mime: record.mime, size: file.size });
    return key;
  }

  function mediaKind(file) {
    return (file.type || '').startsWith('video') ? 'vid' : 'img';
  }

  function sourceLabel(src) {
    if (!src) return '(비어 있음)';
    if (Portfolio.isLocalSource(src)) {
      const meta = mediaMeta.get(src);
      return meta ? `${meta.name} (아직 내보내지 않음)` : '새 파일 (아직 내보내지 않음)';
    }
    return src;
  }

  /* --------------------------------------------------------------- 상태 변경 */

  function snapshot() {
    history.push(JSON.stringify(draft));
    if (history.length > HISTORY_LIMIT) history.shift();
    if (nodes.undoButton) nodes.undoButton.disabled = false;
  }

  function commit(options) {
    const config = options || {};
    const saved = Portfolio.set(draft);
    setStatus(saved ? '저장함' : '임시 저장 실패 (저장 공간 부족)', saved ? 'dirty' : '');
    if (config.redraw !== false) renderPanel();
    if (nodes.undoButton) nodes.undoButton.disabled = history.length === 0;
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    draft = JSON.parse(previous);
    commit();
    toast('한 단계 되돌렸습니다.');
  }

  /* ------------------------------------------------------------- 패널 만들기 */

  function buildPanel() {
    nodes.status = h('span', { class: 'np-admin-status', text: '이 브라우저에 임시 저장됨' });
    nodes.undoButton = button('되돌리기', { onClick: undo, disabled: true, title: '되돌리기 (마지막 수정 취소)' });
    nodes.exportButton = button('내보내기', { variant: 'primary', onClick: exportBundle, title: '수정한 내용을 파일로 내보내기' });

    const bar = h('div', { class: 'np-admin-bar' },
      h('strong', { class: 'np-admin-brand', text: '관리자 모드' }),
      nodes.status,
      nodes.undoButton,
      button('미리보기', { onClick: () => hidePanelForPreview(true), title: '패널을 잠시 숨기고 화면만 보기' }),
      nodes.exportButton,
      button('닫기 ✕', { onClick: () => closePanel(), title: '관리자 모드 닫기 (Esc)' }),
    );

    nodes.notice = h('div', { class: 'np-export', hidden: true });
    nodes.body = h('div', { class: 'np-admin-body' });

    panel = h('div', {
      class: 'np-admin',
      role: 'dialog',
      'aria-label': '포트폴리오 관리자 모드',
      hidden: true,
    }, bar, nodes.body);

    nodes.reopen = h('button', {
      type: 'button',
      class: 'np-reopen',
      hidden: true,
      onclick: () => hidePanelForPreview(false),
    }, '관리자 패널 열기');

    nodes.toast = h('div', { class: 'np-toast', role: 'status', 'aria-live': 'polite', hidden: true });

    document.body.append(panel, nodes.reopen, nodes.toast);
  }

  /* ------------------------------------------------------------- 패널 그리기 */

  function textField(label, value, onInput, options) {
    const config = options || {};
    const control = config.multiline
      ? h('textarea', { class: 'np-textarea', rows: config.rows || 6 })
      : h('input', { class: 'np-input', type: 'text' });
    if (config.focusId) control.setAttribute('data-np-focus', config.focusId);
    control.value = value || '';
    control.addEventListener('focus', snapshot);
    control.addEventListener('input', () => onInput(control.value));
    if (config.placeholder) control.placeholder = config.placeholder;
    return h('label', { class: 'np-field' },
      h('span', { class: 'np-field-label', text: label }),
      control);
  }

  function imagePicker(label, src, onPick, onPath, focusId) {
    const preview = h('img', { class: 'np-thumb', alt: '' });
    preview.src = Portfolio.resolveSource(src) || Portfolio.BLANK_IMAGE;
    const pathInput = h('input', { class: 'np-input', type: 'text', placeholder: '예: rice.png' });
    if (focusId) pathInput.setAttribute('data-np-focus', focusId);
    pathInput.value = Portfolio.isLocalSource(src) ? '' : (src || '');
    pathInput.addEventListener('focus', snapshot);
    pathInput.addEventListener('input', () => onPath(pathInput.value.trim()));

    return h('div', { class: 'np-field' },
      h('span', { class: 'np-field-label', text: label }),
      h('div', { class: 'np-thumb-row' },
        preview,
        h('div', { class: 'np-thumb-actions' },
          button('사진 고르기…', { onClick: onPick }),
          h('span', { class: 'np-path', text: sourceLabel(src) }),
          pathInput)));
  }

  function mediaRow(project, file, position) {
    const thumb = h('span', { class: 'np-media-thumb' });
    const url = Portfolio.resolveSource(file.src);
    if (file.type === 'img' && url) {
      thumb.append(h('img', { alt: '', src: url }));
    } else {
      thumb.textContent = file.type === 'vid' ? '▶' : '▪';
    }

    const move = (from, to) => {
      if (to < 0 || to >= project.files.length) return;
      snapshot();
      const [moved] = project.files.splice(from, 1);
      project.files.splice(to, 0, moved);
      commit();
    };

    return h('div', { class: 'np-media-item' },
      thumb,
      h('div', { class: 'np-media-meta' },
        h('span', { class: 'np-path', text: sourceLabel(file.src) }),
        h('span', { class: 'np-media-type', text: file.type === 'vid' ? '영상' : '이미지' })),
      h('div', { class: 'np-media-actions' },
        button('↑', { icon: true, title: '위로', disabled: position === 0, onClick: () => move(position, position - 1) }),
        button('↓', { icon: true, title: '아래로', disabled: position === project.files.length - 1, onClick: () => move(position, position + 1) }),
        button('교체', {
          title: '이 파일 교체',
          onClick: async () => {
            const picked = await pickFile('image/*,video/*');
            if (!picked) return;
            const key = await storeFile(picked);
            snapshot();
            project.files[position] = { src: key, type: mediaKind(picked) };
            commit();
          },
        }),
        button('삭제', {
          variant: 'danger',
          title: '이 파일 빼기',
          onClick: () => {
            snapshot();
            project.files.splice(position, 1);
            commit();
          },
        })));
  }

  function projectBlock(project, position) {
    const isOpen = expanded.has(project.key);
    const total = draft.projects.length;
    const number = String(position + 1).padStart(2, '0');

    const move = to => {
      if (to < 0 || to >= total) return;
      snapshot();
      const [moved] = draft.projects.splice(position, 1);
      draft.projects.splice(to, 0, moved);
      commit();
    };

    const head = h('div', { class: 'np-project-head' },
      h('button', {
        type: 'button',
        class: 'np-project-toggle',
        'aria-expanded': isOpen ? 'true' : 'false',
        onclick: () => {
          if (isOpen) expanded.delete(project.key); else expanded.add(project.key);
          renderPanel();
        },
      },
        h('span', { class: 'np-project-num', text: number }),
        h('span', { class: 'np-project-name', text: project.title }),
        h('span', { class: 'np-project-num', text: isOpen ? '▾' : '▸' })),
      button('↑', { icon: true, title: '위로 옮기기', disabled: position === 0, onClick: () => move(position - 1) }),
      button('↓', { icon: true, title: '아래로 옮기기', disabled: position === total - 1, onClick: () => move(position + 1) }));

    const block = h('div', { class: `np-project${isOpen ? ' is-open' : ''}` }, head);
    if (!isOpen) return block;

    const coverSelect = h('select', { class: 'np-select' },
      Portfolio.COVER_OPTIONS.map(option => h('option', { value: option.value, text: option.label })));
    coverSelect.value = project.coverClass;
    coverSelect.addEventListener('change', () => {
      snapshot();
      project.coverClass = coverSelect.value;
      commit({ redraw: false });
    });

    const addMedia = async accept => {
      const picked = await pickFile(accept, true);
      if (!picked || !picked.length) return;
      const added = [];
      for (const file of picked) added.push({ src: await storeFile(file), type: mediaKind(file) });
      snapshot();
      project.files.push(...added);
      commit();
    };

    block.append(h('div', { class: 'np-project-body' },
      textField('제목', project.title, value => {
        project.title = value;
        commit({ redraw: false });
        const label = block.querySelector('.np-project-name');
        if (label) label.textContent = value;
      }, { focusId: focusKey(project.key, 'title') }),
      textField('분류', project.category, value => {
        project.category = value;
        commit({ redraw: false });
      }, { placeholder: '예: Graphic design', focusId: focusKey(project.key, 'category') }),
      textField('설명', project.desc, value => {
        project.desc = value;
        commit({ redraw: false });
      }, { multiline: true, rows: 7, focusId: focusKey(project.key, 'desc') }),
      h('label', { class: 'np-field' },
        h('span', { class: 'np-field-label', text: '커버 배경' }),
        coverSelect),
      imagePicker('대표 이미지 (그리드 썸네일)', project.poster,
        async () => {
          const picked = await pickFile('image/*');
          if (!picked) return;
          const key = await storeFile(picked);
          snapshot();
          project.poster = key;
          commit();
        },
        value => {
          project.poster = value;
          commit({ redraw: false });
        },
        focusKey(project.key, 'poster')),
      h('div', { class: 'np-field' },
        h('span', { class: 'np-field-label', text: `상세창 미디어 (${project.files.length})` }),
        project.files.length
          ? h('div', { class: 'np-media-list' }, project.files.map((file, index) => mediaRow(project, file, index)))
          : h('span', { class: 'np-empty', text: '아직 파일이 없습니다.' })),
      h('div', { class: 'np-row' },
        button('이미지 추가…', { onClick: () => addMedia('image/*') }),
        button('영상 추가…', { onClick: () => addMedia('video/*') })),
      h('hr', { class: 'np-divider' }),
      h('div', { class: 'np-row np-row-end' },
        button('이 작품 삭제', {
          variant: 'danger',
          onClick: () => {
            if (!window.confirm(`${number} ${project.title || '(제목 없음)'} 작품을 목록에서 뺄까요?`)) return;
            snapshot();
            draft.projects.splice(position, 1);
            expanded.delete(project.key);
            commit();
            toast('삭제했습니다. 되돌리기를 누르면 복구됩니다.');
          },
        }))));

    return block;
  }

  function renderPanel() {
    if (!panel) return;
    const scroll = nodes.body.scrollTop;
    const activeId = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.npFocus
      : null;

    const heroPicker = imagePicker('첫 화면 배경 사진', draft.hero.image,
      async () => {
        const picked = await pickFile('image/*');
        if (!picked) return;
        const key = await storeFile(picked);
        snapshot();
        draft.hero.image = key;
        commit();
      },
      value => {
        draft.hero.image = value;
        commit({ redraw: false });
      },
      'hero:image');

    const heroSection = h('section', { class: 'np-section' },
      h('h2', { class: 'np-section-title', text: '첫 화면' }),
      h('div', { class: 'np-section-body' },
        textField('이름 (큰 글씨)', draft.hero.title, value => {
          draft.hero.title = value;
          commit({ redraw: false });
        }, { focusId: 'hero:title' }),
        heroPicker));

    const projectsSection = h('section', { class: 'np-section' },
      h('h2', { class: 'np-section-title', text: `작품 (${draft.projects.length})` }),
      h('div', { class: 'np-section-body' },
        draft.projects.length
          ? h('div', {}, draft.projects.map((project, position) => projectBlock(project, position)))
          : h('span', { class: 'np-empty', text: '작품이 없습니다. 아래에서 추가하세요.' }),
        h('div', { class: 'np-row' },
          button('+ 작품 추가', {
            onClick: () => {
              snapshot();
              const key = `project-${uid()}`;
              draft.projects.push({
                key,
                title: '새 작품',
                category: '',
                desc: '',
                poster: '',
                coverClass: 'cover-dark',
                files: [],
              });
              expanded.clear();
              expanded.add(key);
              commit();
              nodes.body.scrollTop = nodes.body.scrollHeight;
            },
          }))));

    const resetSection = h('section', { class: 'np-section' },
      h('h2', { class: 'np-section-title', text: '정리' }),
      h('div', { class: 'np-section-body' },
        h('p', { class: 'np-empty', text: '임시 저장을 지우면 content.js 에 저장된 내용으로 되돌아갑니다.' }),
        h('div', { class: 'np-row' },
          button('임시 저장 지우기', { variant: 'danger', onClick: discardDraft }))));

    nodes.body.replaceChildren(
      h('p', { class: 'np-admin-hint' },
        h('strong', { text: '이 화면은 내 브라우저에서만 보입니다. ' }),
        '수정한 내용을 실제 사이트에 올리려면 ',
        h('strong', { text: '내보내기' }),
        ' → 받은 ',
        h('code', { text: 'content.js' }),
        ' 와 ',
        h('code', { text: 'media/' }),
        ' 폴더를 프로젝트 폴더에 덮어쓰고 커밋·푸시하세요.'),
      nodes.notice,
      heroSection,
      projectsSection,
      resetSection);

    nodes.body.scrollTop = scroll;
    if (activeId) {
      const restore = nodes.body.querySelector(`[data-np-focus="${activeId}"]`);
      if (restore) restore.focus();
    }
  }

  /* ---------------------------------------------------------------- 내보내기 */

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[i] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosStamp(date) {
    const year = Math.max(date.getFullYear(), 1980);
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  function makeZip(entries) {
    const encoder = new TextEncoder();
    const when = dosStamp(new Date());
    const parts = [];
    const central = [];
    let offset = 0;

    entries.forEach(entry => {
      const name = encoder.encode(entry.name);
      const crc = crc32(entry.data);
      const size = entry.data.length;

      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, when.time, true);
      localView.setUint16(12, when.date, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, size, true);
      localView.setUint32(22, size, true);
      localView.setUint16(26, name.length, true);
      localView.setUint16(28, 0, true);
      local.set(name, 30);
      parts.push(local, entry.data);

      const directory = new Uint8Array(46 + name.length);
      const directoryView = new DataView(directory.buffer);
      directoryView.setUint32(0, 0x02014b50, true);
      directoryView.setUint16(4, 20, true);
      directoryView.setUint16(6, 20, true);
      directoryView.setUint16(8, 0x0800, true);
      directoryView.setUint16(10, 0, true);
      directoryView.setUint16(12, when.time, true);
      directoryView.setUint16(14, when.date, true);
      directoryView.setUint32(16, crc, true);
      directoryView.setUint32(20, size, true);
      directoryView.setUint32(24, size, true);
      directoryView.setUint16(28, name.length, true);
      directoryView.setUint16(30, 0, true);
      directoryView.setUint16(32, 0, true);
      directoryView.setUint16(34, 0, true);
      directoryView.setUint16(36, 0, true);
      directoryView.setUint32(38, 0, true);
      directoryView.setUint32(42, offset, true);
      directory.set(name, 46);
      central.push(directory);

      offset += local.length + size;
    });

    const centralSize = central.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }

  // 압축을 어떤 프로그램으로 풀어도 깨지지 않도록 파일 이름을 영문·숫자로 바꿉니다.
  const MIME_EXTENSION = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/svg+xml': 'svg',
    'image/tiff': 'tif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-m4v': 'm4v',
  };

  function asciiSlug(value, limit) {
    return String(value || '')
      .normalize('NFC')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '')
      .slice(0, limit);
  }

  function exportFileName(record, position) {
    const raw = String(record.name || '');
    const dot = raw.lastIndexOf('.');
    const hasExtension = dot > 0 && dot < raw.length - 1;
    const stem = asciiSlug(hasExtension ? raw.slice(0, dot) : raw, 60);
    const mime = String(record.mime || '').toLowerCase();
    const named = asciiSlug(hasExtension ? raw.slice(dot + 1) : '', 8).toLowerCase();
    const extension = /^[a-z0-9]{1,5}$/.test(named)
      ? named
      : (MIME_EXTENSION[mime] || (mime.startsWith('video') ? 'mp4' : 'png'));
    // 숫자·기호만 남은 이름은 알아보기 어려우니 순번 이름으로 바꿉니다.
    const usable = /[A-Za-z]/.test(stem) ? stem : '';
    return `${usable || `media-${position}`}.${extension}`;
  }

  function contentFileText(content) {
    return [
      '// 포트폴리오에 들어가는 글과 사진 목록입니다.',
      `// 관리자 모드에서 ${new Date().toLocaleString('ko-KR')} 에 내보냈습니다.`,
      'window.PORTFOLIO_CONTENT = ' + JSON.stringify(content, null, 2) + ';',
      '',
    ].join('\n');
  }

  const APPLY_GUIDE = [
    'nopaaiin 포트폴리오 — 내보낸 파일 적용하기',
    '',
    '1. 이 zip 을 풀면 content.js 와 (새 사진·영상이 있으면) media 폴더가 나옵니다.',
    '2. 두 가지를 프로젝트 폴더(index.html 이 있는 곳)에 그대로 덮어씁니다.',
    '   - content.js : 기존 파일을 덮어쓰기',
    '   - media/     : 폴더째 복사 (기존 media 폴더가 있으면 파일만 합치기)',
    '3. 브라우저에서 사이트를 새로고침해 확인합니다.',
    '4. 관리자 모드에서 "임시 저장 지우기"를 눌러 브라우저 임시본을 정리합니다.',
    '5. 확인이 끝나면 git 으로 커밋·푸시합니다.',
    '',
    '   git add content.js media',
    '   git commit -m "포트폴리오 내용 수정"',
    '   git push',
    '',
  ].join('\n');

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function buildBundle() {
    const records = await Portfolio.media.store.all();
    const byKey = new Map(records.map(record => [record.key, record]));
    const exported = Portfolio.cloneContent(draft);
    const pathByKey = new Map();
    const usedPaths = new Set();
    const files = [];
    const missing = [];

    const mapSource = async src => {
      if (!Portfolio.isLocalSource(src)) return src;
      if (pathByKey.has(src)) return pathByKey.get(src);
      const record = byKey.get(src);
      if (!record || !record.blob) {
        missing.push(src);
        return '';
      }
      const base = exportFileName(record, pathByKey.size + 1);
      const dot = base.lastIndexOf('.');
      const stem = base.slice(0, dot);
      const extension = base.slice(dot);
      let path = `media/${base}`;
      let counter = 2;
      while (usedPaths.has(path)) {
        path = `media/${stem}-${counter}${extension}`;
        counter += 1;
      }
      usedPaths.add(path);
      pathByKey.set(src, path);
      files.push({ name: path, data: new Uint8Array(await record.blob.arrayBuffer()) });
      return path;
    };

    exported.hero.image = await mapSource(exported.hero.image);
    for (const project of exported.projects) {
      project.poster = await mapSource(project.poster);
      const kept = [];
      for (const file of project.files) {
        const source = await mapSource(file.src);
        if (source) kept.push({ src: source, type: file.type });
      }
      project.files = kept;
    }

    const encoder = new TextEncoder();
    const text = contentFileText(exported);
    const entries = [
      { name: 'content.js', data: encoder.encode(text) },
      ...files,
      { name: 'HOW-TO-APPLY.txt', data: encoder.encode(APPLY_GUIDE) },
    ];

    return { zip: makeZip(entries), text, mediaCount: files.length, missing, heroImage: exported.hero.image };
  }

  async function exportBundle() {
    if (busy) return;
    setBusy(true);
    setStatus('내보내는 중…');
    try {
      const bundle = await buildBundle();
      downloadBlob(bundle.zip, `nopaaiin-content-${stamp()}.zip`);
      showNotice(bundle);
      setStatus('내보냈습니다');
    } catch (error) {
      toast(`내보내기에 실패했습니다: ${error && error.message ? error.message : error}`, 6000);
      setStatus('내보내기 실패');
    } finally {
      setBusy(false);
    }
  }

  function showNotice(bundle) {
    const warn = bundle.missing.length > 0;
    // index.html 의 preload 는 손으로 맞춰야 해서, 달라졌을 때만 알려 줍니다.
    const preload = document.querySelector('link[rel="preload"][as="image"]');
    const preloadHref = preload ? preload.getAttribute('href') : '';
    const heroMoved = Boolean(bundle.heroImage) && Boolean(preloadHref) && preloadHref !== bundle.heroImage;
    nodes.notice.className = `np-export${warn ? ' np-export-warn' : ''}`;
    nodes.notice.hidden = false;
    nodes.notice.replaceChildren(
      h('strong', { text: warn ? '일부 파일을 찾지 못했습니다' : 'zip 파일을 받았습니다' }),
      h('ol', {},
        h('li', {}, 'zip 을 풀어 ', h('code', { text: 'content.js' }),
          bundle.mediaCount ? [' 와 ', h('code', { text: 'media/' }), ' 폴더를'] : ' 를',
          ' 프로젝트 폴더에 덮어쓰기'),
        heroMoved
          ? h('li', {}, 'index.html 의 ', h('code', { text: 'rel="preload"' }), ' 경로를 ',
              h('code', { text: bundle.heroImage }), ' 로 바꾸기')
          : null,
        h('li', { text: '사이트를 새로고침해 확인' }),
        h('li', {}, '아래 ', h('strong', { text: '임시 저장 지우기' }), ' 를 눌러 브라우저 임시본 정리'),
        h('li', { text: 'git add . → commit → push' })),
      warn
        ? h('p', { text: `저장된 원본을 찾지 못한 파일 ${bundle.missing.length}개는 목록에서 빠졌습니다. 해당 사진을 다시 넣어 주세요.` })
        : null,
      h('div', { class: 'np-row' },
        button('content.js 만 다시 받기', {
          onClick: () => downloadBlob(new Blob([bundle.text], { type: 'text/javascript' }), 'content.js'),
        }),
        button('닫기', { onClick: () => { nodes.notice.hidden = true; } })));
  }

  async function discardDraft() {
    if (!window.confirm('이 브라우저의 임시 저장을 지우고 content.js 내용으로 되돌릴까요?\n내보내지 않은 수정은 사라집니다.')) return;
    const records = await Portfolio.media.store.all();
    for (const record of records) {
      Portfolio.media.forget(record.key);
      await Portfolio.media.store.remove(record.key);
    }
    mediaMeta.clear();
    history.length = 0;
    Portfolio.clearDraft();
    draft = Portfolio.cloneContent(Portfolio.current);
    renderPanel();
    setStatus('기본 내용으로 되돌림');
    toast('content.js 의 내용으로 되돌렸습니다.');
  }

  /* --------------------------------------------------------------- 열고 닫기 */

  function hidePanelForPreview(value) {
    hiddenForPreview = value;
    panel.hidden = value;
    nodes.reopen.hidden = !value;
    document.body.classList.toggle('np-admin-open', open && !value);
  }

  async function openPanel() {
    if (open) return;
    if (!panel) buildPanel();
    open = true;
    Portfolio.closeDialog();

    try {
      const records = await Portfolio.media.load();
      records.forEach(record => {
        mediaMeta.set(record.key, { name: record.name, mime: record.mime, size: record.blob ? record.blob.size : 0 });
      });
    } catch (error) {
      toast('저장된 사진 목록을 불러오지 못했습니다. 이번 세션에서 올린 파일만 보입니다.', 5000);
    }

    draft = Portfolio.cloneContent(Portfolio.current);
    history.length = 0;
    hidePanelForPreview(false);
    panel.hidden = false;
    document.body.classList.add('np-admin-open');
    renderPanel();
    setStatus(Portfolio.hasDraft() ? '이 브라우저에 임시 저장됨' : 'content.js 내용을 불러옴');
    toast('관리자 모드입니다. Esc 로 닫습니다.');
  }

  function closePanel() {
    if (!open) return;
    open = false;
    hiddenForPreview = false;
    panel.hidden = true;
    nodes.reopen.hidden = true;
    document.body.classList.remove('np-admin-open');
  }

  /* -------------------------------------------------------------- 여는 단축키 */

  const presses = [];

  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      // 작품 상세창이 떠 있으면 그 창만 닫히도록 둡니다.
      if (Portfolio.isDialogOpen()) return;
      if (hiddenForPreview) hidePanelForPreview(false);
      else closePanel();
      return;
    }
    if (event.key !== TRIGGER_KEY || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) return;

    const now = performance.now();
    presses.push(now);
    while (presses.length > TRIGGER_COUNT) presses.shift();
    if (presses.length === TRIGGER_COUNT && now - presses[0] <= TRIGGER_WINDOW) {
      presses.length = 0;
      if (open) closePanel();
      else openPanel();
    }
  });
})();
