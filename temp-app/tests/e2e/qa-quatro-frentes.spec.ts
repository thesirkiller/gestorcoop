import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/admin/.gemini/antigravity/brain/382d8bdd-0ff7-4427-bd76-b9e5a015a801';

// CPF e PIS válidos (Módulo 11)
const CPF_VALIDO = '529.982.247-25';
const PIS_VALIDO = '120.56412.84-9'; // Vamos validar ou calcular um PIS válido no próprio teste

async function autenticarGestor(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-1',
      url: 'http://localhost:3005',
    },
  ]);

  await page.route('**/api/gestor/me', (route) =>
    route.fulfill({ json: { nome: 'Dr. Cícero Vanderley', email: 'gestor@gestorcoop.app' } })
  );
}

async function autenticarCooperado(page: Page) {
  await page.context().addCookies([
    {
      name: 'cooperado_session',
      value: 'user-e2e-coop-1',
      url: 'http://localhost:3005',
    },
  ]);

  await page.route('**/api/cooperado/me', (route) =>
    route.fulfill({
      json: {
        success: true,
        cooperadoId: 'coop_101',
        nome: 'Enf. Camila Andrade',
        cpf: '529.982.247-25',
        cargo: 'Tecnico_Enfermagem',
        profissao: 'Enfermeiro (a)',
      },
    })
  );
}

test.describe('QA Visual — 4 Frentes da Reunião de Alinhamento (13/10/2026)', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test('Frente 1: Adesão & Validação COREN/PIS + 5 Documentos Obrigatórios', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1020 });

    await page.route('**/api/cooperado/verificar-cpf**', (route) =>
      route.fulfill({ json: { exists: false } })
    );

    const nomesArquivos = [
      'rg_frente_verso.pdf',
      'carteira_coren_go.pdf',
      'certidao_regularidade_coren.pdf',
      'certidao_negativa_criminal.pdf',
      'comprovante_endereco_goiania.pdf',
      'cartao_vacinacao_atualizado.pdf',
      'cartao_sus_pis.pdf',
    ];
    let uploadIdx = 0;

    await page.route('**/api/cooperado/upload', (route) => {
      const name = nomesArquivos[uploadIdx] || `documento_${uploadIdx + 1}.pdf`;
      uploadIdx++;
      return route.fulfill({
        json: {
          success: true,
          url: `https://cdn.gestorcoop.app/uploads/${name}`,
          name,
          comprovante: `comp-${uploadIdx}-${Date.now()}`,
        },
      });
    });

    await page.route('https://viacep.com.br/**', (route) =>
      route.fulfill({
        json: {
          logradouro: 'Avenida T-63, nº 1240',
          bairro: 'Setor Bueno',
          localidade: 'Goiânia',
          uf: 'GO',
        },
      })
    );

    await page.goto('/cooperado/adesao');

    // Etapa 1 — Dados Pessoais + Validação PIS
    await page.fill('input[name="nomeCompleto"]', 'Camila Andrade Souza');
    await page.fill('input[name="cpf"]', CPF_VALIDO);
    await page.fill('input[name="email"]', 'camila.andrade@enfermagem.coop.br');
    await page.fill('input[name="whatsapp"]', '62998765432');

    // Testa PIS válido (170.33259.50-4: 1*3+7*2+0*9+3*8+3*7+2*6+5*5+9*4+5*3+0*2 = 3+14+0+24+21+12+25+36+15+0 = 150; 150%11 = 7; 11-7 = 4)
    await page.fill('input[name="pis"]', '17033259504');
    await expect(page.getByText('PIS/PASEP válido (dígito verificador confirmado).')).toBeVisible();

    await page.getByRole('button', { name: /Avançar/i }).click();

    // Etapa 2 — Endereço
    await expect(page.getByRole('heading', { name: /Endereço Residencial/i })).toBeVisible();
    await page.fill('input[name="cep"]', '74230100');
    await expect(page.locator('input[name="rua"]')).toHaveValue('Avenida T-63, nº 1240');
    await page.fill('input[name="numero"]', '1240');
    await page.getByRole('button', { name: /Avançar/i }).click();

    // Etapa 3 — Atuação Profissional & Registro no Conselho (COREN + UF)
    await expect(page.getByRole('heading', { name: /Atuação Profissional & Registro no Conselho/i })).toBeVisible();

    // 1) Primeiro adiciona um COREN válido para constar na lista de profissões cadastradas
    await page.selectOption('#prof_name', 'Enfermeiro (a)');
    await page.selectOption('#prof_uf', 'GO');
    await page.fill('#prof_registration', '482917-ENF');
    await page.fill('#prof_emissionDate', '2021-05-14');
    await page.getByRole('button', { name: /Salvar Profissão/i }).click();

    await expect(page.getByText('COREN-GO 482917-ENF')).toBeVisible();
    await expect(page.getByText('Formato Validado')).toBeVisible();
    await expect(page.getByText(/Emissão:\s*14\/05\/2021/)).toBeVisible();

    // 2) Agora tenta salvar um número sequencial/aleatório (ex: 123456) para exibir o alerta de rejeição na tela junto com o válido cadastrado
    await page.selectOption('#prof_name', 'Técnico (a) de Enfermagem');
    await page.selectOption('#prof_uf', 'GO');
    await page.fill('#prof_registration', '123456');
    await page.getByRole('button', { name: /Salvar Profissão/i }).click();

    await expect(page.getByText(/sequências numéricas \(ex\.: 123456 ou 654321\) não são aceitas/i)).toBeVisible();

    // Captura screenshot da Frente 1 - Etapa 3 (COREN)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-frente1-adesao-coren.png'),
      fullPage: true,
    });

    // Limpa o erro adicionando o registro válido de Técnico ou avançando (já tem 1 profissão válida)
    await page.fill('#prof_registration', '739284-TE');
    await page.getByRole('button', { name: /Salvar Profissão/i }).click();
    await expect(page.getByText('COREN-GO 739284-TE')).toBeVisible();

    await page.getByRole('button', { name: /Avançar/i }).click();

    // Etapa 4 — Dados Bancários
    await expect(page.getByRole('heading', { name: /Dados Bancários/i })).toBeVisible();
    await page.fill('#bank_agency', '0001');
    await page.fill('#bank_account', '984512-3');
    await page.getByRole('button', { name: /Salvar Conta/i }).click();
    await page.getByRole('button', { name: /Avançar/i }).click();

    // Etapa 5 — Upload dos 6 Documentos Obrigatórios + Opcionais (SUS/PIS)
    await expect(page.getByRole('heading', { name: /Upload de Documentos/i })).toBeVisible();

    const tiposParaSelecionar = [
      'identificacao',
      'conselho',
      'certidao_regularidade',
      'certidao_negativa_criminal',
      'residencia',
      'cartao_vacinacao',
      'cartao_sus_pis',
    ];

    for (let i = 0; i < nomesArquivos.length; i++) {
      await page.locator('input[type="file"]').setInputFiles({
        name: nomesArquivos[i],
        mimeType: 'application/pdf',
        buffer: Buffer.from(`%PDF-1.4 conteudo ${nomesArquivos[i]}`),
      });
      await expect(page.getByText(`Arquivos Carregados (${i + 1})`)).toBeVisible();
      await page.getByRole('combobox', { name: `Tipo de ${nomesArquivos[i]}` }).selectOption(tiposParaSelecionar[i]);
    }

    await expect(page.getByText('Checklist de Documentação Obrigatória (6/6)')).toBeVisible();
    await expect(page.getByText('Documentos obrigatórios enviados. Você pode finalizar e assinar.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Finalizar & Assinar/i })).toBeEnabled();

    // Captura screenshot da Frente 1 - Etapa 5 (Documentos)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-frente1-adesao-documentos.png'),
      fullPage: true,
    });
  });

  test('Frente 2: Exportação Direta do RPA em PDF no Financeiro', async ({ page }) => {
    await autenticarGestor(page);
    await page.setViewportSize({ width: 1440, height: 1020 });

    const mockCoop = {
      _id: 'coop_fin_1',
      txt_nomeCompleto: 'Dra. Fernanda Vasconcelos',
      txt_CPF: '418.729.630-15',
      txt_email: 'fernanda.vasconcelos@multcare.coop.br',
      txt_whatsapp: '(62) 99612-8840',
      txt_termo_status: 'Assinado',
    };

    const hoje = new Date();
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    await page.route('**/api/gestor/cooperados**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            results: [mockCoop],
            remaining: 0,
          },
        },
      })
    );

    await page.route('**/api/gestor/financeiro/escalas**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            results: [
              { _id: 'esc_1', num_id: 204, txt_anotacoes: 'Escala Home Care Verdes Mares - UTI Domiciliar' },
            ],
            remaining: 0,
          },
        },
      })
    );

    await page.route('**/api/gestor/financeiro/servicos**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          json: {
            success: true,
            data: [
              {
                _id: 'srv_101',
                num_id: 8801,
                txt_nome: 'Plantão Diurno 12h - Assistência Integral',
                fk_escala: 'esc_1',
                date_fixa_entrada: `${anoMes}-05T07:00:00.000Z`,
                date_fixa_saida: `${anoMes}-05T19:00:00.000Z`,
                num_valor_cooperado: 680.0,
                bool_confirmacao_finalizado: true,
                bool_pago: false,
              },
              {
                _id: 'srv_102',
                num_id: 8802,
                txt_nome: 'Plantão Diurno 12h - Assistência Integral',
                fk_escala: 'esc_1',
                date_fixa_entrada: `${anoMes}-08T07:00:00.000Z`,
                date_fixa_saida: `${anoMes}-08T19:00:00.000Z`,
                num_valor_cooperado: 680.0,
                bool_confirmacao_finalizado: true,
                bool_pago: false,
              },
              {
                _id: 'srv_103',
                num_id: 8803,
                txt_nome: 'Plantão Noturno 12h - Monitoramento Clínico',
                fk_escala: 'esc_1',
                date_fixa_entrada: `${anoMes}-11T19:00:00.000Z`,
                date_fixa_saida: `${anoMes}-12T07:00:00.000Z`,
                num_valor_cooperado: 740.0,
                bool_confirmacao_finalizado: true,
                bool_pago: false,
              },
            ],
          },
        });
      }
      return route.fulfill({ json: { success: true } });
    });

    await page.route('**/api/gestor/financeiro/contas**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              _id: 'bank_1',
              txt_banco: '341 - Itaú Unibanco S.A.',
              txt_agencia: '1420',
              txt_nConta: '45892-1',
              text_corrente_or_poupanca: 'Conta Corrente',
            },
          ],
        },
      })
    );

    await page.goto('/gestor/financeiro');

    // Seleciona a cooperada
    const searchInput = page.locator('input[placeholder*="Digite o nome ou CPF"]');
    await searchInput.fill('Fernanda');
    await page.getByRole('button', { name: /Dra\. Fernanda Vasconcelos/i }).click();

    await expect(page.getByText('Plantão Diurno 12h - Assistência Integral').first()).toBeVisible();

    // Seleciona todos os plantões pendentes
    await page.locator('thead input[type="checkbox"]').check();
    await expect(page.getByRole('button', { name: /Emitir RPA/i })).toBeEnabled();

    // Abre o modal de RPA
    await page.getByRole('button', { name: /Emitir RPA/i }).click();
    await expect(page.getByText('RECIBO DE PAGAMENTO DE AUTÔNOMO - RPA')).toBeVisible();

    // Preenche retenções para demonstrar cálculo líquido
    await page.fill('#rpa-retencoes-input', '150');
    await expect(page.getByTestId('btn-download-rpa-pdf')).toBeVisible();

    // Captura screenshot do Modal RPA com botão "Baixar PDF Direto"
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-frente2-rpa-pdf.png'),
      fullPage: false,
    });

    // Valida o disparo e conclusão real do download do PDF via jsPDF
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('btn-download-rpa-pdf').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^RPA_Dra_Fernanda_Vasconcelos_.*\.pdf$/);
    const pdfPath = await download.path();
    expect(pdfPath).toBeTruthy();
    if (pdfPath) {
      const stat = fs.statSync(pdfPath);
      expect(stat.size).toBeGreaterThan(1000);
    }
  });

  test('Frente 3: Reconhecimento Facial na Assinatura de Evoluções + Selo SHA-256', async ({ page }) => {
    await autenticarCooperado(page);
    await page.setViewportSize({ width: 1280, height: 980 });

    const mockPac = {
      id: 'pac_facial_1',
      nome: 'Sr. Antônio Carlos Mendonça',
      cpf: '384.920.115-68',
      data_nascimento: '14/07/1948',
      endereco: 'Rua das Orquídeas, Qd. 24, Lt. 12 - Setor Oeste, Goiânia/GO',
      warnings: ['Alergia a Penicilina', 'Uso de O2 Contínuo'],
      limite_visitas_mes: 30,
      visitas_realizadas_mes: 12,
      visitas_restantes_mes: 18,
      limite_atingido: false,
    };

    await page.route('**/api/cooperado/agenda**', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [mockPac],
          prescricoes: [],
          aprazamentos: [],
        },
      })
    );

    await page.route('**/api/cooperado/sync**', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [mockPac],
          prescricoes: [],
          aprazamentos: [],
        },
      })
    );

    await page.goto('/cooperado/prontuario/pac_facial_1');

    // Confirma o modal de identificação de segurança do paciente
    await expect(page.getByRole('heading', { name: /Identificação de Segurança/i })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Inicia Check-in
    await page.getByRole('button', { name: /Iniciar Check-in/i }).click();
    await expect(page.getByText('Sessão Ativa')).toBeVisible();

    // Preenche a evolução clínica estruturada
    await page.fill(
      '#revisaoEvolucao',
      'Paciente consciente, orientado no tempo e espaço, eupneico em cateter nasal de O2 a 2L/min. Sinais vitais estáveis (PA 120/80 mmHg, FC 76 bpm, SpO2 97%, Temp 36.4°C). Realizada higiene corporal, mudança de decúbito e curativo sacral oclusivo sem sinais flogísticos.'
    );

    // Abre o modal de Reconhecimento Facial Biométrico
    const btnFacial = page.getByTestId('btn-abrir-validacao-facial');
    await expect(btnFacial).toBeVisible();
    await btnFacial.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Reconhecimento Facial • Assinatura')).toBeVisible();

    // Captura o rosto para gerar o Hash Biométrico SHA-256 dentro do modal
    const btnCapturar = page.getByTestId('btn-capturar-rosto');
    await expect(btnCapturar).toBeVisible();
    await btnCapturar.click();

    // Verifica que a imagem capturada e o hash SHA-256 estão visíveis no modal
    await expect(page.getByTestId('img-captura-facial')).toBeVisible();
    await expect(page.getByTestId('hash-biometrico-sha256')).toBeVisible();
    const hashGerado = (await page.getByTestId('hash-biometrico-sha256').textContent())?.trim() || '';
    expect(hashGerado).toMatch(/^[a-f0-9]{64}$/);

    // Captura screenshot do modal de Reconhecimento Facial Biométrico com a face capturada e hash SHA-256
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-frente3-validacao-facial.png'),
      fullPage: false,
    });

    // Confirma a assinatura facial e verifica o selo biométrico SHA-256 no prontuário fechado
    await page.getByTestId('btn-confirmar-assinatura-facial').click();
    await expect(page.getByText('Biometria Facial Validada (SHA-256)')).toBeVisible();
    await expect(page.getByTestId('selo-biometrico-assinado')).toContainText(hashGerado);
  });

  test('Frente 4: Empresa Contratante (Verdes Mares / Multi / ISA) na Admissão + Impressão por Categoria e Individual', async ({ page }) => {
    await autenticarGestor(page);
    await page.setViewportSize({ width: 1440, height: 1020 });

    const mockPacienteVerdesMares = {
      id: 'p_vm_1',
      nome: 'Dona Helena Albuquerque Prado',
      cpf: '295.841.370-04',
      data_nascimento: '1944-08-19',
      sexo: 'Feminino',
      endereco: 'Alameda das Rosas, nº 850 - Setor Oeste, Goiânia/GO',
      telefone: '(62) 99123-4567',
      responsavel_nome: 'Eduardo Albuquerque Prado (Filho)',
      responsavel_telefone: '(62) 99876-1122',
      diagnostico_principal: 'Reabilitação Neurológica Pós-AVE Isquêmico e Hipertensão Arterial Sistêmica',
      cid10: 'I69.3 / I10',
      complexidade: 'Alta',
      empresa_contratante: 'verdes-mares',
      plano_saude: 'Verdes Mares',
      status: 'Ativo',
      limite_visitas_mes: 30,
      visitas_realizadas_mes: 14,
      visitas_restantes_mes: 16,
      limite_atingido: false,
      total_prescricoes_ativas: 2,
      tem_plano_terapeutico: true,
      plano_vigente: {
        id: 'pl_1',
        data_inicio: '2026-10-01',
        data_fim: '2026-10-31',
        total_previsto: 30,
        total_realizado: 14,
        total_restante: 16,
        tem_pendencias: false,
      },
    };

    const mockEvolucoesCategorias = [
      {
        id: 'ev_enf_1',
        paciente_id: 'p_vm_1',
        paciente_nome: 'Dona Helena Albuquerque Prado',
        profissional_id: 'coop_101',
        profissional_nome: 'Enf. Camila Andrade Souza',
        profissional_registro: 'COREN-GO 482917-ENF',
        tipo_profissional: 'Enfermeiro',
        turno: 'Diurno',
        check_in: '2026-10-13T08:00:00.000Z',
        check_out: '2026-10-13T10:30:00.000Z',
        soap_subjetivo: 'Paciente calma, contactuante, acompanhada pelo filho Eduardo. Nega algias ou desconforto respiratório.',
        soap_objetivo: 'Eupneica em ar ambiente (SpO2 98%), normotensa (PA 122/78 mmHg), afebril (36.4°C). Pele íntegra, acesso venoso periférico pérvio em MSE.',
        soap_avaliacao: 'Quadro clínico e hemodinâmico estável em assistência domiciliar integral.',
        soap_plano: 'Realizada administração medicamentosa prescrita, orientação familiar sobre prevenção de broncoaspiração e mudança de decúbito.',
        status: 'Finalizado',
        data_assinatura: '2026-10-13T10:30:00.000Z',
        assinatura_digital: 'SHA256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      },
      {
        id: 'ev_fisio_1',
        paciente_id: 'p_vm_1',
        paciente_nome: 'Dona Helena Albuquerque Prado',
        profissional_id: 'coop_202',
        profissional_nome: 'Dr. Lucas Mendes Oliveira',
        profissional_registro: 'CREFITO-11 194820-F',
        tipo_profissional: 'Fisioterapeuta',
        turno: 'Diurno',
        check_in: '2026-10-12T14:00:00.000Z',
        check_out: '2026-10-12T15:00:00.000Z',
        soap_subjetivo: 'Boa disposição para cinesioterapia motora e respiratória.',
        soap_objetivo: 'Ausculta pulmonar com murmúrio vesicular presente bilateralmente sem ruídos adventícios.',
        soap_avaliacao: 'Ganho progressivo de amplitude articular em membro superior direito.',
        soap_plano: 'Exercícios passivos e ativo-assistidos, treino de controle de tronco e reexpansão pulmonar.',
        status: 'Finalizado',
        data_assinatura: '2026-10-12T15:00:00.000Z',
        assinatura_digital: 'SHA256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      },
      {
        id: 'ev_med_1',
        paciente_id: 'p_vm_1',
        paciente_nome: 'Dona Helena Albuquerque Prado',
        profissional_id: 'coop_303',
        profissional_nome: 'Dr. Roberto Cardozo',
        profissional_registro: 'CRM-GO 18420',
        tipo_profissional: 'Medico',
        turno: 'Diurno',
        check_in: '2026-10-10T09:00:00.000Z',
        check_out: '2026-10-10T10:00:00.000Z',
        soap_subjetivo: 'Visita médica domiciliar de acompanhamento mensal.',
        soap_objetivo: 'Bom estado geral, corada, hidratada, sem edemas de extremidades.',
        soap_avaliacao: 'Reabilitação domiciliar evoluindo satisfatoriamente.',
        soap_plano: 'Mantida prescrição medicamentosa atual e plano terapêutico multiprofissional.',
        status: 'Finalizado',
        data_assinatura: '2026-10-10T10:00:00.000Z',
        assinatura_digital: 'SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ];

    const mockPrescricoesVM = [
      {
        id: 'pr_vm_1',
        paciente_id: 'p_vm_1',
        medicamento: 'Enoxaparina Sódica',
        dosagem: '40mg SC 1x/dia',
        via_administracao: 'Subcutânea',
        frequencia_horas: 24,
        horarios_padrao: ['08:00'],
        status: 'Ativa',
        data_inicio: '2026-10-01',
        data_fim: '2026-10-31',
        medico_nome: 'Dr. Roberto Cardozo',
        medico_crm: 'CRM-GO 18420',
        instrucoes: 'Aplicar em região periumbilical alternando lados.',
      },
      {
        id: 'pr_vm_2',
        paciente_id: 'p_vm_1',
        medicamento: 'Losartana Potássica',
        dosagem: '50mg 1 cp',
        via_administracao: 'Oral',
        frequencia_horas: 12,
        horarios_padrao: ['08:00', '20:00'],
        status: 'Ativa',
        data_inicio: '2026-10-01',
        data_fim: '2026-10-31',
        medico_nome: 'Dr. Roberto Cardozo',
        medico_crm: 'CRM-GO 18420',
        instrucoes: 'Monitorar PA antes da administração.',
      },
    ];

    const mockSinaisVM = [
      {
        id: 'sv_vm_1',
        paciente_id: 'p_vm_1',
        data_hora: '2026-10-13T08:15:00.000Z',
        pa_sistolica: 122,
        pa_diastolica: 78,
        fc_bpm: 74,
        fr_rpm: 16,
        temp_celsius: 36.4,
        spo2_percent: 98,
        glicemia_mg_dl: 96,
        profissional_nome: 'Enf. Camila Andrade Souza',
      },
      {
        id: 'sv_vm_2',
        paciente_id: 'p_vm_1',
        data_hora: '2026-10-13T10:15:00.000Z',
        pa_sistolica: 120,
        pa_diastolica: 76,
        fc_bpm: 72,
        fr_rpm: 15,
        temp_celsius: 36.5,
        spo2_percent: 99,
        glicemia_mg_dl: 102,
        profissional_nome: 'Enf. Camila Andrade Souza',
      },
    ];

    await page.route('**/api/gestor/prontuarios/pacientes', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [mockPacienteVerdesMares],
        },
      })
    );

    await page.route('**/api/gestor/prontuarios?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          results: mockEvolucoesCategorias,
        },
      })
    );

    await page.route('**/api/gestor/pacientes**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            results: [
              {
                _id: 'bub_pac_1',
                txt_nome: 'Dona Helena Albuquerque Prado',
                txt_endereco: 'Alameda das Rosas, nº 850 - Setor Oeste, Goiânia/GO',
                txt_tipo: 'Home Care Integral',
              },
            ],
            remaining: 0,
          },
        },
      })
    );

    await page.route('**/api/gestor/cooperados**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            results: [
              {
                _id: 'coop_101',
                txt_nomeCompleto: 'Enf. Camila Andrade Souza',
                txt_CPF: '529.982.247-25',
                txt_profissao: 'Enfermeiro (a)',
              },
            ],
            remaining: 0,
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_vm_1', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            completo: true,
            paciente: mockPacienteVerdesMares,
            evolucoes: mockEvolucoesCategorias,
            prescricoes: mockPrescricoesVM,
            aprazamentos: [],
            sinaisVitais: mockSinaisVM,
            pareceres: [],
            planos: [],
            planoVigente: null,
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_vm_1/equipamentos', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [],
        },
      })
    );

    // 1. Acessa /gestor/prontuarios e abre o modal de Admissão Clínica
    await page.goto('/gestor/prontuarios');
    await expect(page.getByText('Dona Helena Albuquerque Prado').first()).toBeVisible();

    await page.getByRole('button', { name: /Admitir Paciente|Novo Paciente/i }).first().click();
    await expect(page.getByText('Admissão Clínica de Paciente & Plano Terapêutico')).toBeVisible();

    // Verifica que o seletor de Empresa Contratante (Verdes Mares, Multi, ISA) e a logomarca da Verdes Mares estão visíveis
    await expect(page.getByText('Empresa Contratante / Prestadora (Exibição de Logomarca) *')).toBeVisible();
    await expect(page.getByText('HOME CARE DE ASSISTÊNCIA INTEGRAL — INSCRIÇÃO CNPJ: 54.800.169/0001-55')).toBeVisible();

    // Preenche dados no formulário do modal para ficar ainda mais rico visualmente
    await page.getByRole('button', { name: /Cadastrar Novo/i }).click();
    await page.fill('input[placeholder="Ex: Seu João da Silva"]', 'Dona Helena Albuquerque Prado');
    await page.fill('input[placeholder="000.000.000-00"]', '295.841.370-04');
    await page.fill('input[placeholder*="Nome completo do responsável"]', 'Eduardo Albuquerque Prado (Filho)');

    // Rola o modal até a seção de Empresa Contratante para destacar os 3 cards (Verdes Mares, Multi, ISA) + Preview de cabeçalho com logo
    const secaoEmpresa = page.getByText('Empresa Contratante / Prestadora (Exibição de Logomarca) *');
    await secaoEmpresa.scrollIntoViewIfNeeded();

    // Captura screenshot do Modal de Admissão mostrando o seletor de Empresa Contratante
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-frente4-empresa-admissao.png'),
      fullPage: false,
    });

    // 2. Navega para o detalhe do prontuário /gestor/prontuarios/p_vm_1 e abre o Modal de Impressão por Categorias
    await page.goto('/gestor/prontuarios/p_vm_1');
    await expect(page.getByRole('heading', { name: 'Dona Helena Albuquerque Prado' })).toBeVisible();

    // Vai para a aba Evoluções Clínicas & SOAP para mostrar a barra de categorias e abrir o modal de impressão
    await page.getByRole('button', { name: /Evoluções Clínicas & SOAP/i }).click();
    await expect(page.getByText(/Impressão de Prontuário por Categoria Profissional/i)).toBeVisible();

    // Abre o modal de Impressão na categoria "Evolução de Enfermagem" (ou "Evolução Individual") mostrando o cabeçalho da Verdes Mares, SSVV e assinaturas
    await page.getByRole('button', { name: /Imprimir Evolução/i }).first().click();

    await expect(page.getByText('Central de Impressão de Prontuários por Categoria & Evolução Individual')).toBeVisible();
    await expect(page.getByText('HOME CARE DE ASSISTÊNCIA INTEGRAL — INSCRIÇÃO CNPJ: 54.800.169/0001-55').first()).toBeVisible();
    await expect(page.getByText('SSVV — CONTROLE DE SINAIS VITAIS').first()).toBeVisible();
    await expect(page.getByText('Nº do Coren e assinatura do profissional').first()).toBeVisible();
    await expect(page.getByText('Responsável (nome legível)').first()).toBeVisible();

    // Captura screenshot do Modal de Impressão por Categoria Profissional / Evolução Individual com cabeçalho da Verdes Mares
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-frente4-impressao-categorias.png'),
      fullPage: false,
    });
  });
});
