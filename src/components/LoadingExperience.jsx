import { motion } from 'framer-motion'

const particles = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  x: `${8 + ((index * 37) % 84)}%`,
  y: `${10 + ((index * 53) % 78)}%`,
  delay: (index % 9) * 0.06,
}))

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
      <div className="loader-mark" aria-hidden="true">
        <span className="loader-mark-left" />
        <span className="loader-mark-right" />
        <span className="loader-mark-core" />
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
