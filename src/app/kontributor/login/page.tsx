import { redirect } from 'next/navigation';

export default function KontributorLoginPage() {
  redirect('/login?next=/kontributor/dashboard');
}
