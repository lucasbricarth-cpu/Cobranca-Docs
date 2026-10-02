# Segurança, LGPD e guarda

## Arquivos recebidos

Todo arquivo, pelo app ou pelo WhatsApp, passa pelo mesmo caminho antes de aparecer em qualquer pasta:

1. **Limite de tamanho:** `LIMITE_ARQUIVO_MB`, 25 MB por padrão. Vale no envio assinado, no registro e no WhatsApp.
2. **Quarentena:** o arquivo fica fora da pasta até passar pelas checagens.
3. **Antivírus:** ClamAV (clamd, INSTREAM). Em produção o app não sobe sem ele.
4. **Tipo real pelo conteúdo,** nunca pela extensão (bytes mágicos). Só PDF, imagens, XML e OFX são aceitos.
5. **PDF com JavaScript** embutido é recusado: `/JS`, `/JavaScript`, `OpenAction` com JavaScript ou ações automáticas (`/AA`).
6. **Recusado** (vírus, tipo proibido, PDF com JS): o arquivo é apagado na hora e o documento nunca aparece na pasta.

Código: `src/lib/seguranca/` e `src/lib/documentos/processar.ts`.

## Download

O download só sai por URL assinada de curta duração: 120 segundos para abrir ou baixar, e só para quem tem permissão.
O armazenamento é privado e criptografado (S3 com SSE, região sa-east-1). Nada é público.

## Registro de acesso

Cada abertura, download e exportação grava quem fez e quando, com o lado (escritório ou cliente).

- **No painel do documento:** a seção "Registro de acesso".
- **Para os Admins:** Ajustes › Registro de acesso, com filtro por empresa, pessoa e data.

## Aviso de privacidade

O aviso fica em `/privacidade`, com link em Conta, no portal do cliente.
O texto é o que o escritório aprovar, editado em Ajustes › Mensagens.
A lista de operadores de dados aparece logo abaixo:

- o armazenamento;
- o e-mail (Amazon SES);
- a IA (Google Vertex AI, São Paulo);
- a plataforma de atendimento;
- a Meta (WhatsApp).

## Guarda

O app **nunca apaga sozinho**.

- **Por tipo:** o prazo em meses fica em Ajustes › Tipos. Ele conta do fim do mês do documento (a competência). Sem competência, conta do mês em que o arquivo chegou.
- **Não reconhecidos de uma empresa** (sem tipo): `GUARDA_SEM_TIPO_MESES`.
- **Pasta geral** (sem empresa): **[DECIDIR]** `PASTA_GERAL_PRAZO_DIAS`, 90 por padrão, contado do recebimento. Os Admins recebem um aviso `PASTA_GERAL_AVISO_DIAS` antes do vencimento.
- **Job diário** (passo "guarda" de `/api/jobs/diario`): lista o que venceu e avisa os Admins por push e e-mail, uma vez por documento. O aviso traz só contagens, sem conteúdo.
- **Aprovação:** em Ajustes › Guarda e exclusões, um Admin escolhe os documentos e confirma.
  - O servidor confere de novo, documento por documento, se cada um ainda venceu.
  - Depois apaga o arquivo e a miniatura, e limpa o nome original e o que a leitura extraiu.
  - Fica a linha com quem aprovou e quando, e o histórico em `exclusoes`.

## Saída de um cliente

Na pasta da empresa › Saída (só Admin):

1. **Exportar tudo:** um ZIP com a mesma árvore do portal, Empresa / Tipo / Subtipo / Mês.
   - Inclui as versões anteriores, um `indice.csv` (nome original, quem enviou e quando) e um `LEIA-ME.txt`.
   - Cada documento exportado entra no registro de acesso.
   - As horas são as de São Paulo.
2. **Excluir os documentos:** só depois de uma exportação completa, sem falhas, feita depois do último arquivo recebido. Exige digitar o CNPJ.
   - Os pedidos abertos são cancelados.
   - O cadastro e os acessos ficam, e o vínculo com a Domínio continua.

## Segredos

Nenhuma senha, chave ou token fica no código ou no repositório. Tudo vem de variáveis de ambiente (veja `.env.example`).
