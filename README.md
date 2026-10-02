# Portal de Documentos

App web instalável (PWA) de duas pontas para o escritório de contabilidade.

- **Funcionário:** documentos de cada cliente por tipo, subtipo e mês; pedidos avulsos e agenda mensal; fila A conferir.
- **Cliente:** recebe o pedido (push, e-mail, WhatsApp), tira a foto ou anexa o arquivo, e o app arquiva no lugar certo.

Stack: Next.js 14 (App Router), TypeScript, Tailwind, PostgreSQL. Estética: Glass Dourado (`.claude/skills/estetica-dourada`).

## Rodar

```bash
cp .env.example .env          # preencha os segredos
npm install
npm run migrar                # aplica migrations/*.sql
npm run semear                # dados de demonstração (opcional)
npm run dev
```

## Verificação

```bash
npm run build
npm run lint
npm test                      # usa DATABASE_URL_TEST
npm run contraste             # 6 paletas × 2 temas × 2 intensidades
./scripts/capturas.sh         # capturas no computador e no celular (Playwright)
```

Mais detalhes em `docs/`.
