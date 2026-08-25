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
  Archive,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  LogOut,
  ChevronDown,
  LayoutGrid,
  Stethoscope,
  ShieldAlert,
  Truck,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Clínico & Pacientes',
    items: [
      { href: '/gestor/prontuarios', label: 'Prontuários', icon: Stethoscope, badge: '360°' },
      { href: '/gestor/prontuarios/auditoria', label: 'Auditoria Clínica', icon: ShieldAlert },
    ],
  },
  {
    title: 'Cooperados',
    items: [
      { href: '/gestor/dashboard', label: 'Adesões', icon: Users },
      { href: '/gestor/termos', label: 'Termos', icon: FileText },
    ],
  },
  {
    title: 'Equipamentos',
    items: [
      { href: '/gestor/equipamentos', label: 'Equipamentos', icon: Boxes },
      { href: '/gestor/equipamentos/romaneio', label: 'Romaneios', icon: Truck },
      { href: '/gestor/manutencao', label: 'Manutenção', icon: Wrench },
      { href: '/gestor/baixas', label: 'Baixas', icon: Archive },
      { href: '/gestor/equipamentos-relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { href: '/gestor/financeiro', label: 'Financeiro', icon: DollarSign },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

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

  // Encontra item ativo (com match exato ou mais longo primeiro para evitar overlap entre /prontuarios e /prontuarios/auditoria)
  const activeItem = [...ALL_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname?.startsWith(item.href + '/'));

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

      {/* Itens Organizados por Categoria */}
      <nav className="flex-1 py-3 px-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.title} className="flex flex-col gap-1">
            {!collapsed ? (
              <div className="px-3 pt-1 pb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {section.title}
                </span>
              </div>
            ) : sIdx > 0 ? (
              <div className="border-t border-slate-100 my-1 mx-2" />
            ) : null}

            {section.items.map((item) => {
              const Icon = item.icon;
              const isItemActive =
                pathname === item.href ||
                (pathname?.startsWith(item.href + '/') &&
                  (!activeItem || activeItem.href === item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ${
                    collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2'
                  } ${
                    isItemActive
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isItemActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {!collapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Toggle colapsar (desktop) */}
      <div className="border-t border-slate-100 p-3 hidden md:block">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`w-full flex items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm font-semibold transition-all ${collapsed ? 'justify-center py-2.5' : 'gap-3 px-3.5 py-2'}`}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4 shrink-0" />}
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-700 tracking-tight">
                {activeItem?.label || 'Painel'}
              </span>
            </div>
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
