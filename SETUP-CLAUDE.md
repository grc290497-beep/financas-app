# Setup do Claude Code: skills, plugins e conectores

Lista portátil para levar a qualquer projeto. Copie este arquivo para a raiz do
projeto novo e peça ao Claude: **"confira e instale o que falta do SETUP-CLAUDE.md"**.
Pedir confirmação ao usuário sempre que uma instalação pedir aceite de termos.

## 1. Ferramentas do sistema (Windows, via `winget`)

| Ferramenta | Comando |
| --- | --- |
| Node.js LTS | `winget install OpenJS.NodeJS.LTS` |
| Git | `winget install Git.Git` |
| Python 3 (só para o graphify) | `winget install Python.Python.3.12` |

Se `node` ou `git` não forem encontrados no PowerShell, recarregue o PATH da sessão:

```
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

O Claude Code roda na aba **Code** do app desktop do Claude, ou pelo CLI
(`npm install -g @anthropic-ai/claude-code`, depois `claude` na pasta do projeto).

## 2. Plugins

| Plugin | Para que serve | Instalação |
| --- | --- | --- |
| **ponytail** | Código mínimo e respostas curtas. Nível usado: **lite** (`/ponytail lite`) | `claude plugin marketplace add DietrichGebert/ponytail` e depois `claude plugin install ponytail@ponytail` |
| **impeccable** | Design e revisão de layout. Vem com hooks que revisam cada arquivo de tela editado | `claude plugin marketplace add pbakaus/impeccable` e depois `claude plugin install impeccable@impeccable` |
| **claude-security** | Varredura de segurança do código | `claude plugin install claude-security@claude-plugins-official` |
| **claude-code-setup** | Sugere automações do Claude Code para o projeto | `claude plugin install claude-code-setup@claude-plugins-official` |

O marketplace `claude-plugins-official` (github.com/anthropics/claude-plugins-official)
já vem configurado; se não vier: `claude plugin marketplace add anthropics/claude-plugins-official`.

**Não instalar:** `ui-ux-pro-max` (removido a pedido do usuário).

## 3. Skills (pasta `~/.claude/skills/`)

| Skills | Origem | Como instalar |
| --- | --- | --- |
| animate, animate-expo, animation-performance, animation-vocabulary, apple-design, ask-sonner, break-ui, emil-design-eng, find-animation-opportunities, improve-animations, mobile-native, pick-ui-library, prototype, review-animations, write-swift | https://github.com/emilkowalski/skills | Clonar o repo e copiar cada pasta de skill para `~/.claude/skills/` |
| graphify | https://github.com/Graphify-Labs/graphify | `pip install` a partir do código-fonte do repo e depois `graphify install` (cria `~/.claude/skills/graphify` e uma linha no `~/.claude/CLAUDE.md`) |

Já vêm com o Claude Code, sem instalar: **dataviz** (gráficos), **artifact-design**,
**code-review**, **simplify**, **security-review**.

As mais usadas na prática: **emil-design-eng** (acabamento e animações),
**impeccable** (layout) e **dataviz** (antes de qualquer gráfico).

## 4. Conectores (claude.ai → Settings → Connectors)

O usuário conecta cada um; o Claude nunca digita credenciais.

| Conector | Para que serve |
| --- | --- |
| **Supabase** | Banco: migrações, consultas, RLS, avisos de segurança |
| **Vercel** | Deploys, variáveis de ambiente e logs de produção |
| **Figma** | Opcional, para trabalho de design |

Já vêm no app desktop, sem configurar: navegador embutido (testar telas),
terminal e Visualize (diagramas na conversa).

## 5. Como conferir o que está instalado

- Plugins: `claude plugin list`, ou `enabledPlugins` em `~/.claude/settings.json`
- Skills: listar a pasta `~/.claude/skills/`
- Conectores: claude.ai → Settings → Connectors
