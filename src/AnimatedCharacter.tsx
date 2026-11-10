import { useEffect, useRef, useState } from 'react'

const imageSource = '/hero-self-manga.png'

const vertexShaderSource = `
  attribute vec2 a_uv;
  uniform float u_time;
  varying vec2 v_uv;

  float influence(vec2 point, vec2 center, vec2 radius) {
    vec2 distance = (point - center) / radius;
    return exp(-2.0 * dot(distance, distance));
  }

  void main() {
    vec2 point = a_uv;
    float breath = u_time * 1.05;

    float torso = influence(point, vec2(0.73, 0.63), vec2(0.68, 0.90));
    float frontHand = influence(point, vec2(0.20, 0.72), vec2(0.48, 0.58));
    frontHand *= smoothstep(0.42, 0.57, point.y);
    float backHand = influence(point, vec2(0.45, 0.51), vec2(0.24, 0.20));

    vec2 movement = vec2(0.0);
    movement += torso * vec2(sin(breath + 0.4) * 0.0015, sin(breath) * 0.004);
    movement += frontHand * vec2(sin(breath * 0.88 + 1.1) * 0.0035,
                                 cos(breath * 0.88 + 1.1) * 0.005);
    movement += backHand * vec2(sin(breath * 1.12 + 0.7) * 0.003,
                                sin(breath * 1.12 + 0.7) * 0.005);

    vec2 position = point + movement;
    gl_Position = vec4(position.x * 2.0 - 1.0, 1.0 - position.y * 2.0, 0.0, 1.0);
    v_uv = point;
  }
`

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_image;
  varying vec2 v_uv;

  void main() {
    gl_FragColor = texture2D(u_image, vec2(v_uv.x, 1.0 - v_uv.y));
  }
`

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createMesh(columns: number, rows: number) {
  const vertices: number[] = []

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const left = x / columns
      const right = (x + 1) / columns
      const top = y / rows
      const bottom = (y + 1) / rows

      vertices.push(
        left, top, right, top, left, bottom,
        left, bottom, right, top, right, bottom,
      )
    }
  }

  return new Float32Array(vertices)
}

export function AnimatedCharacter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    })
    if (!gl) return

    let disposed = false
    let frame = 0
    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let texture: WebGLTexture | null = null
    let vertexShader: WebGLShader | null = null
    let fragmentShader: WebGLShader | null = null

    const image = new Image()
    image.onload = () => {
      if (disposed) return

      vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
      fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
      if (!vertexShader || !fragmentShader) return

      program = gl.createProgram()
      if (!program) return
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return

      buffer = gl.createBuffer()
      texture = gl.createTexture()
      if (!buffer || !texture) return

      const mesh = createMesh(48, 46)
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(program)

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW)
      const uvLocation = gl.getAttribLocation(program, 'a_uv')
      if (uvLocation < 0) return
      gl.enableVertexAttribArray(uvLocation)
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)

      const timeLocation = gl.getUniformLocation(program, 'u_time')
      const startTime = performance.now()
      const draw = (now: number) => {
        if (disposed) return
        if (!document.hidden) {
          gl.uniform1f(timeLocation, (now - startTime) / 1000)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 2)
        }
        frame = requestAnimationFrame(draw)
      }

      draw(startTime)
      setReady(true)
    }
    image.src = imageSource

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      image.onload = null
      if (texture) gl.deleteTexture(texture)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      if (vertexShader) gl.deleteShader(vertexShader)
      if (fragmentShader) gl.deleteShader(fragmentShader)
    }
  }, [])

  return (
    <div className={`hero-character${ready ? ' hero-character--ready' : ''}`} role="img" aria-label="Ilja Dzhumelya als animierte Manga-Figur">
      <img className="hero-character__fallback" src={imageSource} alt="" />
      <canvas className="hero-character__canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
