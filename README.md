# nopaaiin portfolio real

GitHub 저장소: https://github.com/nopaaiin/nopaaiin_portfolio

## 현재 디자인

- 첫 화면을 위아래 같은 높이로 나눈 구성: 위쪽은 화면 너비를 채운 격자 이미지, 아래쪽은 흰 배경
- 아래쪽 흰 영역 왼편의 큰 `nopaaiin` 이름과 움직이는 핑크색
- 격자 이미지 아래 경계가 가로 방향의 파도와 흰색 그라데이션으로 부드럽게 연결됨
- 첫 화면 아래의 정적인 작품 그리드 6개와 이미지·영상 상세창
- 위쪽 흰색, 아래쪽 핑크 배경
- Instagram: https://www.instagram.com/nopaaiin/
- Email: a01064941102@gmail.com

첫 화면에는 제공된 `pink_found-12.tif`를 연결했습니다. 원본은 수정하지 않고 색상 프로파일을 sRGB로 변환한 웹용 사본 `backgrounds/hero.webp`를 사용합니다.

## 파일 구성

| 파일 | 수정하는 내용 |
| --- | --- |
| `index.html` | 첫 화면, 상단 메뉴, Contact 등 기본 구성 |
| `portfolio.css` | 격자, 글자 크기, 배치, 그라데이션, 모바일 화면 |
| `portfolio.js` | 작품명·설명·이미지·영상 목록, 상세창, 첫 화면 사진 경로 |
| `backgrounds/` | 첫 화면 격자 뒤에 넣을 원본 사진 |
| 기존 이미지·영상 파일 | 작품 원본과 대표 이미지 |


작품 순서는 01 RADIUS, 02 청결강박, 03 RICE, 04 RAGE, 05 album E, 06 GRID입니다.

## 첫 화면 사진 넣기

1. 새 사진을 `backgrounds/` 폴더에 JPG, PNG 또는 WebP로 저장합니다.
2. `portfolio.js`의 `heroImage`와 `index.html`의 이미지 preload 경로를 새 파일 경로로 바꿉니다. 현재 경로는 `backgrounds/hero.webp`입니다.
3. 브라우저를 새로고침합니다.

격자는 사진 위에 자동으로 적용되므로 사진에 격자를 미리 그릴 필요가 없습니다. 사진 위치는 `portfolio.css`의 `.hero-mosaic`에서 조정합니다. 상세한 설정은 `backgrounds/README.md`를 참고하세요.

## VS Code에서 수정하기

VS Code의 **파일 → 폴더 열기**에서 이 폴더를 선택합니다. 메인 화면은 `index.html`입니다. 별도의 패키지 설치나 빌드가 필요하지 않습니다.

`index.html`을 브라우저로 열거나, 이 폴더에서 로컬 웹 서버를 실행해 확인할 수 있습니다.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

브라우저 주소: http://127.0.0.1:8000/

기본 첫 화면과 그리드는 외부 폰트·라이브러리 없이 동작합니다. 운영체제의 동작 줄이기 설정을 존중합니다. 영상은 기존 MOV 파일을 사용하므로 재생 가능 여부는 브라우저의 코덱 지원에 따라 달라집니다.

## 저장과 업로드

확인한 파일만 스테이징하고 커밋·푸시합니다. 실제 업로드에는 GitHub 쓰기 권한이 필요합니다.

`.git` 폴더에는 GitHub 연결과 변경 기록이 있으므로 프로젝트를 옮길 때 폴더 전체를 함께 옮기세요.
