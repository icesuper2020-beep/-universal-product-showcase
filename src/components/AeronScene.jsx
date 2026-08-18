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

function buildScreenTexture(feature, revealedWords = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1280
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(1360, 550, 20, 1130, 640, 1040)
  gradient.addColorStop(0, '#b89a78')
  gradient.addColorStop(.24, '#725b45')
  gradient.addColorStop(.52, '#2f2923')
  gradient.addColorStop(1, '#0d0c0a')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.fillStyle = '#eadbc9'
  context.font = '700 31px Arial'
  context.shadowColor = 'rgba(190,156,116,.62)'
  context.shadowBlur = 8
  context.fillText(feature ? feature.eyebrow.split('').join(' ') : 'A E R O N   O N E   E X P E R I E N C E', 1024, feature ? 300 : 464)
  context.fillStyle = '#ffffff'
  context.font = feature ? '600 180px Arial' : '600 154px Arial'
  context.shadowBlur = 14
  context.fillText(feature ? feature.metric : 'Go inside.', 1024, feature ? 520 : 680)
  if (feature) {
    context.font = '600 68px Arial'
    context.fillStyle = '#f4eadf'
    context.fillText(feature.title, 1024, 655)
    const words = feature.body.split(' ').slice(0, revealedWords)
    context.font = '400 42px Arial'
    context.fillStyle = '#c8b7a4'
    context.shadowBlur = 0
    const lines = []
    let line = ''
    words.forEach((word) => {
      const candidate = `${line} ${word}`.trim()
      if (context.measureText(candidate).width > 1460) { lines.push(line); line = word } else line = candidate
    })
    if (line) lines.push(line)
    lines.slice(0, 3).forEach((text, index) => context.fillText(text, 1024, 775 + index * 62))
  }
  if (!feature) {
  context.strokeStyle = 'rgba(235,218,197,.72)'
  context.lineWidth = 4
  context.beginPath()
  context.roundRect(774, 752, 500, 106, 53)
  context.stroke()
  context.font = '700 29px Arial'
  context.fillStyle = '#f6efe7'
  context.shadowBlur = 5
  context.fillText('OPEN THE DISPLAY  →', 1024, 819)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.anisotropy = 16
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return texture
}

function RealLaptop({ pointer, dragging, productColor, inspectionMode, inspectionFeature, revealedWords, onInspect, onDisplayFocus, onOpen, onSearch }) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const product = useRef()
  const revealLight = useRef()
  const screenMaterial = useRef()
  const keyboardGlowMaterials = useRef([])
  const displayFocusRef = useRef(false)
  const displayReleaseTimer = useRef(null)
  const introTime = useRef(0)
  const inspectionYaw = useRef(HERO_YAW)
  const inspectionBlend = useRef(0)
  const heroYaw = useRef(HERO_YAW)
  const dragState = useRef({ active: false, startX: 0, startYaw: FRONT_YAW, moved: false })
  const target = useRef({ x: -.32, y: ARRIVAL_YAW })
  const [displayFocused, setDisplayFocused] = useState(false)
  const screenTexture = useMemo(() => buildScreenTexture(inspectionMode ? inspectionFeature : null, revealedWords), [inspectionMode, inspectionFeature, revealedWords])
  // GLTFLoader sanitizes spaces in node names to underscores.
  const displayNode = useMemo(() => model.getObjectByName('laptop_display') || model.getObjectByName('laptop display'), [model])
  const screenNode = useMemo(() => model.getObjectByName('wallpaper'), [model])
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
      offset: center.clone().multiplyScalar(-1),
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
    keyboardGlowMaterials.current = []
    model.traverse((object) => {
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
      const isBrandElement = BRAND_OBJECT_PATTERN.test(object.name) || objectMaterials.some((material) => material && BRAND_MATERIAL_PATTERN.test(material.name))
      if (isBrandElement) object.visible = false
      if (object.isMesh) {
        const hierarchy = []
        let node = object
        while (node && node !== model) {
          hierarchy.push(node.name || '')
          node = node.parent
        }
        const hierarchyName = hierarchy.join(' ')
        const materialName = objectMaterials.filter(Boolean).map((material) => material.name || '').join(' ')
        const isBacklight = /backlight/i.test(hierarchyName) || /keylight/i.test(materialName)
        const isKeySurface = /keys phy/i.test(hierarchyName) || /(^|\s)keys($|\s)|wasd key/i.test(materialName)
        if (isBacklight) {
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: '#d0b18d',
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            side: THREE.DoubleSide,
          })
          object.material = glowMaterial
          object.visible = true
          object.renderOrder = 3
          keyboardGlowMaterials.current.push({ material: glowMaterial, isLightLayer: true, baseOpacity: .82 })
        } else if (isKeySurface) {
          const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
          const glowingMaterials = sourceMaterials.filter(Boolean).map((material) => material.clone())
          object.material = Array.isArray(object.material) ? glowingMaterials : glowingMaterials[0]
          glowingMaterials.forEach((material) => {
            if ('emissive' in material) {
              material.emissive = new THREE.Color('#d8bd9b')
              material.emissiveIntensity = 0
            }
            keyboardGlowMaterials.current.push({ material, isLightLayer: false, baseOpacity: material.opacity ?? 1 })
          })
        }
        object.castShadow = true
        object.receiveShadow = true
        objectMaterials.filter(Boolean).forEach((material) => {
          material.envMapIntensity = 1.1
          if (material.metalness !== undefined) material.metalness = Math.max(material.metalness, .35)
          if (material.roughness !== undefined) material.roughness = Math.min(material.roughness, .42)
        })
      }
    })
    const wallpaper = screenNode
    if (wallpaper?.material) {
      wallpaper.visible = true
      screenMaterial.current = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false, transparent: true, opacity: 0 })
      wallpaper.material = screenMaterial.current
    }
  }, [model, screenNode, screenTexture])

  useEffect(() => () => screenTexture.dispose(), [screenTexture])

  useEffect(() => {
    if (inspectionMode) inspectionYaw.current = FRONT_YAW
  }, [inspectionMode])

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
    inspectionBlend.current = THREE.MathUtils.damp(inspectionBlend.current, inspectionMode ? 1 : 0, .95, delta)
    const inspectProgress = THREE.MathUtils.smootherstep(inspectionBlend.current, 0, 1)
    const deadZone = Math.abs(pointer.current.x) < .08 && Math.abs(pointer.current.y) < .08
    if (dragging.current && !displayFocused) {
      if (!dragState.current.active) {
        dragState.current.active = true
        dragState.current.startX = pointer.current.x
        dragState.current.startYaw = inspectionMode ? inspectionYaw.current : heroYaw.current
      }
      const dragDistance = pointer.current.x - dragState.current.startX
      if (Math.abs(dragDistance) > .025) dragState.current.moved = true
      const nextYaw = dragState.current.startYaw + dragDistance * Math.PI * 1.5
      if (inspectionMode) inspectionYaw.current = nextYaw
      else heroYaw.current = nextYaw
    } else {
      dragState.current.active = false
    }
    const inspectionTargetY = displayFocused ? FRONT_YAW : inspectionYaw.current
    const interactiveY = inspectionMode ? inspectionTargetY : (displayFocused ? HERO_YAW : heroYaw.current)
    const interactiveX = inspectionMode ? -.015 : -.08
    target.current.y = THREE.MathUtils.lerp(ARRIVAL_YAW, interactiveY, arrival)
    target.current.x = THREE.MathUtils.lerp(-.32, interactiveX, arrival)
    const damping = 1 - Math.exp(-delta * (dragging.current ? 4 : (inspectionMode ? 1.15 : 2.6)))
    product.current.rotation.y = THREE.MathUtils.lerp(product.current.rotation.y, target.current.y, damping * arrival)
    product.current.rotation.x = THREE.MathUtils.lerp(product.current.rotation.x, target.current.x, damping)
    product.current.rotation.z = THREE.MathUtils.lerp(product.current.rotation.z, THREE.MathUtils.lerp(.16, 0, arrival), damping)
    const travel = 1 - arrival
    const waveX = Math.sin(introTime.current * 4.2) * .62 * travel
    const waveY = Math.sin(introTime.current * 7.1 + .8) * .22 * travel
    const inspectX = THREE.MathUtils.lerp(2.15, 0, inspectProgress)
    const inspectY = THREE.MathUtils.lerp(.16, .52, inspectProgress)
    product.current.position.x = THREE.MathUtils.lerp(1.45, inspectX, arrival) + waveX
    product.current.position.y = THREE.MathUtils.lerp(2.15, inspectY, arrival) + waveY
    product.current.position.z = THREE.MathUtils.lerp(-8, 0, arrival)
    const settledScale = modelFit.scale * THREE.MathUtils.lerp(1, .96, inspectProgress)
    const scale = THREE.MathUtils.lerp(modelFit.scale * .035, settledScale, arrival)
    product.current.scale.setScalar(scale)
    if (displayNode) displayNode.rotation.z = THREE.MathUtils.lerp(CLOSED_HINGE, openHinge, opening)
    if (screenMaterial.current) screenMaterial.current.opacity = THREE.MathUtils.smoothstep(opening, .18, .82)
    const keyboardReveal = THREE.MathUtils.smoothstep(opening, .28, .94)
    const keyboardBreath = .9 + Math.sin(introTime.current * 1.65) * .1
    keyboardGlowMaterials.current.forEach(({ material, isLightLayer, baseOpacity }) => {
      if ('emissiveIntensity' in material) material.emissiveIntensity = keyboardReveal * keyboardBreath * (isLightLayer ? 2.1 : .42)
      material.opacity = isLightLayer ? baseOpacity * keyboardReveal * keyboardBreath : baseOpacity
    })
    if (revealLight.current) revealLight.current.intensity = Math.sin(opening * Math.PI) * 3.2 + opening * .55
  })

  useEffect(() => () => window.clearTimeout(displayReleaseTimer.current), [])

  const focusDisplay = (value) => {
    if (value) {
      window.clearTimeout(displayReleaseTimer.current)
      displayReleaseTimer.current = null
      if (!displayFocusRef.current) {
        displayFocusRef.current = true
        setDisplayFocused(true)
        onDisplayFocus(true)
      }
      return
    }
    if (displayReleaseTimer.current) return
    displayReleaseTimer.current = window.setTimeout(() => {
      displayReleaseTimer.current = null
      displayFocusRef.current = false
      setDisplayFocused(false)
      onDisplayFocus(false)
    }, 240)
  }

  return (
    <Float speed={.55} rotationIntensity={.018} floatIntensity={.08}>
      <group ref={product} position={[1.45, 2.15, -8]} rotation={[-.32, ARRIVAL_YAW, .16]} scale={modelFit.scale * .035}>
        <pointLight ref={revealLight} position={[0, 1.2, 1.4]} intensity={0} color="#c8a77f" distance={5} decay={2} />
        <primitive
          object={model}
          position={modelFit.offset.toArray()}
          onPointerMove={(event) => focusDisplay(event.intersections.some((intersection) => intersection.object === screenNode))}
          onPointerLeave={() => {
            focusDisplay(false)
            dragging.current = false
            dragState.current.active = false
            heroYaw.current = HERO_YAW
            inspectionYaw.current = FRONT_YAW
          }}
          onPointerDown={(event) => {
            const isDisplay = event.object === screenNode
            if (isDisplay) return
            event.stopPropagation()
            dragState.current.moved = false
            dragging.current = true
            event.target?.setPointerCapture?.(event.pointerId)
          }}
          onPointerUp={(event) => {
            dragging.current = false
            event.target?.releasePointerCapture?.(event.pointerId)
          }}
          onClick={(event) => {
            event.stopPropagation()
            if (dragState.current.moved) {
              dragState.current.moved = false
              return
            }
            const hit = (event.object?.name || '').toLowerCase()
            if (/key|deck|powerbutton|^a$|^s$|^d$|^w$/.test(hit)) onSearch()
            else if (event.object === screenNode) onOpen()
            else if (!inspectionMode) onInspect()
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
      <directionalLight ref={rimLight} position={[-5, 3, 4]} intensity={3.6} color="#dec8ae" />
    </>
  )
}

export default function AeronScene({ pointer, dragging, productColor, inspectionMode, inspectionFeature, revealedWords, onInspect, onDisplayFocus, onOpen, onSearch }) {
  const compactDevice = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  return (
    <Canvas shadows={!compactDevice} camera={{ position: [.2, 3.25, 9.2], fov: 34 }} dpr={[1, compactDevice ? 1.25 : 1.65]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={1.85} />
        <ReactiveLights pointer={pointer} />
        <spotLight position={[2, 6, -4]} intensity={11} angle={.5} penumbra={1} color="#d0b38f" />
        <pointLight position={[0, -1, 5]} intensity={2.6} color="#a98461" />
        <RealLaptop pointer={pointer} dragging={dragging} productColor={productColor} inspectionMode={inspectionMode} inspectionFeature={inspectionFeature} revealedWords={revealedWords} onInspect={onInspect} onDisplayFocus={onDisplayFocus} onOpen={onOpen} onSearch={onSearch} />
        <ContactShadows position={[0, -1, 0]} opacity={.26} scale={9} blur={3.6} far={4} />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)
