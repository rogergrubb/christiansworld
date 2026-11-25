// Effects that sit on top of the world: glows and headlights at night, dust, smoke and skid marks.
import * as THREE from './three.js';
import { CURB, WATER_Y } from './world.js';
import { clamp } from './util.js';

function radialTexture(stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, a] of stops) gr.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW = () => radialTexture([[0, 1], [0.18, 0.75], [0.45, 0.22], [1, 0]]);
let glowTex = null;
// One soft round glow shared by anything that wants a light sprite.
export function glowTexture() { return glowTex || (glowTex = GLOW()); }

// Camera-facing glows drawn in one call. Each has a position, size in metres, colour and strength.
// With { flat: true } they lie on the ground instead; with { blending: THREE.NormalBlending } they are smoke, not light.
export class Glows {
  constructor(scene, max, map, o = {}) {
    this.max = max; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.at = new Float32Array(max * 4); this.tint = new Float32Array(max * 4);
    g.setAttribute('at', this.aAt = new THREE.InstancedBufferAttribute(this.at, 4));       // xyz + size
    g.setAttribute('tint', this.aTint = new THREE.InstancedBufferAttribute(this.tint, 4)); // rgb + strength
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, opacity: { value: 1 }, light: { value: new THREE.Color(1, 1, 1) } },
      transparent: true, depthWrite: false, blending: o.blending ?? THREE.AdditiveBlending, fog: false,
      vertexShader: `
        attribute vec4 at; attribute vec4 tint; varying vec2 vUv; varying vec4 vT;
        void main(){ vUv = uv; vT = tint; ${o.flat
          ? 'vec4 mv = viewMatrix * vec4(at.xyz + vec3(position.x, 0.0, position.y) * at.w, 1.0);'
          : 'vec4 mv = viewMatrix * vec4(at.xyz, 1.0); mv.xy += position.xy * at.w;'} gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; uniform float opacity; uniform vec3 light; varying vec2 vUv; varying vec4 vT;
        void main(){ float a = texture2D(map, vUv).a * vT.a * opacity; if (a < 0.004) discard; gl_FragColor = vec4(vT.rgb * light, a); }`,
      side: o.flat ? THREE.DoubleSide : THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    scene.add(this.mesh);
  }
  clear() { this.n = 0; }
  add(x, y, z, size, r, g, b, strength = 1) {
    if (this.n >= this.max) return;
    const k = this.n++ * 4;
    this.at[k] = x; this.at[k + 1] = y; this.at[k + 2] = z; this.at[k + 3] = size;
    this.tint[k] = r; this.tint[k + 1] = g; this.tint[k + 2] = b; this.tint[k + 3] = strength;
  }
  commit() { this.mesh.geometry.instanceCount = this.n; this.aAt.needsUpdate = true; this.aTint.needsUpdate = true; this.mesh.visible = this.n > 0; }
}

// Everything that lights up after dark.
export class NightLights {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    const map = GLOW();
    // street lamps and other fixed lights
    const L = world.lights;
    this.fixed = new Glows(scene, L.length + 4, map);
    for (const l of L) this.fixed.add(l.x, l.y, l.z, l.size ?? 7, l.r ?? 1, l.g ?? 0.86, l.b ?? 0.6, l.power ?? 0.9);
    this.fixed.commit();
    // pools of light on the ground under the lamps
    const pos = [], uv = [], idx = [];
    L.filter((l) => l.pool).forEach((l, k) => {
      const s = l.pool, y = l.py ?? CURB + 0.07, b = k * 4;
      pos.push(l.px - s, y, l.pz - s, l.px + s, y, l.pz - s, l.px - s, y, l.pz + s, l.px + s, y, l.pz + s);
      uv.push(0, 0, 1, 0, 0, 1, 1, 1); idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pg.setIndex(idx);
    this.pools = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: radialTexture([[0, 0.9], [0.5, 0.4], [1, 0]]), color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    this.pools.renderOrder = 2; scene.add(this.pools);
    // moving lights: headlights and tail lights
    this.cars = new Glows(scene, 160, map);
    const beamTex = (() => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'), img = g.createImageData(64, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) { const u = (x / 63) * 2 - 1, v = y / 127; const a = Math.pow(1 - v, 1.3) * Math.max(0, 1 - u * u) * Math.min(1, v * 9); const k = (y * 64 + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = a * 255; }
      g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.beamGeo = new THREE.BufferGeometry();
    this.beamGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1.3, 0.14, 0, 1.3, 0.14, 0, -5.5, 0.14, 22, 5.5, 0.14, 22], 3));
    this.beamGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); this.beamGeo.setIndex([0, 2, 1, 1, 2, 3]);
    this.beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xfff0c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, side: THREE.DoubleSide });
    // one real light for the car the player is driving
    this.spot = new THREE.SpotLight(0xfff1cf, 0, 85, 0.62, 0.75, 1.15);
    this.spotTarget = new THREE.Object3D(); this.spot.target = this.spotTarget;
    scene.add(this.spot, this.spotTarget);
    // the lighthouse sweeps a beam around
    const b = world.POI.beach.lighthouse;
    this.beacon = new THREE.Mesh(new THREE.ConeGeometry(9, 150, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.beacon.geometry.translate(0, -75, 0); this.beacon.geometry.rotateX(-Math.PI / 2 + 0.045);
    this.beaconPivot = new THREE.Group(); this.beaconPivot.position.set(b.x, 28, b.z); this.beaconPivot.add(this.beacon); scene.add(this.beaconPivot);
  }
  beamFor(v) {
    if (v.beam) return v.beam;
    const m = new THREE.Mesh(this.beamGeo, this.beamMat); m.position.z = v.spec.len / 2 + 0.2; m.renderOrder = 3; m.visible = false;
    v.group.add(m); v.beam = m; return m;
  }
  update(dt, t, night, vlist, driven, fx, fz) {
    const w = this.world;
    this.fixed.mat.uniforms.opacity.value = night; this.fixed.mesh.visible = night > 0.02;
    this.pools.material.opacity = night * 0.5; this.pools.visible = night > 0.02;
    w.setNight(night);
    this.beaconPivot.visible = night > 0.05; this.beacon.material.opacity = night * 0.16; this.beaconPivot.rotation.y = t * 0.7;
    const cars = this.cars; cars.clear();
    this.beamMat.opacity = night * 0.42;
    const lit = night > 0.12;
    for (const v of vlist) {
      const active = (v.driver || v.ai) && !v.noLights, near = Math.abs(v.pos.x - fx) < 260 && Math.abs(v.pos.z - fz) < 260;
      if (v.beam || (lit && active && near && v.spec.wr)) this.beamFor(v).visible = lit && active && near && !!v.spec.wr && v.onGround;
      if (!v.spec.wr) {
        // boats carry a bow lamp; the helicopter adds a blinking red tail beacon
        if (active && near && lit) {
          const hx = Math.sin(v.heading), hz = Math.cos(v.heading), heli = v.spec.style === 'heli';
          cars.add(v.pos.x + hx * v.spec.len * 0.42, v.pos.y + 0.95, v.pos.z + hz * v.spec.len * 0.42, 2.4, 1, 0.95, 0.78, night);
          if (heli && Math.sin(t * 7) > 0.1) cars.add(v.pos.x - hx * 4.3, v.pos.y + 2.5, v.pos.z - hz * 4.3, 2.4, 1, 0.1, 0.08, night);
        }
        continue;
      }
      if (!active || !near) continue;
      const s = v.spec, hx = Math.sin(v.heading), hz = Math.cos(v.heading), y = v.pos.y + v.curb + s.clr + Math.min(s.h, 0.8) * 0.62;
      const half = s.len / 2, wx = hz * s.wid * 0.33, wz = -hx * s.wid * 0.33;
      if (lit) for (const sgn of [-1, 1]) cars.add(v.pos.x + hx * (half + 0.1) + wx * sgn, y, v.pos.z + hz * (half + 0.1) + wz * sgn, 2.6, 1, 0.95, 0.78, night);
      const tail = v.braking ? 1 : night * 0.5;
      if (tail > 0.05) for (const sgn of [-1, 1]) cars.add(v.pos.x - hx * (half + 0.1) + wx * sgn, y + 0.03, v.pos.z - hz * (half + 0.1) + wz * sgn, v.braking ? 1.9 : 1.2, 1, 0.12, 0.08, tail);
    }
    cars.commit();
    // the real light follows the car you drive
    const sp = this.spot;
    if (driven && driven.spec.style === 'heli' && lit) {
      // searchlight: shines down and ahead of the helicopter
      const hx = Math.sin(driven.heading), hz = Math.cos(driven.heading), drop = Math.max(6, driven.alt || 0);
      sp.position.set(driven.pos.x + hx * 1.5, driven.pos.y + 0.4, driven.pos.z + hz * 1.5);
      this.spotTarget.position.set(driven.pos.x + hx * (8 + drop * 0.35), driven.pos.y - drop, driven.pos.z + hz * (8 + drop * 0.35));
      sp.intensity = night * 260; sp.distance = 140;
    } else if (driven && lit) {
      sp.distance = 85;
      const hx = Math.sin(driven.heading), hz = Math.cos(driven.heading), y = driven.pos.y + driven.curb + 1.1;
      sp.position.set(driven.pos.x + hx * driven.spec.len * 0.45, y, driven.pos.z + hz * driven.spec.len * 0.45);
      this.spotTarget.position.set(driven.pos.x + hx * 30, y - 2.2, driven.pos.z + hz * 30);
      sp.intensity = night * 170;
    } else sp.intensity = 0;
  }
}

// Dust, smoke, spray and foam. Each puff has a position, a velocity, a lifetime, a start and end size and a colour.
// Puffs made with flat = true lie on the ground or the water (wakes, ripples) instead of facing the camera.
export class Particles {
  constructor(scene, max = 900) {
    this.max = max; this.head = 0; this.alive = 0;
    this.d = new Float32Array(max * 16);   // x y z  vx vy vz  age ttl  s0 s1  r g b a  grav flat
    const soft = radialTexture([[0, 1], [0.4, 0.7], [1, 0]]);
    this.soft = new Glows(scene, max, soft, { blending: THREE.NormalBlending });
    this.flat = new Glows(scene, max >> 1, radialTexture([[0, 0.75], [0.55, 0.6], [0.8, 0.35], [1, 0]]), { blending: THREE.NormalBlending, flat: true });
    this.soft.mesh.renderOrder = 5; this.flat.mesh.renderOrder = 4;
    this.soft.mesh.visible = this.flat.mesh.visible = false;
  }
  emit(x, y, z, vx, vy, vz, ttl, s0, s1, r, g, b, a = 1, grav = 0, flat = false) {
    const k = this.head * 16, d = this.d; this.head = (this.head + 1) % this.max;
    d[k] = x; d[k + 1] = y; d[k + 2] = z; d[k + 3] = vx; d[k + 4] = vy; d[k + 5] = vz; d[k + 6] = 0; d[k + 7] = ttl;
    d[k + 8] = s0; d[k + 9] = s1; d[k + 10] = r; d[k + 11] = g; d[k + 12] = b; d[k + 13] = a; d[k + 14] = grav; d[k + 15] = flat ? 1 : 0;
  }
  // A quick round burst: a splash, a landing, a puff of smoke.
  burst(x, y, z, n, speed, ttl, s0, s1, r, g, b, a = 0.7, grav = 0, up = 0.6) {
    for (let i = 0; i < n; i++) { const t = Math.random() * 6.283, v = speed * (0.4 + Math.random() * 0.6); this.emit(x, y, z, Math.cos(t) * v, speed * up * (0.5 + Math.random()), Math.sin(t) * v, ttl * (0.7 + Math.random() * 0.6), s0, s1, r, g, b, a, grav); }
  }
  update(dt, light) {
    const d = this.d, soft = this.soft, flat = this.flat; soft.clear(); flat.clear(); let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const k = i * 16, ttl = d[k + 7]; if (ttl <= 0) continue;
      const age = d[k + 6] += dt; if (age >= ttl) { d[k + 7] = 0; continue; }
      alive++;
      d[k + 4] -= d[k + 14] * dt;
      const drag = Math.exp(-1.6 * dt); d[k + 3] *= drag; d[k + 5] *= drag; if (!d[k + 14]) d[k + 4] *= drag;
      d[k] += d[k + 3] * dt; d[k + 1] += d[k + 4] * dt; d[k + 2] += d[k + 5] * dt;
      const t = age / ttl, size = d[k + 8] + (d[k + 9] - d[k + 8]) * (1 - (1 - t) * (1 - t)), a = d[k + 13] * Math.min(1, age * 14) * (1 - t) * (1 - t * 0.5);
      (d[k + 15] ? flat : soft).add(d[k], d[k + 1], d[k + 2], size, d[k + 10], d[k + 11], d[k + 12], a);
    }
    this.alive = alive;
    soft.mat.uniforms.light.value.setScalar(light); flat.mat.uniforms.light.value.setScalar(light);
    soft.commit(); flat.commit();
  }
}

// Tyre marks: short dark strips laid on the road where wheels slide. The oldest are painted over first.
export class SkidMarks {
  constructor(scene, max = 900) {
    this.max = max; this.head = 0; this.count = 0;
    this.pos = new Float32Array(max * 12); this.col = new Float32Array(max * 16);
    const idx = new Uint16Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.aPos = new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', this.aCol = new THREE.BufferAttribute(this.col, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.aPos.setUsage(THREE.DynamicDrawUsage); this.aCol.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.visible = false; scene.add(this.mesh);
  }
  // One strip from (x0, z0) to (x1, z1) at height y.
  add(x0, z0, x1, z1, y, wid, alpha) {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 0.01) return;
    const nx = (-dz / l) * wid * 0.5, nz = (dx / l) * wid * 0.5, k = this.head * 12, c = this.head * 16;
    this.head = (this.head + 1) % this.max; this.count++;
    this.pos.set([x0 - nx, y, z0 - nz, x0 + nx, y, z0 + nz, x1 - nx, y, z1 - nz, x1 + nx, y, z1 + nz], k);
    for (let i = 0; i < 4; i++) this.col.set([0.07, 0.07, 0.08, alpha], c + i * 4);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.mesh.visible = true;
  }
}
