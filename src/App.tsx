import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AnimatedCharacter } from './AnimatedCharacter'

gsap.registerPlugin(ScrollTrigger)

const projectPlaceholders = [2, 3, 4, 5, 6]
const projectNames = ['Portfolio', 'StampNow', 'MJE/OPERATIONS', 'GaLaBau Beier', 'Sonar', 'Hidden Local Gems']

const riftOutline = [
  [31.6, 0], [57.6, 0], [57.2, 4], [58.1, 11], [56.7, 17], [55.1, 21],
  [54.4, 26], [55.4, 32], [54.7, 37], [55.5, 43], [55, 49], [53.2, 55],
  [51.8, 51], [50.5, 46], [47.7, 43], [44.8, 41], [42, 37], [40.4, 32],
  [38.4, 27], [36.5, 20], [35.5, 13], [33.8, 8],
]

const riftFullscreen = [
  [0, 0], [100, 0], [100, 4], [100, 12], [100, 22], [100, 33],
  [100, 44], [100, 55], [100, 66], [100, 77], [100, 89], [100, 100],
  [0, 100], [0, 91], [0, 82], [0, 73], [0, 64], [0, 55],
  [0, 45], [0, 34], [0, 22], [0, 10],
]

function getRiftStart() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const mobile = viewportWidth <= 700
  const characterWidth = mobile ? viewportWidth * 0.93 : Math.min(viewportWidth * 0.455, 870)
  const characterRight = mobile ? viewportWidth * -0.11 : viewportWidth * 0.025

  // The fingertip is near (12, 515) in the 1278 × 1230 character image.
  const fingertipX = ((viewportWidth - characterRight - characterWidth + characterWidth * 12 / 1278) / viewportWidth) * 100
  const fingertipY = ((viewportHeight - characterWidth * (1230 - 515) / 1278) / viewportHeight) * 100
  const originalTipX = mobile ? 10.8 + (57.6 - 53.2) * 55 / 26 : 53.2
  const xCorrection = fingertipX - originalTipX
  const yScale = fingertipY / 55

  return `polygon(${riftOutline.map(([x, y]) => {
    const baseX = mobile ? 10.8 + (57.6 - x) * 55 / 26 : x
    const weight = (y / 55) ** 2
    return `${baseX + xCorrection * weight + 0.5}% ${y * yScale}%`
  }).join(', ')})`
}

function getRiftEnd() {
  const mobile = window.innerWidth <= 700
  return `polygon(${riftFullscreen.map(([x, y]) => `${mobile ? 100 - x : x}% ${y}%`).join(', ')})`
}

function SiteHeader({ intro = false, dark = false }: { intro?: boolean; dark?: boolean }) {
  return (
    <header className={`site-header${intro ? ' site-header--intro' : ''}${dark ? ' site-header--dark' : ''}`}>
      <img className="site-logo" src={dark ? '/logo-white.png' : '/logo-black.png'} alt="Ilja Dzhumelya" />
      <nav className="site-nav" aria-label="Hauptnavigation">
        <a href="#work">WORK</a>
        <a href="#about">ABOUT</a>
        <a href="#lab">LAB</a>
        <a href="#contact">LET’S TALK</a>
      </nav>
    </header>
  )
}

function CubeMark() {
  return (
    <div className="about-cube" role="img" aria-label="Dunkler dreidimensionaler Würfel mit einem Infinity-Symbol">
      <div className="about-cube__body">
        {['front', 'back', 'right', 'left', 'top', 'bottom'].map((face) => (
          <div className={`about-cube__face about-cube__face--${face}`} key={face}>
            {Array.from({ length: 9 }, (_, index) => <span className="about-cube__tile" key={index} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  const stageRef = useRef<HTMLDivElement>(null)
  const riftRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const thirdSceneRef = useRef<HTMLElement>(null)
  const fourthSceneRef = useRef<HTMLElement>(null)
  const myWordRef = useRef<HTMLImageElement>(null)
  const worldWordRef = useRef<HTMLImageElement>(null)
  const [fourthHeaderVisible, setFourthHeaderVisible] = useState(false)

  const movePortraitReveal = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--portrait-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`)
    event.currentTarget.style.setProperty('--portrait-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`)
  }

  useEffect(() => {
    const updateHeader = () => {
      const section = fourthSceneRef.current?.getBoundingClientRect()
      setFourthHeaderVisible(section !== undefined && section.top <= 1 && section.bottom > 0)
    }

    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    window.addEventListener('resize', updateHeader)
    return () => {
      window.removeEventListener('scroll', updateHeader)
      window.removeEventListener('resize', updateHeader)
    }
  }, [])

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (riftRef.current) riftRef.current.style.clipPath = getRiftStart()
      return
    }

    const context = gsap.context(() => {
      const projectCards = gsap.utils.toArray<HTMLElement>('.project-card')
      const projectLabels = gsap.utils.toArray<HTMLElement>('.project-name')
      const stackPosition = (depth: number) => {
        const mobile = window.innerWidth <= 700
        return {
          x: depth * (mobile ? 5 : 20),
          y: 0,
          rotation: 0,
          scale: 1,
        }
      }
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: stageRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
          invalidateOnRefresh: true,
        },
      })

      timeline
        .fromTo(
          riftRef.current,
          { clipPath: getRiftStart },
          { clipPath: getRiftEnd, ease: 'power3.in', duration: 1 },
          0,
        )
        .fromTo(
          sceneRef.current,
          { scale: 1 },
          { scale: 1.22, ease: 'power2.in', duration: 1 },
          0,
        )
        .to('.hero-copy', { opacity: 0, xPercent: -18, scale: 1.12, ease: 'power1.in', duration: 0.55 }, 0.22)
        .to('.hero-character', { opacity: 0, xPercent: 14, scale: 1.2, ease: 'power1.in', duration: 0.58 }, 0.25)
        .to('.site-header--intro, .scroll-indicator, .copyright', { opacity: 0, ease: 'none', duration: 0.35 }, 0.28)
        .fromTo(
          myWordRef.current,
          { opacity: 0, x: -22, filter: 'blur(8px)' },
          { opacity: 1, x: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.32 },
          0.53,
        )
        .fromTo(
          worldWordRef.current,
          { opacity: 0, x: 22, filter: 'blur(8px)' },
          { opacity: 1, x: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.34 },
          0.66,
        )
        .fromTo(
          thirdSceneRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, ease: 'none', duration: 0.08 },
          1.02,
        )
        .to(
          riftRef.current,
          {
            scale: () => window.innerWidth <= 700 ? 0.8 : 0.7,
            yPercent: () => window.innerWidth <= 700 ? 8 : 5,
            ease: 'power2.inOut',
            duration: 0.9,
          },
          1.1,
        )
        .to(sceneRef.current, { scale: 1, ease: 'power2.inOut', duration: 0.9 }, 1.1)
        .fromTo(
          projectLabels[0],
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.38 },
          1.62,
        )

      projectCards.forEach((card, index) => {
        timeline.set(card, { autoAlpha: 1, ...stackPosition(index + 1) }, 1.02)
      })

      projectCards.forEach((card, index) => {
        const start = 2.7 + index * 0.95
        const previous = index === 0 ? riftRef.current : projectCards[index - 1]

        timeline.to(previous, {
          autoAlpha: 0,
          x: -160,
          y: 0,
          rotation: 0,
          scale: index === 0 ? (window.innerWidth <= 700 ? 0.8 : 0.7) : 1,
          ease: 'power2.inOut',
          duration: 0.58,
        }, start)
        timeline.set(previous, { pointerEvents: 'none' }, start)
        timeline.set(card, { pointerEvents: 'auto' }, start + 0.5)

        timeline
          .to(projectLabels[index], { autoAlpha: 0, y: -8, ease: 'power1.inOut', duration: 0.34 }, start)
          .fromTo(
            projectLabels[index + 1],
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.48 },
            start + 0.08,
          )

        projectCards.slice(index).forEach((stackCard, depth) => {
          timeline.to(stackCard, {
            ...stackPosition(depth),
            ease: 'power2.out',
            duration: 0.72,
          }, start + 0.05)
        })
      })
    }, stageRef)

    return () => context.revert()
  }, [])

  useLayoutEffect(() => {
    if (!fourthSceneRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const context = gsap.context(() => {
      const reveal = (selector: string, delay = 0) => {
        gsap.utils.toArray<HTMLElement>(selector).forEach((element) => {
          gsap.fromTo(element,
            { autoAlpha: 0, y: 58, filter: 'blur(7px)' },
            {
              autoAlpha: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 1.15,
              delay,
              ease: 'power3.out',
              scrollTrigger: { trigger: element, start: 'top 88%', once: true },
            },
          )
        })
      }

      reveal('.about-intro__side')
      reveal('.about-cube', 0.12)
      reveal('.about-statement h2')
      reveal('.about-statement__story p')
      reveal('.about-statement__details')
      reveal('.about-portrait-layout__note')
      reveal('.about-portrait')
      reveal('.about-approach__copy')
      reveal('.about-directions__item')

      const flowers = fourthSceneRef.current?.querySelector<HTMLElement>('.about-statement__flowers')
      if (flowers) {
        gsap.fromTo(flowers,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 1.4,
            ease: 'power2.out',
            scrollTrigger: { trigger: flowers, start: 'top 90%', once: true },
          },
        )
      }
    }, fourthSceneRef)

    return () => context.revert()
  }, [])

  return (
    <main>
      <div className="scroll-stage" ref={stageRef}>
        <section className="blank-page" aria-label="Intro">
      <SiteHeader intro />
      <section className="third-scene" ref={thirdSceneRef} aria-label="Next chapter">
        <SiteHeader />
        {projectNames.map((name) => (
          <h2 className="project-name" key={name}>{name}</h2>
        ))}
        {projectPlaceholders.map((number) => (
          <article
            className={`project-card${number === 2 ? ' project-card--stampnow' : number === 3 ? ' project-card--mje' : number === 4 ? ' project-card--beier' : number === 5 ? ' project-card--sonar' : number === 6 ? ' project-card--gems' : ''}`}
            data-project-number={`0${number}`}
            key={number}
            aria-label={number === 2 ? 'StampNow' : number === 3 ? 'MJE/OPERATIONS' : number === 4 ? 'GaLaBau Beier' : number === 5 ? 'Sonar' : 'Hidden Local Gems'}
            style={{ zIndex: 7 - number }}
          >
            {number === 2 ? (
              <a className="project-card__site-link" href="https://stampnow.de/" target="_blank" rel="noopener noreferrer" aria-label="StampNow Website öffnen">
                <img src="/stampnow-preview.png" alt="StampNow Website mit dem Titel Dein Geschäft. Mehr Stammkunden." />
                <span className="project-card__visit" aria-hidden="true">↗</span>
              </a>
            ) : number === 3 ? (
              <a className="project-card__site-link" href="https://mje-operations.de/" target="_blank" rel="noopener noreferrer" aria-label="MJE/OPERATIONS Website öffnen">
                <img src="/mje-operations-preview.png" alt="MJE/OPERATIONS Website mit dem Titel KI, die zuhört, versteht und handelt." />
                <span className="project-card__visit" aria-hidden="true">↗</span>
              </a>
            ) : number === 4 ? (
              <a className="project-card__site-link" href="https://galabau-beier.de/" target="_blank" rel="noopener noreferrer" aria-label="GaLaBau Beier Website öffnen">
                <img src="/galabau-beier-preview.png" alt="GaLaBau Beier Website mit dem Titel Wir gestalten Ihren Traumgarten." />
                <span className="project-card__visit" aria-hidden="true">↗</span>
              </a>
            ) : number === 5 ? (
              <a className="project-card__site-link" href="https://sonar-kypx.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Sonar Website öffnen">
                <img src="/sonar-preview.png" alt="Sonar Website mit einer violetten Kugel und dem Titel Architect the Sound." />
                <span className="project-card__visit" aria-hidden="true">↗</span>
              </a>
            ) : number === 6 ? (
              <a className="project-card__site-link" href="https://github.com/IljaDzhumelya24/Hidden-Local-Gems" target="_blank" rel="noopener noreferrer" aria-label="Hidden Local Gems auf GitHub öffnen">
                <img src="/hidden-local-gems-preview.png" alt="Hidden Local Gems Website mit grüner Karte und Reiseziel-Suche." />
                <span className="project-card__visit" aria-hidden="true">↗</span>
              </a>
            ) : (
              <>
                <span className="project-card__eyebrow">PROJECT / 0{number}</span>
                <h3>Project 0{number}</h3>
                <span className="project-card__count">0{number} / 06</span>
              </>
            )}
          </article>
        ))}
      </section>
      <div className="portal-rift" ref={riftRef}>
        <div className="portal-rift__scene" ref={sceneRef} aria-hidden="true" />
        <h2 className="portal-rift__title" aria-label="MY WORLD">
          <img className="portal-rift__word portal-rift__word--my" ref={myWordRef} src="/my-world.png" alt="" />
          <img className="portal-rift__word portal-rift__word--world" ref={worldWordRef} src="/my-world.png" alt="" />
        </h2>
      </div>
      <div className="hero-copy">
        <h1 className="hero-title">
          <span>BEYOND</span>
          <span>LIMITS</span>
        </h1>
        <p className="hero-description">
          I turn bold ideas into powerful digital
          <br />
          experiences. No boundaries. Just creativity
        </p>
        <button
          className="work-button"
          type="button"
          onClick={() => document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="work-button__label">EXPLORE WORK</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M5 19 19 5M7 5h12v12" />
          </svg>
        </button>
      </div>
      <AnimatedCharacter />
      <svg
        className="scroll-indicator"
        viewBox="0 0 24 40"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2v30m-8-8 8 8 8-8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <small className="copyright">© 2026 -- ALL RIGHTS RESERVED</small>
        </section>
        <div className="scroll-stage__end" id="work" aria-hidden="true" />
      </div>
      <section className={`fourth-scene${fourthHeaderVisible ? ' fourth-scene--header-visible' : ''}`} ref={fourthSceneRef} id="about" aria-label="Über mich">
        <svg className="fourth-scene__edge" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 67 C180 64 273 62 405 55 C549 48 598 21 732 27 C875 33 935 54 1062 49 C1201 43 1309 58 1440 61 L1440 80 H0 Z" />
        </svg>
        <SiteHeader dark />
        <div className="about-page">
          <div className="about-intro">
            <div className="about-intro__scene">
              <p className="about-intro__side"><span>[I]</span><span>ILJA.</span></p>
              <CubeMark />
              <p className="about-intro__side"><span>[D]</span><span>DZHUMELYA.</span></p>
            </div>
          </div>
          <div className="about-statement">
            <h2>HEY, I’M <em>ILJA.</em> I DESIGN AND BUILD WEBSITES THAT <em>STAND APART.</em></h2>
            <div className="about-statement__story">
              <p>I FINISHED MY IT ASSISTANT TRAINING. NOW I’M WORKING TOWARD MY <em>FACHABITUR</em> IN COMPUTER SCIENCE.</p>
              <img className="about-statement__flowers" src="/about-halftone-flowers.png" alt="" aria-hidden="true" />
            </div>
            <div className="about-statement__story">
              <dl className="about-statement__details" aria-label="Standort und Kontakt">
                <div className="about-statement__detail about-statement__detail--location">
                  <dt>C:</dt>
                  <dd>53°01&apos;33.2&quot;N, 8°37&apos;51.0&quot;E</dd>
                </div>
                <div className="about-statement__detail">
                  <dt>P:</dt>
                  <dd><a href="tel:+4915229772688">+49 1522 9772688</a></dd>
                </div>
                <div className="about-statement__detail">
                  <dt>E:</dt>
                  <dd><a href="mailto:iljadzhumelya24@gmail.com">iljadzhumelya24@gmail.com</a></dd>
                </div>
                <div className="about-statement__detail">
                  <dt>S:</dt>
                  <dd>iljadzhumelya</dd>
                </div>
              </dl>
              <p>I BUILD WEBSITES TO <em>STAND OUT.</em> AWAY FROM THE SCREEN, IT’S DARTS, FILMS, AND FRIENDS.</p>
            </div>
          </div>
          <div className="about-portrait-layout">
            <ol className="about-portrait-layout__notes">
              <li className="about-portrait-layout__note">
                <span>1</span>
                <p>I DESIGN AND BUILD WEBSITES WITH THE HELP OF AI.</p>
              </li>
              <li className="about-portrait-layout__note">
                <span>2</span>
                <p>EVERY PROJECT SHOULD HAVE SOMETHING THE OTHERS DON’T.</p>
              </li>
            </ol>
            <figure className="about-portrait" onPointerEnter={movePortraitReveal} onPointerMove={movePortraitReveal}>
              <img src="/about-portrait.png" alt="Schwarz-Weiß-Porträt von Ilja Dzhumelya" />
              <img className="about-portrait__reveal" src="/about-portrait.png" alt="" aria-hidden="true" />
            </figure>
          </div>
          <section className="about-approach" aria-label="Meine Arbeitsweise">
            <p className="about-approach__copy">I START WITH WHAT MAKES AN IDEA <em>DIFFERENT.</em> THEN I SHAPE THE DESIGN AND CODE UNTIL IT FEELS RIGHT.</p>
          </section>
          <section className="about-directions" aria-label="Mehr über mich">
            <ol className="about-directions__list">
              <li className="about-directions__item"><button className="about-directions__button" type="button">SKILL TREE — WHAT I CAN DO</button></li>
              <li className="about-directions__item"><button className="about-directions__button" type="button">TIMELINE — HOW I GOT HERE</button></li>
              <li className="about-directions__item"><button className="about-directions__button" type="button">TOOLBOX — WHAT I WORK WITH</button></li>
              <li className="about-directions__item"><button className="about-directions__button" type="button">SOCIALS — WHERE TO FIND ME</button></li>
            </ol>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
