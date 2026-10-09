/**
 * Catálogo de permissões. Tem de corresponder a app.all_permissions() no banco,
 * que é quem de facto as aplica.
 */
export const PERMISSIONS = [
  "establishment.manage",
  "members.manage",
  "settings.manage",
  "assets.manage",
  "work_orders.create",
  "work_orders.read_all",
  "work_orders.assign",
  "work_orders.manage",
  "work_orders.execute",
  "costs.read",
  "costs.write",
  "preventive.manage",
  "displays.manage",
  "dashboard.read",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Textos simples, para o cliente montar cargos sem jargão. */
export const PERMISSION_GROUPS: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<{ key: Permission; label: string }>;
}> = [
  {
    title: "Ocorrências",
    items: [
      { key: "work_orders.create", label: "Abrir ocorrências" },
      { key: "work_orders.read_all", label: "Ver todas as ocorrências" },
      { key: "work_orders.execute", label: "Executar e concluir os serviços atribuídos a si" },
      { key: "work_orders.assign", label: "Atribuir serviços a outras pessoas" },
      { key: "work_orders.manage", label: "Editar e cancelar qualquer ocorrência" },
    ],
  },
  {
    title: "Custos",
    items: [
      { key: "costs.read", label: "Ver custos" },
      { key: "costs.write", label: "Registrar materiais e custos" },
    ],
  },
  {
    title: "Operação",
    items: [
      { key: "preventive.manage", label: "Gerir manutenção preventiva" },
      { key: "assets.manage", label: "Cadastrar e editar equipamentos" },
      { key: "dashboard.read", label: "Ver o painel de gestão" },
    ],
  },
  {
    title: "Administração",
    items: [
      { key: "members.manage", label: "Convidar pessoas e gerir cargos" },
      { key: "settings.manage", label: "Configurar locais, categorias e prazos" },
      { key: "displays.manage", label: "Configurar e parear TVs" },
      { key: "audit.read", label: "Ver o histórico de alterações" },
      { key: "establishment.manage", label: "Alterar dados do estabelecimento" },
    ],
  },
];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
