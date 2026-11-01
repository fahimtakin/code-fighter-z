import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Wipe out server cookie states instantly
  response.cookies.set('auth-token', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
