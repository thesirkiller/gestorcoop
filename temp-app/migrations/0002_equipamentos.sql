-- Migration: 0002_equipamentos.sql
-- Description: Módulo de equipamentos no D1 — proprietários e contratos de terceiro,
--              equipamentos (próprios e sublocados), domicílios, locações e movimentações.
--
-- Modelo de negócio: o equipamento de terceiro pertence a outra empresa. A cooperativa
-- paga um ALUGUEL FIXO MENSAL por ele e subloca ao cliente. O custo corre esteja o
-- equipamento locado ou parado. O reajuste é MANUAL (o gestor edita custo_mensal_terceiro),
-- por isso não há histórico de vigência de valor e `indice_reajuste` é apenas informativo.
--
-- Convenções (iguais às de 0001_init_prontuario.sql):
--   - CREATE TABLE IF NOT EXISTS, para a migração ser reexecutável;
--   - ids em TEXT (preservam os _id do Bubble na migração da Fase 4);
--   - datas em TEXT no formato ISO (YYYY-MM-DD ou datetime completo);
--   - booleanos em INTEGER 0/1.

-- =============================================================================
-- Proprietários (empresas das quais a cooperativa aluga)
-- =============================================================================
CREATE TABLE IF NOT EXISTS proprietarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    documento TEXT,                      -- CNPJ/CPF
    contato_nome TEXT,
    contato_telefone TEXT,
    contato_email TEXT,
    observacoes TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);

-- Contrato pelo qual a cooperativa aluga DO terceiro (não confundir
-- com a locação, que é o que a cooperativa aluga PARA o cliente).
CREATE TABLE IF NOT EXISTS contratos_terceiro (
    id TEXT PRIMARY KEY,
    proprietario_id TEXT NOT NULL REFERENCES proprietarios(id),
    numero TEXT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT,                       -- NULL = prazo indeterminado
    dia_vencimento INTEGER,              -- 1..31
    aviso_previo_dias INTEGER,
    indice_reajuste TEXT,                -- informativo; reajuste é manual, sem cálculo
    status TEXT NOT NULL DEFAULT 'Ativo',
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    CHECK (status IN ('Ativo','Encerrado','Suspenso'))
);

CREATE INDEX IF NOT EXISTS idx_contrato_proprietario
    ON contratos_terceiro(proprietario_id, status);

-- =============================================================================
-- Equipamentos
-- =============================================================================
CREATE TABLE IF NOT EXISTS equipamentos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    marca TEXT,
    modelo TEXT,
    numero_serie TEXT,
    patrimonio TEXT,
    categoria TEXT,
    -- Vocabulário de status (mesmo do módulo atual): 'Aguardando conferência',
    -- 'Disponível', 'Reservado', 'Em transporte para implantação',
    -- 'Implantado no domicílio', 'Em transporte para recolhimento',
    -- 'Recolhido e aguardando conferência', 'Aguardando higienização',
    -- 'Em higienização', 'Manutenção', 'Aguardando peça',
    -- 'Liberado pela manutenção', 'Bloqueado', 'Extraviado', 'Condenado',
    -- 'Baixado', 'Alugado', 'Inativo'.
    -- Sem CHECK de propósito: a lista ainda muda e a migração da Fase 4 traz
    -- 31 equipamentos + 106 movimentações do Bubble, onde o valor não era validado.
    status TEXT NOT NULL DEFAULT 'Disponível',
    origem TEXT NOT NULL DEFAULT 'Proprio',
    -- Campos de terceiro: só fazem sentido quando origem = 'Terceiro'
    proprietario_id TEXT REFERENCES proprietarios(id),
    contrato_terceiro_id TEXT REFERENCES contratos_terceiro(id),
    custo_mensal_terceiro REAL,          -- NUNCA exibir em documento que vá ao cliente
    data_entrada_terceiro TEXT,
    data_devolucao_terceiro TEXT,
    valor_mensal_padrao REAL,
    criado_em TEXT NOT NULL,
    CHECK (origem IN ('Proprio','Terceiro')),
    -- Esta é a regra que o Bubble não conseguia garantir:
    CHECK (origem = 'Proprio' OR (proprietario_id IS NOT NULL
                                  AND custo_mensal_terceiro IS NOT NULL
                                  AND data_entrada_terceiro IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_equip_origem ON equipamentos(origem, proprietario_id);

-- UNIQUE parcial intencional: hoje nada impede cadastrar o mesmo equipamento duas
-- vezes, e com terceiro isso vira custo mensal duplicado na fatura. Se a base tiver
-- série repetida legítima (não deveria), este índice falha na migração da Fase 4.
CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_serie ON equipamentos(numero_serie)
    WHERE numero_serie IS NOT NULL AND numero_serie <> '';

-- =============================================================================
-- Domicílios e locações
-- =============================================================================
CREATE TABLE IF NOT EXISTS domicilios (
    id TEXT PRIMARY KEY,
    cliente_bubble_id TEXT NOT NULL,     -- id em locais_de_trabalho_pacientes; sem FK, outro banco
    endereco TEXT NOT NULL,
    cep TEXT, numero TEXT, complemento TEXT,
    bairro TEXT, cidade TEXT, estado TEXT,
    ponto_referencia TEXT,
    contato_local TEXT,
    instrucoes_acesso TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domicilio_cliente ON domicilios(cliente_bubble_id, ativo);

CREATE TABLE IF NOT EXISTS locacoes (
    id TEXT PRIMARY KEY,
    equipamento_id TEXT NOT NULL REFERENCES equipamentos(id),
    cliente_bubble_id TEXT NOT NULL,
    -- Desnormalização deliberada: sem ela todo relatório vira uma chamada ao Bubble
    -- por linha e o PDF quebra se o Bubble estiver fora do ar. Atualizar na gravação
    -- da locação; a fonte da verdade continua sendo o Bubble.
    cliente_nome_cache TEXT,
    domicilio_id TEXT REFERENCES domicilios(id),
    data_inicio TEXT NOT NULL,
    data_fim_previsto TEXT,
    data_fim_real TEXT,
    valor_mensal REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo',
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    CHECK (status IN ('Ativo','Finalizado','Cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_loc_equip ON locacoes(equipamento_id, status);
CREATE INDEX IF NOT EXISTS idx_loc_cliente ON locacoes(cliente_bubble_id, status);
CREATE INDEX IF NOT EXISTS idx_loc_periodo ON locacoes(data_inicio, data_fim_real);

-- =============================================================================
-- Movimentações (espelha o tipo movimentacao_equipamento do Bubble)
-- =============================================================================
CREATE TABLE IF NOT EXISTS movimentacoes (
    id TEXT PRIMARY KEY,
    equipamento_id TEXT NOT NULL REFERENCES equipamentos(id),
    locacao_id TEXT REFERENCES locacoes(id),
    -- Ordens de serviço de manutenção continuam no Bubble nesta fase: guardamos o
    -- id como texto, sem FK, até a tabela existir no D1.
    ordem_servico_id TEXT,
    domicilio_id TEXT REFERENCES domicilios(id),
    localizacao_anterior TEXT,
    nova_localizacao TEXT,
    -- Vocabulário de tipo: 'Cadastro', 'Entrada no estoque', 'Alteração cadastral',
    -- 'Reserva', 'Cancelamento de reserva', 'Implantação', 'Recolhimento',
    -- 'Transferência', 'Higienização', 'Manutenção', 'Calibração', 'Bloqueio',
    -- 'Liberação', 'Extravio', 'Baixa', 'Correção'.
    tipo TEXT NOT NULL,
    status_anterior TEXT,                -- mesmo vocabulário de equipamentos.status
    novo_status TEXT NOT NULL,
    data_hora TEXT NOT NULL,             -- ISO Datetime
    responsavel TEXT,
    observacoes TEXT,
    justificativa TEXT,
    -- No Bubble a idempotência era conferida com uma busca antes de gravar;
    -- aqui o índice único resolve de vez.
    chave_idempotencia TEXT NOT NULL UNIQUE,
    cancelado INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    CHECK (cancelado IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_mov_equip ON movimentacoes(equipamento_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_mov_locacao ON movimentacoes(locacao_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo_data ON movimentacoes(tipo, data_hora);
