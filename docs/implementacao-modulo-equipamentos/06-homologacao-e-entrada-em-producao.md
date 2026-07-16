# Etapa 6 — Homologação, migração e entrada em produção

## Objetivo

Validar o módulo com cenários reais, migrar dados sem perda de rastreabilidade e liberar o uso com operação treinada e plano de contingência.

## Resultado esperado

O módulo está pronto para uso controlado em produção, com dados confiáveis, perfis corretos, equipe treinada e acompanhamento pós-liberação.

## 1. Plano de testes integrado

- [ ] Criar base de homologação com equipamentos de múltiplas categorias e situações.
- [ ] Criar pacientes, domicílios, filiais, estoques, fornecedores e usuários de todos os perfis.
- [ ] Executar fluxo completo: entrada → reserva → implantação → recolhimento → conferência → higienização → disponibilidade.
- [ ] Executar fluxo de defeito no domicílio → substituição → manutenção → teste → liberação.
- [ ] Executar fluxo de preventiva vencida em equipamento implantado.
- [ ] Executar fluxo de extravio, condenação e baixa autorizada.
- [ ] Executar fluxo de diária, mensalidade, proporcional, desconto, comodato e troca de equipamento.
- [ ] Executar fluxos negativos: permissão negada, estado inválido, duplicidade de envio e data retroativa sem autorização.
- [ ] Registrar resultado esperado, resultado obtido, evidência e responsável por cada caso.
- [ ] Corrigir falhas críticas antes de seguir para migração.

## 2. Qualidade de dados e migração

- [ ] Inventariar equipamentos existentes e identificar registros duplicados/incompletos.
- [ ] Normalizar números de série, nomes, categorias e status legados.
- [ ] Definir como registros antigos serão classificados nos novos estados.
- [ ] Gerar códigos internos para equipamentos legados sem código.
- [ ] Definir como locações ativas serão migradas sem interromper cobrança ou operação.
- [ ] Importar dados inicialmente em ambiente de teste.
- [ ] Conferir contagem de equipamentos, locações e pacientes antes/depois da importação.
- [ ] Conferir amostra de históricos, valores e documentos migrados.
- [ ] Planejar janela de migração para produção e congelamento temporário de cadastros antigos, se necessário.
- [ ] Manter backup e plano de reversão testado antes da migração final.

## 3. Segurança e privacidade

- [ ] Revisar regras de privacidade com um usuário real de cada perfil.
- [ ] Confirmar que URLs, QR Codes e exports não expõem dados sem autorização.
- [ ] Confirmar que documentos sensíveis não são acessíveis por link público indevido.
- [ ] Revisar tokens, chaves e credenciais de integrações; não armazenar segredos em telas ou logs.
- [ ] Confirmar que alterações sensíveis deixam auditoria consultável.
- [ ] Validar processo de criação, troca e remoção de usuários.

## 4. Treinamento e operação assistida

- [ ] Criar material curto para Estoque/Logística: reserva, entrega, recolhimento e conferência.
- [ ] Criar material curto para Manutenção: abertura, diagnóstico, custo, teste e liberação.
- [ ] Criar material curto para Financeiro: tabela, locação, demonstrativo e ajustes autorizados.
- [ ] Criar material curto para Administração/Auditoria: aprovações, baixa, permissões e relatórios.
- [ ] Realizar treinamento com cenários práticos e registrar dúvidas recorrentes.
- [ ] Definir canal para suporte operacional nas primeiras semanas.
- [ ] Definir responsável por triagem de incidentes e correção de dados.

## 5. Liberação gradual

- [ ] Definir grupo piloto, filial ou categoria inicial de equipamentos.
- [ ] Definir indicadores de sucesso do piloto: divergências, tempo de operação, pendências e adesão.
- [ ] Liberar para piloto com monitoramento diário no período acordado.
- [ ] Revisar falhas e melhorias antes de ampliar para toda a operação.
- [ ] Comunicar data, impacto e procedimento de entrada em produção.
- [ ] Documentar versão liberada e mudanças conhecidas.

## 6. Acompanhamento pós-produção

- [ ] Monitorar implantações, recolhimentos e estados sem movimentação recente.
- [ ] Monitorar erros de workflow e tentativas de transição inválida.
- [ ] Conferir diariamente, na primeira semana, equipamentos implantados sem locação e locações ativas sem equipamento implantado.
- [ ] Conferir equipamentos recolhidos que foram liberados sem higienização/teste obrigatório.
- [ ] Conferir alertas pendentes e tempo médio de resolução.
- [ ] Coletar feedback dos perfis operacionais e registrar backlog de evolução.
- [ ] Realizar revisão de acessos e privacidade após o primeiro ciclo operacional.

## Critérios de aceite para produção

- [ ] Todos os cenários críticos de homologação foram aprovados.
- [ ] Migração foi validada em teste e possui backup/reversão.
- [ ] Perfis e regras de privacidade foram revisados.
- [ ] Usuários-chave foram treinados.
- [ ] Plano de suporte do piloto está definido.
- [ ] Não existe defeito crítico aberto relacionado a disponibilidade, movimentação, privacidade ou cobrança.
- [ ] Responsáveis de negócio, técnico e operação aprovaram a liberação.

