import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { useEffect, useRef, useState } from 'react'
import AeronScene from './components/AeronScene'
import LoadingExperience from './components/LoadingExperience'

export default function App() {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [displayFocused, setDisplayFocused] = useState(false)
  const pointer = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)

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
  }

  return (
    <main>
      <AnimatePresence>{!ready && <LoadingExperience progress={progress} leaving={leaving} />}</AnimatePresence>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#experience" aria-label="Aeron home"><span className="brand-mark">A</span><span>AERON</span></a>
        <div className="nav-links"><a href="#experience">Experience</a><a href="#design">Design</a><a href="#contact">Contact</a></div>
        <button className="sound-toggle" type="button" aria-label="Sound is off">SOUND OFF</button>
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
          <motion.p initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2 }}>AERON ONE</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 32 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3, duration: 0.9 }}>Light,<br /><span>reimagined.</span></motion.h1>
          <motion.p className="hero-description" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.65 }}>Powerful enough for everything.<br />Light enough for anywhere.</motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.8 }}>
            <a className="primary-cta" href="#design">Explore the experience</a>
            <a className="text-link" href="#design">Discover the design <span>↗</span></a>
          </motion.div>
        </div>
        <motion.div className="product-stage" initial={{ opacity: 0, scale: 0.86, x: 80 }} animate={ready ? { opacity: 1, scale: 1, x: 0 } : {}} transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}>
          <AeronScene pointer={pointer} dragging={dragging} onDisplayFocus={setDisplayFocused} />
          <div className="interaction-hint"><span /> {displayFocused ? 'DISPLAY STABILIZED' : 'MOVE TO EXPLORE'}</div>
        </motion.div>
        <div className="hero-index">01 <span>/</span> 05</div>
        <a className="scroll-cue" href="#design"><span>SCROLL TO DISCOVER</span><i /></a>
      </section>

      <section id="design" className="manifesto">
        <p>PRECISION, MADE VISIBLE</p>
        <h2>Your product deserves<br />more than a product page.</h2>
        <p className="manifesto-copy">A reusable interactive canvas for products that deserve to be explored, understood and remembered.</p>
      </section>

      <section id="contact" className="contact">
        <p>AN INTERACTIVE PRODUCT EXPERIENCE BY</p>
        <h2>APEX MEDIA</h2>
        <a href="mailto:info@mediaapex.in">BUILD THE EXPERIENCE <span>↗</span></a>
      </section>
    </main>
  )
}
