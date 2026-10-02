# WhatsApp

O app conversa com os clientes pelo **número oficial do escritório**, o mesmo do atendimento de hoje.

## Regra fixa: sempre pela plataforma de atendimento

O app fala com o WhatsApp **só pela plataforma de atendimento já ligada ao número**. Nunca fala direto com a Meta (Cloud API) pelo mesmo número.
Se as duas pontas estiverem ligadas, as duas recebem os mesmos avisos e as duas respondem ao mesmo cliente.
Trocar de plataforma é escrever outro adaptador em `src/lib/whatsapp/`. O resto do app não muda (interface única em `canal.ts`).

## [DECIDIR] Qual plataforma?

Antes de escrever o adaptador (`src/lib/whatsapp/plataforma.ts`), confira na documentação da plataforma os 4 pontos abaixo. Anote o link de cada um.

| # | Ponto | Peso | Para quê | Sem ele |
|---|---|---|---|---|
| 1 | **Webhook de mensagem recebida, com o arquivo** (ou um link para baixá-lo) e assinatura | Obrigatório | O cliente responde com o documento e ele cai na pasta certa | Não dá para receber pelo WhatsApp; fica só o app e o e-mail |
| 2 | **Envio de mensagem-modelo por API** (template aprovado, categoria Utilidade, com variáveis e botão de URL) | Obrigatório | Pedido e lembrete do dia saem sozinhos | Só o botão "Abrir no WhatsApp" (wa.me), mandado à mão pelo atendente |
| 3 | **Botões ou lista na conversa** (mensagem interativa) | Desejável | "Qual empresa?", "Qual mês?", "Está certo?" com um toque | O app manda as opções numeradas e aceita "1", "2"… como resposta |
| 4 | **Nota interna** na conversa (só o atendente vê) | Desejável | O atendente vê onde o arquivo foi parar sem abrir o app | O atendente consulta a fila "A conferir" do app |

O adaptador declara o que a plataforma tem em `recursos` e o fluxo se adapta sozinho.

### Mensagens-modelo para aprovar na conta

Os nomes e textos-base ficam em Ajustes › Mensagens. Todos são da categoria **Utilidade**, em pt_BR, com tom informativo e saudação neutra.

- `pedido_documento`: variáveis {nome}, {empresa}, {mes} e {prazo}. Botão de URL "Enviar pelo app", com sufixo dinâmico (o token do link de envio).
- `lembrete_prazo_hoje`: as mesmas variáveis e o mesmo botão.

A régua do WhatsApp é mais curta que a de push e e-mail. Só saem o pedido criado e o lembrete no dia do prazo.

## Reserva desde o primeiro dia: "Abrir no WhatsApp"

Em cada item aberto de um pedido há um botão "Abrir no WhatsApp".
O atendente vê a mensagem pronta, com o link de envio daquele item, e abre um `wa.me` no WhatsApp do atendimento. Não precisa de integração nem tem custo.
Usa o número confirmado em Acessos. Sem ele, usa o telefone do cadastro da empresa e avisa na tela.

## Regras que o código garante

- **Número confirmado:** o app só reconhece um número confirmado por alguém do escritório em Clientes › Acessos. Um número desconhecido recebe só uma resposta genérica, e o arquivo vai para "Não reconhecidos".
- **Aceite:** sem aceite registrado (data e canal), nada automático sai pelo WhatsApp para o contato. O aceite pode ser revogado.
- **Desativar o login** desliga o número na mesma hora.
- **Notificações genéricas:** nenhuma mensagem leva conteúdo do documento, banco, valor ou tipo sensível.
- **Documento sensível:** se o último pedido enviado ao contato é de um tipo sensível e ainda está aberto, o arquivo vai para esse pedido sem passar pela IA. A resposta ao cliente é genérica ("Recebemos o seu documento").
- **Lote:** arquivos mandados em sequência viram um lote (`WHATSAPP_ESPERA_LOTE_MS`). O cliente recebe uma pergunta só, e não uma por arquivo.
- **Sem resposta** em `WHATSAPP_PRAZO_RESPOSTA_H` horas: os arquivos vão para "Não reconhecidos". Nada se perde.
- **Arquivo baixado na hora**, porque o link de mídia da Meta expira em minutos. Depois ele passa pelo mesmo caminho do app: antivírus, tipo real, classificação e conferência.
- **Webhook idempotente:** a mesma mensagem entregue duas vezes é processada uma vez.

## Piloto: volume aos poucos

O número é o do atendimento inteiro. Uma queda na classificação de qualidade atinge todas as conversas do escritório.

1. Comece com `WHATSAPP_LIMITE_DIARIO` baixo, por exemplo 50 mensagens-modelo por dia.
2. Olhe a classificação de qualidade do número na plataforma, ou no Gerenciador do WhatsApp, toda semana.
3. Suba o limite só com a qualidade em verde. Pare e revise os textos ao primeiro amarelo.

Quando o limite do dia acaba, push e e-mail saem normalmente. O WhatsApp tenta de novo no dia seguinte.

## Variáveis de ambiente

Veja `.env.example`: `WHATSAPP`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_NUMERO_ESCRITORIO`, `WHATSAPP_LIMITE_DIARIO`, `WHATSAPP_ESPERA_LOTE_MS` e `WHATSAPP_PRAZO_RESPOSTA_H`.
Nenhum token vai para o código ou para o repositório.

## Testes

`tests/whatsapp.test.ts` usa o adaptador simulado. Ele cobre:

- a assinatura do webhook e a idempotência;
- o número sem vínculo e a pergunta de empresa;
- o lote e o mês;
- o aceite e o tipo sensível fora da IA;
- desligar o número ao desativar o login.
