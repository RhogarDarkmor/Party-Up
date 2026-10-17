import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import "./partyup.css";

export const metadata: Metadata = {
  title: "PartyUp: ache gente pra jogar do seu jeito",
  description:
    "Encontre jogadores pelo jogo, plataforma, idioma, estilo e horário. Você escolhe se aparece na busca.",
};

const examples = [
  {
    nick: "NickDoJogador",
    initial: "N",
    coral: false,
    info: "Português · joga à noite",
    tags: ["Valorant", "PC", "Competitivo"],
  },
  {
    nick: "OutroNick",
    initial: "O",
    coral: true,
    info: "Português · joga à tarde",
    tags: ["Minecraft", "Console", "Casual"],
  },
];

const privacyFeatures = [
  {
    title: "Você decide se aparece",
    text: "A descoberta começa desligada e você pode desativá-la quando quiser.",
  },
  {
    title: "Sua bio é opcional",
    text: "Compartilhar a bio é uma escolha separada e também começa desligada.",
  },
  {
    title: "Foto protegida",
    text: "Sua foto só aparece para jogadores que também estão visíveis na busca.",
  },
];

export default function Home() {
  return (
    <div className="pu-page">
      <SiteHeader />

      <main>
        <section className="pu-hero">
          <div className="pu-hero-text">
            <h1 className="pu-display">Ache gente pra jogar do seu jeito.</h1>
            <p className="pu-lead">
              Encontre jogadores pelo jogo, plataforma, idioma, estilo e
              horário. Você escolhe se aparece na busca.
            </p>
            <div className="pu-actions">
              <Link href="/cadastro" className="pu-btn pu-btn--accent">
                Criar minha conta
              </Link>
              <Link href="/jogadores" className="pu-btn pu-btn--ghost">
                Ver jogadores
              </Link>
            </div>
          </div>

          <div className="pu-cards">
            {examples.map((player) => (
              <article key={player.nick} className="pu-card">
                <div className="pu-avatar-wrap">
                  <div
                    className={`pu-avatar pu-display${player.coral ? " pu-avatar--coral" : ""}`}
                    aria-hidden="true"
                  >
                    {player.initial}
                  </div>
                  <span className="pu-status" role="img" aria-label="Online" />
                </div>
                <div>
                  <div className="pu-card-name">{player.nick}</div>
                  <div className="pu-card-info">{player.info}</div>
                  <div className="pu-chips">
                    {player.tags.map((tag) => (
                      <span key={tag} className="pu-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            <p className="pu-cards-caption">
              Exemplo de como os perfis aparecem na busca.
            </p>
          </div>
        </section>

        <section className="pu-privacy" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="pu-display">
            Seu perfil, suas regras
          </h2>
          <div className="pu-privacy-list">
            {privacyFeatures.map((feature) => (
              <article key={feature.title} className="pu-privacy-item">
                <h3 className="pu-display">{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="pu-footer">
        Parties e convites chegam em breve.
      </footer>
    </div>
  );
}
