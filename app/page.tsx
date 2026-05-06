import { currentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await currentUser();
  redirect(user.role === 'manager' ? '/manager/readings' : '/gauges');
}
