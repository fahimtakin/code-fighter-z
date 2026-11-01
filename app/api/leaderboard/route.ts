import { NextResponse } from 'next/server';
import { route } from '@/lib/http';
import { getLeaderboard } from '@/lib/users';

export const GET = route(async () => NextResponse.json(await getLeaderboard()));
