import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { useEffect, useRef, useState } from 'react'
import AeronScene from './components/AeronScene'
import LoadingExperience from './components/LoadingExperience'

const FEATURES = [
  { id: 'performance', number: '01', eyebrow: 'AERON SILICON', title: 'Power without the noise.', metric: '12-core', metricLabel: 'hybrid architecture', body: 'A precision-tuned performance system that stays responsive, cool and remarkably quiet—whether you are creating, rendering or moving between worlds.', color: '#b28e69' },
  { id: 'display', number: '02', eyebrow: 'LUMINA DISPLAY', title: 'Every detail, illuminated.', metric: '3.2K', metricLabel: 'ultra-clear canvas', body: 'Deep contrast, fluid motion and calibrated colour turn every frame into an immersive workspace built for ambitious ideas.', color: '#c4a47e' },
  { id: 'cooling', number: '03', eyebrow: 'SILENT FLOW', title: 'Engineered to breathe.', metric: '38%', metricLabel: 'more airflow', body: 'A sculpted internal airflow system moves heat silently through independent thermal channels without interrupting your focus.', color: '#d2b896' },
  { id: 'battery', number: '04', eyebrow: 'ENDURANCE CELL', title: 'Leave the charger behind.', metric: '20h', metricLabel: 'all-day power', body: 'Intelligent power orchestration learns your rhythm and delivers lasting performance from the first meeting to the final export.', color: '#9b8166' },
  { id: 'connect', number: '05', eyebrow: 'SEAMLESS I/O', title: 'Everything connects.', metric: '40Gb/s', metricLabel: 'high-speed transfer', body: 'A complete high-bandwidth connection system keeps displays, storage and creative tools moving at full speed.', color: '#b69a79' },
]

const PRODUCT_COLORS = [
  { id: 'midnight', label: 'Midnight', hex: '#111827' },
  { id: 'titanium', label: 'Titanium', hex: '#777c84' },
  { id: 'silver', label: 'Silver', hex: '#c6c9ce' },
]

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function ProductFallback() {
  return (
    <div className="fallback-product" aria-label="Interactive Aeron One laptop preview">
      <div className="fallback-lid">
        <div className="fallback-screen"><span>BEYOND THIN.</span><small>ENGINEERED FOR POSSIBILITY</small></div>
        <i className="fallback-camera" />
      </div>
      <div className="fallback-base">
        <div className="fallback-keyboard">{Array.from({ length: 54 }, (_, index) => <i key={index} />)}</div>
        <div className="fallback-trackpad" />
      </div>
      <div className="fallback-shadow" />
    </div>
  )
}

export default function App() {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [displayFocused, setDisplayFocused] = useState(false)
  const [displayOpen, setDisplayOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const [productColor, setProductColor] = useState('midnight')
  const [soundOn, setSoundOn] = useState(false)
  const pointer = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const webGLAvailable = useRef(supportsWebGL())
  const audioNodes = useRef(null)

  useEffect(() => {
    if (!soundOn) return undefined
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return undefined
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    oscillator.type = 'sine'
    oscillator.frequency.value = 56
    filter.type = 'lowpass'
    filter.frequency.value = 180
    gain.gain.value = .014
    oscillator.connect(filter).connect(gain).connect(context.destination)
    oscillator.start()
    audioNodes.current = { context, oscillator }
    return () => {
      oscillator.stop()
      context.close()
      audioNodes.current = null
    }
  }, [soundOn])

  const playAccent = (frequency = 330) => {
    if (!soundOn || !audioNodes.current) return
    const { context } = audioNodes.current
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.55, context.currentTime + .32)
    gain.gain.setValueAtTime(.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(.08, context.currentTime + .025)
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .42)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + .44)
  }

  const enterDisplay = (featureIndex = 0) => {
    setActiveFeature(featureIndex)
    setSearchOpen(false)
    setDisplayOpen(true)
    playAccent(280)
  }

  useEffect(() => {
    const modalOpen = displayOpen || searchOpen
    document.body.style.overflow = modalOpen ? 'hidden' : ''
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setDisplayOpen(false)
      setSearchOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [displayOpen, searchOpen])

  useEffect(() => {
    const started = performance.now()
    let frame
    const tick = (time) => {
      const value = Math.min(100, Math.round(((time - started) / 2700) * 100))
      setProgress(value)
      if (value < 100) frame = requestAnimationFrame(tick)
      else {
        setLeaving(true)
        window.setTimeout(() => setReady(true), 650)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const updatePointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.current.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
    event.currentTarget.style.setProperty('--pointer-x', `${pointer.current.x * 7}deg`)
    event.currentTarget.style.setProperty('--pointer-y', `${pointer.current.y * -3}deg`)
  }

  return (
    <main>
      <AnimatePresence>{!ready && <LoadingExperience progress={progress} leaving={leaving} />}</AnimatePresence>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#experience" aria-label="Aeron home"><span className="brand-mark">A</span><span>AERON</span></a>
        <div className="nav-links"><a href="#experience">Experience</a><a href="#design">Design</a><a href="#contact">Contact</a></div>
        <button className={`sound-toggle ${soundOn ? 'is-on' : ''}`} type="button" aria-pressed={soundOn} onClick={() => setSoundOn((value) => !value)}>{soundOn ? 'SOUND ON' : 'SOUND OFF'}</button>
      </nav>

      <section
        id="experience"
        className={`hero ${displayFocused ? 'display-focused' : ''}`}
        onPointerMove={updatePointer}
        onPointerDown={() => { dragging.current = true }}
        onPointerUp={() => { dragging.current = false }}
        onPointerLeave={() => { dragging.current = false; pointer.current = { x: 0, y: 0 } }}
      >
        <div className="hero-copy">
          <motion.p initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.15, duration: .7 }}>AERON ONE</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 42, filter: 'blur(12px)' }} animate={ready ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}} transition={{ delay: 1.35, duration: 1.05, ease: [0.22, 1, 0.36, 1] }}>Light,<span>reimagined.</span></motion.h1>
          <motion.p className="hero-description" initial={{ opacity: 0, y: 18 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.85, duration: .75 }}>Powerful enough for everything.<br />Light enough for anywhere.</motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 2.15, duration: .7 }}>
            <button className="primary-cta" type="button" onClick={() => enterDisplay(0)}>Explore the experience</button>
            <a className="text-link" href="#design">Discover the design <span>↗</span></a>
          </motion.div>
        </div>
        <motion.div className="product-stage" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ duration: .35 }}>
          {webGLAvailable.current
            ? ready && <AeronScene pointer={pointer} dragging={dragging} productColor={productColor} onDisplayFocus={setDisplayFocused} onOpen={() => enterDisplay(1)} onSearch={() => { setSearchOpen(true); playAccent(420) }} />
            : <ProductFallback />}
          <div className="color-selector" aria-label="Choose chassis finish">
            <span>FINISH</span>
            {PRODUCT_COLORS.map((finish) => <button key={finish.id} type="button" className={productColor === finish.id ? 'active' : ''} style={{ '--swatch': finish.hex }} onClick={() => { setProductColor(finish.id); playAccent(360) }} aria-label={finish.label} title={finish.label} />)}
          </div>
          <div className="interaction-hint"><span /> {displayFocused ? 'DISPLAY STABILIZED' : 'MOVE TO EXPLORE'}</div>
        </motion.div>
        <div className="hero-index">01 <span>/</span> 05</div>
        <a className="scroll-cue" href="#design"><span>SCROLL TO DISCOVER</span><i /></a>
      </section>

      <AnimatePresence>
        {displayOpen && (
          <motion.div className="display-portal" initial={{ opacity: 0, clipPath: 'circle(3% at 72% 48%)' }} animate={{ opacity: 1, clipPath: 'circle(145% at 72% 48%)' }} exit={{ opacity: 0, clipPath: 'circle(3% at 72% 48%)' }} transition={{ duration: .85, ease: [0.22, 1, 0.36, 1] }}>
            <motion.div className="display-portal-card" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} transition={{ delay: .22, duration: .65 }}>
              <button type="button" onClick={() => setDisplayOpen(false)} aria-label="Close experience">×</button>
              <div className="portal-topline"><span>AERON ONE / INTERACTIVE SYSTEM</span><span>{FEATURES[activeFeature].number} — 05</span></div>
              <div className="portal-experience">
                <div className="portal-copy" key={FEATURES[activeFeature].id}>
                  <p>{FEATURES[activeFeature].eyebrow}</p>
                  <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>{FEATURES[activeFeature].title}</motion.h2>
                  <motion.p className="portal-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .18 }}>{FEATURES[activeFeature].body}</motion.p>
                  <div className="portal-metric"><strong>{FEATURES[activeFeature].metric}</strong><span>{FEATURES[activeFeature].metricLabel}</span></div>
                </div>
                <div className={`portal-visual feature-${FEATURES[activeFeature].id}`} style={{ '--feature-color': FEATURES[activeFeature].color }}>
                  <div className="exploded-device"><i className="layer-display" /><i className="layer-board" /><i className="layer-thermal" /><i className="layer-base" /></div>
                  <span className="visual-orbit orbit-one" /><span className="visual-orbit orbit-two" />
                </div>
              </div>
              <div className="feature-nav">{FEATURES.map((feature, index) => <button key={feature.id} type="button" className={index === activeFeature ? 'active' : ''} onClick={() => { setActiveFeature(index); playAccent(300 + index * 38) }}><span>{feature.number}</span>{feature.eyebrow}</button>)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div className="command-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSearchOpen(false)}>
            <motion.div className="command-panel" initial={{ y: 32, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
              <div className="command-header"><span>AERON COMMAND</span><button type="button" onClick={() => setSearchOpen(false)}>ESC</button></div>
              <label><span>⌕</span><input autoFocus placeholder="Ask anything about Aeron One…" /></label>
              <div className="command-suggestions"><button onClick={() => enterDisplay(0)}>Explore performance</button><button onClick={() => enterDisplay(2)}>Show cooling system</button><button onClick={() => enterDisplay(3)}>Check battery life</button></div>
              <p>Click the keyboard anytime to reopen command.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section id="design" className="manifesto">
        <p>PRECISION, MADE VISIBLE</p>
        <h2>Your product deserves<br />more than a product page.</h2>
        <p className="manifesto-copy">A reusable interactive canvas for products that deserve to be explored, understood and remembered.</p>
        <div className="manifesto-features">{FEATURES.slice(0, 4).map((feature, index) => <button key={feature.id} type="button" onClick={() => enterDisplay(index)}><span>{feature.number}</span><strong>{feature.metric}</strong><small>{feature.eyebrow}</small></button>)}</div>
      </section>

      <section id="contact" className="contact">
        <p>AN INTERACTIVE PRODUCT EXPERIENCE BY</p>
        <h2>APEX MEDIA</h2>
        <a href="mailto:info@mediaapex.in">BUILD THE EXPERIENCE <span>↗</span></a>
      </section>
    </main>
  )
}
