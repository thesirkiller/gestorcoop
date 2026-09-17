import { NextResponse } from 'next/server';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({ success: false, error: 'Use a integração por token em /api/auth/embed.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
