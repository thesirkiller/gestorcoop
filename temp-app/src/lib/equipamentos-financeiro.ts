export type TipoCobrancaLocacao =
  | 'Somente diária'
  | 'Somente mensalidade'
  | 'Mensalidade proporcional'
  | 'Mensalidade fechada'
  | 'Valor personalizado'
  | 'Sem cobrança';

export interface PeriodoSuspenso {
  inicio: string;
  fim: string;
  motivo?: string;
}

export interface CalculoLocacaoInput {
  dataInicio: string;
  dataFim?: string;
  tipoCobranca: TipoCobrancaLocacao;
  valorDiaria?: number;
  valorMensal?: number;
  valorPersonalizado?: number;
  desconto?: number;
  acrescimo?: number;
  taxaImplantacao?: number;
  taxaRecolhimento?: number;
  periodosSuspensos?: PeriodoSuspenso[];
}

export interface CalculoLocacaoResultado {
  diasCorridos: number;
  diasSuspensos: number;
  diasCobrados: number;
  mesesCobrados: number;
  valorBase: number;
  taxaImplantacao: number;
  taxaRecolhimento: number;
  desconto: number;
  acrescimo: number;
  total: number;
}

const paraDataUtc = (valor: string) => {
  const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
};

const moeda = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

function diasInclusivos(inicio: Date, fim: Date) {
  const diferenca = Math.floor((fim.getTime() - inicio.getTime()) / 86_400_000);
  return Math.max(1, diferenca + 1);
}

// Normaliza os períodos suspensos em intervalos UTC sem sobreposição, para
// que a contagem de dias suspensos não some o mesmo dia duas vezes.
function normalizarSuspensoes(periodos: PeriodoSuspenso[] | undefined): Array<{ inicio: Date; fim: Date }> {
  if (!periodos || periodos.length === 0) return [];
  const intervalos = periodos
    .map((p) => ({ inicio: paraDataUtc(p.inicio), fim: paraDataUtc(p.fim) }))
    .filter((p) => !Number.isNaN(p.inicio.getTime()) && !Number.isNaN(p.fim.getTime()) && p.fim >= p.inicio)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const merged: Array<{ inicio: Date; fim: Date }> = [];
  for (const atual of intervalos) {
    const ultimo = merged[merged.length - 1];
    if (ultimo && atual.inicio.getTime() <= ultimo.fim.getTime() + 86_400_000) {
      if (atual.fim > ultimo.fim) ultimo.fim = atual.fim;
    } else {
      merged.push({ inicio: new Date(atual.inicio), fim: new Date(atual.fim) });
    }
  }
  return merged;
}

// Dias suspensos (inclusivos) dentro da janela [janelaInicio, janelaFim].
function diasSuspensosNaJanela(
  janelaInicio: Date,
  janelaFim: Date,
  suspensoes: Array<{ inicio: Date; fim: Date }>,
): number {
  let total = 0;
  for (const s of suspensoes) {
    const inicio = s.inicio > janelaInicio ? s.inicio : janelaInicio;
    const fim = s.fim < janelaFim ? s.fim : janelaFim;
    if (fim >= inicio) {
      total += Math.floor((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
    }
  }
  return total;
}

function mensalidadeProporcional(
  inicio: Date,
  fim: Date,
  valorMensal: number,
  suspensoes: Array<{ inicio: Date; fim: Date }>,
) {
  let cursor = new Date(inicio);
  let total = 0;
  let meses = 0;

  while (cursor <= fim) {
    const fimDoMes = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const fimDoTrecho = fimDoMes < fim ? fimDoMes : fim;
    const diasNoMes = fimDoMes.getUTCDate();
    const diasNoTrecho = diasInclusivos(cursor, fimDoTrecho);
    const diasSuspensosNoTrecho = diasSuspensosNaJanela(cursor, fimDoTrecho, suspensoes);
    const diasCobrados = Math.max(0, diasNoTrecho - diasSuspensosNoTrecho);
    total += (valorMensal / diasNoMes) * diasCobrados;
    meses += 1;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return { total, meses };
}

export function calcularLocacao(input: CalculoLocacaoInput): CalculoLocacaoResultado {
  const inicio = paraDataUtc(input.dataInicio);
  const fim = input.dataFim ? paraDataUtc(input.dataFim) : inicio;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
    throw new Error('O período da locação é inválido.');
  }

  const suspensoes = normalizarSuspensoes(input.periodosSuspensos);
  const diaria = Number(input.valorDiaria || 0);
  const mensalidade = Number(input.valorMensal || 0);
  const diasCorridos = diasInclusivos(inicio, fim);
  const diasSuspensos = Math.min(diasCorridos, diasSuspensosNaJanela(inicio, fim, suspensoes));
  const diasCobrados = Math.max(0, diasCorridos - diasSuspensos);
  let valorBase = 0;
  let mesesCobrados = 0;

  switch (input.tipoCobranca) {
    case 'Somente diária':
      valorBase = diaria * diasCobrados;
      break;
    case 'Mensalidade proporcional': {
      const proporcional = mensalidadeProporcional(inicio, fim, mensalidade, suspensoes);
      valorBase = proporcional.total;
      mesesCobrados = proporcional.meses;
      break;
    }
    case 'Somente mensalidade':
    case 'Mensalidade fechada':
      mesesCobrados = Math.ceil(diasCobrados / 30);
      valorBase = mensalidade * mesesCobrados;
      break;
    case 'Valor personalizado':
      valorBase = Number(input.valorPersonalizado ?? mensalidade);
      mesesCobrados = 1;
      break;
    case 'Sem cobrança':
      break;
  }

  const taxaImplantacao = Math.max(0, Number(input.taxaImplantacao || 0));
  const taxaRecolhimento = Math.max(0, Number(input.taxaRecolhimento || 0));
  const desconto = Math.max(0, Number(input.desconto || 0));
  const acrescimo = Math.max(0, Number(input.acrescimo || 0));
  const total = Math.max(0, valorBase + taxaImplantacao + taxaRecolhimento - desconto + acrescimo);

  return {
    diasCorridos,
    diasSuspensos,
    diasCobrados,
    mesesCobrados,
    valorBase: moeda(valorBase),
    taxaImplantacao: moeda(taxaImplantacao),
    taxaRecolhimento: moeda(taxaRecolhimento),
    desconto: moeda(desconto),
    acrescimo: moeda(acrescimo),
    total: moeda(total),
  };
}

export interface DemonstrativoLocacao {
  regraAplicada: TipoCobrancaLocacao;
  dataInicio: string;
  dataFimEfetiva: string;
  projetado: boolean;
  aberta: boolean;
  linhas: Array<{ descricao: string; valor: number }>;
  diasCorridos: number;
  diasSuspensos: number;
  diasCobrados: number;
  mesesCobrados: number;
  total: number;
}

// Monta um demonstrativo legível. Quando a locação está aberta (sem data de
// fim real), o cálculo é projetado até `dataReferencia` (default: dataFim
// informada) e o campo `projetado` fica verdadeiro.
export function montarDemonstrativoLocacao(
  input: CalculoLocacaoInput & { locacaoAberta?: boolean; dataReferencia?: string },
): DemonstrativoLocacao {
  const dataFimEfetiva = input.dataFim || input.dataReferencia || input.dataInicio;
  const calculo = calcularLocacao({ ...input, dataFim: dataFimEfetiva });

  const linhas: Array<{ descricao: string; valor: number }> = [];
  if (calculo.valorBase > 0) {
    const rotulo =
      input.tipoCobranca === 'Somente diária'
        ? `Diárias (${calculo.diasCobrados} dia(s))`
        : input.tipoCobranca === 'Mensalidade proporcional'
          ? `Mensalidade proporcional (${calculo.diasCobrados} dia(s))`
          : `Mensalidade (${calculo.mesesCobrados} mês/meses)`;
    linhas.push({ descricao: rotulo, valor: calculo.valorBase });
  }
  if (calculo.taxaImplantacao > 0) linhas.push({ descricao: 'Taxa de implantação', valor: calculo.taxaImplantacao });
  if (calculo.taxaRecolhimento > 0) linhas.push({ descricao: 'Taxa de recolhimento', valor: calculo.taxaRecolhimento });
  if (calculo.acrescimo > 0) linhas.push({ descricao: 'Acréscimo', valor: calculo.acrescimo });
  if (calculo.desconto > 0) linhas.push({ descricao: 'Desconto', valor: -calculo.desconto });
  if (calculo.diasSuspensos > 0) {
    linhas.push({ descricao: `Dias suspensos (não cobrados: ${calculo.diasSuspensos})`, valor: 0 });
  }

  return {
    regraAplicada: input.tipoCobranca,
    dataInicio: input.dataInicio,
    dataFimEfetiva,
    projetado: Boolean(input.locacaoAberta),
    aberta: Boolean(input.locacaoAberta),
    linhas,
    diasCorridos: calculo.diasCorridos,
    diasSuspensos: calculo.diasSuspensos,
    diasCobrados: calculo.diasCobrados,
    mesesCobrados: calculo.mesesCobrados,
    total: calculo.total,
  };
}

export interface RentabilidadeInput {
  valorAquisicao?: number;
  custosManutencao?: number[];
  receitaRealizada?: number[];
  receitaEstimada?: number[];
  diasImplantado?: number;
  diasEstoque?: number;
  diasManutencao?: number;
  quantidadeImplantacoes?: number;
}

export interface RentabilidadeResultado {
  valorAquisicao: number;
  custoManutencaoTotal: number;
  receitaRealizada: number;
  receitaEstimada: number;
  resultadoRealizado: number;
  resultadoProjetado: number;
  percentualRecuperacaoAquisicao: number;
  aquisicaoRecuperada: boolean;
  quantidadeImplantacoes: number;
  diasImplantado: number;
  diasEstoque: number;
  diasManutencao: number;
}

const somar = (valores?: number[]) => (valores || []).reduce((total, v) => total + Number(v || 0), 0);

// Consolida receita realizada (locações encerradas) e estimada (abertas) em
// indicadores separados, subtraindo aquisição e custos de manutenção aprovados.
export function calcularRentabilidadeEquipamento(input: RentabilidadeInput): RentabilidadeResultado {
  const valorAquisicao = Math.max(0, Number(input.valorAquisicao || 0));
  const custoManutencaoTotal = somar(input.custosManutencao);
  const receitaRealizada = somar(input.receitaRealizada);
  const receitaEstimada = somar(input.receitaEstimada);

  const resultadoRealizado = receitaRealizada - valorAquisicao - custoManutencaoTotal;
  const resultadoProjetado = receitaRealizada + receitaEstimada - valorAquisicao - custoManutencaoTotal;
  const percentualRecuperacaoAquisicao = valorAquisicao > 0
    ? moeda((receitaRealizada / valorAquisicao) * 100)
    : 0;

  return {
    valorAquisicao: moeda(valorAquisicao),
    custoManutencaoTotal: moeda(custoManutencaoTotal),
    receitaRealizada: moeda(receitaRealizada),
    receitaEstimada: moeda(receitaEstimada),
    resultadoRealizado: moeda(resultadoRealizado),
    resultadoProjetado: moeda(resultadoProjetado),
    percentualRecuperacaoAquisicao,
    aquisicaoRecuperada: valorAquisicao > 0 && receitaRealizada >= valorAquisicao,
    quantidadeImplantacoes: Number(input.quantidadeImplantacoes || 0),
    diasImplantado: Number(input.diasImplantado || 0),
    diasEstoque: Number(input.diasEstoque || 0),
    diasManutencao: Number(input.diasManutencao || 0),
  };
}
