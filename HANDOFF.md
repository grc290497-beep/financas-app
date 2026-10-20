# HANDOFF — continuar o financas-app em outro computador

> **Para o Claude que ler isto:** este arquivo resume tudo que foi feito até aqui e como
> continuar. Leia também `CLAUDE.md` (regras do projeto) e `PLAN.md` (spec e roadmap)
> antes de qualquer trabalho. Responda ao usuário em **português (pt-BR)**; código,
> comentários e commits em inglês.

## 0. Primeira coisa a fazer: conferir skills, plugins e ferramentas

Antes de continuar o projeto, **verifique se cada item abaixo está instalado nesta máquina.
O que faltar, instale** (peça confirmação ao usuário quando a instalação pedir aceite de termos).

### Ferramentas do sistema (Windows, via `winget`)
- **Node.js LTS**: `winget install OpenJS.NodeJS.LTS`
- **Git**: `winget install Git.Git`
- Python 3 (para o graphify): `winget install Python.Python.3.12`
- No PowerShell, node/git podem não estar no PATH da sessão. Antes dos comandos, use:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`

### Claude Code
- O Claude Code aparece na aba **Code** do app desktop do Claude (Windows/Mac).
  Alternativa: CLI com `npm install -g @anthropic-ai/claude-code` e rodar `claude` na pasta do projeto.
- O claude.ai no navegador sozinho **não** roda comandos nem edita arquivos.

### Skills (pasta `~/.claude/skills/`)
Devem existir estas skills:
`animate, animate-expo, animation-performance, animation-vocabulary, apple-design, ask-sonner,
break-ui, emil-design-eng, find-animation-opportunities, improve-animations, mobile-native,
pick-ui-library, prototype, review-animations, write-swift, impeccable, graphify`

Origem de cada uma:
| Skill(s) | Origem | Como instalar |
|---|---|---|
| animate … write-swift (as de animação/design do Emil Kowalski) | https://github.com/emilkowalski/skills | clonar o repo e copiar cada pasta de skill para `~/.claude/skills/` |
| impeccable | https://github.com/pbakaus/impeccable | **só a skill, sem os hooks** (o usuário escolheu assim). Copiar a pasta da skill para `~/.claude/skills/impeccable` |
| graphify | https://github.com/Graphify-Labs/graphify | `pip install` a partir do código-fonte do repo e depois `graphify install` (cria `~/.claude/skills/graphify` e a linha no `~/.claude/CLAUDE.md`) |

**Não** instalar `ui-ux-pro-max` (o usuário pediu para remover).

### Plugins
- **ponytail** (plugin completo) — https://github.com/DietrichGebert/ponytail
  ```
  claude plugin marketplace add DietrichGebert/ponytail
  claude plugin install ponytail@ponytail
  ```
  O usuário usa o nível **lite**: `/ponytail lite` (constrói o que foi pedido e aponta em uma
  linha quando existe uma versão menor).

### Conectores (claude.ai → Settings → Connectors) — o usuário conecta, você não digita credenciais
- **Supabase** (projeto `nbaetpofofagcogzykhv`)
- **Vercel** (projeto `financas-app`)
- **Figma** (opcional, para a fase de design)

### Memória a recriar
- O usuário quer **um passe completo de layout/design antes de terminar o app (Fase 7)**,
  não polimento a cada fase. "A apresentação na planilha não fica das melhores, mas está
  funcionando; podemos voltar pro layout final antes de terminar o app."

## 1. Baixar e rodar o projeto

```
git clone https://github.com/grc290497-beep/financas-app.git
cd financas-app
npm install
```

Criar `.env.local` (não vai para o git — **o usuário cola os valores**, nunca o Claude):
```
NEXT_PUBLIC_SUPABASE_URL=https://nbaetpofofagcogzykhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key: Supabase → Project Settings → API Keys>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=            # opcional no local; sem ele o cache de câmbio só não é gravado
```
(`.env.example` documenta tudo, inclusive `CRON_SECRET`, que só existe na Vercel.)

Comandos: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run format`. Para testes RLS via CLI: `npx supabase login` e
`npx supabase link --project-ref nbaetpofofagcogzykhv` (ainda não foi feito).

Git: autor `grc290497@gmail.com`; `core.autocrlf false` (há `.gitattributes` com `eol=lf`).
Push direto na `main` está aprovado; a Vercel faz o deploy sozinha. Para conferir o deploy:
`https://api.github.com/repos/grc290497-beep/financas-app/commits/<sha>/status`.

## 2. Estado atual (20/10/2026)

| Fase | Status |
|---|---|
| 0 Setup | ✅ no ar na Vercel |
| 1 Auth + perfil + onboarding | ✅ |
| 2 Lançamentos + câmbio | ✅ |
| 3 Fixos recorrentes + cron diário (`/api/cron/recurring`, `CRON_SECRET` configurado) | ✅ |
| 4 Dashboard + orçamento | ✅ |
| 5 Metas | ✅ testado no navegador |
| Extra pós-fase 5 | ✅ meses futuros mostram os fixos previstos (até 12 meses à frente, gerados ao abrir o mês); edição de fixo com **"Mudança vale a partir de"** (divide o item: antigo termina na véspera, novo começa na próxima ocorrência; recusa se já há pagamento confirmado a partir da data) |
| 6 Relatórios + exportação | ✅ `/app/reports` (barras 12 meses, rosca por categoria, tabela) + `/app/reports/export?format=csv\|json`; testado no navegador com dados de teste (já apagados) |
| 7 PWA, polimento, E2E, privacidade + passe de design | 🟡 quase: Ajustes com edição de perfil, excluir conta, `/privacy` e `/terms`, PWA (`app/manifest.ts`, ícones de `components/brand/mark.ts`), escuro por padrão, paleta esmeralda+latão (positivo latão, negativo cobre), logo, rodapé, E2E escrito. Falta: rodar o E2E (service role no `.env.local`), e-mail de contato na privacidade, testar "Adicionar à tela inicial" no celular, domínio próprio (opcional) |

Último commit: "Resolve the session before goal queries…" (após `c4ac7c2`). 175 testes unitários passando.
O usuário apagou os próprios dados de teste no app; o banco estava vazio em 20/10.

### Plano esboçado para a Fase 6 (PLAN.md §8)
- Rota `/app/reports` + aba "Relatórios" no `components/nav/app-nav.tsx`.
- Barras de 12 meses (entradas vs. gastos): reaproveitar `getMonthSummary(period)` (RPC
  `month_summary`) para cada período via `shiftPeriod` — 12 chamadas em paralelo.
- Pizza por categoria do mês: `getCategorySpend(period)`.
- Tabela comparativa mês a mês (entradas, gastos, saldo, taxa de poupança).
- Exportar CSV de lançamentos e JSON com todos os dados (GDPR) via route handlers
  autenticados (RLS com o client do usuário, nunca service role).
- Gráficos com Recharts seguindo o padrão de `components/goals/goal-chart.tsx`
  (cores por tokens CSS, tooltip, sem animação). Ler a skill `dataviz` antes.
- **Pronto quando:** o usuário consegue baixar os dados e ver a evolução do ano.

## 3. Arquitetura e convenções importantes

- **Stack:** Next.js 16 (App Router, Turbopack, `cacheComponents: true`, `proxy.ts` no lugar
  de middleware), React 19, TS strict (target ES2020 por causa de BigInt), Tailwind v4,
  shadcn/ui, next-intl (só pt-BR, `messages/pt-BR.json`), react-hook-form + zod 4 com resolver
  próprio (`lib/zod-resolver.ts`), date-fns 4, Recharts 3, sonner, Vitest.
- **Cache Components:** qualquer `new Date()`/`Date.now()` exige `await connection()` antes.
  `requireUser`/`requireProfile` (`lib/auth.ts`) chamam `connection()`; **resolva o perfil
  antes** de outras queries do Supabase (não em paralelo), senão aparece o erro de
  prerender. Leituras de sessão ficam dentro de `<Suspense>`. Componentes client com
  `usePathname` em layouts precisam de `<Suspense>` por causa de rotas dinâmicas.
- **Dinheiro:** centavos inteiros; câmbio em BigInt micro-unidades. Só EUR→BRL é buscado
  (Frankfurter/ECB) e cacheado em `fx_rates`; BRL→EUR é o inverso. Datas futuras usam a cotação de hoje.
- **Mês financeiro:** `lib/period.ts` com `month_start_day` 1–28; URLs usam `?month=yyyy-MM`.
- **Recorrentes:** `lib/recurring.ts` (puro, testado) + `lib/recurring-store.ts`
  (`ensureRecurringGenerated(today, viewedMonth?)`). Idempotente por
  `unique(recurring_item_id, occurred_on)`.
- **Metas:** `lib/goals.ts` (métricas puras, testadas), `lib/goals-store.ts`, `lib/actions/goals.ts`.
- **Migrations:** escrever `supabase/migrations/<versão>_nome.sql`; testar antes com pgTAP num
  bloco DO que termina em `raise exception 'ROLLBACK_ON_PURPOSE'` (via MCP `execute_sql`),
  depois `apply_migration`, `list_migrations` e renomear o arquivo local para a versão aplicada.
  Testes pgTAP ficam em `supabase/tests/database/`. Toda tabela nova tem RLS
  `(select auth.uid())` e FKs compostas `(x_id, user_id)`.
- Toda Server Action valida com zod (`lib/validators.ts`). Erros retornam chaves de mensagem.

## 4. Regras de trabalho combinadas com o usuário

- Uma fase por vez; não começar a próxima sem o usuário pedir.
- No fim de cada fase: lint, typecheck, test (e build), resumo do que mudou e do que o
  usuário precisa fazer manualmente.
- Perguntar antes de adicionar dependência fora do PLAN.md §2.
- **Dados de teste** só com permissão (o banco é o de produção) e apagar depois.
- Nunca digitar senhas, chaves ou tokens: o usuário cola os segredos. Para gerar segredos existe
  `scripts/copy-cron-secret.ps1` (copia para a área de transferência sem mostrar).
- Testar no navegador embutido em `http://localhost:3000` (o usuário faz o login).

## 5. Pendências que dependem do usuário

- **Dados de teste na conta do usuário (pedido dele, NÃO apagar sem ele pedir):** 96 lançamentos
  confirmados de mai–out/2026 (todos com `created_at` de 2026-10-20 ~20:23 UTC), 6 aportes na meta
  "Casa" e limites de orçamento em Mercado, Restaurantes/Delivery, Lazer e Compras. Para remover:
  `delete from transactions where status = 'confirmed' and created_at between '2026-10-20 20:23' and '2026-10-20 20:24'`
  (e os aportes/limites à parte).

- Variáveis de ambiente de Preview na Vercel ainda só estão em Production.
- Supabase: ativar "leaked password protection" (aviso do advisor).
- SMTP próprio no Supabase (o padrão tem limite baixo de e-mails) — Fase 7.
