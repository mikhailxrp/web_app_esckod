import { LoginForm } from '@/components/auth/LoginForm';

const BLOCKED_MESSAGE = 'Вас заблокировал администратор';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}): Promise<React.ReactElement> {
  const { reason } = await searchParams;
  const initialError = reason === 'blocked' ? BLOCKED_MESSAGE : undefined;

  return <LoginForm initialError={initialError} />;
}
