"use client";

import type { ComponentProps } from "react";
import { Button } from "./button";

/** Botão de envio que pede confirmação antes (ações destrutivas). */
export function ConfirmButton({ confirmText, ...props }: ComponentProps<typeof Button> & { confirmText: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(event) => {
        if (!confirm(confirmText)) event.preventDefault();
      }}
    />
  );
}
