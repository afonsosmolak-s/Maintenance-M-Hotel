/**
 * Prepara uma foto no navegador antes do envio:
 * - redimensiona para no máximo 1600 px (fotos de telemóvel chegam a 12 MP);
 * - recodifica em JPEG, o que descarta os metadados EXIF, incluindo a localização GPS
 *   (importante em suítes de motel: privacidade de quem tira e de quem aparece).
 * Respeita a orientação da câmara antes de descartar o EXIF.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("O arquivo não é uma imagem.");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao converter a imagem."))), "image/jpeg", QUALITY),
  );
}
