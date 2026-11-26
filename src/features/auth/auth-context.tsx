import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { setOnUnauthorized } from "@/api/client";
import { getSession, logoutUser } from "@/api/marketplace";
import type { SessionData, UserProfile } from "@/contracts/marketplace";
import { socketManager } from "@/lib/socket-client";

interface AuthContextValue {
  session: SessionData;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
  });

  const session: SessionData = data ?? {
    authenticated: false,
    user: null,
    expiresAt: null,
  };

  useEffect(() => {
    setOnUnauthorized(() => {
      qc.setQueryData<SessionData>(["session"], {
        authenticated: false,
        user: null,
        expiresAt: null,
      });
      socketManager.resetSessionTracking();
      void qc.invalidateQueries({ queryKey: ["cart"] });
      void qc.invalidateQueries({ queryKey: ["favorites"] });
    });

    return () => {
      setOnUnauthorized(null);
    };
  }, [qc]);

  useEffect(() => {
    socketManager.connect({
      queryClient: qc,
      getActiveUserId: () => {
        const current = qc.getQueryData<SessionData>(["session"]);
        return current?.user?.id ?? null;
      },
    });

    return () => {
      socketManager.disconnect();
    };
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session.user,
      isAuthenticated: Boolean(session.authenticated && session.user),
      isLoading,
      refreshSession: async () => {
        await refetch();
      },
      logout: async () => {
        await logoutUser();
        socketManager.resetSessionTracking();
        qc.setQueryData<SessionData>(["session"], {
          authenticated: false,
          user: null,
          expiresAt: null,
        });
        await qc.invalidateQueries({ queryKey: ["cart"] });
        await qc.invalidateQueries({ queryKey: ["favorites"] });
        await qc.invalidateQueries({ queryKey: ["orders"] });
        await qc.invalidateQueries({ queryKey: ["wallets"] });
      },
    }),
    [isLoading, qc, refetch, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
