export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface SuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
  meta?: ResponseMeta;

}

export interface ErrorResponse {
  success: false;
  error: AppError;
  meta?: ResponseMeta;
}

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
}