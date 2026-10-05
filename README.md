# Portal de Documentos

App web instalável (PWA) de duas pontas para o escritório de contabilidade (cerca de 337 clientes).

- **Escritório:** documentos de cada cliente por tipo, subtipo e mês; pedidos avulsos e agenda mensal; fila A conferir; guarda e saída de clientes; métricas do piloto.
- **Cliente:** recebe o pedido (push, e-mail, WhatsApp), escaneia com a câmera ou anexa o arquivo, e o app arquiva no lugar certo.

Stack: Next.js 14 (App Router), TypeScript, Tailwind, PostgreSQL. Estética: Glass Dourado, 6 paletas (`.claude/skills/estetica-dourada`).

## Rodar

Requisitos: **Node.js 22.6 ou mais novo** (os scripts usam `--experimental-strip-types`) e **PostgreSQL 15 ou mais novo** (as tabelas usam `UNIQUE NULLS NOT DISTINCT`).

```bash
cp .env.example .env          # preencha os segredos (nunca no repositório)
npm install                   # copia OpenCV.js e pdf.js para public/
npm run migrar                # aplica migrations/*.sql
npm run semear                # escritório, empresas e logins de demonstração (opcional)
npm run dev
```

Com `DEV_LOGIN=1` no `.env` (só em localhost):

- **Entrar sem e-mail:** `/api/dev/entrar?como=ana@escritorio.com.br` (Admin) ou `?como=carlos@padaria.com.br` (cliente).
- **Documentos e pedidos de demonstração:** com o `npm run dev` rodando, `POST /api/dev/semear`. No Windows: `Invoke-RestMethod -Method Post http://localhost:3000/api/dev/semear`.

## Jobs (agendar no servidor)

| Job | Quando | O que faz |
|---|---|---|
| `npm run job:diario` | uma vez por dia, de madrugada | agenda mensal, lembretes, resumo do funcionário, guarda (só lista e avisa) |
| `npm run job:fila` | a cada minuto | antivírus, miniatura, classificação, avisos, WhatsApp |

Os dois chamam a API com `JOB_SECRET`. As datas contam sempre no fuso de São Paulo.

## Verificação

```bash
npm run build
npm run lint
npm test                      # usa DATABASE_URL_TEST
npm run contraste             # 6 paletas × 2 temas × 2 intensidades
./scripts/capturas.sh         # capturas no computador e no celular (Playwright)
```

## Documentos

- `leitor-dominio/README.md`: o leitor local da Domínio. Só leitura, com usuário próprio. Confirme a licença da Thomson Reuters antes de instalar.
- `docs/whatsapp.md`: os 4 pontos a conferir na plataforma de atendimento, a reserva "Abrir no WhatsApp" e o volume aos poucos.
- `docs/seguranca-lgpd.md`: arquivos recebidos, download, registro de acesso, guarda e saída de clientes.
- `docs/piloto.md`: quem entra no piloto, o que medir e quando ampliar.

## Decisões em aberto ([DECIDIR])

| Ponto | Recomendação já implementada | Onde muda |
|---|---|---|
| Armazenamento | S3 em São Paulo (sa-east-1), privado, criptografado, URL assinada curta | `ARMAZENAMENTO`, `S3_*` |
| E-mail | Amazon SES pelo domínio do escritório (SPF, DKIM, DMARC) | `EMAIL`, `SES_*` |
| IA | Gemini 2.5 Flash na Vertex AI, `southamerica-east1`, depois de confirmar a residência de dados | `IA`, `VERTEX_*` |
| Plataforma de WhatsApp | o adaptador espera a escolha; até lá, "Abrir no WhatsApp" (wa.me) | `src/lib/whatsapp/plataforma.ts` |
| Régua do WhatsApp | o pedido e o lembrete no dia do prazo | `src/lib/whatsapp/avisos.ts` |
| Prazo da pasta geral | 90 dias, com aviso 7 dias antes | `PASTA_GERAL_PRAZO_DIAS` |
| Piloto | poucas empresas, de responsáveis diferentes, por um mês | Ajustes › Piloto e métricas |
