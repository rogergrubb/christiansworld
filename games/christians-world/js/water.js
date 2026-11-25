// The sea and the lake: one big plane whose colour, foam and sparkle are computed per pixel.
// It reads the island's height map, so the water knows where the shore is.
import * as THREE from './three.js';
import { GRID, WATER_Y } from './world.js';

export function makeWater(scene, world, sky) {
  const { nx, nz, cell, x0, z0 } = GRID;
  const data = new Uint16Array(nx * nz);
  for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(world.heightGrid[i]);
  const heightTex = new THREE.DataTexture(data, nx, nz, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, night: { value: 0 }, waterY: { value: WATER_Y },
    grid: { value: new THREE.Vector4(x0, z0, 1 / ((nx - 1) * cell), 1 / ((nz - 1) * cell)) },
    deep: { value: new THREE.Color(0x0e5fa8) }, shallow: { value: new THREE.Color(0x3fd2cb) },
    skyCol: { value: new THREE.Color(0xdff1ff) }, sunCol: { value: new THREE.Color(0xfff0d2) }, lightDir: { value: new THREE.Vector3(0, 1, 0) },
  }]);
  uniforms.heightTex = { value: heightTex };

  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true,
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time; uniform float night; uniform float waterY; uniform vec4 grid; uniform sampler2D heightTex;
      uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyCol; uniform vec3 sunCol; uniform vec3 lightDir;
      varying vec3 vW;
      #include <fog_pars_fragment>
      vec2 wave(vec2 p, vec2 d, float f, float s, float a){ return d * a * cos(dot(p, d) * f + time * s); }
      void main(){
        vec2 p = vW.xz;
        float far = smoothstep(120.0, 900.0, distance(cameraPosition.xz, p));   // calm the ripples toward the horizon
        vec2 g = wave(p, vec2(0.8, 0.6), 0.21, 1.1, 0.05) + wave(p, vec2(-0.5, 0.86), 0.43, 1.7, 0.04)
               + (wave(p, vec2(0.2, -0.98), 0.97, 2.3, 0.035) + wave(p, vec2(0.95, -0.3), 1.9, 3.1, 0.025)) * (1.0 - far);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec2 uv = (p - grid.xy) * grid.zw;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float h = mix(-14.0, texture2D(heightTex, uv).r, inside);
        float depth = waterY - h;
        vec3 col = mix(shallow, deep, smoothstep(0.2, 7.0, depth));
        col = mix(col, skyCol, fres * 0.6);
        float spec = pow(max(dot(reflect(-v, n), lightDir), 0.0), 240.0);
        col += sunCol * spec * mix(0.85, 0.45, night);
        float edge = depth + 0.2 * sin(time * 1.3 + p.x * 0.33 + p.y * 0.27);
        float foam = smoothstep(0.85, 0.05, edge);
        float lace = 0.55 + 0.45 * sin(depth * 8.0 - time * 2.0 + (p.x + p.y) * 0.55);
        float fo = clamp(foam * lace, 0.0, 1.0) * (1.0 - night * 0.55);
        col = mix(col, vec3(1.0), fo);
        float alpha = max(mix(0.5, 1.0, smoothstep(0.0, 3.6, depth)), fo);   // deep water hides the seabed completely
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = WATER_Y; mesh.renderOrder = 1;
  scene.add(mesh);
  return {
    mesh,
    update(t) {
      const u = mat.uniforms;
      u.time.value = t; u.night.value = sky.night;
      u.deep.value.copy(sky.col.deep); u.shallow.value.copy(sky.col.shallow);
      u.skyCol.value.copy(sky.col.low).lerp(sky.col.mid, 0.4); u.sunCol.value.copy(sky.sun.color); u.lightDir.value.copy(sky.lightDir);
    },
  };
}
