import { motion, useReducedMotion } from 'motion/react'

export default function LaunchScreen() {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className="launch-screen"
      role="status"
      aria-live="polite"
      aria-label="Preparando SyntaX"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: reducedMotion ? 'none' : 'blur(12px)' }}
      transition={{ duration: reducedMotion ? 0.12 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="launch-aura" />
      <motion.div
        className="launch-core"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <span>S</span><b>×</b>
      </motion.div>
      <div className="launch-copy">
        <strong>SyntaX</strong>
        <span>INDEXANDO CAPACIDADES</span>
      </div>
      <div className="launch-track"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reducedMotion ? 0.1 : 0.72, ease: 'easeOut' }} /></div>
    </motion.div>
  )
}
