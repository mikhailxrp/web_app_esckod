"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/Input";
import {
  registerFormSchema,
  type RegisterFormInput,
} from "@/lib/validations/auth";

const REDIRECT_DELAY_MS = 10000;
const AUTH_CARD_PATTERN = "/".repeat(60);

const FALLBACK_DEFAULTS = {
  defaultMarketingConsent: false,
  supportEmail: "support@example.com",
} as const;

interface RegistrationDefaults {
  defaultMarketingConsent: boolean;
  supportEmail: string;
}

type RegisterErrorCode =
  | "INVALID_KEY"
  | "KEY_BLOCKED"
  | "ACTIVATIONS_EXCEEDED"
  | "EMAIL_EXISTS"
  | "VALIDATION_ERROR";

interface RegisterSuccessResponse {
  success: true;
  emailSent: boolean;
  message?: string;
}

interface RegisterErrorResponse {
  success: false;
  error: RegisterErrorCode;
}

type RegisterResponse = RegisterSuccessResponse | RegisterErrorResponse;

function getServerErrorMessage(
  code: RegisterErrorCode,
  supportEmail: string,
): string {
  switch (code) {
    case "INVALID_KEY":
      return `Ключ доступа не найден. Проверьте написание или обратитесь в поддержку: ${supportEmail}`;
    case "KEY_BLOCKED":
      return `Ключ заблокирован. Обратитесь в поддержку: ${supportEmail}`;
    case "ACTIVATIONS_EXCEEDED":
      return "По этому ключу уже зарегистрировано максимальное число пользователей";
    case "EMAIL_EXISTS":
      return "Этот email уже зарегистрирован";
    case "VALIDATION_ERROR":
      return "Проверьте правильность введенных данных";
    default:
      return "Произошла ошибка. Попробуйте еще раз";
  }
}

function AuthCardHeader(): React.ReactElement {
  return (
    <header className="auth-card__header">
      <h1 className="auth-card__title">Регистрация</h1>
      <span className="auth-card__pattern" aria-hidden="true">
        {AUTH_CARD_PATTERN}
      </span>
    </header>
  );
}

export function RegisterForm(): React.ReactElement {
  const router = useRouter();
  const [defaults, setDefaults] =
    useState<RegistrationDefaults>(FALLBACK_DEFAULTS);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      accessKey: "",
      consentPolicy: false,
      consentMarketing: FALLBACK_DEFAULTS.defaultMarketingConsent,
    },
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDefaults(): Promise<void> {
      try {
        const response = await fetch("/api/settings/registration-defaults");

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as RegistrationDefaults;

        if (!isMounted) {
          return;
        }

        setDefaults(data);
        reset((currentValues) => ({
          ...currentValues,
          consentMarketing: data.defaultMarketingConsent,
        }));
      } catch (error) {
        console.error("Failed to load registration defaults:", error);
      }
    }

    void loadDefaults();

    return () => {
      isMounted = false;
    };
  }, [reset]);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.push("/login");
    }, REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSuccess, router]);

  async function onSubmit(data: RegisterFormInput): Promise<void> {
    setServerError(null);

    const payload = {
      ...data,
      consentPolicy: true as const,
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as RegisterResponse;

      if (!result.success) {
        setServerError(
          getServerErrorMessage(result.error, defaults.supportEmail),
        );
        return;
      }

      if (!result.emailSent && result.message) {
        setSuccessMessage(result.message);
      }

      setIsSuccess(true);
    } catch (error) {
      console.error("Registration failed:", error);
      setServerError("Не удалось выполнить регистрацию. Попробуйте еще раз");
    }
  }

  if (isSuccess) {
    return (
      <section aria-labelledby="register-success-title" className="auth-card">
        <AuthCardHeader />

        <div className="auth-card__body">
          <div className="flex flex-col gap-6">
            <p id="register-success-title">
              Мы отправили письмо с паролем вам на почту, используйте его для
              входа.
            </p>
            {successMessage ? (
              <p role="alert" className="form-alert form-alert--warning">
                {successMessage}
              </p>
            ) : null}
            <p className="text-content-secondary">
              Перенаправление на страницу входа через 10 секунд…
            </p>
            <Link href="/login" className="btn-primary">
              ВОЙТИ
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="register-title" className="auth-card">
      <AuthCardHeader />

      <div className="auth-card__body">
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="form-split">
            <div className="form-split__text">
              <p id="register-title">Рады приветствовать нового агента!</p>
              <p>
                Для того, чтобы приступить к расследованию, вам нужно
                зарегистрироваться и ввести ключ доступа из коробки.
              </p>
              <p>
                Пароль будет автоматически направлен на почту, указанную при
                регистрации.
              </p>
            </div>

            <div className="form-split__fields">
              <Input
                label="Имя пользователя"
                type="text"
                maxLength={15}
                autoComplete="username"
                error={errors.name?.message}
                {...register("name")}
              />

              <Input
                label="Почта"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />

              <Input
                label="Ключ"
                type="text"
                autoComplete="off"
                error={errors.accessKey?.message}
                {...register("accessKey")}
              />

              <label className="form-field__checkbox-label">
                <input
                  type="checkbox"
                  className="form-field__checkbox"
                  {...register("consentPolicy")}
                />
                <span>
                  Я согласен(-на) на обработку персональных данных (
                  <Link
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-hover"
                  >
                    политика конфиденциальности
                  </Link>
                  )
                </span>
              </label>
              {errors.consentPolicy?.message ? (
                <p className="form-field__error">
                  {errors.consentPolicy.message}
                </p>
              ) : null}

              <label className="form-field__checkbox-label">
                <input
                  type="checkbox"
                  className="form-field__checkbox"
                  {...register("consentMarketing")}
                />
                <span>Я согласен(-на) получать информационную рассылку</span>
              </label>

              {serverError ? (
                <p role="alert" className="form-alert form-alert--error">
                  {serverError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? "ОТПРАВКА…" : "ПОДТВЕРДИТЬ"}
              </button>

              <p className="text-center">
                <Link href="/login" className="form-link">
                  Войти
                </Link>
              </p>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
