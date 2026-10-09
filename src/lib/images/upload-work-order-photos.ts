import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { preparePhoto } from "./prepare-photo";

export type PhotoPhase = "opening" | "progress" | "completion";

/**
 * Envia fotos de uma ocorrência para o armazenamento privado e regista-as.
 * Caminho: {establishmentId}/{workOrderId}/{uuid}.jpg — as políticas do banco validam esse caminho.
 * Devolve quantas foram enviadas e as mensagens de erro das que falharam.
 */
export async function uploadWorkOrderPhotos(
  establishmentId: string,
  workOrderId: string,
  files: File[],
  phase: PhotoPhase,
): Promise<{ uploaded: number; errors: string[] }> {
  const supabase = createSupabaseBrowserClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { uploaded: 0, errors: ["Sessão expirada. Entre novamente."] };

  let uploaded = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      const blob = await preparePhoto(file);
      const path = `${establishmentId}/${workOrderId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("work-orders")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error("envio recusado");

      const { error: insertError } = await supabase.from("attachments").insert({
        establishment_id: establishmentId,
        work_order_id: workOrderId,
        phase,
        storage_path: path,
        content_type: "image/jpeg",
        size_bytes: blob.size,
        uploaded_by: userId,
      });
      if (insertError) throw new Error("registo recusado");
      uploaded += 1;
    } catch {
      errors.push(`Não foi possível enviar ${file.name}.`);
    }
  }

  return { uploaded, errors };
}
