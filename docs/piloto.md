# Piloto

## [DECIDIR] Quem entra

A recomendação: poucas empresas, de **responsáveis diferentes**, durante **um mês**. Por exemplo, de 5 a 10 empresas com 3 ou 4 responsáveis, misturando perfis com e sem folha.

Em Ajustes › Piloto e métricas, um Admin põe as empresas no piloto.

- **Com alguma empresa marcada,** o app entra em modo piloto. A agenda mensal e os avisos automáticos ao cliente (push, e-mail e WhatsApp) só valem para essas empresas.
- **Sem nenhuma marcada,** vale a carteira inteira.
- **O escritório continua usando tudo** para qualquer empresa: pasta, conferência e pedidos avulsos. O que para fora do piloto é só o aviso automático ao cliente.

Se todas as empresas do piloto forem do mesmo responsável, a tela avisa.

## O que medir

A mesma tela mostra, por tipo de documento e no período escolhido (datas de São Paulo):

| Métrica | Como é medida |
|---|---|
| Tempo até o envio | Do pedido (item criado) ao **primeiro** arquivo recebido. Mostra a mediana e o tempo em que 90% enviaram. |
| No prazo | O primeiro arquivo chegou até o fim do dia do prazo, em São Paulo. |
| Atrasados | Itens ainda sem arquivo, com o prazo vencido. |
| Rejeitados | Itens com pelo menos um envio recusado pelo escritório ("Rejeitar e pedir de novo"). |
| WhatsApp | Parte dos envios que chegou pelo WhatsApp. |
| Acerto da IA | Nas conferências com sugestão, quantas vezes o tipo e o subtipo sugeridos estavam certos. Sensíveis nunca passam pela IA. |

A tela pode mostrar só as empresas do piloto ou a carteira inteira.

## Antes de ampliar

1. **Acerto da IA:** ligue o arquivamento automático (Ajustes › Classificação) só nos tipos com acerto alto e estável no mês. Ele continua exigindo pedido, o CNPJ da empresa e o tipo e o subtipo do pedido.
2. **Rejeitados:** onde a taxa estiver alta, olhe o motivo mais comum. Foto ruim pede ajuste nas dicas da câmera; mês errado pede ajuste na regra do tipo.
3. **Tempo até o envio:** compare com o prazo dado aos clientes antes de mexer na agenda.
4. **Amplie aos poucos:** tire as empresas do piloto todas de uma vez para liberar a carteira inteira, ou acrescente grupos por responsável.

## WhatsApp: volume aos poucos

O número oficial é o do atendimento inteiro, e a nota de qualidade dele vale para todas as conversas.

- **Comece com `WHATSAPP_LIMITE_DIARIO` baixo,** por exemplo 50. A tela mostra o gráfico dos últimos 14 dias com a linha do limite.
- **Acompanhe toda semana** a nota de qualidade do número no painel da Meta (ou da plataforma de atendimento).
- **Suba o limite só com a nota em verde.** Ao primeiro amarelo, pare e revise os textos em Ajustes › Mensagens.
- **Quando o limite do dia acaba,** o push e o e-mail saem normalmente, e o WhatsApp fica para o dia seguinte.
