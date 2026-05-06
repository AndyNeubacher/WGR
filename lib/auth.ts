import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

export type User = {
  id: string;
  name: string;
  role: 'technician' | 'manager';
};

// Auth.js v5 session reader. Every server action and route handler should call this — never inline an id.
// Redirects to login if no session.
export async function currentUser(): Promise<User> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return {
    id: session.user.id,
    name: session.user.name ?? '',
    role: session.user.role,
  };
}

// Role guard for SERVER COMPONENTS — redirects to the appropriate role's home on mismatch.
// Middleware should already block role-mismatched URLs; this is defense-in-depth.
export async function requireRole(role: 'manager' | 'technician'): Promise<User> {
  const user = await currentUser();
  if (user.role !== role) {
    redirect(role === 'manager' ? '/gauges' : '/manager/readings');
  }
  return user;
}

// Role guard for API ROUTES — returns either the user or a 403 NextResponse.
// Caller must check `'role' in result` to discriminate.
export async function requireRoleApi(
  role: 'manager' | 'technician',
): Promise<User | NextResponse> {
  const user = await currentUser();
  if (user.role !== role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

export function isApiResponse(value: User | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
