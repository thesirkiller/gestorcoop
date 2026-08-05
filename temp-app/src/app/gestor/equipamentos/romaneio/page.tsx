'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { AlertCircle, ArrowLeft, Loader2, Printer } from 'lucide-react';
import Link from 'next/link';
import { Domicilio, Equipamento, LocacaoEquipamento, Paciente } from '@/lib/bubble';
import {
  ItemRomaneio,
  formatarData,
  gerarNumeroRomaneio,
  montarItens,
  resolverEnderecoEntrega,
} from '@/lib/romaneio-entrega';

function RomaneioContent() {
  const searchParams = useSearchParams();
  const clienteId = searchParams.get('cliente') || '';
  const itensParam = searchParams.get('itens') || '';

  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [cliente, setCliente] = React.useState<Paciente | null>(null);
  const [domicilio, setDomicilio] = React.useState<Domicilio | undefined>();
  const [itens, setItens] = React.useState<ItemRomaneio[]>([]);
  const [entregador, setEntregador] = React.useState('');

  React.useEffect(() => {
    if (!clienteId) {
      setErro('Nenhum cliente informado. Abra o romaneio a partir da lista de clientes.');
      setLoading(false);
      return;
    }

    const carregar = async () => {
      try {
        const preSelecionados = itensParam.split(',').map((i) => i.trim()).filter(Boolean);
        const [resCli, resLoc, resEqp, resDom] = await Promise.all([
          axios.get('/api/gestor/pacientes'),
          axios.get('/api/gestor/locacoes'),
          axios.get('/api/gestor/equipamentos'),
          // O cadastro de domicílios só existe no fluxo V2; sem ele caímos no
          // endereço legado do cliente, então a falha aqui não é bloqueante.
          axios.get(`/api/gestor/domicilios?cliente=${clienteId}`).catch(() => null),
        ]);

        const clientes: Paciente[] = resCli.data?.data || [];
        const encontrado = clientes.find((c) => c._id === clienteId);
        if (!encontrado) {
          setErro('Cliente não encontrado.');
          return;
        }
        setCliente(encontrado);

        const locacoes: LocacaoEquipamento[] = (resLoc.data?.data || []).filter(
          (l: LocacaoEquipamento) => l.fk_paciente === clienteId
        );
        const equipamentos: Equipamento[] = resEqp.data?.data || [];
        const montados = montarItens(locacoes, equipamentos, preSelecionados);
        if (montados.length === 0) {
          setErro('Este cliente não tem equipamentos em locação ativa.');
          return;
        }
        setItens(montados);

        const domicilios: Domicilio[] = resDom?.data?.data || [];
        const idDoDomicilioDaLocacao = locacoes.find((l) => l.fk_domicilio)?.fk_domicilio;
        setDomicilio(
          domicilios.find((d) => d._id === idDoDomicilioDaLocacao) ||
            domicilios.find((d) => d.bool_ativo)
        );
      } catch (err) {
        const error = err as { response?: { data?: { error?: string } } };
        setErro(error.response?.data?.error || 'Erro ao carregar os dados do romaneio.');
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [clienteId, itensParam]);

  const alternarItem = (locacaoId: string) => {
    setItens((atual) =>
      atual.map((i) => (i.locacaoId === locacaoId ? { ...i, selecionado: !i.selecionado } : i))
    );
  };

  const selecionados = itens.filter((i) => i.selecionado);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Montando o romaneio...</span>
      </div>
    );
  }

  if (erro || !cliente) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-white border border-rose-100 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm text-slate-700">{erro}</p>
        <Link
          href="/gestor/equipamentos"
          className="inline-flex items-center gap-1.5 mt-5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para equipamentos
        </Link>
      </div>
    );
  }

  const numero = gerarNumeroRomaneio(clienteId);
  const emissao = new Date();

  return (
    <div className="text-slate-800 font-sans">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          #print-area,
          #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
          }
          #print-area table {
            page-break-inside: auto;
          }
          #print-area tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          #print-area thead {
            display: table-header-group;
          }
        }
      `}</style>

      {/* Barra de controle — não sai na impressão */}
      <div className="print:hidden mb-4 space-y-3">
        <Link
          href="/gestor/equipamentos"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para equipamentos
        </Link>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-900">Romaneio de entrega</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Desmarque os equipamentos que não vão nesta viagem e imprima o documento.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label
                  htmlFor="entregador"
                  className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1"
                >
                  Entregue por
                </label>
                <input
                  id="entregador"
                  type="text"
                  value={entregador}
                  onChange={(e) => setEntregador(e.target.value)}
                  placeholder="Nome de quem vai entregar..."
                  className="bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={() => window.print()}
                disabled={selecionados.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 space-y-1.5">
            {itens.map((item) => (
              <label
                key={item.locacaoId}
                className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={item.selecionado}
                  onChange={() => alternarItem(item.locacaoId)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25"
                />
                <span className="font-semibold text-slate-800">{item.nome}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 font-mono">{item.numeroSerie}</span>
              </label>
            ))}
            <p className="text-[11px] text-slate-400 pt-1">
              {selecionados.length} de {itens.length}{' '}
              {itens.length === 1 ? 'equipamento selecionado' : 'equipamentos selecionados'}
            </p>
          </div>
        </div>
      </div>

      {/* Documento */}
      <div id="print-area" className="bg-white text-black p-8 md:p-10 border border-slate-200/80 rounded-xl">
        <div className="flex justify-between items-start border-b-2 border-black pb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest">GestorCoop</div>
            <h2 className="text-lg font-bold mt-0.5">ROMANEIO DE ENTREGA DE EQUIPAMENTOS</h2>
          </div>
          <div className="text-right text-[11px] leading-relaxed">
            <div className="font-bold">Nº {numero}</div>
            <div>Emitido em {emissao.toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <section className="mt-4 text-[11px] leading-relaxed">
          <div className="font-bold uppercase tracking-wider text-[10px] mb-1.5">Cliente</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <span className="font-bold">Nome:</span> {cliente.txt_nome}
            </div>
            <div>
              <span className="font-bold">Tipo:</span> {cliente.txt_tipo || 'Homecare'}
            </div>
            <div>
              <span className="font-bold">CPF:</span> {cliente.txt_cpf || '—'}
            </div>
            <div>
              <span className="font-bold">WhatsApp:</span> {cliente.txt_whatsapp || '—'}
            </div>
          </div>
          <div className="mt-1">
            <span className="font-bold">Endereço de entrega:</span>{' '}
            {resolverEnderecoEntrega(cliente, domicilio) || '—'}
          </div>
          {domicilio?.txt_ponto_referencia && (
            <div>
              <span className="font-bold">Ponto de referência:</span> {domicilio.txt_ponto_referencia}
            </div>
          )}
          {domicilio?.txt_instrucoes_acesso && (
            <div>
              <span className="font-bold">Instruções de acesso:</span> {domicilio.txt_instrucoes_acesso}
            </div>
          )}
          {domicilio?.txt_contato_local && (
            <div>
              <span className="font-bold">Contato no local:</span> {domicilio.txt_contato_local}
            </div>
          )}
        </section>

        <table className="w-full mt-5 text-[11px] border-collapse">
          <thead>
            <tr className="border-y-2 border-black text-left uppercase text-[9px] tracking-wider">
              <th className="py-1.5 pr-2 w-8">#</th>
              <th className="py-1.5 pr-2">Equipamento</th>
              <th className="py-1.5 pr-2">Marca / Modelo</th>
              <th className="py-1.5 pr-2">Nº Série</th>
              <th className="py-1.5 pr-2 w-20">Início</th>
              <th className="py-1.5 w-16 text-center">Entregue</th>
            </tr>
          </thead>
          <tbody>
            {selecionados.map((item, indice) => (
              <tr key={item.locacaoId} className="border-b border-black/20">
                <td className="py-2 pr-2">{indice + 1}</td>
                <td className="py-2 pr-2 font-semibold">{item.nome}</td>
                <td className="py-2 pr-2">{item.marcaModelo}</td>
                <td className="py-2 pr-2 font-mono">{item.numeroSerie}</td>
                <td className="py-2 pr-2">{formatarData(item.dataInicio)}</td>
                <td className="py-2 text-center">
                  <span className="inline-block w-3.5 h-3.5 border border-black align-middle" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 text-[11px] font-bold">
          Total de itens: {selecionados.length}
        </div>

        <section className="mt-5 text-[11px]">
          <div className="font-bold uppercase tracking-wider text-[10px] mb-2">Observações</div>
          <div className="border-b border-black/40 h-5" />
          <div className="border-b border-black/40 h-5" />
        </section>

        <section className="mt-6 text-[11px]">
          <p className="leading-relaxed">
            Declaro ter recebido os equipamentos assinalados acima, em bom estado de conservação e
            funcionamento, comprometendo-me a zelar por sua guarda e conservação enquanto estiverem
            sob minha responsabilidade.
          </p>
          <div className="grid grid-cols-2 gap-8 mt-10">
            <div>
              <div className="border-t border-black pt-1">Entregue por (nome e assinatura)</div>
              {entregador && <div className="mt-1 font-semibold">{entregador}</div>}
            </div>
            <div>
              <div className="border-t border-black pt-1">Recebido por (nome e assinatura)</div>
              <div className="mt-3">Documento: ______________________</div>
              <div className="mt-2">Data: ____/____/______ Hora: ____:____</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function RomaneioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      }
    >
      <RomaneioContent />
    </Suspense>
  );
}
