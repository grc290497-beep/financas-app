# PLAN.md — App de Controle Financeiro Pessoal

> Documento-mestre do projeto. O Claude Code deve ler este arquivo antes de cada fase e seguir a ordem das fases.

---

## 1. Visão do produto

Um web app (PWA, instalável no celular) para qualquer pessoa controlar suas finanças pessoais:

- registrar **quanto recebe** (salário, renda extra);
- cadastrar **custos fixos** recorrentes (aluguel, contas, assinaturas);
- lançar **gastos variáveis** por categoria (mercado, lazer, transporte…);
- acompanhar um **tracker mensal** com saldo, orçamento por categoria e taxa de poupança;
- definir **metas de economia** (quanto quer juntar e até quando) e ver se está no ritmo.

**Diferencial:** suporte nativo a **EUR e BRL**. O usuário escolhe a moeda de cada lançamento e define qual é a sua **moeda primária**. Todos os totais aparecem na moeda primária, com conversão automática.

**Público:** multiusuário aberto, ou seja, qualquer pessoa cria a própria conta. Cada usuário só vê os próprios dados.

**Princípio de UX:** lançar um gasto pelo celular em menos de 10 segundos.

---

## 2. Stack técnica

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | **Next.js** (App Router, versão estável mais recente) + **TypeScript** | Padrão de mercado, front e back no mesmo projeto |
| UI | **Tailwind CSS** + **shadcn/ui** | Componentes prontos, bonitos e acessíveis |
| Gráficos | **Recharts** | Simples e compatível com React |
| Formulários | **react-hook-form** + **zod** | Validação tipada, a mesma no client e no server |
| Banco + Auth | **Supabase** (Postgres + Auth + Row Level Security) | Login pronto, plano grátis, segurança por linha |
| Acesso a dados | `@supabase/ssr` + Server Components / Server Actions | Sem API separada para manter |
| Câmbio | **Frankfurter API** (cotações do BCE, grátis, sem chave) | EUR↔BRL diário |
| Datas | **date-fns** | Leve, com locale pt-BR |
| i18n | **next-intl** (pt-BR padrão, en depois) | Preparado para crescer |
| PWA | manifest + ícones (via Next metadata) | Instalar na tela inicial |
| Notificações | **web-push** (Web Push com chaves VAPID) + cron diário da Vercel | Avisos de orçamento e metas no celular |
| Testes | **Vitest** (unidade) + **Playwright** (E2E) | Garantir os cálculos financeiros |
| Deploy | **Vercel** (app) + **Supabase Cloud** (banco) | Gratuito para começar |
| Qualidade | ESLint + Prettier + `tsc --noEmit` | Padrão |

---

## 3. Regras de negócio essenciais

### 3.1 Dinheiro
- **Nunca usar float para dinheiro.** Os valores são guardados como **inteiros em centavos** (`bigint`), e a conversão para exibição só acontece na UI.
- Cada lançamento guarda:
  - `amount_cents` + `currency` (o valor **original**, na moeda em que foi lançado);
  - `fx_rate` (cotação usada, com 6 casas decimais) + `amount_primary_cents` (o valor convertido para a moeda primária **no momento do lançamento**).
- O valor convertido fica **congelado** no lançamento, para que o histórico não mude quando o câmbio variar.
- Se o usuário trocar a moeda primária, um job/ação recalcula `amount_primary_cents` de todos os lançamentos usando a cotação da **data de cada lançamento**.

### 3.2 Câmbio
- Fonte: `https://api.frankfurter.app/{data}?from=EUR&to=BRL`.
- As cotações vão para um cache na tabela `fx_rates (date, base, quote, rate)`, consultando a API no máximo 1x por dia por par.
- Em fim de semana ou feriado, usar a última cotação disponível (a API já faz isso).
- O usuário pode **editar a cotação manualmente** em um lançamento (ex.: cotação real do Wise/Revolut).

### 3.3 Mês financeiro
- O usuário define o **dia de início do mês** (ex.: dia 25, quando cai o salário). O padrão é dia 1.
- Todo o tracker mensal usa esse período (ex.: 25/out → 24/nov).

### 3.4 Custos fixos (recorrentes)
- São cadastrados como **modelos recorrentes** (`recurring_items`): nome, valor, moeda, categoria, dia do vencimento, frequência (mensal/semanal/anual) e data de início/fim.
- No início de cada mês financeiro, o sistema **gera os lançamentos previstos** (status `planned`).
- O usuário marca o lançamento como **pago** (`confirmed`) e pode ajustar o valor real (ex.: conta de luz variou).
- A geração precisa ser idempotente (não duplicar). Ela roda ao abrir o dashboard e também por um cron diário (Supabase cron ou Vercel cron).

### 3.5 Metas
- Uma meta tem nome, valor-alvo, moeda, prazo (data), valor inicial e ícone/cor.
- Os aportes ficam em `goal_contributions` (valor, moeda, data), e os retiradas são aportes negativos.
- Métricas por meta:
  - `restante = alvo − acumulado`
  - `meses_restantes = meses entre hoje e prazo`
  - `aporte_mensal_necessário = restante / meses_restantes`
  - `ritmo_atual = média de aportes dos últimos 3 meses`
  - `previsão_de_conclusão = hoje + restante / ritmo_atual` (em meses)
  - status: **no ritmo** / **atrasado** / **concluída**

### 3.6 Orçamento por categoria
- O usuário define um limite mensal por categoria (opcional).
- A barra de progresso muda de cor em 80% (atenção) e em 100% (estourou).

---

## 4. Modelo de dados (Supabase / Postgres)

> Todas as tabelas têm `user_id uuid references auth.users` + **RLS ativado** com a policy `user_id = auth.uid()` para select/insert/update/delete.

```sql
-- Perfil e preferências
profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  primary_currency text not null default 'EUR' check (primary_currency in ('EUR','BRL')),
  month_start_day int not null default 1 check (month_start_day between 1 and 28),
  locale text not null default 'pt-BR',
  onboarding_done boolean not null default false,
  created_at timestamptz default now()
)

-- Categorias (seed padrão criado no signup; usuário pode editar)
categories (
  id uuid pk, user_id uuid,
  name text not null,
  kind text not null check (kind in ('income','fixed','variable','savings')),
  icon text, color text,
  monthly_budget_cents bigint,          -- opcional, na moeda primária
  archived boolean default false,
  sort_order int
)

-- Contas/carteiras (opcional na v1, preparado para v2)
accounts (
  id uuid pk, user_id uuid,
  name text, currency text, type text check (type in ('bank','cash','card','savings')),
  archived boolean default false
)

-- Lançamentos (entradas e saídas)
transactions (
  id uuid pk, user_id uuid,
  type text not null check (type in ('income','expense')),
  category_id uuid references categories,
  account_id uuid references accounts null,
  recurring_item_id uuid references recurring_items null,
  description text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency in ('EUR','BRL')),
  fx_rate numeric(18,6) not null default 1,
  amount_primary_cents bigint not null,
  occurred_on date not null,
  status text not null default 'confirmed' check (status in ('planned','confirmed')),
  created_at timestamptz default now()
)
-- índices: (user_id, occurred_on), (user_id, category_id)

-- Modelos de custos fixos / entradas recorrentes
recurring_items (
  id uuid pk, user_id uuid,
  type text check (type in ('income','expense')),
  name text, category_id uuid,
  amount_cents bigint, currency text,
  frequency text check (frequency in ('weekly','monthly','yearly')),
  day_of_month int,                      -- para mensal
  start_on date, end_on date null,
  active boolean default true
)
-- unique (recurring_item_id, occurred_on) em transactions para garantir idempotência

-- Metas
goals (
  id uuid pk, user_id uuid,
  name text, target_cents bigint, currency text,
  initial_cents bigint default 0,
  deadline date, icon text, color text,
  status text default 'active' check (status in ('active','done','archived')),
  created_at timestamptz default now()
)

goal_contributions (
  id uuid pk, user_id uuid, goal_id uuid references goals on delete cascade,
  amount_cents bigint not null,          -- negativo = retirada
  currency text, fx_rate numeric(18,6), amount_goal_cents bigint,
  contributed_on date not null, note text
)

-- Cache de câmbio (público para leitura, escrita só via service role)
fx_rates (
  date date, base text, quote text, rate numeric(18,6),
  primary key (date, base, quote)
)
```

**Categorias padrão (seed):**
- Entradas: Salário, Renda extra, Outros.
- Fixos: Aluguel, Contas da casa, Internet/Celular, Transporte, Seguros, Assinaturas.
- Variáveis: Mercado, Restaurantes/Delivery, Lazer, Compras, Saúde, Viagens, Imprevistos.
- Poupança: Reserva, Investimentos.

**Views/funções SQL úteis:**
- `month_summary(user, start, end)`: total de entradas, fixos, variáveis, saldo e taxa de poupança.
- `category_spend(user, start, end)`: gasto vs. orçamento por categoria.

---

## 5. Telas (rotas)

| Rota | Conteúdo |
|---|---|
| `/` (público) | Landing simples: o que é, botão "Criar conta" |
| `/login`, `/signup` | Supabase Auth: e-mail + senha, magic link e Google (opcional) |
| `/onboarding` | Wizard em 4 passos: moeda primária → dia de início do mês → renda mensal → custos fixos principais → (opcional) primeira meta |
| `/app` (dashboard) | Resumo do mês: entradas, gastos, saldo, "quanto ainda posso gastar", taxa de poupança, top categorias, próximas contas a vencer, metas em destaque |
| `/app/transactions` | Lista filtrável (mês, categoria, tipo, moeda), busca, editar/excluir |
| `/app/fixed` | Custos fixos e entradas recorrentes, marcar como pago |
| `/app/budget` | Orçamento por categoria com barras de progresso |
| `/app/goals` | Metas, aportes, projeção e status |
| `/app/goals/[id]` | Detalhe da meta: gráfico de evolução e histórico de aportes |
| `/app/reports` | Gráficos: evolução mensal (12 meses), pizza por categoria, comparação mês a mês |
| `/app/settings` | Perfil, moeda primária, dia de início, categorias, exportar dados (CSV), excluir conta |

**Botão flutuante "+" (sempre visível no mobile):** abre uma sheet de lançamento rápido com valor (teclado numérico), toggle EUR/BRL, categoria (chips com as mais usadas primeiro), data (padrão hoje) e descrição opcional.

**Navegação mobile:** bottom tab bar com Início · Lançamentos · Metas · Relatórios · Ajustes.

---

## 6. Métricas do dashboard

| Métrica | Fórmula |
|---|---|
| Entradas do mês | Σ income confirmed no período |
| Gastos do mês | Σ expense confirmed no período |
| Fixos previstos | Σ expense planned + confirmed vindos de recurring |
| Saldo | entradas − gastos |
| Livre para gastar | entradas − fixos previstos − aportes planejados em metas − variáveis já gastos |
| Livre por dia | livre para gastar / dias restantes no mês |
| Taxa de poupança | (entradas − gastos) / entradas |
| Variação vs. mês anterior | por categoria, em % |
| Progresso de metas | acumulado / alvo, mais o status do ritmo |

Tudo é exibido na **moeda primária**, com um toggle para ver os valores na outra moeda (usando a cotação do dia).

---

## 7. Segurança e privacidade (o app é aberto ao público e operado da UE)

- RLS em **todas** as tabelas, com testes que garantem que o usuário A não lê dados do B.
- Nunca expor a `service_role key` no client; ela só vive em env vars do servidor.
- Validação com zod em todas as Server Actions.
- **GDPR:** página de política de privacidade, botão **exportar meus dados** (CSV/JSON) e **excluir minha conta** (apaga tudo em cascata).
- Rate limiting básico nas actions de auth (o Supabase já cobre o login).
- Sem analytics de terceiros na v1.

---

## 8. Roadmap por fases

> Cada fase termina com: `npm run lint`, `npm run typecheck`, `npm test` passando, commit e deploy de preview.

### Fase 0 — Setup (meio dia)
- Criar o projeto Next.js + TS + Tailwind + ESLint.
- Instalar o shadcn/ui e os componentes base (button, input, card, sheet, dialog, select, tabs, toast, progress).
- Criar o projeto Supabase e configurar `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Configurar o Supabase CLI e a pasta `supabase/migrations`.
- Conectar o repositório GitHub → Vercel.
- **Pronto quando:** a página inicial está no ar na Vercel.

### Fase 1 — Auth + perfil + onboarding
- Signup/login/logout com `@supabase/ssr` e um middleware protegendo `/app/*`.
- Trigger SQL que cria `profiles` + as categorias padrão no signup.
- Wizard de onboarding.
- **Pronto quando:** um usuário novo cria a conta, escolhe a moeda e o dia de início e cai no dashboard vazio.

### Fase 2 — Lançamentos + câmbio (núcleo do app)
- Migrations: `transactions`, `fx_rates`.
- Serviço `lib/fx.ts`: busca cotação → cache → fallback.
- Utilitários `lib/money.ts`: parse/format de centavos, conversão e `Intl.NumberFormat` por moeda.
- Sheet de lançamento rápido + lista de lançamentos com filtros, edição e exclusão.
- **Testes unitários** de money e fx (arredondamento, conversão ida e volta).
- **Pronto quando:** lanço €12,50 e R$80, e ambos aparecem convertidos certo na moeda primária.

### Fase 3 — Custos fixos recorrentes
- Migration `recurring_items` + constraint de idempotência.
- Tela de cadastro e a função `generateRecurringForPeriod(user, period)`.
- Marcar como pago e ajustar o valor.
- Cron diário.
- **Pronto quando:** cadastro o aluguel no dia 1 e ele aparece como previsto todo mês, sem duplicar.

### Fase 4 — Dashboard mensal + orçamento
- `lib/period.ts`: cálculo do mês financeiro a partir de `month_start_day`.
- Funções SQL `month_summary` e `category_spend`.
- Cards de métricas, barras de orçamento e lista de próximas contas.
- Navegação entre meses (← →).
- **Pronto quando:** o dashboard mostra todas as métricas da seção 6, corretas para meses com dia de início ≠ 1.

### Fase 5 — Metas
- Migrations `goals` e `goal_contributions`.
- CRUD de metas, aportes e retiradas.
- `lib/goals.ts` com as fórmulas da seção 3.5, todas com teste unitário.
- Gráfico de evolução da meta.
- **Pronto quando:** crio "Reserva de emergência €6.000 até dez/2027" e o app diz quanto preciso guardar por mês e se estou no ritmo.

### Fase 6 — Relatórios + exportação
- Gráfico de barras de 12 meses (entradas vs. gastos), pizza por categoria e tabela comparativa mês a mês.
- Exportar CSV de lançamentos e exportar todos os dados em JSON (GDPR).
- **Pronto quando:** consigo baixar meus dados e ver a evolução do ano.

### Fase 7 — PWA, polimento e lançamento
- Manifest, ícones e tema; testar "Adicionar à tela inicial" no iOS e no Android.
- Estados vazios, loading skeletons e mensagens de erro amigáveis.
- Modo escuro.
- Testes E2E (Playwright) do fluxo signup → lançamento → meta.
- Página de privacidade e de termos, e exclusão de conta.
- Domínio próprio (opcional).
- **Pronto quando:** o app está publicado e usável por qualquer pessoa.

### Backlog (v2+)
- Contas/carteiras com saldo próprio e transferências entre elas.
- Divisão de gastos com outra pessoa (casal).
- Mais moedas (USD, GBP).
- Versão em inglês.
- Plano pago (Stripe), se virar produto.

---

## 9. Estrutura de pastas sugerida

```
/app
  /(public)        landing, login, signup
  /(app)/app       dashboard e telas logadas
  /api/cron        geração de recorrentes
/components
  /ui              shadcn
  /forms           TransactionForm, GoalForm…
  /charts
/lib
  money.ts  fx.ts  period.ts  goals.ts  validators.ts
  /supabase        client.ts  server.ts  middleware.ts
/supabase
  /migrations
  seed.sql
/tests
  /unit  /e2e
```

---

## 10. O que preparar antes de abrir o Claude Code

**Contas (todas com plano grátis):**
- [ ] GitHub (repositório do projeto)
- [ ] Supabase (criar um projeto na região **EU — Frankfurt ou Irlanda**)
- [ ] Vercel (conectada ao GitHub)

**Na máquina:**
- [ ] Node.js LTS + npm
- [ ] Git
- [ ] Supabase CLI (`npm i -g supabase` ou via Homebrew)
- [ ] Claude Code

**Ferramentas/integrações recomendadas para o Claude Code:**
- [ ] **Supabase MCP server** (oficial). Permite ao Claude criar tabelas, rodar migrations e checar RLS direto no seu projeto.
- [ ] **shadcn/ui CLI** (`npx shadcn@latest init`). Adiciona componentes sem copiar e colar.
- [ ] **Playwright** já vem no fluxo de testes da Fase 7.
- [ ] Opcional: Vercel CLI para deploy pelo terminal.

**Decisões já tomadas (não precisa perguntar de novo):**
- Multiusuário aberto, Next.js + Supabase, EUR + BRL com moeda primária escolhida pelo usuário, idioma pt-BR primeiro.

---

## 11. Prompts sugeridos por fase (copiar no Claude Code)

1. *"Leia PLAN.md e CLAUDE.md. Execute a Fase 0. Ao final, rode lint/typecheck e me diga o que preciso configurar manualmente (env vars, Vercel)."*
2. *"Execute a Fase 1 do PLAN.md. Crie as migrations em supabase/migrations e teste o RLS."*
3. *"Execute a Fase 2. Comece pelos testes de lib/money.ts e lib/fx.ts antes da UI."*
4. *"Execute a Fase 3…"* e assim por diante, uma fase por vez, revisando no celular entre cada uma.
