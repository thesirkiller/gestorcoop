import { test, expect, Page } from '@playwright/test';

// Teste E2E Integrado:
// 1. Novo profissional entra no Funil de Adesão (/cooperado/adesao), preenche dados, documentos e conclui o termo.
// 2. Gestor acessa o Painel Admin (/gestor/dashboard), audita documentos na grade 2x2 e aprova o cooperado.

const CPF_CANDIDATO = '529.982.247-25';

async function autenticarGestor(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-marcos',
      url: 'http://localhost:3005',
    },
  ]);
}

// Banco compartilhado em memória simulando a transição entre o funil de adesão e o painel do gestor
let novoCooperadoCadastrado: any = null;

test.describe('Jornada Completa: Candidato faz Adesão (Cooperação) -> Gestor Audita e Aprova no Admin', () => {
  test('Fluxo Integrado: Inscrição completa do cooperado e aprovação administrativa', async ({ page }) => {
    // -------------------------------------------------------------
    // ETAPA 1: CANDIDATO A COOPERADO REALIZA O FUNIL DE ADESÃO
    // -------------------------------------------------------------
    await page.route('**/api/cooperado/verificar-cpf**', (route) =>
      route.fulfill({ json: { exists: false } })
    );

    await page.route('https://viacep.com.br/**', (route) =>
      route.fulfill({
        json: {
          logradouro: 'Avenida das Américas, 500',
          bairro: 'Barra da Tijuca',
          localidade: 'Rio de Janeiro',
          uf: 'RJ',
        },
      })
    );

    let uploadIndex = 0;
    await page.route('**/api/cooperado/upload', (route) => {
      const name = ++uploadIndex === 1 ? 'rg_frente_verso.pdf' : 'comprovante_residencia.pdf';
      return route.fulfill({
        json: {
          success: true,
          url: `https://cdn.example.com/${name}`,
          name,
          comprovante: 'comprovante-mock',
        },
      });
    });

    await page.route('**/api/cooperado/adesao', (route) => {
      novoCooperadoCadastrado = {
        _id: 'coop_novo_inscrito_1',
        txt_nomeCompleto: 'Dr. Leonardo Albuquerque',
        txt_CPF: CPF_CANDIDATO,
        txt_email: 'leonardo.albuquerque@medicina.com',
        txt_whatsapp: '(21) 99887-1122',
        txt_pis: '123.45678.90-1',
        txt_rg: '20.123.456-7',
        txt_orgaoEmissor: 'DETRAN',
        txt_orgaoUF: 'RJ',
        txt_endereco: 'Avenida das Américas, 500, Apt 302, Barra da Tijuca, Rio de Janeiro - RJ',
        fks_profissoes: ['Médico Clínico Geral'],
        fks_pasta: [
          'https://cdn.example.com/rg_frente_verso.pdf',
          'https://cdn.example.com/comprovante_residencia.pdf',
        ],
        txt_termo_status: 'Assinado', // Simula termo assinado pelo candidato
        file_termo_assinado: 'https://cdn.example.com/termo_adesao_assinado.pdf',
        fk_usuario: null, // Ainda pendente de aprovação do gestor
      };

      return route.fulfill({
        json: {
          success: true,
          cooperadoId: novoCooperadoCadastrado._id,
          docToken: 'token_termo_123',
          signUrl: 'https://app.zapsign.com.br/sign/e2e-termo-assinado',
        },
      });
    });

    await page.route('**/e2e-termo-assinado', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<h1>Termo de Adesão Assinado com Sucesso</h1><p>Cadastro enviado para análise da gestão.</p>',
      })
    );

    // 1. Acessa a página de adesão pública
    await page.goto('http://localhost:3005/cooperado/adesao');

    // 2. Etapa 1: Dados Pessoais
    await page.fill('input[name="nomeCompleto"]', 'Dr. Leonardo Albuquerque');
    await page.fill('input[name="cpf"]', CPF_CANDIDATO);
    await page.fill('input[name="email"]', 'leonardo.albuquerque@medicina.com');
    await page.fill('input[name="whatsapp"]', '21998871122');
    await page.getByRole('button', { name: /Avançar/ }).click();

    // 3. Etapa 2: Endereço (ViaCEP)
    await expect(page.getByRole('heading', { name: 'Endereço' })).toBeVisible();
    await page.fill('input[name="cep"]', '22640100');
    await expect(page.locator('input[name="rua"]')).toHaveValue('Avenida das Américas, 500');
    await page.fill('input[name="numero"]', '500');
    await page.getByRole('button', { name: /Avançar/ }).click();

    // 4. Etapa 3: Profissões & Conselho
    await expect(page.getByRole('heading', { name: 'Profissões' })).toBeVisible();
    await page.fill('input[placeholder="123456"]', 'CRM-RJ 998877');
    await page.getByRole('button', { name: /Salvar Profissão/ }).click();
    await page.getByRole('button', { name: /Avançar/ }).click();

    // 5. Etapa 4: Dados Bancários
    await expect(page.getByRole('heading', { name: /Dados Bancários/ })).toBeVisible();
    await page.fill('input[placeholder="1234-5"]', '1234');
    await page.fill('input[placeholder="123456-7"]', '56789-0');
    await page.getByRole('button', { name: /Salvar Conta/ }).click();
    await page.getByRole('button', { name: /Avançar/ }).click();

    // 6. Etapa 5: Upload de Documentos
    await expect(page.getByRole('heading', { name: /Upload de Documentos/ })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'rg_frente_verso.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 documento RG'),
    });
    await expect(page.getByText('Arquivos Carregados (1)')).toBeVisible();
    await expect(page.getByText('rg_frente_verso.pdf').first()).toBeAttached();
    await page.getByRole('combobox', { name: 'Tipo de rg_frente_verso.pdf' }).selectOption('identificacao');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'comprovante_residencia.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 comprovante de endereco'),
    });
    await expect(page.getByText('Arquivos Carregados (2)')).toBeVisible();
    await page.getByRole('combobox', { name: 'Tipo de comprovante_residencia.pdf' }).selectOption('residencia');

    // 7. Finaliza a inscrição e submete
    const btnFinalizar = page.getByRole('button', { name: /Finalizar & Assinar/ });
    await expect(btnFinalizar).toBeEnabled();
    await btnFinalizar.click();

    // 8. Verifica tela de confirmação do termo
    await expect(page.getByRole('heading', { name: /Termo de Ades/i })).toBeVisible();

    // Garante que o cadastro foi gerado com sucesso
    expect(novoCooperadoCadastrado).not.toBeNull();
    expect(novoCooperadoCadastrado.txt_nomeCompleto).toBe('Dr. Leonardo Albuquerque');

    // -------------------------------------------------------------
    // ETAPA 2: GESTOR CLÍNICO/ADMIN NO PAINEL DE ADESÕES
    // -------------------------------------------------------------
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({
        json: { nome: 'Dr. Marcos Gabryel (Gestor)', email: 'gestor@gestorcoop.app' },
      })
    );

    await page.route('**/api/gestor/cooperados*', (route) => {
      return route.fulfill({
        json: {
          success: true,
          data: {
            results: [novoCooperadoCadastrado],
            remaining: 0,
            cursor: 0,
          },
        },
      });
    });

    let cooperadoFoiAprovado = false;
    await page.route('**/api/gestor/cooperados/aprovar', async (route) => {
      cooperadoFoiAprovado = true;
      novoCooperadoCadastrado.fk_usuario = 'usr_bubble_aprovado_123';
      return route.fulfill({
        json: {
          success: true,
          message: 'Cooperado aprovado com sucesso.',
          usuarioId: 'usr_bubble_aprovado_123',
        },
      });
    });

    // 1. Gestor abre o Painel de Adesões do Gestor
    await page.goto('http://localhost:3005/gestor/dashboard');
    await expect(page.getByText('Dr. Leonardo Albuquerque')).toBeVisible();
    await expect(page.getByText(CPF_CANDIDATO)).toBeVisible();

    // 2. Verifica status inicial: "Em Análise (Assinado)"
    await expect(page.getByText('Em Análise (Assinado)')).toBeVisible();

    // 3. Gestor abre a visualização de documentos anexados (Grade 2x2)
    const btnDocs = page.locator('button[title*="Ver Documentos"]').first();
    await btnDocs.click();

    // 4. Modal de documentos do cooperado abre com os arquivos anexados no cadastro
    await expect(page.getByText('Documentos & Anexos')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fecha o modal de documentos
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // 5. Gestor clica no botão "Aprovar" para admitir o novo sócio cooperado
    const btnAprovar = page.getByRole('button', { name: /Aprovar/ }).first();
    await expect(btnAprovar).toBeVisible();
    await btnAprovar.click();

    // 6. Confirma que a aprovação foi processada no backend
    expect(cooperadoFoiAprovado).toBe(true);

    // 7. Status do cooperado na tabela atualiza imediatamente para "Aprovado"
    await expect(page.getByText('Aprovado', { exact: true })).toBeVisible();
  });
});
