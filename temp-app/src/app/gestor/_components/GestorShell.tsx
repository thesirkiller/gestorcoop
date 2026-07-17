'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import axios from 'axios';
import {
  Users,
  DollarSign,
  FileText,
  Boxes,
  Wrench,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  LogOut,
  ChevronDown,
  LayoutGrid,
} from 'lucide-react';

// Navegação única do painel do gestor. O fluxo do cooperado (adesão) fica
// fora de propósito: é público, sem autenticação, e não usa este shell.
const NAV_ITEMS = [
  { href: '/gestor/dashboard', label: 'Adesões', icon: Users },
  { href: '/gestor/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/gestor/termos', label: 'Termos', icon: FileText },
  { href: '/gestor/equipamentos', label: 'Equipamentos', icon: Boxes },
  { href: '/gestor/manutencao', label: 'Manutenção', icon: Wrench },
  { href: '/gestor/equipamentos-relatorios', label: 'Relatórios', icon: BarChart3 },
];

const SIDEBAR_COLLAPSED_KEY = 'gc_sidebar_collapsed';

interface Me {
  nome: string;
  email: string;
  foto: string | null;
}

export default function GestorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {}
    axios
      .get('/api/gestor/me')
      .then((res) => setMe(res.data))
      .catch(() => setMe({ nome: 'Gestor', email: '', foto: null }));
  }, []);

  // Fecha o drawer mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Fecha o menu do usuário ao clicar fora
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, prev ? '0' : '1');
      } catch {}
      return !prev;
    });
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } finally {
      window.location.href = '/login';
    }
  };

  const activeItem = NAV_ITEMS.find((item) => pathname?.startsWith(item.href));

  const initials = (me?.nome || 'G')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const sidebarContent = (
    <>
      {/* Marca */}
      <div className={`h-16 flex items-center border-b border-slate-100 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5 gap-3'}`}>
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <p className="font-extrabold text-slate-900 leading-tight">GestorCoop</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Painel do Gestor</p>
          </div>
        )}
      </div>

      {/* Itens */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg text-sm font-semibold transition-all duration-200 ${collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5'} ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-450'}`} />
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${collapsed ? 'w-0 opacity-0 hidden' : 'opacity-100'}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Toggle colapsar (desktop) */}
      <div className="border-t border-slate-100 p-3 hidden md:block">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`w-full flex items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm font-semibold transition-all ${collapsed ? 'justify-center py-3' : 'gap-3 px-4 py-2.5'}`}
        >
          {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5 shrink-0" />}
          {!collapsed && <span>Recolher menu</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Sidebar desktop */}
      <aside
        className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-[width] duration-300 ease-in-out ${collapsed ? 'w-[76px]' : 'w-64'}`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar mobile (drawer) */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-slate-900/40 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      >
        <aside
          className={`flex flex-col absolute inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="absolute top-4 right-3 text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
          {sidebarContent}
        </aside>
      </div>

      {/* Área principal */}
      <div className={`flex flex-col min-h-screen transition-[margin] duration-300 ease-in-out ${collapsed ? 'md:ml-[76px]' : 'md:ml-64'}`}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="md:hidden text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              {activeItem?.label || 'Painel'}
            </span>
          </div>

          {/* Usuário */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-3 hover:bg-slate-50 rounded-full pl-1.5 pr-2.5 py-1.5 transition-all"
            >
              {me?.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.foto}
                  alt={me.nome}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
              )}
              <span className="hidden sm:block text-left">
                <span className="block text-sm font-bold text-slate-900 leading-tight">{me?.nome || '...'}</span>
                <span className="block text-xs text-slate-500 leading-tight max-w-[160px] truncate">{me?.email || 'Multcare'}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sair do painel
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
