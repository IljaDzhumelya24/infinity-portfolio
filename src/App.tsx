import { HandReveal } from './HandReveal'
import './App.css'

function App() {
  return (
    <main className="black-screen" id="top" aria-label="Portfolio">
      <header className="site-header">
        <nav className="site-nav" aria-label="Hauptnavigation">
          <a className="top-logo" href="#top" aria-label="Ilja Dzhumelya – Startseite">
            <img src="/logo-white.png" alt="Ilja Dzhumelya" />
          </a>
        </nav>
      </header>
      <h1 className="hero-title">
        <span className="visually-hidden">INFINITY</span>
        <span className="hero-title__glass" aria-hidden="true" />
      </h1>
      <div className="visual-card" role="img" aria-label="Abstrakter Farbverlauf in Rot, Orange und Türkis" />
      <HandReveal />
    </main>
  )
}

export default App
