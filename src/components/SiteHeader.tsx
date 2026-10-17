import Link from "next/link";
import Logo from "@/components/Logo";

export default function SiteHeader() {
  return (
    <header className="pu-header">
      <Link
        href="/"
        className="pu-brand pu-display"
        aria-label="PartyUp, página inicial"
      >
        <Logo size={36} />
        PartyUp
      </Link>
      <nav className="pu-nav" aria-label="Principal">
        <Link href="/jogadores">Jogadores</Link>
        <Link href="/entrar">Entrar</Link>
        <Link href="/cadastro" className="pu-btn pu-btn--primary">
          Criar conta
        </Link>
      </nav>
    </header>
  );
}
