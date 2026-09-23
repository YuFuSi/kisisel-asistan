// Kürenin gövdesi için WebGL gölgelendirici: gerçek 3B normal, ışık, Fresnel kenar parlaması ve hacimli iç sis.
// Yüzey noktaları, halkalar ve duygular 2D tuvalde kalır; bu katman sadece gövdeyi çizer.
// WebGL yoksa createSphereRenderer null döner ve küre eski 2D gövdeyle çizilir.

export interface SphereUniforms {
  /** Kürenin tuval içindeki yarıçapı (px, dpr'siz) */
  radius: number
  /** Yavaş akan zaman (iç sis hareketi) */
  flow: number
  /** 0-1 ses enerjisi */
  energy: number
  /** Cevap nabzı (0-1) */
  kick: number
  /** Yoğunluk çarpanı */
  intensity: number
  /** Bakış yönü (-1..1, ekranda sağ ve aşağı pozitif): ışık ve sis imlece doğru kayar */
  gaze: [number, number]
  /** RGB (0-1) renkler: sis A, sis B, kenar parlaması */
  colorA: [number, number, number]
  colorB: [number, number, number]
  colorRim: [number, number, number]
}

export interface SphereRenderer {
  canvas: HTMLCanvasElement
  render: (u: SphereUniforms) => void
  dispose: () => void
}

const VERTEX = `
attribute vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 res;
uniform float radiusFrac;
uniform float flow;
uniform float energy;
uniform float kick;
uniform float intensity;
uniform vec2 gaze;
uniform vec3 colA;
uniform vec3 colB;
uniform vec3 colRim;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 q = (uv - 0.5) / radiusFrac;
  float len = length(q);
  float edge = 1.0 - smoothstep(0.985, 1.0, len);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float z = sqrt(max(1.0 - len * len, 0.0));
  vec3 n = vec3(q, z);

  // Hacimli sis: yüzeyin biraz içindeki noktalarda gezinen gürültü, iki katman farklı yönde akar
  vec3 p1 = n * 1.5 + vec3(flow * 0.21 + gaze.x * 0.5, flow * 0.13 + gaze.y * 0.5, -flow * 0.17);
  vec3 p2 = n * 2.6 + vec3(-flow * 0.16, flow * 0.24, flow * 0.1);
  float fogA = fbm(p1);
  float fogB = fbm(p2 + 4.0);
  float depth = 0.55 + 0.45 * z;
  float amount = (0.35 + 0.65 * smoothstep(0.25, 0.85, fogA)) * depth;
  vec3 fog = mix(colA, colB, fogB) * amount * (0.55 + energy * 0.25 + kick * 0.2) * intensity;

  // Koyu taban, sis, kenarda Fresnel parlaması, üst soldan ışık
  vec3 base = vec3(0.035, 0.04, 0.055);
  float fres = pow(1.0 - z, 2.6);
  vec3 rim = colRim * fres * (0.85 + energy * 0.3);
  vec3 light = normalize(vec3(-0.4 + gaze.x * 0.9, 0.55 - gaze.y * 0.9, 0.75));
  float ndl = max(dot(n, light), 0.0);
  float spec = pow(ndl, 48.0) * 0.55 + pow(ndl, 6.0) * 0.06;

  vec3 col = base + fog + rim + vec3(spec);
  float alpha = clamp(0.9 + fres * 0.1, 0.0, 1.0) * edge;
  gl_FragColor = vec4(col * alpha, alpha);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Küre gölgelendirici derlenemedi:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** Gövde için WebGL çizici; WebGL kullanılamıyorsa veya derleme başarısızsa null */
export function createSphereRenderer(size: number, dpr: number): SphereRenderer | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true })
    if (!gl) return null
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return null
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(program, 'pos')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const loc = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name)
    const uRes = loc('res')
    const uRadius = loc('radiusFrac')
    const uFlow = loc('flow')
    const uEnergy = loc('energy')
    const uKick = loc('kick')
    const uIntensity = loc('intensity')
    const uGaze = loc('gaze')
    const uA = loc('colA')
    const uB = loc('colB')
    const uRim = loc('colRim')

    return {
      canvas,
      render: (u) => {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform1f(uRadius, u.radius / size)
        gl.uniform1f(uFlow, u.flow)
        gl.uniform1f(uEnergy, u.energy)
        gl.uniform1f(uKick, u.kick)
        gl.uniform1f(uIntensity, u.intensity)
        gl.uniform2f(uGaze, u.gaze[0], u.gaze[1])
        gl.uniform3f(uA, ...u.colorA)
        gl.uniform3f(uB, ...u.colorB)
        gl.uniform3f(uRim, ...u.colorRim)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      },
      dispose: () => {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    }
  } catch {
    return null
  }
}
