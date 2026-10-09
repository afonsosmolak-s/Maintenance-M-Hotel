# ZMOLAK Maintenance

SaaS de gestão de manutenção para motéis e hotéis — ZMOLAK Technology.
Nome provisório, definido em `src/config/brand.ts`.

- Plano, arquitetura e decisões: [`docs/PLANO-MVP.md`](docs/PLANO-MVP.md)

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind CSS 4 · Supabase (Postgres + RLS, Auth, Storage) · Zod · Vitest

## Desenvolvimento

```bash
cp .env.example .env.local   # preencher com os valores públicos do Supabase
npm install
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir |
| `npm test` | Testes unitários (Vitest) |
| `npm run build` | Build de produção |

- `/ui-kit` mostra os tokens e componentes base (indisponível em produção).
- Migrações SQL ficam em `supabase/migrations/` e são aplicadas em ordem.
