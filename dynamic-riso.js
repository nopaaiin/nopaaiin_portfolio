// DYNAMIC RISO
// p5.js + Matter.js 인스턴스 모드로 포트폴리오의 다른 스크립트와 격리한다.

window.DynamicRiso = (() => {
  const CANVAS_W = 800;
  const CANVAS_H = 1100;
  const PAPER = '#F2EEE5';
  const WORLD_CATEGORY = 0x0010;
  const END_TIME = 18;
  const SEESAW_RELEASE_TIME = 2;
  const FIRST_OBJECT_RELEASE = 2.25;
  const RELEASE_INTERVAL = 0.3;

  const INKS = [
    {
      name: 'Fluorescent Pink',
      rgb: [255, 72, 176],
      density: 0.001,
      restitution: 0.9,
      friction: 0,
      category: 0x0001,
    },
    {
      name: 'Orange',
      rgb: [255, 108, 47],
      density: 0.002,
      restitution: 0.6,
      friction: 0.2,
      category: 0x0002,
    },
    {
      name: 'Green',
      rgb: [0, 169, 92],
      density: 0.004,
      restitution: 0.3,
      friction: 0.5,
      category: 0x0004,
    },
    {
      name: 'Blue',
      rgb: [0, 120, 191],
      density: 0.008,
      restitution: 0.05,
      friction: 1,
      category: 0x0008,
    },
  ];

  const ALL_LAYER_CATEGORIES = INKS.reduce((mask, ink) => mask | ink.category, 0);

  // 배열 순서가 위에서 아래로 해제되는 순서다.
  const TOWER_DEFS = [
    { type: 'circle', x: 354, y: 242, d: 104 },
    { type: 'triangle', x: 432, y: 335, r: 54, angle: -Math.PI / 2 },
    { type: 'rect', x: 348, y: 402, w: 62, h: 62, angle: 0 },
    { type: 'rect', x: 408, y: 450, w: 220, h: 28, angle: 0.035 },
    { type: 'circle', x: 468, y: 510, d: 90 },
    { type: 'rect', x: 400, y: 588, w: 190, h: 64, angle: 0 },
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
      let trailLayer;
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

        trailLayer = p.createGraphics(CANVAS_W, CANVAS_H);
        trailLayer.pixelDensity(1);
        trailLayer.clear();
        trailLayer.rectMode(p.CENTER);
        trailLayer.ellipseMode(p.CENTER);
        trailLayer.blendMode(p.MULTIPLY);

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

        // 한 번 만든 노이즈 점을 프레임마다 조금씩 이동해 종이 결을 만든다.
        for (let i = 0; i < 6500; i += 1) {
          const x = p.random(grainLayer.width);
          const y = p.random(grainLayer.height);
          const size = p.random(0.6, 1.7);
          const texture = p.noise(x * 0.018, y * 0.018);
          if (p.random() < 0.82) {
            grainLayer.fill(45, 38, 31, p.map(texture, 0, 1, 3, 10));
          } else {
            grainLayer.fill(255, 255, 250, p.map(texture, 0, 1, 4, 13));
          }
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
        World.add(world, floorBody);

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
          return { ink, seesaw, pivot, seesawReleased: false, objects };
        });
      }

      function createTowerBody(definition, ink) {
        const options = {
          density: ink.density,
          restitution: ink.restitution,
          friction: ink.friction,
          frictionAir: 0.002,
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

      function drawEnvironment(target, alpha) {
        INKS.forEach(ink => {
          target.noStroke();
          target.fill(ink.rgb[0], ink.rgb[1], ink.rgb[2], alpha);
          target.rect(floorBody.position.x, floorBody.position.y, 900, 90);
          pinBodies.forEach(pin => {
            target.ellipse(pin.position.x, pin.position.y, pin.drawRadius * 2, pin.drawRadius * 2);
          });
          target.ellipse(400, 630, 22, 22);
        });
      }

      function recordTrails(elapsed) {
        if (elapsed < SEESAW_RELEASE_TIME || p.frameCount % 3 !== 0) return;
        layers.forEach(layer => {
          const bodies = [layer.seesaw, ...layer.objects];
          bodies.forEach(body => {
            if (!body || body.removed || body.isStatic) return;
            drawInkShape(trailLayer, body, body.shapeData, layer.ink.rgb, 9);
          });
        });
      }

      function drawTitle(target) {
        const offsets = [
          [-2, -1],
          [1, -2],
          [-1, 2],
          [2, 1],
        ];
        target.push();
        target.textFont('Arial, Helvetica, sans-serif');
        target.textSize(17);
        target.textStyle(p.BOLD);
        target.textAlign(p.LEFT, p.BASELINE);
        INKS.forEach((ink, position) => {
          target.fill(ink.rgb[0], ink.rgb[1], ink.rgb[2], 205);
          target.noStroke();
          target.text(
            'DYNAMIC BALANCE',
            54 + offsets[position][0],
            72 + offsets[position][1],
          );
        });
        target.pop();
      }

      function drawCurrentBodies() {
        layers.forEach(layer => {
          drawInkShape(p, layer.seesaw, layer.seesaw.shapeData, layer.ink.rgb, 205);
          layer.objects.forEach(body => {
            drawInkShape(p, body, body.shapeData, layer.ink.rgb, 205);
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
        recordTrails(elapsed);

        p.blendMode(p.BLEND);
        p.background(PAPER);
        p.image(trailLayer, 0, 0);
        p.blendMode(p.MULTIPLY);
        drawEnvironment(p, 190);
        drawCurrentBodies();
        drawTitle(p);
        drawPaperGrain();
        updateStatus(elapsed);

        if (elapsed >= END_TIME && !finished) {
          finished = true;
          updateStatus(END_TIME);
          p.noLoop();
        }
      };

      p.keyPressed = () => {
        if (p.key === 's' || p.key === 'S') p.saveCanvas('dynamic-riso-final', 'png');
      };
    };
  }

  return { mount };
})();
