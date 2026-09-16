# Contas a pagar dentro do dashboard

## Objetivo
Manter a experiência completa de contas a pagar na tela principal, sem depender das configurações, e fazer contas fixas aparecerem imediatamente nos vencimentos.

## Alterações
- Incorporar no dashboard os controles hoje existentes na tela de contas: mês, resumo, progresso, lista, calendário, contas fixas, cadastro, edição, pagamento e exclusão.
- Remover a aba “Contas” das configurações, mantendo apenas perfil, plano e senha.
- Corrigir o salvamento de conta fixa para criar/atualizar suas ocorrências antes de recarregar a tabela, com tratamento visível de qualquer erro.
- Garantir que uma conta fixa criada para o mês atual apareça na lista e nos totais assim que for salva.
- Manter a rota atual de contas compatível, mas fazer do dashboard o ponto principal de uso.

## Validação
- Cadastrar uma conta fixa e confirmar sua presença imediata em “Contas”, totais e calendário.
- Cadastrar uma conta avulsa e comparar o comportamento.
- Verificar edição, pagamento e exclusão em celular e computador.
- Confirmar que as configurações não exibem mais “Contas”.
