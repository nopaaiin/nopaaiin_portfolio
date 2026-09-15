// 포트폴리오에 들어가는 글과 사진 목록입니다.
// 관리자 모드(숫자 1 빠르게 5번)에서 "내보내기"로 받은 content.js 로
// 이 파일을 통째로 덮어쓰면 수정한 내용이 실제 사이트에 반영됩니다.
window.PORTFOLIO_CONTENT = {
  hero: {
    title: 'nopaaiin',
    image: 'backgrounds/hero.webp'
  },
  projects: [
    {
      key: 'radius',
      title: 'RADIUS',
      category: 'Moving image',
      poster: 'thumb_audio.png',
      coverClass: 'cover-dark',
      files: [{ src: 'audio_reactive.mov', type: 'vid' }],
      desc: 'TouchDesigner를 통해 구현한 오디오 리액티브 비주얼. 음악의 킥 신호를 실시간으로 분석해 원형 그래픽이 비트에 반응하며 변형된다. 소리의 물리적 진동을 기하학적 형태로 번역한 작업.'
    },
    {
      key: 'hips',
      title: '청결강박',
      category: 'Photography',
      poster: 'HIPS_1.jpeg',
      coverClass: 'cover-photo',
      files: [{ src: 'HIPS_1.jpeg', type: 'img' }],
      desc: '손 씻기 행위를 495회 반복한 뒤, 그 순서를 제거해 배열했다. 반복된 행위는 강박의 불안과 통제 욕구를 시각적 구조로 드러낸다. HIPS 새끼전 [보행]에 전시된 작품.'
    },
    {
      key: 'rice',
      title: 'RICE',
      category: 'Graphic design',
      poster: 'rice.png',
      coverClass: 'cover-poster',
      files: [{ src: 'rice.png', type: 'img' }],
      desc: '소비의 과정에서 재료의 원형은 지워진다. 쌀국수 안에서 쌀알은 더 이상 쌀의 형태를 갖지 않는다. 이 은폐된 변환을 가시화하기 위해, 쌀국수의 실루엣을 왜곡하고 해체하는 그래픽 작업을 진행했다.'
    },
    {
      key: 'rage',
      title: 'RAGE',
      category: 'Moving image',
      poster: 'thumb_rage.png',
      coverClass: 'cover-dark',
      files: [{ src: 'ragebeat.mov', type: 'vid' }],
      desc: '레이지 장르가 내포한 음향적 공격성과 파열의 질감을 시각 언어로 번역했다. TouchDesigner를 기반으로 음악의 충돌과 찢김을 실시간 그래픽으로 구현한 작업.'
    },
    {
      key: 'album-e',
      title: 'album E',
      category: 'Graphic design',
      poster: 'effie.png',
      coverClass: 'cover-album',
      files: [
        { src: 'effie.png', type: 'img' },
        { src: 'effie_in.png', type: 'img' }
      ],
      desc: 'effie의 앨범 E를 위한 커버 아트와 수록곡 부클릿 디자인. 그녀의 음악이 품은 노스탤직한 정서를 닌텐도 게임팩의 물성과 형태로 치환해, 디지털 감성과 아날로그 매체 사이의 간극을 시각화했다.'
    },
    {
      key: 'grid',
      title: 'GRID',
      category: 'Interactive',
      poster: 'thumb_key.png',
      coverClass: 'cover-dark',
      files: [{ src: 'keyboardreactive.mov', type: 'vid' }],
      desc: '균일한 사각형 그리드를 기반으로, 비정형 그래픽이 실시간으로 생성되는 인터랙티브 비주얼 시스템. 키보드 입력을 이벤트로 받아 루프 주기, 분포 패턴 등의 주요 파라미터를 즉각적으로 변경한다. 동일한 구조 위에서 매 순간 다른 시각적 상태를 생성하는 시스템으로 설계되었다.'
    }
  ]
};
