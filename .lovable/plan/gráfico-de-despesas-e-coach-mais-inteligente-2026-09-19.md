# Gráfico de despesas e coach mais inteligente

## O que será melhorado
- Adicionar ao dashboard um gráfico circular de despesas por categoria, usando o período já selecionado: hoje, semana, mês, tudo ou dia escolhido.
- Mostrar no centro do gráfico o total gasto e, ao lado/abaixo, uma legenda clara com categoria, valor e participação percentual.
- Exibir um estado vazio simples quando não houver despesas no período.
- Manter as cores, tipografia e estilo atuais do CONTROLA, com boa leitura no celular e computador.

## Coach financeiro
- Separar análises consolidadas de padrões semanais/mensais das observações do dia.
- Manter alertas realmente importantes disponíveis quando necessário.
- Só gerar comparações e conclusões sobre “hoje” no fim do dia, após 18h no horário de Brasília, e quando houver dados suficientes.
- Antes disso, evitar afirmações prematuras e usar apenas orientações neutras ou análises de períodos já consolidados.
- Ajustar também os resumos locais do dashboard para não comparar o dia incompleto com ontem.

## Detalhes técnicos
- Usar a biblioteca de gráficos já instalada no projeto.
- Calcular as fatias diretamente das despesas carregadas no dashboard, sem alterar os registros existentes.
- Atualizar a função do coach para aplicar horário de Brasília e critérios mínimos de dados.
- Preservar autenticação, pagamentos, contas a pagar, relatórios, chat e demais funcionalidades.

## Verificação
- Confirmar gráfico, legenda, totais e estados vazios em celular e computador.
- Validar que novas despesas atualizam o gráfico automaticamente.
- Verificar que o coach não emite comparação diária prematura e continua trazendo análises semanais/mensais úteis.
- Executar validações de tipos, testes e compilação.
