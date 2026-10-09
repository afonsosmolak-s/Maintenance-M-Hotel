import "server-only";
import { locationPaths } from "@/lib/domain/locations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Estrutura operacional do estabelecimento (a RLS limita ao que o utilizador pode ver). */
export async function loadStructure(establishmentId: string) {
  const supabase = await createSupabaseServerClient();
  const [types, locations, categories] = await Promise.all([
    supabase.from("location_types").select("id, name, sort_order").eq("establishment_id", establishmentId).order("sort_order").order("name"),
    supabase
      .from("locations")
      .select("id, parent_id, location_type_id, name, code, active, sort_order")
      .eq("establishment_id", establishmentId),
    supabase.from("categories").select("id, name, active, sort_order").eq("establishment_id", establishmentId).order("sort_order").order("name"),
  ]);
  if (types.error || locations.error || categories.error) throw new Error("Não foi possível carregar a estrutura.");

  const flatLocations = locations.data.map((l) => ({
    id: l.id,
    parentId: l.parent_id,
    typeId: l.location_type_id,
    name: l.name,
    code: l.code,
    active: l.active,
    sortOrder: l.sort_order,
  }));

  return {
    types: types.data,
    categories: categories.data,
    locations: flatLocations,
    paths: locationPaths(flatLocations),
  };
}
