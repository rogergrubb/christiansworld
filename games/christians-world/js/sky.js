// The sky: time of day, sun, moon and stars, and the light they cast on the island.
import * as THREE from './three.js';
import { clamp, lerp, smoothstep } from './util.js';

const C = (hex) => new THREE.Color(hex);
// Each entry: [day, dusk or dawn, night]
const PAL = {
  top: [C(0x2f86e6), C(0x3d4f96), C(0x030817)],
  mid: [C(0x8ecbff), C(0xf0935e), C(0x0a1430)],
  low: [C(0xdff1ff), C(0xffd0a0), C(0x15213c)],
  sun: [C(0xfff0d2), C(0xff9750), C(0x9db8ff)],
  hemiSky: [C(0xdcefff), C(0xffc6a0), C(0x30437a)],
  hemiGround: [C(0xa39672), C(0x8a6955), C(0x121a26)],
  cloud: [C(0xffffff), C(0xffbfa0), C(0x27314f)],
  deep: [C(0x0e5fa8), C(0x274f86), C(0x05162c)],
  shallow: [C(0x3fd2cb), C(0x5fb3a8), C(0x0e3550)],
};
const HEMI = [1.5, 1.05, 0.82];

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.t = 0.36;            // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    this.mode = 'auto';       // or 'day', 'dusk', 'night' to hold the clock still
    this.dayLength = 720;     // seconds of play for a full day; nights pass faster
    this.night = 0; this.dusk = 0; this.sunY = 1;
    this.sunDir = new THREE.Vector3(0, 1, 0); this.moonDir = new THREE.Vector3(0, -1, 0); this.lightDir = new THREE.Vector3(0, 1, 0);
    this.col = {}; for (const k in PAL) this.col[k] = new THREE.Color();

    this.hemi = new THREE.HemisphereLight(0xdcefff, 0xa39672, 1.5);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 1; sc.far = 560;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.5;
    scene.add(this.hemi, this.sun, this.sun.target);

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4200, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
        sunDir: { value: this.sunDir }, moonDir: { value: this.moonDir }, night: { value: 0 },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunCol; uniform vec3 sunDir; uniform vec3 moonDir; uniform float night;
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, d.y));
          c = mix(c, top, smoothstep(0.2, 0.85, d.y));
          float sd = max(dot(d, sunDir), 0.0);
          c += sunCol * (pow(sd, 5.0) * 0.22 + pow(sd, 48.0) * 0.45) * (1.0 - night);
          c = mix(c, vec3(1.0, 0.96, 0.82), smoothstep(0.99935, 0.9997, sd));
          float md = max(dot(d, moonDir), 0.0);
          c += vec3(0.55, 0.65, 1.0) * pow(md, 220.0) * 0.3 * night;
          float disc = smoothstep(0.99915, 0.9994, md);
          float bite = smoothstep(0.9993, 0.99965, max(dot(d, normalize(moonDir + vec3(0.016, 0.008, 0.0))), 0.0));
          c = mix(c, vec3(0.94, 0.96, 1.0), disc * (1.0 - bite * 0.85) * night);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    this.dome.frustumCulled = false; this.dome.renderOrder = -10;
    scene.add(this.dome);

    // stars: fixed points far away that fade in after sunset
    const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, a = rnd() * 6.283, s = Math.sqrt(1 - u * u), r = 3900;
      pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = Math.abs(u) * r * 0.98 + 40; pos[i * 3 + 2] = Math.sin(a) * s * r;
      const b = 0.45 + rnd() * 0.55, warm = rnd();
      col[i * 3] = b * (0.85 + warm * 0.15); col[i * 3 + 1] = b * 0.92; col[i * 3 + 2] = b * (1.0 - warm * 0.2);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -9; this.stars.visible = false;
    scene.add(this.stars);
    this.apply();
  }

  setMode(mode) { this.mode = mode; if (mode === 'day') this.t = 0.45; else if (mode === 'dusk') this.t = 0.742; else if (mode === 'night') this.t = 0.93; this.apply(); }
  // "8:05 AM"
  clock() {
    const mins = Math.floor(this.t * 1440), h = Math.floor(mins / 60), m = mins % 60;
    return `${((h + 11) % 12) + 1}:${m < 10 ? '0' : ''}${m} ${h < 12 ? 'AM' : 'PM'}`;
  }
  mix(key, w) {
    const p = PAL[key], c = this.col[key];
    c.setRGB(p[0].r * w[0] + p[1].r * w[1] + p[2].r * w[2], p[0].g * w[0] + p[1].g * w[1] + p[2].g * w[2], p[0].b * w[0] + p[1].b * w[1] + p[2].b * w[2]);
    return c;
  }
  apply() {
    const ang = (this.t - 0.25) * Math.PI * 2, sy = Math.sin(ang);
    this.sunY = sy;
    this.sunDir.set(Math.cos(ang) * 0.82, sy, 0.42).normalize();
    this.moonDir.set(-Math.cos(ang) * 0.7, -sy, -0.3).normalize();
    let wd = smoothstep(0.0, 0.36, sy), wn = smoothstep(0.03, -0.2, sy), wk = Math.max(0, 1 - wd - wn);
    const sum = wd + wn + wk; wd /= sum; wn /= sum; wk /= sum;
    const w = this.w = [wd, wk, wn];
    this.night = smoothstep(0.1, -0.16, sy); this.dusk = wk;
    const u = this.dome.material.uniforms;
    u.top.value.copy(this.mix('top', w)); u.mid.value.copy(this.mix('mid', w)); u.low.value.copy(this.mix('low', w));
    u.sunCol.value.copy(this.mix('sun', [wd, wk, 0])); u.night.value = wn;
    this.mix('cloud', w); this.mix('deep', w); this.mix('shallow', w);
    this.hemi.color.copy(this.mix('hemiSky', w)); this.hemi.groundColor.copy(this.mix('hemiGround', w));
    this.hemi.intensity = HEMI[0] * wd + HEMI[1] * wk + HEMI[2] * wn;
    // one shadow-casting light: the sun by day, the moon by night
    const sunPower = 2.4 * smoothstep(-0.03, 0.3, sy), moonPower = 0.7 * smoothstep(-0.06, -0.3, sy);
    if (sunPower >= moonPower) { this.lightDir.copy(this.sunDir); this.sun.color.copy(this.mix('sun', [wd, wk, 0])); this.sun.intensity = sunPower; }
    else { this.lightDir.copy(this.moonDir); this.sun.color.copy(PAL.sun[2]); this.sun.intensity = moonPower; }
    if (this.lightDir.y < 0.12) { this.lightDir.y = 0.12; this.lightDir.normalize(); }
    if (this.scene.fog) this.scene.fog.color.copy(this.col.low).lerp(this.col.mid, 0.25);
    this.stars.visible = wn > 0.02; this.stars.material.opacity = wn * 0.95;
  }
  update(dt, camera, fx, fy, fz) {
    if (this.mode === 'auto' && dt > 0) {
      this.t = (this.t + (dt / this.dayLength) * (this.sunY < -0.05 ? 2.4 : 1)) % 1;
      this.apply();
    }
    this.dome.position.copy(camera.position); this.stars.position.copy(camera.position);
    this.stars.rotation.y = this.t * 0.6;
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx + this.lightDir.x * 260, fy + this.lightDir.y * 260, fz + this.lightDir.z * 260);
  }
}
