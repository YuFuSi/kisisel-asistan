import * as THREE from 'three'

// Tur O: yörüngedeki nesnelerin konumu artık sahte (sin/cos ile taklit edilen) elips yerine
// gerçek bir 3B döndürmeden hesaplanıyor. İkonlar hâlâ DOM elemanı (kolay etkileşim,
// erişilebilirlik) — Three.js sadece "3B uzayda nerede duruyor, ekrana projekte edilince nereye
// düşüyor, kameraya ne kadar yakın" matematiğini yapıyor. WebGL çizimi yok, sahne render edilmiyor.
//
// Perspektif kamera denendi ama kameraya yakın noktalarda ölçek patlaması oldu (öngörülemez
// büyüme); bunun yerine ortografik (paralel) projeksiyon kullanılıyor — hâlâ gerçek 3B döndürme,
// ama uzaklığa göre bozulma olmadan, öngörülebilir bir ölçek.
const RING_RADIUS = 1
const TILT_DEGREES = 62

// Ortografik kamera: frustum tam olarak halkanın maksimum genişliğini kaplıyor, bu yüzden
// projekte edilen x/y her zaman -1..1 aralığında kalıyor
const camera = new THREE.OrthographicCamera(
  -RING_RADIUS,
  RING_RADIUS,
  RING_RADIUS,
  -RING_RADIUS,
  0.1,
  100
)
camera.position.set(0, 0, 5)
camera.lookAt(0, 0, 0)

export interface Projected3D {
  /** -1..1 aralığında normalize ekran konumu; çağıran kendi px genişliğiyle çarpar */
  x: number
  y: number
  /** 0 (en uzak) - 1 (en yakın): ölçek/saydamlık için */
  depth: number
}

/**
 * `count` nesneyi orijin etrafında yarıçapı `RING_RADIUS` olan, hafif eğik (tilt) bir 3B
 * halkaya yerleştirip ortografik kameradan ekrana projekte eder.
 * @param angleDeg Halkanın Y ekseni etrafındaki dönüş açısı (derece)
 */
export function projectRing(count: number, angleDeg: number): Projected3D[] {
  const angleRad = (angleDeg * Math.PI) / 180
  const tiltRad = (TILT_DEGREES * Math.PI) / 180
  const result: Projected3D[] = []

  for (let i = 0; i < count; i++) {
    const theta = angleRad + (i / count) * Math.PI * 2
    // Önce düz bir yatay halka (XZ düzlemi), sonra X ekseni etrafında eğiliyor
    const x = Math.cos(theta) * RING_RADIUS
    const zFlat = Math.sin(theta) * RING_RADIUS
    const y = zFlat * Math.sin(tiltRad)
    const z = zFlat * Math.cos(tiltRad)

    const point = new THREE.Vector3(x, y, z).project(camera)
    // depth: kameraya en yakın nokta z≈-1'e, en uzak nokta z≈+1'e denk gelir (NDC)
    const depth = 1 - (point.z + 1) / 2

    result.push({ x: point.x, y: -point.y, depth })
  }

  return result
}
