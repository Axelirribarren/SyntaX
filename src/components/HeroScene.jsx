import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import { MathUtils } from 'three'
import { useRef } from 'react'

function Sculpture({ reducedMotion }) {
  const core = useRef(null)
  const { pointer } = useThree()

  useFrame((state) => {
    if (!core.current || reducedMotion) return
    core.current.rotation.y = MathUtils.lerp(core.current.rotation.y, -0.45 + pointer.x * 0.24, 0.045)
    core.current.rotation.x = MathUtils.lerp(core.current.rotation.x, -0.2 - pointer.y * 0.16, 0.045)
    core.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.06
  })

  return (
    <group ref={core} rotation={[-0.2, -0.45, 0.08]}>
      <Float speed={reducedMotion ? 0 : 1.25} rotationIntensity={0.35} floatIntensity={0.45}>
        <mesh position={[0.25, 0.15, 0]}>
          <icosahedronGeometry args={[1.45, 3]} />
          <meshPhysicalMaterial
            color="#876cff"
            emissive="#38208f"
            emissiveIntensity={0.58}
            metalness={0.48}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.18}
            transparent
            opacity={0.82}
          />
        </mesh>
        <mesh scale={1.04} position={[0.25, 0.15, 0]}>
          <icosahedronGeometry args={[1.45, 2]} />
          <meshBasicMaterial color="#8cf8ff" wireframe transparent opacity={0.2} />
        </mesh>
      </Float>

      <Float speed={reducedMotion ? 0 : 1.7} rotationIntensity={0.75} floatIntensity={0.3}>
        <mesh position={[-1.6, 1.15, -0.7]} rotation={[0.5, 0.3, 0.2]}>
          <torusGeometry args={[0.48, 0.08, 16, 72]} />
          <meshStandardMaterial color="#a7ff83" emissive="#3f7c2d" emissiveIntensity={0.55} />
        </mesh>
      </Float>

      <Float speed={reducedMotion ? 0 : 1.05} rotationIntensity={0.55} floatIntensity={0.5}>
        <mesh position={[1.05, -1.32, 0.2]} rotation={[0.2, 0.5, 0.25]}>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#ffce7a" wireframe />
        </mesh>
      </Float>

      <Sparkles count={reducedMotion ? 18 : 54} scale={[6, 4.5, 3]} size={1.7} speed={reducedMotion ? 0 : 0.32} color="#bff9ff" opacity={0.65} />
    </group>
  )
}

export default function HeroScene() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="hero-scene" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 42 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} color="#dffcff" />
        <pointLight position={[-4, -2, 3]} intensity={20} color="#876cff" distance={9} />
        <pointLight position={[4, 1, 2]} intensity={11} color="#73f2ff" distance={8} />
        <Sculpture reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
