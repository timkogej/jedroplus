/**
 * Asistent+ "sij": svetleč obris plusa, narisan s senčilnikom (WebGL, brez knjižnic).
 *
 * Videz po zgledu "voice orb" (svetel obroč z mehkim sijem navznoter, barve tečejo
 * po robu, svetla iskra kroži, šum rahlo vzvalovi rob), le da je namesto kroga
 * oblika plusa: razdalja do roba je SDF unije dveh zaobljenih palic (isti parametri
 * kot plusOblika.ts), zato se plus zvezno napihne v krog.
 *
 * Izris je na zahtevo (izrisi): ko pogon v PlusOrb miruje, ne teče nič.
 * Koordinate so v prostoru 144 × 144 (središče 72, 72); platno je večje za sij (OKVIR).
 */

import type { ParametriPlusa } from './plusOblika';

/** Velikost platna v enotah 144 (plus + prostor za sij). */
export const OKVIR = 200;

const VERT = `
attribute vec2 polozaj;
varying vec2 vUv;
void main() {
  vUv = polozaj * 0.5 + 0.5;
  gl_Position = vec4(polozaj, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uCas;
uniform float uVrtenje;
uniform vec4 uKraki;   // gor, desno, dol, levo
uniform vec3 uOblika;  // debelina, zaobljenost, mehcanje
uniform float uNivo;
uniform float uMisli;
uniform float uMiska;

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
  return dot(vec4(31.316), n);
}

float palica(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float gladkiMin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

/** Razdalja do roba plusa (negativno znotraj). y raste navzdol. */
float plus(vec2 p) {
  float deb = uOblika.x;
  float zao = uOblika.y;
  vec2 cv = vec2((uKraki.y - uKraki.w) * 0.5, 0.0);
  vec2 cn = vec2(0.0, (uKraki.z - uKraki.x) * 0.5);
  float v = palica(p - cv, vec2((uKraki.y + uKraki.w) * 0.5, deb), zao);
  float n = palica(p - cn, vec2(deb, (uKraki.x + uKraki.z) * 0.5), zao);
  return gladkiMin(v, n, max(uOblika.z, 0.001));
}

float luc1(float moc, float slabljenje, float d) { return moc / (1.0 + d * slabljenje); }
float luc2(float moc, float slabljenje, float d) { return moc / (1.0 + d * d * slabljenje); }

/** Svetla iskra, ki kroži po robu (kot a). */
float iskra(float kot, float a, float d0, float moc) {
  float dk = atan(sin(kot - a), cos(kot - a));
  float d = length(vec2(dk * 0.62, d0 / 72.0));
  return luc2(moc, 5.0, d) * luc1(1.0, 50.0, d0 / 72.0);
}

void main() {
  // Točka v prostoru 144 (središče 0), y navzdol.
  vec2 p = (vUv - 0.5) * ${OKVIR.toFixed(1)};
  p.y = -p.y;

  // Glas (in miška) rob rahlo vzvalujeta.
  float val = uNivo * 0.85 + uMiska * 0.25;
  p.x += val * 3.5 * sin(p.y * 0.12 + uCas * 1.3);
  p.y += val * 3.5 * sin(p.x * 0.12 + uCas * 1.1);

  float kot = atan(p.y, p.x);
  float cs = cos(uVrtenje), sn = sin(uVrtenje);
  vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);

  float n0 = snoise3(vec3(q * 0.011, uCas * 0.5)) * 0.5 + 0.5;
  float sd = plus(p);
  // Črta obroča malo znotraj roba, šum jo zamika sem ter tja.
  float rob = sd - mix(-6.0, -1.0, n0);
  float d0 = abs(rob);

  vec3 barva1 = vec3(0.486, 0.471, 0.980); // #7c78fa
  vec3 barva2 = vec3(0.208, 0.890, 0.859); // #35e3db
  vec3 barva3 = vec3(0.118, 0.110, 0.560); // globoka indigo (notranji sij)

  float v0 = luc1(1.0, 10.0, d0 / 72.0) * smoothstep(3.5, 0.0, rob);
  float cl = cos(kot + uVrtenje + uCas * 2.0) * 0.5 + 0.5;

  float a = -uCas * mix(1.0, 2.6, uMisli) - uVrtenje;
  float v1 = iskra(kot, a, d0, 1.5 + uMisli * 0.6);
  v1 += uMisli * iskra(kot, a + 3.14159, d0, 1.1);

  float v2 = 1.0 - smoothstep(mix(-8.0, 3.0, n0 * 0.5), 15.0, rob);
  float v3 = smoothstep(-15.0, -1.0, rob);

  vec3 col = mix(barva1, barva2, cl);
  col = mix(barva3, col, v0);
  col = (col + v1) * v2 * v3;
  col = clamp(col, 0.0, 1.0);
  float alfa = max(max(col.r, col.g), col.b);
  gl_FragColor = vec4(col, alfa);
}`;

export interface IzrisSija {
  oblika: ParametriPlusa;
  /** Čas v sekundah (stoji, ko pogon miruje). */
  cas: number;
  nivo: number;
  /** 0–1: razmišljanje (hitrejša iskra, dve iskri). */
  misli: number;
  miska: number;
}

export interface Sij {
  izrisi(v: IzrisSija): void;
  /** Velikost platna v CSS px (glede na velikost orba). */
  velikost(px: number): void;
  unici(): void;
}

function prevedi(gl: WebGLRenderingContext, vrsta: number, vir: string): WebGLShader | null {
  const s = gl.createShader(vrsta);
  if (!s) return null;
  gl.shaderSource(s, vir);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/** Ustvari izris na platnu; null, če WebGL ni na voljo (takrat PlusOrb nariše CSS obris). */
export function ustvariSij(platno: HTMLCanvasElement): Sij | null {
  const gl = platno.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const vs = prevedi(gl, gl.VERTEX_SHADER, VERT);
  const fs = prevedi(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // En trikotnik čez celo platno.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const atr = gl.getAttribLocation(prog, 'polozaj');
  gl.enableVertexAttribArray(atr);
  gl.vertexAttribPointer(atr, 2, gl.FLOAT, false, 0, 0);

  const u = (ime: string) => gl.getUniformLocation(prog, ime);
  const uCas = u('uCas');
  const uVrtenje = u('uVrtenje');
  const uKraki = u('uKraki');
  const uOblika = u('uOblika');
  const uNivo = u('uNivo');
  const uMisli = u('uMisli');
  const uMiska = u('uMiska');

  let vrtenje = 0;
  let prejCas = -1;

  return {
    velikost(px) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const s = Math.max(48, Math.min(420, Math.round(px * dpr)));
      if (platno.width !== s) {
        platno.width = s;
        platno.height = s;
      }
    },
    izrisi({ oblika, cas, nivo, misli, miska }) {
      // Glas pospeši vrtenje barv (kot pri zgledu).
      if (prejCas >= 0) vrtenje += Math.max(0, Math.min(0.1, cas - prejCas)) * (0.3 + nivo * 2.2);
      prejCas = cas;
      gl.viewport(0, 0, platno.width, platno.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uCas, cas);
      gl.uniform1f(uVrtenje, vrtenje);
      const k = oblika.kraki;
      gl.uniform4f(uKraki, k.gor, k.desno, k.dol, k.levo);
      gl.uniform3f(uOblika, oblika.debelina, oblika.zaobljenost, oblika.mehcanje);
      gl.uniform1f(uNivo, nivo);
      gl.uniform1f(uMisli, misli);
      gl.uniform1f(uMiska, miska);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    unici() {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
