import { brand } from "@/config/brand";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-center gap-6 px-[clamp(24px,4.4vw,72px)] py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{brand.company}</p>
      <h1 className="max-w-[14ch] text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-[550] tracking-[-0.045em]">
        {brand.productName}
      </h1>
      <p className="max-w-[48ch] text-base text-muted">
        Gestão de manutenção para motéis e hotéis. Ambiente em construção — ainda sem dados nem acesso de clientes.
      </p>
    </main>
  );
}
