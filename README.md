# PartyUp

Plataforma social gamer em desenvolvimento para conectar jogadores por jogo,
plataforma, idioma, estilo e horário. A versão inicial prepara a fundação Next.js
e um painel administrativo privado de andamento.

## Requisitos

- Node.js 20.9 ou superior.
- npm.
- Um projeto Supabase para autenticação e perfis de jogadores.

## Desenvolvimento local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Cadastro, perfis, descoberta de jogadores e seleção
de jogos estão disponíveis após configurar o Supabase. O feed de parties permite
publicar e encontrar equipes abertas com vagas.

## Autenticação e perfil de jogador

O cadastro e login usam Supabase Auth com confirmação de e-mail, sessão em
cookies protegidos pelo servidor e atualização de tokens via `src/proxy.ts`.
Os perfis podem ser criados e editados em `/perfil`; essa rota exige uma sessão
válida. Não configure nem exponha a chave `service_role` no navegador.

1. Crie um projeto Supabase e aplique, em ordem, as migrações
   `supabase/migrations/20261015000000_init_gamer_profiles.sql`,
   `supabase/migrations/20261016000000_game_catalog_and_profile_games.sql` e
   `supabase/migrations/20261017000000_discovery_profiles_platforms_and_avatars.sql`,
   `supabase/migrations/20261017010000_fix_avatar_storage_path_policies.sql` e
   `supabase/migrations/20261017020000_explicit_bio_discovery_consent.sql` e
   `supabase/migrations/20261017180000_parties_feed_and_game_activity.sql`,
   `supabase/migrations/20261019180000_add_contact_info_to_parties.sql` e
   `supabase/migrations/20261019220000_add_player_friend_requests.sql`
   pelo SQL Editor ou pela CLI do Supabase.
2. No terminal integrado, execute `npm run supabase:configure`. Informe o URL
   do projeto, a chave **publishable** (ou `anon` legado) e o endereço local do
   aplicativo nos prompts ocultos. Use a URL/porta mostrada pelo `npm run dev`,
   por exemplo `http://127.0.0.1:3001`. O script valida os formatos, rejeita
   chaves `secret`/`service_role` e salva a configuração somente em
   `.env.local`, que é ignorado pelo Git. A chave publishable/anon é pública
   por desenho; a proteção dos perfis depende de RLS.
3. No Supabase, habilite confirmação de e-mail e adicione
   `http://localhost:3000/auth/callback` às URLs permitidas de redirecionamento.
   Em produção, configure a URL HTTPS do site e o callback correspondente.
4. Reinicie `npm run dev`, crie uma conta em `/cadastro`, confirme o e-mail e
   preencha o perfil em `/perfil`.

A migração inicial permite a cada usuário ler e editar somente o próprio perfil.
Descoberta usa uma função autenticada limitada a perfis que optaram por aparecer;
os dados privados dos demais jogadores continuam inacessíveis.

O catálogo inicial contém dez jogos mantidos por migração. Em `/perfil`, cada
jogador pode selecionar até 20 jogos; suas seleções são privadas e só podem ser
lidas ou alteradas pelo próprio usuário. Adicione títulos ao catálogo por uma
nova migração. A migração
`supabase/migrations/20261017000000_discovery_profiles_platforms_and_avatars.sql`
adiciona plataformas, upload privado de fotos e consentimento explícito para a
descoberta. A migração seguinte ajusta a política do arquivo no bucket privado.
A migração de consentimento da bio mantém esse campo oculto por padrão e reserva
as alterações de perfil à função autenticada do aplicativo.
A busca em `/jogadores` exige um jogo ou plataforma e mostra somente perfis que
habilitaram a descoberta.

### Amizades

Em `/jogadores`, abra o perfil de alguém visível na descoberta para enviar um
pedido de amizade. Em `/amizades`, os jogadores podem aceitar ou recusar pedidos
recebidos e consultar pedidos enviados e amizades aceitas. O banco valida cada
operação usando a sessão autenticada e não permite acesso direto à tabela de
pedidos.

### Feed de parties e atividade por jogo

Em `/parties`, jogadores autenticados podem filtrar parties abertas com vagas
por jogo, modo, faixa de horário local e idioma. O horário exibido e a faixa
filtrada usam o fuso horário salvo no perfil. Em `/parties/nova`, o anfitrião
publica jogo, modo, horário, idioma, tamanho da equipe e detalhes; ele ocupa a
primeira vaga automaticamente. Outros jogadores podem entrar ou sair enquanto
a party ainda tiver vagas, e o anfitrião pode cancelá-la.

O perfil privado em `/perfil` mostra o gráfico de parties por jogo. Os perfis
públicos de jogadores só exibem esse gráfico quando a descoberta está habilitada.
A participação do anfitrião e de quem entrou na equipe é registrada no banco;
parties canceladas não entram nas estatísticas. Sem histórico, o perfil explica
como o gráfico será preenchido.

### Foto do perfil e descoberta

Em `/perfil`, o jogador pode enviar uma foto JPG, PNG ou WebP de até 5 MB,
escolher as plataformas que usa e decidir se quer aparecer na descoberta.
Compartilhar a bio é uma opção independente e começa desligada.
Fotos ficam em bucket privado; somente o próprio jogador e pessoas com perfil
visível na descoberta podem obter URLs assinadas, com validade de um minuto. A
descoberta pode ser desativada a qualquer momento e começa desligada.

### Login com redes sociais

O código oferece Google, Facebook e X (OAuth 2.0) nas telas de cadastro e login.
Para habilitar cada botão, configure o Client ID e o Client Secret do provedor
em **Supabase Dashboard → Authentication → Sign In / Providers**. Configure o
callback do provedor como `https://<project-ref>.supabase.co/auth/v1/callback`
e permita `http://localhost:3000/auth/callback` em
**Authentication → URL Configuration → Redirect URLs**. Em produção, permita
também o callback HTTPS do site. Segredos dos provedores ficam somente no
Dashboard Supabase; nunca os adicione ao repositório.

## Configurar o acesso administrativo

O identificador, o hash da senha e o segredo de sessão existem somente em
variáveis privadas do servidor. Não coloque credenciais no código, no Git, em
variáveis `NEXT_PUBLIC_*` ou em mensagens. `.env.local` já é ignorado pelo Git.

1. Gere um hash de senha usando a entrada oculta do terminal:

   ```powershell
   npm run admin:hash-password
   ```

   Guarde o valor `scrypt:...` exibido e use-o como `ADMIN_PASSWORD_HASH`. O
   script não grava a senha nem o hash em arquivo.

2. Gere um segredo de sessão com pelo menos 32 bytes aleatórios:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Preencha `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e
   `ADMIN_SESSION_SECRET` em `.env.local` para desenvolvimento, ou no cofre de
   segredos do provedor de deploy para produção. Use o login escolhido pelo
   administrador; ele não deve ser incluído neste repositório.

4. Acesse `http://localhost:3000/admin/login`. O painel está em
   `http://localhost:3000/admin`.

As rotas do painel e de dados verificam a sessão no servidor. A sessão usa um
cookie assinado, `HttpOnly`, `SameSite=Strict`, com duração de oito horas e
`Secure` em produção. A senha é verificada com scrypt e comparações de tempo
constante. O login limita tentativas por endereço IP no processo atual; em
deploys com múltiplas instâncias, configure também rate limiting persistente ou
um WAF no provedor.

## Atualização automática pelo GitHub

O dashboard consulta a API do GitHub no servidor a cada 30 segundos, sem
expor o token ao navegador. A porcentagem é calculada pelas issues concluídas
divididas pelo total de issues associadas a milestones; o painel também mostra
milestones, commits recentes e o último workflow do GitHub Actions. O painel não
inventa progresso caso esses dados não existam.

Depois de criar e publicar o repositório:

1. Crie um fine-grained personal access token restrito ao repositorio PartyUp,
   com permissoes somente de leitura para **Contents**, **Issues** e **Actions**
   e um prazo de validade curto.
2. Execute `npm run github:configure` no terminal interativo do VS Code e cole
   o token no prompt oculto. O script valida o acesso a commits, milestones e
   Actions antes de gravar `GITHUB_REPOSITORY` e `GITHUB_TOKEN` em `.env.local`,
   arquivo ignorado pelo Git.
3. Reinicie `npm run dev`. Em producao, guarde as duas variaveis no cofre de
   segredos do provedor e publique uma nova versao.
4. Crie milestones para as etapas do PartyUp e associe issues a elas. O workflow
   em `.github/workflows/ci.yml` executa lint, verificacao de tipos e build em
   cada push e pull request.

Sem essa configuração, o painel informa que a integração está pendente; não
apresenta métricas de exemplo como se fossem dados reais.

## Verificações

```powershell
npm run lint
npm run typecheck
npm run build
```

## Estado do MVP

- Fundação Next.js, TypeScript e interface inicial em português.
- Migração inicial de `gamer_profiles` com RLS restrita ao próprio usuário.
- Catálogo inicial de jogos e seleção privada de jogos no perfil, protegidos por RLS.
- Descoberta de jogadores por jogo, plataforma, idioma e estilo com opt-in.
- Foto de perfil em bucket privado e badges das plataformas selecionadas.
- Login e cadastro por e-mail e OAuth para Google, Facebook e X, após configurar
  credenciais dos provedores no Supabase.
- Login administrativo e painel de avanço protegidos no servidor.
- Leitura de milestones, issues, commits e GitHub Actions com atualização
  periódica.
- Cadastro, confirmação de e-mail, login e edição de perfil integrados ao
  Supabase Auth.
- Convites, testes de produto e deploy ainda precisam ser implementados.
