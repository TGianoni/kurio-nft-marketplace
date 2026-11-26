import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { registerUser } from "@/api/marketplace";

const registerSearchSchema = z.object({
  redirect: z.string().optional().default("/"),
});

export const Route = createFileRoute("/register")({
  validateSearch: (search) => registerSearchSchema.parse(search),
  component: RegisterPage,
});

function RegisterPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: async (sessionData) => {
      queryClient.setQueryData(["session"], sessionData);
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["quote"] });
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
        err instanceof Error ? err.message : "Erro ao criar conta.",
      );
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    registerMutation.mutate({ name, email, password });
  }

  return (
    <div className="mx-auto max-w-[440px] px-4 py-12 sm:py-16">
      <div className="rounded-3xl border border-[#332415] bg-[#1b130b] p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#e0a83e]">
            Novo Colecionador
          </p>
          <h1 className="text-2xl font-bold uppercase text-[#f7f3eb]">
            Criar conta
          </h1>
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
            <label htmlFor="reg-name" className="block text-xs text-[#b5a794]">
              Nome completo
            </label>
            <input
              id="reg-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs text-[#b5a794]">
              E-mail
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reg-password"
              className="block text-xs text-[#b5a794]"
            >
              Senha (mínimo 6 caracteres)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
            />
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full rounded-full bg-[#e0a83e] px-6 py-3 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] disabled:opacity-50 cursor-pointer"
          >
            {registerMutation.isPending
              ? "Criando conta..."
              : "Cadastrar e continuar"}
          </button>
        </form>

        <p className="text-center text-xs text-[#b5a794]">
          Já possui conta?{" "}
          <Link
            to="/login"
            search={{ redirect }}
            className="font-semibold text-[#e0a83e] hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
