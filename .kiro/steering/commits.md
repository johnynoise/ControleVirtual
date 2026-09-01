---
inclusion: manual
---

# Padrão de Commits (iuricode)

Sempre que eu pedir para você **commitar**, use o padrão de commits semânticos do iuricode ([referência](https://github.com/iuricode/padroes-de-commits)), baseado no Conventional Commits com emojis.

## Formato da mensagem

```
:emoji: tipo: descrição sucinta
```

Ou usando o emoji renderizado diretamente:

```
🐛 fix: descrição sucinta
```

## Regras

- Sempre inicie a mensagem com o emoji correspondente ao tipo do commit.
- Escreva a descrição em português, de forma sucinta e no imperativo.
- A primeira linha deve ter, de preferência, no máximo 4 palavras na descrição principal.
- Para detalhes adicionais, use o corpo do commit (impactos, motivos, instruções futuras).
- Rodapé opcional para revisor e número do card. Ex: `Reviewed-by: Nome Refs #133`.
- Links devem ser adicionados em sua forma autêntica (sem encurtadores).

## Tipos disponíveis

| Tipo | Descrição |
| --- | --- |
| `feat` | Novo recurso (MINOR do versionamento). |
| `fix` | Correção de bug (PATCH do versionamento). |
| `docs` | Mudanças na documentação (sem alteração de código). |
| `test` | Criação, alteração ou exclusão de testes. |
| `build` | Modificações em arquivos de build e dependências. |
| `perf` | Alterações relacionadas a performance. |
| `style` | Formatação de código, semicolons, lint (sem alteração de lógica). |
| `refactor` | Refatorações que não alteram a funcionalidade. |
| `chore` | Tarefas de build, configs de admin, pacotes. |
| `ci` | Mudanças de integração contínua. |
| `raw` | Arquivos de configuração, dados, parâmetros. |
| `cleanup` | Remoção de código comentado ou trechos desnecessários. |
| `remove` | Exclusão de arquivos, diretórios ou funcionalidades obsoletas. |

## Emojis por tipo

| Situação | Emoji | Código | Tipo |
| --- | --- | --- | --- |
| Acessibilidade | ♿ | `:wheelchair:` | |
| Adicionando um teste | ✅ | `:white_check_mark:` | test |
| Atualizando versão de submódulo | ⬆️ | `:arrow_up:` | |
| Retrocedendo versão de submódulo | ⬇️ | `:arrow_down:` | |
| Adicionando uma dependência | ➕ | `:heavy_plus_sign:` | build |
| Alterações de revisão de código | 👌 | `:ok_hand:` | style |
| Animações e transições | 💫 | `:dizzy:` | |
| Bugfix | 🐛 | `:bug:` | fix |
| Comentários | 💡 | `:bulb:` | docs |
| Commit inicial | 🎉 | `:tada:` | init |
| Configuração | 🔧 | `:wrench:` | chore |
| Deploy | 🚀 | `:rocket:` | |
| Documentação | 📚 | `:books:` | docs |
| Em progresso | 🚧 | `:construction:` | |
| Estilização de interface | 💄 | `:lipstick:` | feat |
| Infraestrutura | 🧱 | `:bricks:` | ci |
| Lista de ideias (tasks) | 🔜 | `:soon:` | |
| Mover/Renomear | 🚚 | `:truck:` | chore |
| Novo recurso | ✨ | `:sparkles:` | feat |
| Package.json em JS | 📦 | `:package:` | build |
| Performance | ⚡ | `:zap:` | perf |
| Refatoração | ♻️ | `:recycle:` | refactor |
| Limpeza de código | 🧹 | `:broom:` | cleanup |
| Removendo um arquivo | 🗑️ | `:wastebasket:` | remove |
| Removendo uma dependência | ➖ | `:heavy_minus_sign:` | build |
| Responsividade | 📱 | `:iphone:` | |
| Revertendo mudanças | 💥 | `:boom:` | fix |
| Segurança | 🔒️ | `:lock:` | |
| SEO | 🔍️ | `:mag:` | |
| Tag de versão | 🔖 | `:bookmark:` | |
| Teste de aprovação | ✔️ | `:heavy_check_mark:` | test |
| Testes | 🧪 | `:test_tube:` | test |
| Texto | 📝 | `:pencil:` | |
| Tipagem | 🏷️ | `:label:` | |
| Tratamento de erros | 🥅 | `:goal_net:` | |
| Dados | 🗃️ | `:card_file_box:` | raw |

## Exemplos

```bash
git commit -m ":tada: Commit inicial"
git commit -m ":books: docs: Atualização do README"
git commit -m ":bug: fix: Loop infinito na linha 50"
git commit -m ":sparkles: feat: Página de login"
git commit -m ":bricks: ci: Modificação no Dockerfile"
git commit -m ":recycle: refactor: Passando para arrow functions"
git commit -m ":zap: perf: Melhoria no tempo de resposta"
git commit -m ":lipstick: feat: Estilização CSS do formulário"
git commit -m ":test_tube: test: Criando novo teste"
git commit -m ":card_file_box: raw: RAW Data do ano aaaa"
```
