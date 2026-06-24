import { Resend } from 'resend';

const globalForResend = globalThis as unknown as {
  resend: Resend | undefined;
};

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!globalForResend.resend) {
    globalForResend.resend = new Resend(apiKey);
  }

  return globalForResend.resend;
}

function getFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }

  return fromEmail;
}

export async function sendPasswordEmail(
  to: string,
  password: string,
): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: 'Код доступа: корпорация — ваш пароль',
    html: `
      <p>Здравствуйте!</p>
      <p>Вы успешно зарегистрировались в системе «Код доступа: корпорация».</p>
      <p>Ваш пароль: <strong>${password}</strong></p>
      <p>Используйте его для входа на сайт. Рекомендуем сохранить пароль в надежном месте.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  password: string,
): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: 'Код доступа: корпорация — новый пароль',
    html: `
      <p>Здравствуйте!</p>
      <p>Вы запросили восстановление пароля.</p>
      <p>Ваш новый пароль: <strong>${password}</strong></p>
      <p>Используйте его для входа на сайт.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendAdminPasswordResetEmail(
  to: string,
  password: string,
): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: 'Код доступа: корпорация — новый пароль администратора',
    html: `
      <p>Здравствуйте!</p>
      <p>Вы запросили восстановление пароля администратора.</p>
      <p>Ваш новый пароль: <strong>${password}</strong></p>
      <p>Рекомендуем сохранить пароль в надежном месте.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
