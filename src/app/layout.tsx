import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PartyUp — encontre sua próxima equipe",
    template: "%s | PartyUp",
  },
  description:
    "Encontre jogadores compatíveis com seu jogo, plataforma, idioma e horário.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
