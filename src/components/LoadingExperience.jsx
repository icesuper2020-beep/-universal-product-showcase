import { motion } from 'framer-motion'
import React from 'react'

const particles = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  x: `${8 + ((index * 37) % 84)}%`,
  y: `${10 + ((index * 53) % 78)}%`,
  delay: (index % 9) * 0.06,
}))

const cluster = Array.from({ length: 54 }, (_, index) => {
  const row = Math.floor(index / 9)
  const column = index % 9
  const leftEdge = 18 + row * 5
  const rightEdge = 82 - row * 5
  const isBridge = row === 3 && column > 1 && column < 7
  const x = isBridge ? 27 + column * 6 : (column < 5 ? leftEdge + column * 1.3 : rightEdge - (8 - column) * 1.3)
  return { id: index, x, y: 12 + row * 13, delay: index * 0.018 }
})

export default function LoadingExperience({ progress, leaving }) {
  return (
    <motion.div
      className="loader"
      animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 1.015 : 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`Initializing experience ${progress}%`}
    >
      <div className="loader-particles" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            style={{ left: particle.x, top: particle.y, animationDelay: `${particle.delay}s` }}
          />
        ))}
      </div>
      <div className="loader-cluster" aria-hidden="true">
        {cluster.map((dot) => <i key={dot.id} style={{ left: `${dot.x}%`, top: `${dot.y}%`, animationDelay: `${dot.delay}s` }} />)}
      </div>
      <p className="loader-brand">AERON</p>
      <div className="loader-status">
        <span>ASSEMBLING THE EXPERIENCE</span>
        <span>{String(progress).padStart(3, '0')}%</span>
      </div>
      <div className="loader-track"><span style={{ width: `${progress}%` }} /></div>
    </motion.div>
  )
}
