import { ContactShadows, Float, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const MODEL_URL = '/laptop-3d-model-asus-tuf-dash-f15-2022/source/LAPTOP.glb'
const BRAND_OBJECT_PATTERN = /asus|tuf[_ ]?logo|outer[_ ]logo|^tuf$/i
const BRAND_MATERIAL_PATTERN = /asus|tuf[_ ]?logo|outer[_ ]logo/i
const CLOSED_HINGE = Math.PI - .018
const FRONT_YAW = -Math.PI / 2
const HERO_YAW = FRONT_YAW - .3
const ARRIVAL_YAW = HERO_YAW - .72

function buildScreenTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1280
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(1360, 550, 20, 1130, 640, 1040)
  gradient.addColorStop(0, '#5578ff')
  gradient.addColorStop(.24, '#284de4')
  gradient.addColorStop(.52, '#10256f')
  gradient.addColorStop(1, '#020716')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.fillStyle = '#dce8ff'
  context.font = '700 31px Arial'
  context.shadowColor = 'rgba(112,150,255,.65)'
  context.shadowBlur = 8
  context.fillText('A E R O N   O N E   E X P E R I E N C E', 1024, 464)
  context.fillStyle = '#ffffff'
  context.font = '600 154px Arial'
  context.shadowBlur = 14
  context.fillText('Go inside.', 1024, 680)
  context.strokeStyle = 'rgba(210,229,255,.72)'
  context.lineWidth = 4
  context.beginPath()
  context.roundRect(774, 752, 500, 106, 53)
  context.stroke()
  context.font = '700 29px Arial'
  context.fillStyle = '#f3f7ff'
  context.shadowBlur = 5
  context.fillText('OPEN THE DISPLAY  →', 1024, 819)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.anisotropy = 16
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return texture
}

function RealLaptop({ pointer, dragging, productColor, onDisplayFocus, onOpen, onSearch }) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const product = useRef()
  const revealLight = useRef()
  const screenMaterial = useRef()
  const introTime = useRef(0)
  const target = useRef({ x: -.32, y: ARRIVAL_YAW })
  const [displayFocused, setDisplayFocused] = useState(false)
  const screenTexture = useMemo(buildScreenTexture, [])
  // GLTFLoader sanitizes spaces in node names to underscores.
  const displayNode = useMemo(() => model.getObjectByName('laptop_display') || model.getObjectByName('laptop display'), [model])
  const modelFit = useMemo(() => {
    // The downloaded GLB uses authoring-unit transforms, so a fixed scale makes
    // it appear tiny. Fit it to a predictable hero width and pivot around its
    // visual centre so cursor rotation stays smooth and balanced.
    model.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const longestHorizontalSide = Math.max(size.x, size.z, .001)
    return {
      scale: 4.7 / longestHorizontalSide,
      offset: center.multiplyScalar(-1),
    }
  }, [model])
  const openHinge = useMemo(() => displayNode?.rotation.z ?? 1.136, [displayNode])

  // Close the physical hinge before the browser paints the very first frame.
  // Directly controlling the authored Z hinge is more reliable for this GLB
  // than composing an additional quaternion rotation.
  useLayoutEffect(() => {
    if (displayNode) displayNode.rotation.z = CLOSED_HINGE
  }, [displayNode])

  useEffect(() => {
    model.traverse((object) => {
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
      const isBrandElement = BRAND_OBJECT_PATTERN.test(object.name) || objectMaterials.some((material) => material && BRAND_MATERIAL_PATTERN.test(material.name))
      if (isBrandElement) object.visible = false
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
        objectMaterials.filter(Boolean).forEach((material) => {
          material.envMapIntensity = 1.1
          if (material.metalness !== undefined) material.metalness = Math.max(material.metalness, .35)
          if (material.roughness !== undefined) material.roughness = Math.min(material.roughness, .42)
        })
      }
    })
    const wallpaper = model.getObjectByName('wallpaper')
    if (wallpaper?.material) {
      wallpaper.visible = true
      screenMaterial.current = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false, transparent: true, opacity: 0 })
      wallpaper.material = screenMaterial.current
    }
  }, [model, screenTexture])

  useEffect(() => {
    const finish = {
      midnight: new THREE.Color('#111827'),
      titanium: new THREE.Color('#747a83'),
      silver: new THREE.Color('#c2c7cd'),
    }[productColor] || new THREE.Color('#111827')
    model.traverse((object) => {
      if (!object.isMesh || object.name === 'wallpaper') return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => {
        if (!material.color || BRAND_MATERIAL_PATTERN.test(material.name)) return
        if (!material.userData.aeronBaseColor) material.userData.aeronBaseColor = material.color.clone()
        const strength = productColor === 'midnight' ? .28 : .56
        material.color.copy(material.userData.aeronBaseColor).lerp(finish, strength)
        material.needsUpdate = true
      })
    })
  }, [model, productColor])

  useFrame((_, delta) => {
    if (!product.current) return
    introTime.current = Math.min(4, introTime.current + delta)
    // A deliberate two-act reveal: closed product flies in first, then opens
    // only after it has settled into its final hero position.
    const arrival = THREE.MathUtils.smoothstep(introTime.current, 0, 2.35)
    const opening = THREE.MathUtils.smoothstep(introTime.current, 2.45, 4)
    const deadZone = Math.abs(pointer.current.x) < .08 && Math.abs(pointer.current.y) < .08
    const interactiveY = displayFocused ? HERO_YAW : (deadZone ? HERO_YAW : HERO_YAW + pointer.current.x * Math.PI)
    const interactiveX = deadZone ? -.08 : -.08 - pointer.current.y * .16
    target.current.y = THREE.MathUtils.lerp(ARRIVAL_YAW, interactiveY, arrival)
    target.current.x = THREE.MathUtils.lerp(-.32, interactiveX, arrival)
    const damping = 1 - Math.exp(-delta * (dragging.current ? 5.2 : 2.6))
    product.current.rotation.y = THREE.MathUtils.lerp(product.current.rotation.y, target.current.y, damping * arrival)
    product.current.rotation.x = THREE.MathUtils.lerp(product.current.rotation.x, target.current.x, damping)
    product.current.rotation.z = THREE.MathUtils.lerp(product.current.rotation.z, THREE.MathUtils.lerp(.16, 0, arrival), damping)
    const travel = 1 - arrival
    const waveX = Math.sin(introTime.current * 4.2) * .62 * travel
    const waveY = Math.sin(introTime.current * 7.1 + .8) * .22 * travel
    product.current.position.x = THREE.MathUtils.lerp(1.45, 0, arrival) + waveX
    product.current.position.y = THREE.MathUtils.lerp(2.15, .16, arrival) + waveY
    product.current.position.z = THREE.MathUtils.lerp(-8, 0, arrival)
    const scale = THREE.MathUtils.lerp(modelFit.scale * .035, modelFit.scale, arrival)
    product.current.scale.setScalar(scale)
    if (displayNode) displayNode.rotation.z = THREE.MathUtils.lerp(CLOSED_HINGE, openHinge, opening)
    if (screenMaterial.current) screenMaterial.current.opacity = THREE.MathUtils.smoothstep(opening, .18, .82)
    if (revealLight.current) revealLight.current.intensity = Math.sin(opening * Math.PI) * 3.2 + opening * .55
  })

  const focusDisplay = (value) => {
    setDisplayFocused(value)
    onDisplayFocus(value)
  }

  return (
    <Float speed={.55} rotationIntensity={.018} floatIntensity={.08}>
      <group ref={product} position={[1.45, 2.15, -8]} rotation={[-.32, ARRIVAL_YAW, .16]} scale={modelFit.scale * .035}>
        <pointLight ref={revealLight} position={[0, 1.2, 1.4]} intensity={0} color="#4f78ff" distance={5} decay={2} />
        <primitive
          object={model}
          position={modelFit.offset.toArray()}
          onPointerEnter={() => focusDisplay(true)}
          onPointerLeave={() => focusDisplay(false)}
          onClick={(event) => {
            event.stopPropagation()
            const hit = (event.object?.name || '').toLowerCase()
            if (/key|deck|powerbutton|^a$|^s$|^d$|^w$/.test(hit)) onSearch()
            else onOpen()
          }}
        />
      </group>
    </Float>
  )
}

function ReactiveLights({ pointer }) {
  const keyLight = useRef()
  const rimLight = useRef()
  useFrame(() => {
    if (!keyLight.current || !rimLight.current) return
    keyLight.current.position.x = 5 + pointer.current.x * 4
    keyLight.current.position.y = 7 + pointer.current.y * 2
    rimLight.current.position.x = -4 - pointer.current.x * 3
  })
  return (
    <>
      <directionalLight ref={keyLight} position={[5, 8, 7]} intensity={6.5} color="#fffdf8" castShadow />
      <directionalLight ref={rimLight} position={[-5, 3, 4]} intensity={3.6} color="#b6d4ff" />
    </>
  )
}

export default function AeronScene({ pointer, dragging, productColor, onDisplayFocus, onOpen, onSearch }) {
  const compactDevice = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  return (
    <Canvas shadows={!compactDevice} camera={{ position: [.2, 3.25, 9.2], fov: 34 }} dpr={[1, compactDevice ? 1.25 : 1.65]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={1.85} />
        <ReactiveLights pointer={pointer} />
        <spotLight position={[2, 6, -4]} intensity={11} angle={.5} penumbra={1} color="#7aa3ff" />
        <pointLight position={[0, -1, 5]} intensity={2.6} color="#5b9eff" />
        <RealLaptop pointer={pointer} dragging={dragging} productColor={productColor} onDisplayFocus={onDisplayFocus} onOpen={onOpen} onSearch={onSearch} />
        <ContactShadows position={[0, -1, 0]} opacity={.26} scale={9} blur={3.6} far={4} />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)
