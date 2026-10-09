import { Button } from "@/components/ui/button";

export function SignOutButton({ variant = "secondary" }: { variant?: "secondary" | "ghost" }) {
  return (
    <form action="/auth/sair" method="post">
      <Button type="submit" variant={variant} size="sm">
        Sair
      </Button>
    </form>
  );
}
