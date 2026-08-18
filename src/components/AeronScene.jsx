import { ContactShadows, Float, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import React from 'react'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const shell = new THREE.MeshPhysicalMaterial({
  color: '#1d2838', metalness: 0.96, roughness: 0.2, clearcoat: 0.62, clearcoatRoughness: 0.16,
})
const keyMaterial = new THREE.MeshPhysicalMaterial({ color: '#0b1018', metalness: 0.62, roughness: 0.28, clearcoat: 0.25 })

function Keyboard() {
  const keys = useMemo(() => {
    const result = []
    const rows = [14, 14, 13, 12, 10]
    rows.forEach((count, row) => {
      const width = 0.265
      const gap = 0.05
      const total = count * width + (count - 1) * gap
      for (let column = 0; column < count; column += 1) {
        result.push({
          key: `${row}-${column}`,
          position: [-total / 2 + width / 2 + column * (width + gap), 0.142, -0.91 + row * 0.325],
        })
      }
    })
    return result
  }, [])

  return keys.map(({ key, position }) => (
    <RoundedBox key={key} args={[0.265, 0.032, 0.255]} radius={0.038} smoothness={3} position={position} material={keyMaterial} />
  ))
}

function Speaker({ x }) {
  return Array.from({ length: 24 }, (_, index) => (
    <mesh key={index} position={[x + (index % 4) * 0.07, 0.143, -0.88 + Math.floor(index / 4) * 0.17]}>
      <cylinderGeometry args={[0.011, 0.011, 0.009, 10]} />
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
    // The lid geometry is authored upright in the XY plane. Small negative
    // rotations create a natural open-laptop angle; -PI/2 would lay it flat.
    lid.current.rotation.x = THREE.MathUtils.lerp(lid.current.rotation.x, displayFocused ? -0.06 : -0.18, 1 - Math.exp(-delta * 3.2))
  })

  const focusDisplay = (value) => {
    setDisplayFocused(value)
    onDisplayFocus(value)
  }

  return (
    <Float speed={0.72} rotationIntensity={0.035} floatIntensity={0.12}>
      <group ref={product} position={[0, -0.48, 0]} rotation={[-0.11, -0.22, 0]} scale={0.94}>
        {/* ultra-thin machined aluminium lower shell */}
        <RoundedBox args={[5.42, 0.14, 3.38]} radius={0.14} smoothness={7} material={shell} position={[0, 0, 0]} />
        <RoundedBox args={[5.28, 0.035, 3.22]} radius={0.11} smoothness={6} position={[0, 0.09, 0]}>
          <meshPhysicalMaterial color="#263348" metalness={0.94} roughness={0.19} clearcoat={0.5} />
        </RoundedBox>
        {/* polished front chamfer */}
        <mesh position={[0, 0.008, 1.695]}>
          <boxGeometry args={[4.8, 0.035, 0.025]} />
          <meshPhysicalMaterial color="#73849a" metalness={1} roughness={0.12} />
        </mesh>
        <Keyboard />
        <Speaker x={-2.25} />
        <Speaker x={1.98} />
        <RoundedBox args={[2.18, 0.018, 1.08]} radius={0.075} smoothness={5} position={[0, 0.135, 0.94]}>
          <meshPhysicalMaterial color="#2a374b" metalness={0.84} roughness={0.18} clearcoat={0.55} />
        </RoundedBox>
        <RoundedBox args={[0.9, 0.13, 0.095]} radius={0.045} smoothness={4} position={[0, 0.035, -1.61]} material={shell} />
        {/* subtle side I/O details */}
        <mesh position={[-2.69, 0.015, -0.62]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.025, 0.18, 5, 12]} />
          <meshBasicMaterial color="#05080d" />
        </mesh>
        <mesh position={[-2.69, 0.015, -0.22]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.025, 0.16, 5, 12]} />
          <meshBasicMaterial color="#05080d" />
        </mesh>

        <group ref={lid} position={[0, 0.08, -1.57]} rotation={[-0.18, 0, 0]}>
          <RoundedBox args={[5.18, 3.24, 0.105]} radius={0.14} smoothness={8} material={shell} position={[0, 1.62, 0]} />
          <RoundedBox
            args={[4.98, 3.04, 0.022]}
            radius={0.08}
            smoothness={7}
            position={[0, 1.62, 0.066]}
            onPointerEnter={() => focusDisplay(true)}
            onPointerLeave={() => focusDisplay(false)}
          >
            <meshBasicMaterial color="#07111f" />
          </RoundedBox>
          <mesh position={[0, 1.62, 0.081]}>
            <planeGeometry args={[4.84, 2.9]} />
            <shaderMaterial
              uniforms={{ uTime: { value: 0 } }}
              vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
              fragmentShader="varying vec2 vUv; void main(){float d=distance(vUv,vec2(.68,.54)); float glow=.16/(d+.14); vec3 c=mix(vec3(.006,.018,.05),vec3(.025,.19,.58),smoothstep(.03,.98,vUv.x)); c+=vec3(.12,.08,.48)*glow*.45; c+=vec3(.06,.3,.78)*smoothstep(.34,.0,abs(d-.28))*.42; gl_FragColor=vec4(c,1.); }"
            />
          </mesh>
          <mesh position={[0, 3.12, 0.083]}>
            <circleGeometry args={[0.026, 24]} />
            <meshBasicMaterial color="#111923" />
          </mesh>
        </group>
      </group>
    </Float>
  )
}

export default function AeronScene({ pointer, dragging, onDisplayFocus }) {
  return (
    <Canvas camera={{ position: [0.12, 3.15, 8.7], fov: 35 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={1.65} />
        <directionalLight position={[4, 7, 6]} intensity={5.8} color="#fffdf6" />
        <directionalLight position={[-5, 3, 4]} intensity={3.2} color="#b9d6ff" />
        <spotLight position={[1, 5, -4]} intensity={10} angle={0.45} penumbra={1} color="#719cff" />
        <pointLight position={[0, -1, 4]} intensity={2.2} color="#6ca7ff" />
        <Laptop pointer={pointer} dragging={dragging} onDisplayFocus={onDisplayFocus} />
        <ContactShadows position={[0, -0.58, 0]} opacity={0.28} scale={8} blur={3.2} far={3.5} />
      </Suspense>
    </Canvas>
  )
}
