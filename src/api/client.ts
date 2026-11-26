import axios, { AxiosError } from "axios";
import type { ApiErrorPayload } from "@/contracts/marketplace";

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorPayload["code"];
  public readonly details?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: ApiErrorPayload["code"] = "TRANSIENT_ERROR",
    details?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorizedCallback = cb;
}

export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<ApiErrorPayload>;
      const status = axiosErr.response?.status ?? 0;
      const payload = axiosErr.response?.data;

      if (status === 401 && onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }

      if (payload && payload.message) {
        return Promise.reject(
          new ApiClientError(
            payload.message,
            status,
            payload.code,
            payload.details,
          ),
        );
      }

      if (axiosErr.code === "ECONNABORTED" || status === 504) {
        return Promise.reject(
          new ApiClientError(
            "A operação demorou mais que o esperado. Tente novamente.",
            status || 504,
            "TRANSIENT_ERROR",
          ),
        );
      }

      if (!axiosErr.response) {
        return Promise.reject(
          new ApiClientError(
            "Falha de conexão com o serviço. Verifique sua rede e tente novamente.",
            0,
            "TRANSIENT_ERROR",
          ),
        );
      }

      return Promise.reject(
        new ApiClientError(
          `Erro na requisição (${status}).`,
          status,
          status >= 500 ? "TRANSIENT_ERROR" : "VALIDATION_ERROR",
        ),
      );
    }

    return Promise.reject(
      new ApiClientError(
        "Erro inesperado na comunicação.",
        500,
        "TRANSIENT_ERROR",
      ),
    );
  },
);
