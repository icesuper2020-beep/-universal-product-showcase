import { ContactShadows, Float, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import React from 'react'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const shell = new THREE.MeshPhysicalMaterial({
  color: '#242830', metalness: 0.92, roughness: 0.22, clearcoat: 0.45, clearcoatRoughness: 0.2,
})
const keyMaterial = new THREE.MeshStandardMaterial({ color: '#111319', metalness: 0.5, roughness: 0.38 })

function Keyboard() {
  const keys = useMemo(() => {
    const result = []
    const rows = [14, 14, 13, 12, 10]
    rows.forEach((count, row) => {
      const width = 0.27
      const gap = 0.055
      const total = count * width + (count - 1) * gap
      for (let column = 0; column < count; column += 1) {
        result.push({
          key: `${row}-${column}`,
          position: [-total / 2 + width / 2 + column * (width + gap), 0.205, -0.9 + row * 0.34],
        })
      }
    })
    return result
  }, [])

  return keys.map(({ key, position }) => (
    <RoundedBox key={key} args={[0.27, 0.055, 0.27]} radius={0.035} smoothness={2} position={position} material={keyMaterial} />
  ))
}

function Speaker({ x }) {
  return Array.from({ length: 24 }, (_, index) => (
    <mesh key={index} position={[x + (index % 4) * 0.075, 0.207, -0.9 + Math.floor(index / 4) * 0.18]}>
      <cylinderGeometry args={[0.014, 0.014, 0.012, 8]} />
      <meshBasicMaterial color="#0b0d11" />
    </mesh>
  ))
}

function Laptop({ pointer, dragging, onDisplayFocus }) {
  const product = useRef()
  const lid = useRef()
  const [displayFocused, setDisplayFocused] = useState(false)
  const target = useRef({ x: -0.12, y: -0.22 })

  useFrame((state, delta) => {
    if (!product.current || !lid.current) return
    const deadZone = Math.abs(pointer.current.x) < 0.11 && Math.abs(pointer.current.y) < 0.11
    const focusFactor = displayFocused ? 0.08 : 1
    target.current.y = deadZone ? -0.22 : -0.22 + pointer.current.x * 0.34 * focusFactor
    target.current.x = deadZone ? -0.12 : -0.12 - pointer.current.y * 0.14 * focusFactor
    const damping = 1 - Math.exp(-delta * (dragging.current ? 7 : 4.2))
    product.current.rotation.y = THREE.MathUtils.lerp(product.current.rotation.y, target.current.y, damping)
    product.current.rotation.x = THREE.MathUtils.lerp(product.current.rotation.x, target.current.x, damping)
    lid.current.rotation.x = THREE.MathUtils.lerp(lid.current.rotation.x, displayFocused ? -1.88 : -1.77, 1 - Math.exp(-delta * 3.2))
  })

  const focusDisplay = (value) => {
    setDisplayFocused(value)
    onDisplayFocus(value)
  }

  return (
    <Float speed={0.72} rotationIntensity={0.035} floatIntensity={0.12}>
      <group ref={product} rotation={[-0.12, -0.22, 0]} scale={0.92}>
        <RoundedBox args={[5.35, 0.22, 3.35]} radius={0.16} smoothness={5} material={shell} position={[0, 0, 0]} />
        <mesh position={[0, 0.122, 0.02]}>
          <boxGeometry args={[5.08, 0.035, 3.08]} />
          <meshStandardMaterial color="#30343c" metalness={0.78} roughness={0.27} />
        </mesh>
        <Keyboard />
        <Speaker x={-2.25} />
        <Speaker x={1.98} />
        <RoundedBox args={[2.05, 0.035, 1.05]} radius={0.055} smoothness={4} position={[0, 0.208, 0.91]}>
          <meshStandardMaterial color="#383c44" metalness={0.82} roughness={0.23} />
        </RoundedBox>
        <RoundedBox args={[0.78, 0.25, 0.1]} radius={0.04} smoothness={3} position={[0, 0.02, -1.59]} material={shell} />

        <group ref={lid} position={[0, 0.08, -1.57]} rotation={[-1.77, 0, 0]}>
          <RoundedBox args={[5.16, 3.22, 0.16]} radius={0.16} smoothness={6} material={shell} position={[0, 1.61, 0]} />
          <RoundedBox
            args={[4.82, 2.87, 0.035]}
            radius={0.09}
            smoothness={5}
            position={[0, 1.61, 0.102]}
            onPointerEnter={() => focusDisplay(true)}
            onPointerLeave={() => focusDisplay(false)}
          >
            <meshBasicMaterial color="#07111f" />
          </RoundedBox>
          <mesh position={[0, 1.61, 0.125]}>
            <planeGeometry args={[4.62, 2.67]} />
            <shaderMaterial
              uniforms={{ uTime: { value: 0 } }}
              vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
              fragmentShader="varying vec2 vUv; void main(){float glow=.18/(distance(vUv,vec2(.72,.56))+.18); vec3 c=mix(vec3(.015,.03,.08),vec3(.08,.27,.62),smoothstep(.15,.95,vUv.x)); c+=vec3(.16,.1,.5)*glow*.35; gl_FragColor=vec4(c,1.); }"
            />
          </mesh>
          <mesh position={[0, 3.02, 0.126]}>
            <circleGeometry args={[0.032, 18]} />
            <meshBasicMaterial color="#111923" />
          </mesh>
        </group>
      </group>
    </Float>
  )
}

export default function AeronScene({ pointer, dragging, onDisplayFocus }) {
  return (
    <Canvas camera={{ position: [0.15, 3.4, 8.4], fov: 36 }} dpr={[1, 1.65]} gl={{ antialias: true, alpha: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 7, 6]} intensity={4.2} color="#fffdf6" />
        <directionalLight position={[-5, 2, 3]} intensity={2.4} color="#a8c8ff" />
        <spotLight position={[1, 5, -4]} intensity={8} angle={0.45} penumbra={1} color="#758dff" />
        <Laptop pointer={pointer} dragging={dragging} onDisplayFocus={onDisplayFocus} />
        <ContactShadows position={[0, -0.32, 0]} opacity={0.22} scale={8} blur={2.8} far={3.5} />
      </Suspense>
    </Canvas>
  )
}
