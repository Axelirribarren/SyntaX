import { useEffect, useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

const VIDEO_SOURCE = '/Minimal_monochrome_animation.mp4'

export default function HumanMachineSequence() {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end']
  })

  const sceneOpacity = useTransform(scrollYProgress, [0, 0.2, 0.56, 0.74, 1], [0, 1, 1, 0.68, 0])
  const sceneScale = useTransform(scrollYProgress, [0, 0.2, 0.7, 1], [0.97, 1, 1, 0.965])
  const sceneY = useTransform(scrollYProgress, [0, 0.2, 1], [reducedMotion ? 0 : 20, 0, 0])
  const signalOpacity = useTransform(scrollYProgress, [0.5, 0.57, 0.66, 0.72], [0, 0.18, 1, 0])
  const signalScale = useTransform(scrollYProgress, [0.52, 0.67, 0.72], [0.82, 1.18, 1.36])
  const handoffOpacity = useTransform(scrollYProgress, [0.68, 0.82, 1], [0, 1, 1])
  const handoffY = useTransform(scrollYProgress, [0.68, 0.84], [reducedMotion ? 0 : 28, 0])
  const indexOpacity = useTransform(scrollYProgress, [0.04, 0.18, 0.64, 0.74], [0, 1, 1, 0])

  useEffect(() => {
    const video = videoRef.current
    const section = sectionRef.current
    if (!video || !section) return undefined

    // El scroll controla la puesta en escena, no el reloj del MP4. Buscar un
    // frame en cada evento de scroll depende demasiado de los keyframes del
    // archivo y suele producir saltos visibles, especialmente en iOS.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    }, { rootMargin: '20% 0px', threshold: 0.01 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="human-machine-sequence"
      aria-label="Encuentro visual entre creatividad humana y capacidad digital"
    >
      <div className="human-machine-sticky">
        <motion.div
          className="human-machine-visual"
          style={{ opacity: sceneOpacity, scale: sceneScale, y: sceneY }}
        >
          <video
            ref={videoRef}
            className="human-machine-video"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src={VIDEO_SOURCE} type="video/mp4" />
          </video>

          <motion.div
            className="contact-signal"
            style={{ opacity: signalOpacity, scale: signalScale }}
            aria-hidden="true"
          >
            <span />
          </motion.div>
        </motion.div>

        <motion.div className="human-machine-index" style={{ opacity: indexOpacity }} aria-hidden="true">
          <span>HUMAN</span>
          <i />
          <span>SYNTHETIC</span>
        </motion.div>

        <motion.div
          className="capability-handoff"
          style={{ opacity: handoffOpacity, y: handoffY }}
        >
          <p>La idea cruza el umbral.</p>
          <h3>Skills <span>/</span> MCP <span>/</span> Plugins <span>/</span> Agents</h3>
          <small>SyntaX compone las capacidades que la vuelven ejecutable.</small>
        </motion.div>

        <motion.div className="sequence-progress" style={{ opacity: indexOpacity }} aria-hidden="true">
          <motion.span style={{ scaleX: scrollYProgress }} />
        </motion.div>
      </div>
    </section>
  )
}
