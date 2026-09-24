# Prioridade visual por vencimento

## O que será alterado
- Ordenar a lista automaticamente: vencidas primeiro, depois as que vencem hoje, as próximas a vencer e, por último, as pagas.
- Dentro de cada prioridade, mostrar primeiro a data mais próxima de hoje.
- Aplicar amarelo no cartão inteiro para contas que vencem hoje ou nos próximos três dias.
- Aplicar vermelho no cartão inteiro para contas vencidas.
- Recalcular a prioridade enquanto o dashboard estiver aberto e manter as atualizações vindas das contas em tempo real.

## Detalhes técnicos
- A ordenação será aplicada após o filtro escolhido nos cartões de resumo.
- Contas pagas continuarão visíveis no filtro correspondente, sem alerta amarelo ou vermelho.
- O cálculo continuará usando a data de Brasília.
