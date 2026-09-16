// 이미지 파일을 images/work-01.jpg ~ images/work-48.jpg 이름으로 넣으면
// 아래 가상 카드가 실제 이미지로 자동 교체됩니다.
const IMAGE_PATHS = Array.from(
  { length: 48 },
  (_, index) => `images/work-${String(index + 1).padStart(2, "0")}.jpg`,
);

// 카드에 표시할 프로젝트명입니다. 원하는 문구로 수정하세요.
const PROJECTS = [
  "FORME", "KIEHL'S", "VELUNE", "BRITZ", "NEW BALANCE", "F W E E",
  "CAMPAIGN", "EDITORIAL", "RAWUMBER", "ALLFORHOME", "FORME / 02", "KIEHL'S / 02",
  "VELUNE / 02", "BRITZ / 02", "POSTER / 01", "BANNER / 01", "FORME / 03", "KIEHL'S / 03",
  "VELUNE / 03", "BRITZ / 03", "POSTER / 02", "BANNER / 02", "FORME / 04", "KIEHL'S / 04",
  "DETAIL / 01", "DETAIL / 02", "VISUAL / 01", "VISUAL / 02", "POP-UP", "IDENTITY",
  "WEB UI", "PUBLISHING",
];

const PALETTES = [
  ["#d9dde0", "#3d4a52", "#11181d"],
  ["#f0e8d9", "#b57654", "#2c1d1a"],
  ["#e8efdc", "#7d9b83", "#293832"],
  ["#dce8ed", "#7692a5", "#14242d"],
  ["#f2d8dc", "#d85468", "#641d2b"],
  ["#f2eee9", "#8d8278", "#292522"],
  ["#d4d9c8", "#697362", "#252b23"],
  ["#d9d7cf", "#6d7074", "#202225"],
];

// 위도별 카드 개수: 6 + 11 + 14 + 11 + 6 = 총 48장
const ROWS = [
  { latitude: 56, count: 6 },
  { latitude: 28, count: 11 },
  { latitude: 0, count: 14 },
  { latitude: -28, count: 11 },
  { latitude: -56, count: 6 },
];

// 숫자를 작게 하면 이미지와 이미지 사이의 간격이 넓어집니다.
// 숫자를 크게 하면 이미지가 커지고 간격이 좁아집니다.
const TILE_SPAN = 12;

const mount = document.querySelector("#portfolio-globe");
const heroScroll = document.querySelector(".hero-scroll");
const hero = document.querySelector(".hero");

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

function smoothStep(edgeStart, edgeEnd, value) {
  const progress = clamp01((value - edgeStart) / (edgeEnd - edgeStart));
  return progress * progress * (3 - 2 * progress);
}

// 같은 이미지가 새로고침할 때마다 다른 방향으로 튀지 않도록 고정 난수를 사용합니다.
function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function makePlaceholderTexture(title, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 384;
  const context = canvas.getContext("2d");

  const palette = PALETTES[index % PALETTES.length];
  const gradient = context.createLinearGradient(0, 0, 384, 384);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.62, palette[1]);
  gradient.addColorStop(1, palette[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 384, 384);

  context.globalAlpha = 0.3;
  context.fillStyle = index % 2 ? "#ffffff" : "#071017";
  if (index % 3 === 0) {
    context.beginPath();
    context.arc(264, 116, 92, 0, Math.PI * 2);
    context.fill();
  } else if (index % 3 === 1) {
    context.fillRect(168, 34, 142, 260);
  } else {
    context.save();
    context.translate(205, 190);
    context.rotate(-0.42);
    context.fillRect(-62, -180, 124, 360);
    context.restore();
  }

  context.globalAlpha = 1;
  context.strokeStyle = "rgba(255,255,255,.58)";
  context.lineWidth = 2;
  context.strokeRect(18, 18, 348, 348);
  context.fillStyle = "rgba(255,255,255,.94)";
  context.font = "700 17px Arial";
  context.fillText(String(index + 1).padStart(2, "0"), 34, 50);
  context.font = "700 25px Arial";
  title.split(" ").forEach((word, wordIndex) => context.fillText(word, 34, 288 + wordIndex * 30));
  context.font = "12px Arial";
  context.fillText("SELECTED WORK / 2026", 34, 350);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 원본 이미지가 직사각형이어도 늘리지 않고 중앙을 정사각형으로 잘라 사용합니다.
function makeSquareTexture(image) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePatchGeometry(radius, latitudeCenter, longitudeCenter, latitudeSpan, longitudeSpan) {
  const columns = 12;
  const rows = 9;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const toRadians = Math.PI / 180;

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const latitude = (latitudeCenter + (0.5 - v) * latitudeSpan) * toRadians;

    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const longitude = (longitudeCenter + (u - 0.5) * longitudeSpan) * toRadians;
      const cosLatitude = Math.cos(latitude);
      const x = radius * cosLatitude * Math.sin(longitude);
      const y = radius * Math.sin(latitude);
      const z = radius * cosLatitude * Math.cos(longitude);
      positions.push(x, y, z);

      const normal = new THREE.Vector3(x, y, z).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, 1 - v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function showFallback() {
  mount.innerHTML = "";
  const fallback = document.createElement("div");
  fallback.className = "portfolio-globe__fallback";
  fallback.setAttribute("aria-hidden", "true");
  const cells = Array.from({ length: 36 }, (_, index) => index)
    .filter((index) => ![0, 5, 30, 35].includes(index));

  cells.forEach((cell, index) => {
    const tile = document.createElement("span");
    const palette = PALETTES[index % PALETTES.length];
    tile.className = "portfolio-globe__tile";
    tile.style.gridColumn = String((cell % 6) + 1);
    tile.style.gridRow = String(Math.floor(cell / 6) + 1);
    tile.style.background = `linear-gradient(135deg, ${palette[0]}, ${palette[1]} 62%, ${palette[2]})`;
    tile.innerHTML = `<small>${String(index + 1).padStart(2, "0")}</small><b>${PROJECTS[index]}</b>`;
    fallback.appendChild(tile);
  });

  mount.appendChild(fallback);
}

function startGlobe() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.z = 8.2;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    showFallback();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const globe = new THREE.Group();
  globe.rotation.x = -0.08;
  globe.rotation.y = -0.42;
  scene.add(globe);

  const loader = new THREE.TextureLoader();
  const tiles = [];
  let projectIndex = 0;

  ROWS.forEach((row, rowIndex) => {
    const step = 360 / row.count;
    const offset = rowIndex % 2 ? step * 0.5 : 0;

    for (let item = 0; item < row.count; item += 1) {
      const index = projectIndex;
      const placeholder = makePlaceholderTexture(PROJECTS[index % PROJECTS.length], index);
      // 위쪽과 아래쪽은 구 둘레가 짧아지므로 가로 각도를 자동으로 보정합니다.
      const longitudeSpan = TILE_SPAN / Math.cos(THREE.MathUtils.degToRad(row.latitude));
      const geometry = makePatchGeometry(
        2.31,
        row.latitude,
        item * step + offset,
        TILE_SPAN,
        longitudeSpan,
      );
      const material = new THREE.MeshBasicMaterial({
        map: placeholder,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 2;

      const longitudeCenter = item * step + offset;
      const latitudeRadians = THREE.MathUtils.degToRad(row.latitude);
      const longitudeRadians = THREE.MathUtils.degToRad(longitudeCenter);
      const direction = new THREE.Vector3(
        Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
        Math.sin(latitudeRadians),
        Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
      );
      const randomAngle = seededRandom(index + 67) * Math.PI * 2;
      const screenLength = Math.hypot(direction.x, direction.y);
      const outwardX = screenLength > 0.22 ? direction.x / screenLength : Math.cos(randomAngle);
      const outwardY = screenLength > 0.22 ? direction.y / screenLength : Math.sin(randomAngle);
      const horizontalSpread = 2.4 + seededRandom(index + 1) * 3.5;
      const verticalSpread = 1.8 + seededRandom(index + 11) * 2.7;

      mesh.userData.scatterTarget = new THREE.Vector3(
        outwardX * horizontalSpread + (seededRandom(index + 19) - 0.5) * 0.8,
        outwardY * verticalSpread + (seededRandom(index + 29) - 0.5) * 0.65,
        direction.z * (0.5 + seededRandom(index + 37) * 1.15),
      );
      mesh.userData.scatterDelay = seededRandom(index + 53) * 0.13;
      tiles.push(mesh);
      globe.add(mesh);

      loader.load(
        IMAGE_PATHS[index],
        (loadedTexture) => {
          const texture = makeSquareTexture(loadedTexture.image);
          loadedTexture.dispose();
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
          placeholder.dispose();
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        () => {},
      );

      projectIndex += 1;
    }
  });

  scene.add(new THREE.HemisphereLight(0xd9e7ee, 0x050607, 1.35));
  const rim = new THREE.DirectionalLight(0xe8f6ff, 2.1);
  rim.position.set(-4, 5, 5);
  scene.add(rim);

  const resize = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.position.z = width < 640 ? 17.2 : width < 900 ? 15.2 : 13.8;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(mount);

  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let velocityX = 0;
  let velocityY = 0;
  let rotationX = globe.rotation.x;
  let rotationY = globe.rotation.y;
  let scrollTarget = 0;
  let scrollProgress = 0;

  const updateScrollTarget = () => {
    if (!heroScroll || reducedMotion.matches) {
      scrollTarget = 0;
      return;
    }

    const bounds = heroScroll.getBoundingClientRect();
    const scrollDistance = Math.max(bounds.height - window.innerHeight, 1);
    scrollTarget = clamp01(-bounds.top / scrollDistance);
  };

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (scrollProgress > 0.1) return;
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    velocityX = 0;
    velocityY = 0;
    renderer.domElement.setPointerCapture(event.pointerId);
    mount.dataset.dragging = "true";
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - previousX;
    const deltaY = event.clientY - previousY;
    velocityY = deltaX * 0.0045;
    velocityX = deltaY * 0.0032;
    rotationY += velocityY;
    rotationX = THREE.MathUtils.clamp(rotationX + velocityX, -0.72, 0.72);
    previousX = event.clientX;
    previousY = event.clientY;
  });

  const stopDragging = (event) => {
    dragging = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    mount.dataset.dragging = "false";
  };

  renderer.domElement.addEventListener("pointerup", stopDragging);
  renderer.domElement.addEventListener("pointercancel", stopDragging);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clock = new THREE.Clock();

  window.addEventListener("scroll", updateScrollTarget, { passive: true });
  window.addEventListener("resize", updateScrollTarget);
  updateScrollTarget();

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.035);
    scrollProgress = THREE.MathUtils.lerp(
      scrollProgress,
      scrollTarget,
      1 - Math.pow(0.001, delta),
    );
    const scatterProgress = smoothStep(0.08, 0.86, scrollProgress);

    if (!dragging) {
      rotationY += reducedMotion.matches ? 0 : delta * 0.13 * (1 - scatterProgress);
      rotationY += velocityY;
      rotationX = THREE.MathUtils.clamp(rotationX + velocityX, -0.72, 0.72);
      velocityX *= 0.93;
      velocityY *= 0.93;
    }

    tiles.forEach((tile) => {
      const tileProgress = smoothStep(
        0.08 + tile.userData.scatterDelay,
        0.8 + tile.userData.scatterDelay * 0.4,
        scrollProgress,
      );
      tile.position.copy(tile.userData.scatterTarget).multiplyScalar(tileProgress);
      tile.material.opacity = 1 - smoothStep(
        0.82 + tile.userData.scatterDelay * 0.18,
        1,
        scrollProgress,
      );
    });

    const rotationEase = 1 - Math.pow(1 - scatterProgress, 2);
    globe.rotation.x = THREE.MathUtils.lerp(
      globe.rotation.x,
      rotationX + rotationEase * 0.08,
      0.12,
    );
    globe.rotation.y = THREE.MathUtils.lerp(
      globe.rotation.y,
      rotationY + rotationEase * 0.5,
      0.15,
    );
    globe.position.y = 0;

    if (hero) {
      const copyFade = smoothStep(0.04, 0.28, scrollProgress);
      hero.style.setProperty("--hero-copy-opacity", String(1 - copyFade));
      hero.style.setProperty("--hero-motion", String(copyFade));
      // 흩어진 이미지가 완전히 사라지는 지점과 흰 화면 전환의 끝을 맞춰
      // 빈 흰 화면이 머물지 않고 바로 About 섹션으로 이어지게 합니다.
      hero.style.setProperty("--hero-white", String(smoothStep(0.52, 1, scrollProgress)));
      hero.style.setProperty("--about-rail-opacity", String(smoothStep(0.84, 1, scrollProgress)));
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

if (mount && window.THREE) {
  try {
    startGlobe();
  } catch (error) {
    console.error("Portfolio globe could not start.", error);
    showFallback();
  }
} else if (mount) {
  showFallback();
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealTargets = document.querySelectorAll(".reveal");

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
}

const transitionImage = document.querySelector(".profile-transition > img");
const transitionSection = document.querySelector(".profile-transition");

if (!prefersReducedMotion && transitionImage && transitionSection) {
  let framePending = false;

  const updateParallax = () => {
    const rect = transitionSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const progress = Math.max(
      0,
      Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)),
    );

    transitionImage.style.transform =
      `scale(1.06) translate3d(0, ${(progress - 0.5) * 22}px, 0)`;
    framePending = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(updateParallax);
    },
    { passive: true },
  );

  updateParallax();
}
