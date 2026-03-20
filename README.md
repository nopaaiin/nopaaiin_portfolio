# NOPAAIIN Portfolio

> Interactive experiments · Visual systems · Real-time media  
> **nopaaiin.github.io/nopaaiin_portfolio**

---

## 프로젝트 구조

```
nopaaiin_portfolio/
│
├── index.html          # 메인 페이지 (작업 목록)
├── style.css           # index.html 스타일
├── script.js           # index.html 인터랙션 로직
│
├── about.html          # 소개 페이지
├── about.css           # about.html 스타일
├── about.js            # about.html 인터랙션 로직
│
├── logo.png            # 로고 이미지
├── thumb_audio.png     # Audio Reactive 썸네일
├── thumb_key.png       # Keyboard Reactive 썸네일
├── thumb_scanner.png   # Scanner 썸네일
├── thumb_rage.png      # Rage Beat 썸네일
├── HIPS_2.jpeg         # VANISHOWN 작품 사진
│
├── audio_reactive.mov  # Audio Reactive 영상
├── scanner.mov         # Scanner 영상
├── ragebeat.mov        # Rage Beat 영상
├── keyboardreactive.mov # Keyboard Reactive 영상
│
├── audio_node_1.png    # TouchDesigner 노드 스크린샷
├── audio_node_2.png
├── scanner_node.png
├── rage_node.png
├── keyboard_node.png
│
└── README.md           # 이 파일
```

---

## 사용 기술

| 분류 | 기술 | 용도 |
|------|------|------|
| HTML | HTML5 | 페이지 구조 |
| CSS | CSS3 | 스타일, 애니메이션 |
| JavaScript | Vanilla JS | 인터랙션, 커서, 패널 |
| JavaScript | Three.js (r128) | VANISHOWN 3D 조형물 렌더링 |
| JavaScript | WebGL / GLSL | Keyboard Reactive 실시간 셰이더 |
| Python | — | 사용 안 함 |

> **외부 라이브러리**
> - [Three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js) — CDN으로 불러옴

---

## 주요 기능

### index.html
- 비대칭 카드 그리드 레이아웃 (5개 프로젝트)
- 카드 호버 시 영상 자동 재생 + 핑크 글로우
- 카드 클릭 시 사이드 패널 슬라이드 인
- **hasLive 프로젝트** (Keyboard Reactive, VANISHOWN): 패널 상단에 WebGL 인터랙티브 히어로 → 스크롤하면 설명/이미지
- 커스텀 커서 (ॐ 문양)
- 그레인 노이즈 레이어
- 하단 마퀴 텍스트

### about.html
- 전체화면 영상 배경 (`self_introduce.MOV`)
- Tools, Exhibitions 섹션
- 하단 아웃라인 텍스트 호버 효과

---

## Web Pipeline (배포 흐름)

```
로컬 편집 (VSCode)
       │
       ▼
git add .
git commit -m "변경 내용"
git push origin main
       │
       ▼
GitHub Repository (main 브랜치)
       │
       ▼
GitHub Pages 자동 배포 (1~3분 소요)
       │
       ▼
nopaaiin.github.io/nopaaiin_portfolio
```

### 처음 배포할 때 한 번만 설정하는 것
1. GitHub에서 레포지토리 생성
2. Settings → Pages → Source: `main` 브랜치 → Save

---

## 로컬에서 실행하는 법

```bash
# 1. 레포 클론
git clone https://github.com/nopaaiin/nopaaiin_portfolio.git

# 2. 폴더 이동
cd nopaaiin_portfolio

# 3. 브라우저에서 index.html 열기
open index.html   # macOS
```

> **주의**: 영상 파일(.mov)은 용량이 커서 GitHub에 올릴 때 시간이 걸릴 수 있음

---

## 파일 수정 후 배포하기

```bash
# 변경된 파일 스테이징
git add index.html style.css script.js

# 커밋 (변경 내용 요약)
git commit -m "fix: 카드 레이아웃 수정"

# 푸시
git push
```

---

## 언어별 역할 요약

**HTML** — 뼈대
- 페이지 구조, 카드, 패널, 라이트박스 마크업

**CSS** — 외형
- 레이아웃, 색상, 폰트, 호버 애니메이션, 그레인, 마퀴

**JavaScript** — 동작
- 커서 추적, 카드 클릭 패널 열기/닫기, 영상 재생, WebGL 렌더링 (Three.js, GLSL)

**Python** — 미사용
- 이 프로젝트는 순수 프론트엔드로 Python을 사용하지 않음
