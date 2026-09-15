# 배경이미지 폴더

첫 화면 오른쪽 격자 뒤에 넣을 원본 JPG, PNG 또는 WebP 이미지를 이 폴더에 넣으세요.

이미지를 추가한 다음 `portfolio.js`의 `heroImage`를 해당 경로로 지정하면 됩니다.

현재 설정: `const heroImage = 'backgrounds/hero.webp';`

`hero.webp`는 제공된 `pink_found-12.tif`를 웹용으로 변환한 사진입니다. 원본 크기 1986×1192를 유지하고, Adobe RGB를 sRGB로 변환했습니다. 이미지 위에 둥근 격자 마스크가 적용되고, 가운데에서 흰색 그라데이션이 천천히 움직입니다. 사진을 교체할 때는 `index.html`의 preload 경로도 함께 맞춰 주세요.

사진 위치는 `portfolio.css`의 `.hero-mosaic`에 있는 `background-position`으로 조정합니다. 격자 크기는 `mask-size`, 파도 모양과 속도는 `portfolio.js`의 `drawHeroWaves`에서 조정합니다. 글씨의 핑크색과 속도는 `portfolio.css`의 `.hero-title`에서 조정합니다. 운영체제에서 동작 줄이기를 사용하면 움직임이 멈춥니다.
