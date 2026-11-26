import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { loginUser } from "@/api/marketplace";

const loginSearchSchema = z.object({
  redirect: z.string().optional().default("/"),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("lucas@kurio.dev");
  const [password, setPassword] = useState("Senha@123");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: async (sessionData) => {
      queryClient.setQueryData(["session"], sessionData);
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["quote"] });
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      const target = redirect.startsWith("/") ? redirect : "/";
      void navigate({
        to: target as "/",
        search: {
          category: "all",
          edition: "all",
          sort: "featured",
          page: 1,
        },
      });
    },
    onError: (err: unknown) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Não foi possível entrar.",
      );
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    loginMutation.mutate({ email, password });
  }

  return (
    <div className="mx-auto max-w-[440px] px-4 py-12 sm:py-16">
      <div className="rounded-3xl border border-[#332415] bg-[#1b130b] p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#e0a83e]">Acesso Kurio</p>
          <h1 className="text-2xl font-bold uppercase text-[#f7f3eb]">
            Entrar na conta
          </h1>
          <p className="text-xs text-[#b5a794]">
            Conta demo pronta:{" "}
            <span className="text-[#f7f3eb]">lucas@kurio.dev</span> /{" "}
            <span className="text-[#f7f3eb]">Senha@123</span>
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="block text-xs text-[#b5a794]"
            >
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs text-[#b5a794]"
            >
              Senha
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-full bg-[#e0a83e] px-6 py-3 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] disabled:opacity-50 cursor-pointer"
          >
            {loginMutation.isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-[#b5a794]">
          Ainda não tem conta?{" "}
          <Link
            to="/register"
            search={{ redirect }}
            className="font-semibold text-[#e0a83e] hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
