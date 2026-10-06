(() => {
  const globe = document.getElementById("globe");
  const stars = document.getElementById("stars");
  if (!globe) return;

  const gctx = globe.getContext("2d");
  const sctx = stars.getContext("2d");

  const POINTS = 1400;
  const sparks = [];
  const starfield = [];

  function fibSphere(n) {
    const pts = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const lat = Math.asin(y);
      const lon = Math.atan2(z, x);
      const land = isLand(lat, lon);
      pts.push({ x, y, z, land, hot: land && Math.random() > 0.55 });
    }
    return pts;
  }

  function isLand(lat, lon) {
    const n =
      Math.sin(lat * 3.2 + lon * 1.7) +
      Math.sin(lat * 6.1 - lon * 2.4) * 0.5 +
      Math.sin(lon * 4.8) * 0.35;
    if (lat > 1.25 || lat < -1.15) return false;
    return n > 0.15;
  }

  const globePts = fibSphere(POINTS);

  function resizeStars() {
    stars.width = window.innerWidth * devicePixelRatio;
    stars.height = window.innerHeight * devicePixelRatio;
    stars.style.width = "100%";
    stars.style.height = "100%";
    starfield.length = 0;
    const count = Math.floor((window.innerWidth * window.innerHeight) / 4500);
    for (let i = 0; i < count; i++) {
      starfield.push({
        x: Math.random() * stars.width,
        y: Math.random() * stars.height,
        r: Math.random() * 1.4 * devicePixelRatio,
        a: Math.random() * 0.7 + 0.1,
        s: Math.random() * 0.4 + 0.1
      });
    }
  }

  function spawnSpark() {
    const a = Math.random() * Math.PI * 2;
    const tilt = (Math.random() - 0.5) * 0.9;
    sparks.push({
      a,
      tilt,
      life: 0,
      max: 80 + Math.random() * 70,
      speed: 0.8 + Math.random() * 1.4,
      hue: Math.random() > 0.45 ? "cyan" : "pink"
    });
  }

  let rot = 0;
  let last = 0;

  function project(p, w, rotY) {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const x = p.x * cos - p.z * sin;
    const z = p.x * sin + p.z * cos;
    const y = p.y;
    const persp = 1.35 / (2.1 - z);
    return { x: w / 2 + x * w * 0.33 * persp, y: w / 2 + y * w * 0.33 * persp, z, persp };
  }

  function frame(t) {
    const dt = Math.min(32, t - last || 16);
    last = t;
    rot += dt * 0.00018;

    sctx.clearRect(0, 0, stars.width, stars.height);
    for (const s of starfield) {
      s.a += Math.sin(t * 0.002 + s.x) * 0.002;
      sctx.fillStyle = `rgba(200,220,255,${Math.max(0.05, Math.min(0.9, s.a))})`;
      sctx.beginPath();
      sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      sctx.fill();
    }

    const w = globe.width;
    gctx.clearRect(0, 0, w, w);

    const cx = w / 2;
    const cy = w / 2;
    const grd = gctx.createRadialGradient(cx, cy, w * 0.08, cx, cy, w * 0.42);
    grd.addColorStop(0, "rgba(40, 90, 180, 0.28)");
    grd.addColorStop(0.55, "rgba(20, 30, 90, 0.18)");
    grd.addColorStop(1, "rgba(8, 10, 30, 0)");
    gctx.fillStyle = grd;
    gctx.beginPath();
    gctx.arc(cx, cy, w * 0.36, 0, Math.PI * 2);
    gctx.fill();

    gctx.strokeStyle = "rgba(92, 225, 255, 0.35)";
    gctx.lineWidth = 2.5;
    gctx.beginPath();
    gctx.arc(cx, cy, w * 0.335, 0, Math.PI * 2);
    gctx.stroke();
    gctx.strokeStyle = "rgba(180, 120, 255, 0.18)";
    gctx.lineWidth = 8;
    gctx.stroke();

    const projected = globePts.map((p) => ({ p, q: project(p, w, rot) }));
    projected.sort((a, b) => a.q.z - b.q.z);

    const front = [];
    for (const { p, q } of projected) {
      if (q.z < -0.08) continue;
      const alpha = (q.z + 1) / 2;
      const size = (p.hot ? 2.1 : p.land ? 1.45 : 0.9) * q.persp * (w / 720) * 1.6;
      if (p.hot) gctx.fillStyle = `rgba(255, 90, 220, ${0.35 + alpha * 0.65})`;
      else if (p.land) gctx.fillStyle = `rgba(170, 230, 255, ${0.25 + alpha * 0.7})`;
      else gctx.fillStyle = `rgba(90, 140, 220, ${0.08 + alpha * 0.22})`;
      gctx.beginPath();
      gctx.arc(q.x, q.y, size, 0, Math.PI * 2);
      gctx.fill();
      if (p.hot && q.z > 0.15) front.push(q);
    }

    gctx.lineWidth = 0.7;
    for (let i = 0; i < front.length; i++) {
      const a = front[i];
      for (let j = i + 1; j < Math.min(i + 8, front.length); j++) {
        const b = front[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = dx * dx + dy * dy;
        if (d < 900 * (w / 720) * (w / 720)) {
          gctx.strokeStyle = "rgba(200, 120, 255, 0.18)";
          gctx.beginPath();
          gctx.moveTo(a.x, a.y);
          gctx.lineTo(b.x, b.y);
          gctx.stroke();
        }
      }
    }

    if (sparks.length < 28 && Math.random() > 0.4) spawnSpark();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += s.speed;
      const u = s.life / s.max;
      if (u >= 1) {
        sparks.splice(i, 1);
        continue;
      }
      const radius = w * (0.34 + u * 0.28);
      const x = cx + Math.cos(s.a + rot * 0.4) * radius;
      const y = cy + Math.sin(s.a + rot * 0.4) * radius * (0.55 + s.tilt * 0.2) - u * 30;
      const col = s.hue === "cyan" ? `rgba(92,225,255,${1 - u})` : `rgba(232,121,249,${1 - u})`;
      gctx.fillStyle = col;
      gctx.beginPath();
      gctx.arc(x, y, (1.2 + (1 - u) * 1.8) * (w / 720), 0, Math.PI * 2);
      gctx.fill();
    }

    requestAnimationFrame(frame);
  }

  function fitGlobe() {
    const size = Math.min(720, Math.floor(globe.parentElement.clientWidth));
    globe.width = size;
    globe.height = size;
  }

  window.addEventListener("resize", () => {
    resizeStars();
    fitGlobe();
  });
  resizeStars();
  fitGlobe();
  requestAnimationFrame(frame);
})();
