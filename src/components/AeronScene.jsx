import { ContactShadows, Float, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const MODEL_URL = '/laptop-3d-model-asus-tuf-dash-f15-2022/source/LAPTOP.glb'
const BRAND_OBJECT_PATTERN = /asus|tuf[_ ]?logo|outer[_ ]logo|^tuf$/i
const BRAND_MATERIAL_PATTERN = /asus|tuf[_ ]?logo|outer[_ ]logo/i
const CHASSIS_PATTERN = /(^|\s)(mold(?:\s|_|\.|$)|deck2?(?:\s|_|\.|$)|laptop[ _]display|display[ _]sqr)/i
const CHASSIS_EXCLUDE_PATTERN = /wallpaper|keys?|wasd|backlight|keylight|led|power|logo|(^|\s)red($|\s)/i
const CLOSED_HINGE = Math.PI - .018
const FRONT_YAW = -Math.PI / 2
const HERO_YAW = FRONT_YAW - .3
const ARRIVAL_YAW = HERO_YAW - .72

function buildScreenTexture(feature, revealedWords = 0, compactDevice = false) {
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
  context.font = `700 ${compactDevice ? 42 : 31}px Arial`
  context.shadowColor = 'rgba(190,156,116,.62)'
  context.shadowBlur = 8
  context.fillText(feature ? feature.eyebrow.split('').join(' ') : 'A E R O N   O N E', 1024, feature ? (compactDevice ? 280 : 300) : (compactDevice ? 430 : 464))
  context.fillStyle = '#ffffff'
  context.font = feature ? `700 ${compactDevice ? 226 : 180}px Arial` : `700 ${compactDevice ? 224 : 154}px Arial`
  context.shadowBlur = compactDevice ? 24 : 14
  context.fillText(feature ? feature.metric : 'Go inside.', 1024, feature ? (compactDevice ? 520 : 520) : (compactDevice ? 675 : 680))
  if (feature) {
    context.font = `700 ${compactDevice ? 86 : 68}px Arial`
    context.fillStyle = '#f4eadf'
    context.fillText(feature.title, 1024, compactDevice ? 670 : 655)
    const words = feature.body.split(' ').slice(0, revealedWords)
    context.font = `500 ${compactDevice ? 50 : 42}px Arial`
    context.fillStyle = '#c8b7a4'
    context.shadowBlur = 0
    const lines = []
    let line = ''
    words.forEach((word) => {
      const candidate = `${line} ${word}`.trim()
      if (context.measureText(candidate).width > (compactDevice ? 1540 : 1460)) { lines.push(line); line = word } else line = candidate
    })
    if (line) lines.push(line)
    lines.slice(0, compactDevice ? 2 : 3).forEach((text, index) => context.fillText(text, 1024, (compactDevice ? 800 : 775) + index * (compactDevice ? 72 : 62)))
  }
  if (!feature) {
  context.strokeStyle = 'rgba(235,218,197,.72)'
  context.lineWidth = compactDevice ? 7 : 4
  context.beginPath()
  context.roundRect(compactDevice ? 694 : 774, compactDevice ? 770 : 752, compactDevice ? 660 : 500, compactDevice ? 142 : 106, compactDevice ? 71 : 53)
  context.stroke()
  context.font = `700 ${compactDevice ? 39 : 29}px Arial`
  context.fillStyle = '#f6efe7'
  context.shadowBlur = 5
  context.fillText('OPEN THE DISPLAY  →', 1024, compactDevice ? 858 : 819)
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

function RealLaptop({ pointer, dragging, productColor, inspectionMode, inspectionFeature, revealedWords, compactDevice, onInspect, onDisplayFocus, onOpen, onSearch }) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => {
    const clonedModel = scene.clone(true)
    // The source GLB reuses one DECK material across the aluminium chassis,
    // keyboard legends and small hardware. Give every mesh its own material
    // instance so changing the body finish cannot be undone by a later key or
    // logo mesh that shares the original material.
    clonedModel.traverse((object) => {
      if (!object.isMesh || !object.material) return
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone()
    })
    return clonedModel
  }, [scene])
  const product = useRef()
  const revealLight = useRef()
  const screenMaterial = useRef()
  const keyboardGlowMaterials = useRef([])
  const displayFocusRef = useRef(false)
  const displayReleaseTimer = useRef(null)
  const poseResetTimer = useRef(null)
  const introTime = useRef(0)
  const inspectionYaw = useRef(HERO_YAW)
  const inspectionBlend = useRef(0)
  const heroYaw = useRef(HERO_YAW)
  const dragState = useRef({ active: false, startX: 0, startYaw: FRONT_YAW, moved: false })
  const target = useRef({ x: -.32, y: ARRIVAL_YAW })
  const [displayFocused, setDisplayFocused] = useState(false)
  const screenTexture = useMemo(() => buildScreenTexture(inspectionMode ? inspectionFeature : null, revealedWords, compactDevice), [inspectionMode, inspectionFeature, revealedWords, compactDevice])
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

  const cancelPoseReset = () => {
    if (!poseResetTimer.current) return
    window.clearTimeout(poseResetTimer.current)
    poseResetTimer.current = null
  }

  const schedulePoseReset = () => {
    cancelPoseReset()
    poseResetTimer.current = window.setTimeout(() => {
      poseResetTimer.current = null
      // Pointer capture lets a visitor finish a full turn even after the
      // cursor briefly leaves the visible silhouette. Reset only once the
      // drag has genuinely ended and the pointer has stayed away.
      if (dragging.current) {
        schedulePoseReset()
        return
      }
      heroYaw.current = HERO_YAW
      inspectionYaw.current = FRONT_YAW
    }, 900)
  }

  useEffect(() => () => cancelPoseReset(), [])

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
      midnight: { color: '#111722', metalness: .76, roughness: .24, env: 1.75, emissive: '#05070b', emissiveIntensity: .03, preserveSurface: true },
      titanium: { color: '#747b85', metalness: .58, roughness: .28, env: 2.15, emissive: '#58606a', emissiveIntensity: .16, preserveSurface: false },
      silver: { color: '#eef1f4', metalness: .38, roughness: .32, env: 2.55, emissive: '#e4e8ed', emissiveIntensity: .34, preserveSurface: false },
    }[productColor] || { color: '#111722', metalness: .76, roughness: .24, env: 1.75, emissive: '#05070b', emissiveIntensity: .03, preserveSurface: true }
    const finishColor = new THREE.Color(finish.color)
    model.traverse((object) => {
      if (!object.isMesh || object.name === 'wallpaper') return
      const hierarchy = []
      let node = object
      while (node && node !== model) {
        hierarchy.push(node.name || '')
        node = node.parent
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const objectPath = hierarchy.join(' ')
      const isChassisObject = CHASSIS_PATTERN.test(objectPath) && !CHASSIS_EXCLUDE_PATTERN.test(objectPath)
      // GLTFLoader splits the authored DECK node into Cube/Cube_1/etc. meshes.
      // Treat every non-key material under that parent as the palm-rest shell.
      const isDeckBody = hierarchy.some((name) => /^deck(?:_\d+)?$/i.test(name))
      materials.filter(Boolean).forEach((material) => {
        if (!material.color || BRAND_MATERIAL_PATTERN.test(material.name)) return
        // One deck mesh contains separate body, port and accent materials.
        // Decide finish eligibility per material instead of excluding the
        // complete mesh because one of its slots is a port/LED material.
        const isChassis = (isChassisObject || isDeckBody) && !CHASSIS_EXCLUDE_PATTERN.test(material.name || '')
        if (!material.userData.aeronFinishBase) {
          material.userData.aeronFinishBase = {
            color: material.color.clone(),
            map: material.map || null,
            normalMap: material.normalMap || null,
            roughnessMap: material.roughnessMap || null,
            metalnessMap: material.metalnessMap || null,
            metalness: material.metalness,
            roughness: material.roughness,
            envMapIntensity: material.envMapIntensity,
            emissive: material.emissive?.clone?.() || null,
            emissiveIntensity: material.emissiveIntensity,
          }
        }
        const base = material.userData.aeronFinishBase
        if (!isChassis) {
          // Never wash out the keyboard legends, ports, LEDs or screen details.
          material.color.copy(base.color)
          material.map = base.map
          material.normalMap = base.normalMap
          material.roughnessMap = base.roughnessMap
          material.metalnessMap = base.metalnessMap
          if (base.metalness !== undefined) material.metalness = base.metalness
          if (base.roughness !== undefined) material.roughness = base.roughness
          if (base.envMapIntensity !== undefined) material.envMapIntensity = base.envMapIntensity
          if (material.emissive && base.emissive) material.emissive.copy(base.emissive)
          if (base.emissiveIntensity !== undefined) material.emissiveIntensity = base.emissiveIntensity
          material.needsUpdate = true
          return
        }
        material.color.copy(finishColor)
        // The source model has its black finish baked into the colour map.
        // Keep that texture for Midnight, but use clean PBR metal for lighter finishes.
        material.map = finish.preserveSurface ? base.map : null
        material.normalMap = finish.preserveSurface ? base.normalMap : null
        material.roughnessMap = finish.preserveSurface ? base.roughnessMap : null
        material.metalnessMap = finish.preserveSurface ? base.metalnessMap : null
        if (material.metalness !== undefined) material.metalness = finish.metalness
        if (material.roughness !== undefined) material.roughness = finish.roughness
        material.envMapIntensity = finish.env
        // Some faces in the source model have inconsistent authored normals.
        // A subtle finish-coloured emissive lift keeps the palm rest and lower
        // chassis true to the selected finish without washing out the keys.
        if (material.emissive) {
          material.emissive.set(finish.emissive)
          material.emissiveIntensity = inspectionMode && isDeckBody && productColor !== 'midnight'
            ? Math.max(finish.emissiveIntensity, productColor === 'silver' ? .62 : .28)
            : finish.emissiveIntensity
        }
        material.needsUpdate = true
      })
    })
  // Reapply the selected finish after entering/leaving inspection because the
  // live display texture rebuild also refreshes materials in the source GLB.
  }, [model, productColor, inspectionMode])

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
    const heroX = compactDevice ? 0 : 2.15
    const heroY = compactDevice ? .08 : .16
    const inspectionY = compactDevice ? .24 : .52
    const inspectX = THREE.MathUtils.lerp(heroX, 0, inspectProgress)
    const inspectY = THREE.MathUtils.lerp(heroY, inspectionY, inspectProgress)
    product.current.position.x = THREE.MathUtils.lerp(1.45, inspectX, arrival) + waveX
    product.current.position.y = THREE.MathUtils.lerp(2.15, inspectY, arrival) + waveY
    product.current.position.z = THREE.MathUtils.lerp(-8, 0, arrival)
    const mobileFit = compactDevice ? .76 : 1
    const settledScale = modelFit.scale * mobileFit * THREE.MathUtils.lerp(1, .96, inspectProgress)
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
          onPointerMove={(event) => {
            cancelPoseReset()
            focusDisplay(event.intersections.some((intersection) => intersection.object === screenNode))
          }}
          onPointerLeave={() => {
            focusDisplay(false)
            schedulePoseReset()
          }}
          onPointerDown={(event) => {
            const isDisplay = event.object === screenNode
            if (isDisplay) return
            event.stopPropagation()
            cancelPoseReset()
            dragState.current.moved = false
            dragging.current = true
            event.target?.setPointerCapture?.(event.pointerId)
          }}
          onPointerUp={(event) => {
            dragging.current = false
            dragState.current.active = false
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
    <Canvas shadows={!compactDevice} camera={{ position: compactDevice ? [0, 3.45, 10.35] : [.2, 3.25, 9.2], fov: compactDevice ? 37 : 34 }} dpr={[1, compactDevice ? 1.35 : 1.65]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={1.85} />
        <ReactiveLights pointer={pointer} />
        <spotLight position={[2, 6, -4]} intensity={11} angle={.5} penumbra={1} color="#d0b38f" />
        <pointLight position={[0, -1, 5]} intensity={2.6} color="#a98461" />
        <pointLight
          position={[3.4, 3.2, 6.2]}
          intensity={productColor === 'silver' ? 5.4 : productColor === 'titanium' ? 2.5 : .8}
          color="#f5f9ff"
          distance={12}
          decay={1.7}
        />
        <directionalLight
          position={[0, 7.5, 7]}
          intensity={inspectionMode ? (productColor === 'silver' ? 8.5 : productColor === 'titanium' ? 4.2 : 1.25) : 0}
          color={productColor === 'silver' ? '#ffffff' : '#eee3d7'}
        />
        <RealLaptop pointer={pointer} dragging={dragging} productColor={productColor} inspectionMode={inspectionMode} inspectionFeature={inspectionFeature} revealedWords={revealedWords} compactDevice={compactDevice} onInspect={onInspect} onDisplayFocus={onDisplayFocus} onOpen={onOpen} onSearch={onSearch} />
        <ContactShadows position={[0, -1, 0]} opacity={.26} scale={9} blur={3.6} far={4} />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)
