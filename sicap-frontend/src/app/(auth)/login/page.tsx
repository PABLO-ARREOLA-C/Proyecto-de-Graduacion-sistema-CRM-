"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Droplets,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Ingresa tu correo electrónico")
    .email("Correo electrónico inválido"),

  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (!result || result.error) {
      setError(
        "El correo electrónico o la contraseña son incorrectos.",
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Panel institucional */}
      <section className="relative hidden overflow-hidden bg-[#0D47A1] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-24 h-112 w-112 rounded-full bg-[#1976D2]/50" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Droplets className="h-7 w-7" />
            </div>

            <div>
              <p className="text-lg font-bold">
                Purificadora
              </p>

              <p className="text-2xl font-bold">
                Rehobot
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            Gestión eficiente para un mejor servicio.
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-blue-100">
            Plataforma para la administración de clientes,
            pedidos, rutas, CRM y finanzas.
          </p>
        </div>

        <p className="relative z-10 text-sm text-blue-200">
          Purificadora Rehobot
        </p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
              <Droplets className="h-6 w-6" />
            </div>

            <div>
              <p className="font-bold">
                Purificadora Rehobot
              </p>
              <p className="text-xs text-muted-foreground">
                Sistema de gestión
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <h2 className="text-3xl font-bold tracking-tight">
                Iniciar sesión
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Ingresa tus credenciales para acceder al sistema.
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email">
                  Correo electrónico
                </Label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@rehobot.com"
                    className="h-11 pl-10"
                    {...register("email")}
                  />
                </div>

                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Contraseña
                </Label>

                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 px-10"
                    {...register("password")}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full"
              >
                {isSubmitting
                  ? "Ingresando..."
                  : "Ingresar al sistema"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acceso exclusivo para usuarios autorizados.
          </p>
        </div>
      </section>
    </main>
  );
}