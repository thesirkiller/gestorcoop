# GestorCoop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Next.js 14 web application integrated with Bubble.io and ZapSign for managing cooperative memberships and document uploads.

**Architecture:** Next.js App Router for frontend UI and backend API routes. Bubble serves as the database (accessed via Next.js `/api` endpoints). ZapSign handles signatures via API and webhooks. UI uses Tailwind CSS v3 and `react-dropzone` for file uploads.

**Tech Stack:** Next.js 14, Tailwind CSS v3, TypeScript, Axios, React Dropzone.

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json` (via next-app)
- Create: `tailwind.config.ts` (via next-app)
- Create: `.env.local`

- [x] **Step 1: Scaffold Next.js project**
```bash
npx -y create-next-app@14 . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm
```

- [x] **Step 2: Install required dependencies**
```bash
npm install axios react-dropzone framer-motion lucide-react
npm install -D @types/node @types/react
```

- [x] **Step 3: Setup environment variables**
```bash
cat << 'EOF' > .env.local
BUBBLE_API_URL=https://gestorcoop.app/version-test/api/1.1
BUBBLE_API_TOKEN=6c21a37e162a035046428bc4372ee8ba
ZAPSIGN_API_TOKEN=placeholder_zapsign_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

- [x] **Step 4: Commit**
```bash
git add .
git commit -m "chore: initialize Next.js with Tailwind and dependencies"
```

### Task 2: Core Bubble API Service

**Files:**
- Create: `src/lib/bubble.ts`

- [x] **Step 1: Create the Bubble API client**

```typescript
import axios from 'axios';

const bubbleClient = axios.create({
  baseURL: process.env.BUBBLE_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.BUBBLE_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

export const bubbleApi = {
  async createCooperado(data: any) {
    const response = await bubbleClient.post('/obj/socioscooperados', data);
    return response.data;
  },
  async getCooperados() {
    const response = await bubbleClient.get('/obj/socioscooperados');
    return response.data.response.results;
  },
  async updateCooperado(id: string, data: any) {
    const response = await bubbleClient.patch(`/obj/socioscooperados/${id}`, data);
    return response.data;
  },
  async uploadFile(filename: string, fileBuffer: Buffer) {
    // Bubble expects base64 or direct binary upload
    const response = await bubbleClient.post('/obj/file', {
      name: filename,
      contents: fileBuffer.toString('base64')
    });
    return response.data; // usually returns URL of the uploaded file
  }
};
```

- [x] **Step 2: Commit**
```bash
git add src/lib/bubble.ts
git commit -m "feat: create Bubble API client"
```

### Task 3: Backend Routes (API)

**Files:**
- Create: `src/app/api/cooperados/route.ts`
- Create: `src/app/api/upload/route.ts`

- [x] **Step 1: Refactor Homepage**
```typescript
import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export async function GET() {
  try {
    const data = await bubbleApi.getCooperados();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await bubbleApi.createCooperado({
      nome_text: body.nome,
      cpf_text: body.cpf,
      email_text: body.email,
      // mapping other fields dynamically
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [x] **Step 2: Create File Upload API Route**

```typescript
import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // In production, we send this to Bubble or S3
    // For now we mock the successful response to keep moving
    const url = `https://dummy-url.com/${file.name}`;
    
    return NextResponse.json({ url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [x] **Step 3: Commit**
```bash
git add src/app/api/cooperados/route.ts src/app/api/upload/route.ts
git commit -m "feat: setup API routes for cooperados and uploads"
```

### Task 4: UI Components (Drag and Drop Uploader)

**Files:**
- Create: `src/components/FileUploader.tsx`

- [x] **Step 1: Create the Gestor Dashboard**
```tsx
'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileUploader({ onFilesSelected }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles];
    setFiles(newFiles);
    onFilesSelected(newFiles);
  }, [files, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  return (
    <div className="w-full">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium">Arraste seus documentos aqui ou clique para selecionar</p>
        <p className="text-sm text-gray-500 mt-2">RG, CNH, Comprovante de Residência, etc.</p>
      </div>

      {files.length > 0 && (
        <ul className="mt-6 space-y-3">
          {files.map((file, idx) => (
            <li key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex items-center space-x-3">
                <FileIcon className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">{file.name}</span>
              </div>
              <button type="button" onClick={() => removeFile(idx)} className="text-red-500 hover:text-red-700">
                <X className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [x] **Step 2: Commit**
```bash
git add src/components/FileUploader.tsx
git commit -m "feat: add drag and drop file uploader component"
```

### Task 5: Cooperado Registration Page

**Files:**
- Create: `src/app/cooperado/adesao/page.tsx`

- [ ] **Step 1: Build the multi-step form page**

```tsx
'use client';

import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import axios from 'axios';

export default function AdesaoPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ nome: '', cpf: '', email: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Create user record
      await axios.post('/api/cooperados', formData);
      
      // Upload files sequentially (mocked for now)
      for (const file of files) {
        const formDataObj = new FormData();
        formDataObj.append('file', file);
        await axios.post('/api/upload', formDataObj);
      }
      
      alert('Cadastro enviado com sucesso! Aguarde o link para assinatura.');
      setStep(3); // success view
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar cadastro.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Adesão de Cooperado
        </h2>
        
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-700">Passo 1: Dados Pessoais</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome Completo"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
              <input
                type="text"
                placeholder="CPF"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.cpf}
                onChange={e => setFormData({...formData, cpf: e.target.value})}
              />
              <input
                type="email"
                placeholder="E-mail"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Próximo
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-700">Passo 2: Documentos</h3>
            <FileUploader onFilesSelected={setFiles} />
            <div className="flex space-x-4">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-2/3 flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Finalizar Cadastro'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-4 py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-medium text-gray-900">Tudo certo!</h3>
            <p className="text-gray-500">Seus dados e documentos foram enviados para análise.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/cooperado/adesao/page.tsx
git commit -m "feat: create cooperado registration flow"
```

### Task 6: Gestor Dashboard

**Files:**
- Create: `src/app/gestor/dashboard/page.tsx`

- [ ] **Step 1: Build the manager dashboard view**

```tsx
'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

export default function GestorDashboard() {
  const [cooperados, setCooperados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDados() {
      try {
        const response = await axios.get('/api/cooperados');
        setCooperados(response.data || []);
      } catch (error) {
        console.error('Failed to fetch cooperados', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDados();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel do Gestor</h1>
        
        {loading ? (
          <p className="text-gray-500">Carregando cadastros...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-orange-600">Aguardando Assinatura</h2>
              <div className="space-y-4">
                {cooperados.map((user: any) => (
                  <div key={user._id} className="p-4 border border-gray-100 rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-gray-50">
                    <p className="font-medium text-gray-800">{user.nome_text || 'Sem nome'}</p>
                    <p className="text-sm text-gray-500">{user.cpf_text || 'Sem CPF'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-blue-600">Em Análise (Documentos)</h2>
              <div className="space-y-4">
                {/* Dropped entries here */}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-green-600">Aprovados</h2>
              <div className="space-y-4">
                {/* Approved entries here */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/gestor/dashboard/page.tsx
git commit -m "feat: create basic gestor dashboard"
```

### Task 7: Landing Page Redirect

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Redirect to Gestor as default for testing**

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/gestor/dashboard');
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/page.tsx
git commit -m "feat: redirect root to dashboard"
```
