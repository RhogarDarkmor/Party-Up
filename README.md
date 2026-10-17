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

Abra `http://localhost:3000`. Cadastro, perfis e seleção de jogos estão
disponíveis após configurar o Supabase. Descoberta de jogadores, matchmaking
e parties ainda não estão implementados e não simulam operações reais.

## Autenticação e perfil de jogador

O cadastro e login usam Supabase Auth com confirmação de e-mail, sessão em
cookies protegidos pelo servidor e atualização de tokens via `src/proxy.ts`.
Os perfis podem ser criados e editados em `/perfil`; essa rota exige uma sessão
válida. Não configure nem exponha a chave `service_role` no navegador.

1. Crie um projeto Supabase e aplique, em ordem, as migrações
   `supabase/migrations/20261015000000_init_gamer_profiles.sql` e
   `supabase/migrations/20261016000000_game_catalog_and_profile_games.sql` pelo
   SQL Editor ou pela CLI do Supabase.
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

A migração atual permite a cada usuário ler e editar somente o próprio perfil.
Descoberta pública de jogadores não está habilitada; as políticas de leitura
precisam ser ampliadas com uma estratégia de privacidade antes do matchmaking.

O catálogo inicial contém dez jogos mantidos por migração. Em `/perfil`, cada
jogador pode selecionar até 20 jogos; suas seleções são privadas e só podem ser
lidas ou alteradas pelo próprio usuário. Adicione títulos ao catálogo por uma
nova migração. Descoberta de jogadores e visibilidade pública dessas seleções
ainda não estão habilitadas.

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
- Login administrativo e painel de avanço protegidos no servidor.
- Leitura de milestones, issues, commits e GitHub Actions com atualização
  periódica.
- Cadastro, confirmação de e-mail, login e edição de perfil integrados ao
  Supabase Auth.
- Descoberta pública de jogadores, parties, convites, políticas de leitura para
  matchmaking, testes de produto e deploy ainda precisam ser implementados.
