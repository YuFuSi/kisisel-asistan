// Gömme (embedding) vektörlerini SQLite BLOB sütununa yazılabilir baytlara çevirir ve geri okur.
// electron import etmez; hem data/ katmanı hem de ai/ katmanı burayı kullanabilir.

/** Bir gömme vektörünü veritabanında saklamak için baytlara çevirir. */
export function floatsToBlob(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}

/** Veritabanından okunan baytları gömme vektörüne çevirir. */
export function blobToFloats(blob: Buffer): Float32Array {
  return new Float32Array(
    blob.buffer,
    blob.byteOffset,
    blob.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
}
