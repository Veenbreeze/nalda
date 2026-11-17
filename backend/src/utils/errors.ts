export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  static conflict(message = 'Resource already exists', details?: unknown) {
    return new ApiError(409, message, 'CONFLICT', details);
  }
  static validation(message = 'Validation failed', details?: unknown) {
    return new ApiError(422, message, 'VALIDATION_ERROR', details);
  }
  static tooMany(message = 'Too many requests') {
    return new ApiError(429, message, 'TOO_MANY_REQUESTS');
  }
  static internal(message = 'Internal server error') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
  static serviceUnavailable(message = 'Service unavailable') {
    return new ApiError(503, message, 'SERVICE_UNAVAILABLE');
  }
}
