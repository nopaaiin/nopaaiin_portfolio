// DYNAMIC RISO
// p5.js + Matter.js 인스턴스 모드로 포트폴리오의 다른 스크립트와 격리한다.

window.DynamicRiso = (() => {
  const CANVAS_W = 800;
  const CANVAS_H = 1100;
  const PAPER = '#FFFFFF';
  const WORLD_CATEGORY = 0x0010;
  const END_TIME = 18;
  const SEESAW_RELEASE_TIME = 2;
  const FIRST_OBJECT_RELEASE = 2.25;
  const RELEASE_INTERVAL = 0.3;
  const PRIMARY_ALPHA = 230;
  const UNDERPRINT_ALPHA = 0;

  const INKS = [
    {
      name: 'Candy Pink',
      rgb: [255, 100, 183],
      density: 0.001,
      restitution: 0.3,
      friction: 0.05,
      category: 0x0001,
    },
    {
      name: 'Lemon Yellow',
      rgb: [255, 227, 64],
      density: 0.002,
      restitution: 0.2,
      friction: 0.2,
      category: 0x0002,
    },
    {
      name: 'Mint',
      rgb: [86, 221, 177],
      density: 0.004,
      restitution: 0.1,
      friction: 0.5,
      category: 0x0004,
    },
    {
      name: 'Sky Blue',
      rgb: [91, 193, 245],
      density: 0.008,
      restitution: 0.02,
      friction: 1,
      category: 0x0008,
    },
  ];

  const ALL_LAYER_CATEGORIES = INKS.reduce((mask, ink) => mask | ink.category, 0);

  // 배열 순서가 위에서 아래로 해제되는 순서다.
  const TOWER_DEFS = [
    { type: 'circle', x: 354, y: 242, d: 104 },
    { type: 'triangle', x: 432, y: 335, r: 54, angle: -Math.PI / 2 },
    { type: 'rect', x: 348, y: 370, w: 62, h: 62, angle: 0 },
    { type: 'rect', x: 408, y: 426, w: 220, h: 28, angle: 0.035 },
    { type: 'circle', x: 468, y: 494, d: 90 },
    { type: 'rect', x: 400, y: 574, w: 190, h: 64, angle: 0 },
  ];

  const PINS = [
    { x: 165, y: 790, r: 17 },
    { x: 330, y: 865, r: 18 },
    { x: 530, y: 790, r: 16 },
    { x: 655, y: 900, r: 19 },
    { x: 455, y: 968, r: 17 },
  ];

  function mount(host) {
    if (!host) return () => {};

    host.replaceChildren();
    const shell = document.createElement('div');
    shell.className = 'dynamic-riso-shell';
    const stage = document.createElement('div');
    stage.className = 'dynamic-riso-stage';
    const toolbar = document.createElement('div');
    toolbar.className = 'dynamic-riso-toolbar';
    const status = document.createElement('span');
    status.className = 'dynamic-riso-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'REGISTERED / 00:00';
    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'dynamic-riso-replay';
    replay.textContent = 'REPLAY';
    toolbar.append(status, replay);
    shell.append(stage, toolbar);
    host.append(shell);

    if (!window.p5 || !window.Matter) {
      stage.classList.add('dynamic-riso-error');
      stage.textContent = 'p5.js 또는 Matter.js를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.';
      replay.hidden = true;
      status.textContent = 'LOAD ERROR';
      return () => shell.remove();
    }

    let instance = null;
    let destroyed = false;

    function start() {
      if (instance) instance.remove();
      stage.replaceChildren();
      status.textContent = 'REGISTERED / 00:00';
      instance = new window.p5(createSketch(stage, status), stage);
    }

    function handleReplay() {
      if (!destroyed) start();
    }

    replay.addEventListener('click', handleReplay);
    start();

    return () => {
      destroyed = true;
      replay.removeEventListener('click', handleReplay);
      if (instance) instance.remove();
      instance = null;
      shell.remove();
    };
  }

  function createSketch(stage, statusNode) {
    return p => {
      const {
        Engine,
        World,
        Bodies,
        Body,
        Constraint,
      } = window.Matter;

      let engine;
      let world;
      let layers = [];
      let floorBody;
      let pinBodies = [];
      let grainLayer;
      let startMillis = 0;
      let finished = false;
      let lastStatus = '';

      p.setup = () => {
        const canvas = p.createCanvas(CANVAS_W, CANVAS_H);
        canvas.parent(stage);
        canvas.elt.setAttribute('role', 'img');
        canvas.elt.setAttribute(
          'aria-label',
          '네 가지 리소그래프 잉크 레이어가 물성 차이로 무너지고 어긋나는 물리 생성 스케치',
        );

        p.pixelDensity(1);
        p.frameRate(60);
        p.rectMode(p.CENTER);
        p.ellipseMode(p.CENTER);

        engine = Engine.create({ enableSleeping: false });
        world = engine.world;
        engine.gravity.x = 0;
        engine.gravity.y = 1;
        engine.timing.timeScale = 0.5;

        createPaperGrain();
        createEnvironment();
        createLayers();
        startMillis = p.millis();
      };

      function createPaperGrain() {
        grainLayer = p.createGraphics(CANVAS_W + 6, CANVAS_H + 6);
        grainLayer.pixelDensity(1);
        grainLayer.clear();
        grainLayer.noStroke();
        p.randomSeed(9282026);
        p.noiseSeed(9282026);

        // 흰 종이는 그대로 두고, 잉크 안에만 종이가 비치는 미세한 결을 만든다.
        for (let i = 0; i < 14000; i += 1) {
          const x = p.random(grainLayer.width);
          const y = p.random(grainLayer.height);
          const size = p.random(0.7, 1.8);
          const texture = p.noise(x * 0.018, y * 0.018);
          grainLayer.fill(255, 255, 255, p.map(texture, 0, 1, 25, 120));
          grainLayer.rect(x, y, size, size);
        }
      }

      function createEnvironment() {
        const collisionFilter = {
          category: WORLD_CATEGORY,
          mask: ALL_LAYER_CATEGORIES,
        };

        floorBody = Bodies.rectangle(CANVAS_W / 2, 1070, 900, 90, {
          isStatic: true,
          friction: 0.8,
          restitution: 0.1,
          collisionFilter,
        });
        // 보이지 않는 양옆 벽: 도형이 화면 밖으로 튀지 않고 바닥에 쌓이게 한다.
        const wallOptions = { isStatic: true, friction: 0.3, restitution: 0, collisionFilter };
        World.add(world, [
          floorBody,
          Bodies.rectangle(-30, CANVAS_H / 2, 60, CANVAS_H * 3, wallOptions),
          Bodies.rectangle(CANVAS_W + 30, CANVAS_H / 2, 60, CANVAS_H * 3, wallOptions),
        ]);

        pinBodies = PINS.map(definition => {
          const pin = Bodies.circle(definition.x, definition.y, definition.r, {
            isStatic: true,
            restitution: 0.4,
            friction: 0.5,
            collisionFilter,
          });
          pin.drawRadius = definition.r;
          return pin;
        });
        World.add(world, pinBodies);
      }

      function createLayers() {
        layers = INKS.map(ink => {
          // 시소의 밀도는 동일하게 두어 위 도형의 질량 차이가 기울기에 드러나게 한다.
          const seesaw = Bodies.rectangle(400, 630, 520, 18, {
            density: 0.003,
            restitution: ink.restitution,
            friction: ink.friction,
            frictionAir: 0.003,
            collisionFilter: {
              category: ink.category,
              mask: ink.category | WORLD_CATEGORY,
            },
          });
          Body.rotate(seesaw, -0.08);
          Body.setStatic(seesaw, true);
          seesaw.shapeData = { type: 'rect', w: 520, h: 18 };

          const pivot = Constraint.create({
            pointA: { x: 400, y: 630 },
            bodyB: seesaw,
            pointB: { x: 0, y: 0 },
            length: 0,
            stiffness: 1,
            damping: 0.08,
          });

          const objects = TOWER_DEFS.map(definition => createTowerBody(definition, ink));
          World.add(world, [seesaw, pivot, ...objects]);
          return { ink, inkIndex: INKS.indexOf(ink), seesaw, pivot, seesawReleased: false, objects };
        });
      }

      function createTowerBody(definition, ink) {
        const options = {
          density: ink.density,
          restitution: ink.restitution,
          friction: ink.friction,
          frictionAir: 0.012,
          collisionFilter: {
            category: ink.category,
            // 고정된 도형은 움직이는 도형을 붙잡지 않는다. 해제 순간 충돌을 켠다.
            mask: 0,
          },
        };

        let body;
        if (definition.type === 'rect') {
          body = Bodies.rectangle(
            definition.x,
            definition.y,
            definition.w,
            definition.h,
            options,
          );
          body.shapeData = { type: 'rect', w: definition.w, h: definition.h };
        } else if (definition.type === 'circle') {
          body = Bodies.circle(definition.x, definition.y, definition.d / 2, options);
          body.shapeData = { type: 'circle', d: definition.d };
        } else {
          body = Bodies.polygon(definition.x, definition.y, 3, definition.r, options);
          body.shapeData = { type: 'triangle' };
        }

        if (definition.angle) Body.rotate(body, definition.angle);
        Body.setStatic(body, true);
        body.released = false;
        body.removed = false;
        return body;
      }

      function releaseAccordingToTimeline(elapsed) {
        if (elapsed >= SEESAW_RELEASE_TIME) {
          layers.forEach(layer => {
            if (layer.seesawReleased) return;
            Body.setStatic(layer.seesaw, false);
            Body.setAngularVelocity(layer.seesaw, 0);
            layer.seesawReleased = true;
          });
        }

        layers.forEach(layer => {
          layer.objects.forEach((body, position) => {
            const releaseTime = FIRST_OBJECT_RELEASE + position * RELEASE_INTERVAL;
            if (elapsed < releaseTime || body.released || body.removed) return;
            body.collisionFilter.mask = layer.ink.category | WORLD_CATEGORY;
            Body.setStatic(body, false);
            body.released = true;
          });
        });
      }

      function removeEscapedBodies() {
        layers.forEach(layer => {
          layer.objects.forEach(body => {
            if (body.removed || body.isStatic) return;
            const outside = body.position.y > CANVAS_H + 260
              || body.position.x < -360
              || body.position.x > CANVAS_W + 360;
            if (!outside) return;
            World.remove(world, body);
            body.removed = true;
          });
        });
      }

      function drawInkShape(target, body, shape, rgb, alpha) {
        if (!body || body.removed) return;
        target.push();
        target.noStroke();
        target.fill(rgb[0], rgb[1], rgb[2], alpha);

        if (shape.type === 'triangle') {
          const vertices = body.vertices;
          target.triangle(
            vertices[0].x,
            vertices[0].y,
            vertices[1].x,
            vertices[1].y,
            vertices[2].x,
            vertices[2].y,
          );
        } else {
          target.translate(body.position.x, body.position.y);
          target.rotate(body.angle);
          if (shape.type === 'circle') target.ellipse(0, 0, shape.d, shape.d);
          else target.rect(0, 0, shape.w, shape.h);
        }
        target.pop();
      }

      function inkAlpha(layer, shapeIndex) {
        // 네 판은 같은 좌표를 유지하되, 도형마다 주 잉크와 옅은 밑인쇄를 구분한다.
        // 네 색을 모두 진하게 곱해 검은 덩어리가 되는 대신 잉크색이 남는다.
        if (layer.inkIndex === shapeIndex % INKS.length) return PRIMARY_ALPHA;
        const body = layer.objects[shapeIndex] || layer.seesaw;
        const span = body.shapeData.w || body.shapeData.d || 108;
        const nearest = Math.min(...layers.filter(other => other !== layer).map(other => {
          const peer = other.objects[shapeIndex] || other.seesaw;
          if (peer.removed) return span;
          return Math.hypot(body.position.x - peer.position.x, body.position.y - peer.position.y)
            + Math.abs(Math.sin(body.angle - peer.angle)) * span * 0.4;
        }));
        // 물리적으로 판이 벌어지면 밑인쇄도 원래 잉크 농도로 드러난다.
        return p.lerp(UNDERPRINT_ALPHA, 170, p.constrain(nearest / span, 0, 1));
      }

      function drawEnvironment(target) {
        INKS.forEach((ink, index) => {
          target.noStroke();
          target.fill(ink.rgb[0], ink.rgb[1], ink.rgb[2], 180);
          // 공통 바닥은 네 색의 띠를 조금씩 겹쳐 인쇄한다.
          target.rect(floorBody.position.x, 1037 + index * 22, 900, 28);
          pinBodies.forEach((pin, pinIndex) => {
            target.fill(...ink.rgb, index === pinIndex % INKS.length ? PRIMARY_ALPHA : UNDERPRINT_ALPHA);
            target.ellipse(pin.position.x, pin.position.y, pin.drawRadius * 2, pin.drawRadius * 2);
          });
          target.fill(...ink.rgb, index === 3 ? PRIMARY_ALPHA : UNDERPRINT_ALPHA);
          target.ellipse(400, 630, 22, 22);
        });
      }

      function drawCurrentBodies() {
        layers.forEach(layer => {
          drawInkShape(p, layer.seesaw, layer.seesaw.shapeData, layer.ink.rgb, inkAlpha(layer, TOWER_DEFS.length));
          layer.objects.forEach((body, index) => {
            drawInkShape(p, body, body.shapeData, layer.ink.rgb, inkAlpha(layer, index));
          });
        });
      }

      function drawPaperGrain() {
        const x = -3 + (p.frameCount % 4);
        const y = -3 + ((p.frameCount * 3) % 4);
        p.push();
        p.blendMode(p.BLEND);
        p.image(grainLayer, x, y);
        p.pop();
      }

      function updateStatus(elapsed) {
        const phase = elapsed < SEESAW_RELEASE_TIME
          ? 'REGISTERED'
          : (elapsed < END_TIME ? 'MISREGISTERING' : 'FINAL IMPRESSION');
        const seconds = Math.min(Math.floor(elapsed), END_TIME);
        const next = `${phase} / 00:${String(seconds).padStart(2, '0')}`;
        if (next !== lastStatus) {
          statusNode.textContent = next;
          lastStatus = next;
        }
      }

      p.draw = () => {
        const elapsed = (p.millis() - startMillis) / 1000;
        releaseAccordingToTimeline(elapsed);
        Engine.update(engine, 1000 / 60);
        removeEscapedBodies();

        p.blendMode(p.BLEND);
        p.background(PAPER);
        p.blendMode(p.MULTIPLY);
        drawEnvironment(p);
        drawCurrentBodies();
        drawPaperGrain();
        updateStatus(elapsed);

        if (elapsed >= END_TIME && !finished) {
          finished = true;
          updateStatus(END_TIME);
          p.noLoop();
        }
      };

      p.keyPressed = () => {
        if (p.key === 's' || p.key === 'S') p.saveCanvas('dynamic-riso', 'png');
      };
    };
  }

  return { mount };
})();
