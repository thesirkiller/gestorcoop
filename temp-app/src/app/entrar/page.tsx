'use client';
import { useEffect, useRef, useState } from 'react';
export default function EntradaEmbed() {
  const started = useRef(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ticket = new URLSearchParams(location.hash.slice(1)).get('ticket');
    history.replaceState(null, '', location.pathname);
    if (!ticket) { setErro('Abra o prontuário pelo Bubble para validar seu acesso.'); return; }
    fetch('/api/auth/embed/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); location.replace(data.area === 'cooperado' ? `/cooperado#s=${encodeURIComponent(data.token)}` : '/gestor/prontuarios'); })
      .catch(err => setErro(err.message || 'Não foi possível validar o acesso. Abra novamente pelo Bubble.'));
  }, []);
  return <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6"><p role={erro ? 'alert' : 'status'} className="max-w-md text-center">{erro || 'Validando seu acesso ao prontuário…'}</p></main>;
}
