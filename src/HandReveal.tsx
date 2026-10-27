import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { handFragmentShader, handVertexShader } from './handRevealShader'

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return null
}

function createTexture(
  gl: WebGLRenderingContext,
  image: HTMLImageElement,
  unit: number,
  width: number,
  height: number,
) {
  const texture = gl.createTexture()
  if (!texture) return null
  const source = document.createElement('canvas')
  source.width = Math.max(1, Math.min(image.naturalWidth, width))
  source.height = Math.max(1, Math.min(image.naturalHeight, height))
  const context = source.getContext('2d')
  if (!context) {
    gl.deleteTexture(texture)
    return null
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, source.width, source.height)
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  return texture
}

export function HandReveal() {
  const handRef = useRef<HTMLDivElement>(null)
  const skinRef = useRef<HTMLImageElement>(null)
  const chromeRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const hand = handRef.current
    const skin = skinRef.current
    const chrome = chromeRef.current
    const canvas = canvasRef.current
    if (!hand || !skin || !chrome || !canvas) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sampleWidth = 256
    const sampleHeight = 342
    const reveal = { x: hand.clientWidth / 2, y: hand.clientHeight / 3, radius: 0, vx: 0, vy: 0 }

    let alpha: Uint8ClampedArray | null = null
    let active = false
    let disposed = false
    let hideTimer: number | undefined
    let frame = 0
    let graphics: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let skinTexture: WebGLTexture | null = null
    let chromeTexture: WebGLTexture | null = null
    let startedAt = performance.now()

    const renderFallback = () => {
      chrome.style.setProperty('--reveal-x', `${reveal.x}px`)
      chrome.style.setProperty('--reveal-y', `${reveal.y}px`)
      chrome.style.setProperty('--reveal-inner', `${Math.max(0, reveal.radius - 24)}px`)
      chrome.style.setProperty('--reveal-outer', `${reveal.radius}px`)
      canvas.style.setProperty('--reveal-x', `${reveal.x}px`)
      canvas.style.setProperty('--reveal-y', `${reveal.y}px`)
      canvas.style.setProperty('--reveal-outer', `${reveal.radius}px`)
      if (graphics && frame === 0) frame = requestAnimationFrame(animate)
    }

    const paint = () => {
      const gl = graphics
      if (!gl || !program) return
      gl.useProgram(program)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1i(gl.getUniformLocation(program, 'u_chrome'), 0)
      gl.uniform1i(gl.getUniformLocation(program, 'u_skin'), 1)
      gl.uniform2f(gl.getUniformLocation(program, 'u_size'), hand.clientWidth, hand.clientHeight)
      gl.uniform2f(
        gl.getUniformLocation(program, 'u_pointer'),
        reveal.x / hand.clientWidth,
        reveal.y / hand.clientHeight,
      )
      gl.uniform2f(gl.getUniformLocation(program, 'u_velocity'), reveal.vx, reveal.vy)
      gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), reveal.radius)
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), (performance.now() - startedAt) / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const animate = () => {
      frame = 0
      paint()
      if (active || reveal.radius > .1) frame = requestAnimationFrame(animate)
    }

    const resizeCanvas = () => {
      if (!graphics) return
      const density = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(hand.clientWidth * density))
      canvas.height = Math.max(1, Math.round(hand.clientHeight * density))
      paint()
    }

    const closeReveal = () => {
      if (!active) return
      active = false
      gsap.killTweensOf(reveal, 'radius')
      gsap.to(reveal, {
        radius: 0,
        duration: reduceMotion ? 0 : .48,
        ease: 'power2.inOut',
        onUpdate: renderFallback,
        onComplete: renderFallback,
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return

      const bounds = hand.getBoundingClientRect()
      const insideBounds = event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      let overHand = false
      let x = 0
      let y = 0

      if (insideBounds && alpha) {
        const across = (event.clientX - bounds.left) / bounds.width
        const down = (event.clientY - bounds.top) / bounds.height
        const pixelX = Math.min(sampleWidth - 1, Math.floor(across * sampleWidth))
        const pixelY = Math.min(sampleHeight - 1, Math.floor(down * sampleHeight))
        overHand = alpha[(pixelY * sampleWidth + pixelX) * 4 + 3] > 60
        x = across * hand.clientWidth
        y = down * hand.clientHeight
      }

      if (!overHand) {
        if (active && hideTimer === undefined) {
          hideTimer = window.setTimeout(() => {
            hideTimer = undefined
            closeReveal()
          }, 90)
        }
        return
      }

      window.clearTimeout(hideTimer)
      hideTimer = undefined

      if (!active) {
        active = true
        reveal.x = x
        reveal.y = y
        gsap.killTweensOf(reveal)
        gsap.to(reveal, {
          radius: Math.min(96, Math.max(62, hand.clientWidth * .16)),
          duration: reduceMotion ? 0 : .68,
          ease: 'power3.out',
          onUpdate: renderFallback,
          onComplete: renderFallback,
        })
      } else {
        reveal.vx = Math.max(-1, Math.min(1, (x - reveal.x) / 35))
        reveal.vy = Math.max(-1, Math.min(1, (y - reveal.y) / 35))
        gsap.to(reveal, {
          vx: 0,
          vy: 0,
          duration: reduceMotion ? 0 : .5,
          ease: 'power2.out',
          overwrite: 'auto',
        })
        gsap.to(reveal, {
          x,
          y,
          duration: reduceMotion ? 0 : .17,
          ease: 'power2.out',
          overwrite: 'auto',
          onUpdate: renderFallback,
        })
      }
      renderFallback()
    }

    const onPointerLeave = () => {
      window.clearTimeout(hideTimer)
      hideTimer = undefined
      closeReveal()
    }

    const setupWebGL = () => {
      const gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      })
      if (!gl) return

      const vertex = compileShader(gl, gl.VERTEX_SHADER, handVertexShader)
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, handFragmentShader)
      if (!vertex || !fragment) {
        if (vertex) gl.deleteShader(vertex)
        if (fragment) gl.deleteShader(fragment)
        return
      }

      const nextProgram = gl.createProgram()
      if (!nextProgram) return
      gl.attachShader(nextProgram, vertex)
      gl.attachShader(nextProgram, fragment)
      gl.linkProgram(nextProgram)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        gl.deleteProgram(nextProgram)
        return
      }

      const nextBuffer = gl.createBuffer()
      if (!nextBuffer) {
        gl.deleteProgram(nextProgram)
        return
      }
      gl.useProgram(nextProgram)
      gl.bindBuffer(gl.ARRAY_BUFFER, nextBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, 1, 1,
      ]), gl.STATIC_DRAW)
      const position = gl.getAttribLocation(nextProgram, 'a_position')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

      const density = Math.min(window.devicePixelRatio || 1, 2)
      const textureWidth = Math.round(hand.clientWidth * density)
      const textureHeight = Math.round(hand.clientHeight * density)
      const nextChromeTexture = createTexture(gl, chrome, 0, textureWidth, textureHeight)
      const nextSkinTexture = createTexture(gl, skin, 1, textureWidth, textureHeight)
      if (!nextChromeTexture || !nextSkinTexture) {
        if (nextChromeTexture) gl.deleteTexture(nextChromeTexture)
        if (nextSkinTexture) gl.deleteTexture(nextSkinTexture)
        gl.deleteBuffer(nextBuffer)
        gl.deleteProgram(nextProgram)
        return
      }

      graphics = gl
      program = nextProgram
      buffer = nextBuffer
      chromeTexture = nextChromeTexture
      skinTexture = nextSkinTexture
      startedAt = performance.now()
      resizeCanvas()
      hand.classList.add('hand-stack--shader')
    }

    const setup = async () => {
      try {
        await Promise.all([skin.decode(), chrome.decode()])
      } catch {
        return
      }
      if (disposed) return

      const sample = document.createElement('canvas')
      sample.width = sampleWidth
      sample.height = sampleHeight
      const context = sample.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(skin, 0, 0, sampleWidth, sampleHeight)
      alpha = context.getImageData(0, 0, sampleWidth, sampleHeight).data

      renderFallback()
      setupWebGL()
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
      window.addEventListener('blur', onPointerLeave)
      window.addEventListener('resize', resizeCanvas)
    }

    void setup()

    return () => {
      disposed = true
      window.clearTimeout(hideTimer)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('blur', onPointerLeave)
      window.removeEventListener('resize', resizeCanvas)
      if (frame) cancelAnimationFrame(frame)
      gsap.killTweensOf(reveal)
      if (graphics) {
        if (chromeTexture) graphics.deleteTexture(chromeTexture)
        if (skinTexture) graphics.deleteTexture(skinTexture)
        if (buffer) graphics.deleteBuffer(buffer)
        if (program) graphics.deleteProgram(program)
      }
    }
  }, [])

  return (
    <div className="hand-stack" role="img" aria-label="Chromhand mit einer flüssigen Öffnung zur natürlichen Hand" ref={handRef}>
      <img className="hand-stack__original" src="/hand-original.webp" alt="" ref={skinRef} />
      <img className="hand-stack__chrome" src="/hand-chrome.webp" alt="" ref={chromeRef} />
      <canvas className="hand-stack__shader" aria-hidden="true" ref={canvasRef} />
    </div>
  )
}
