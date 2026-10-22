import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { DomainError } from '../errors/domain-error';
import {
  PROBLEM_JSON,
  ProblemDetails,
  problemTypeFor,
} from './problem-details';
import { ValidationProblemException } from './validation-problem.exception';

const GENERIC_SERVER_ERROR = 'An unexpected error occurred.';

/**
 * Renders every error as RFC 7807 problem+json. Only curated text reaches the client:
 * no stack traces, SQL, file paths or library messages.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = this.toProblem(exception);
    problem.instance = request.path;

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method} ${request.path} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(problem.status).type(PROBLEM_JSON).json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof DomainError) {
      return {
        ...exception.extensions,
        type: problemTypeFor(exception.code),
        title: exception.title,
        status: exception.status,
        detail: exception.message,
        code: exception.code,
      };
    }

    if (exception instanceof ValidationProblemException) {
      return {
        type: problemTypeFor('VALIDATION_FAILED'),
        title: 'Validation failed',
        status: HttpStatus.BAD_REQUEST,
        detail: exception.message,
        code: 'VALIDATION_FAILED',
        errors: exception.errors,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return this.basicProblem(
        status,
        status >= 500 ? GENERIC_SERVER_ERROR : this.httpDetail(exception),
      );
    }

    return this.basicProblem(
      HttpStatus.INTERNAL_SERVER_ERROR,
      GENERIC_SERVER_ERROR,
    );
  }

  private basicProblem(status: number, detail: string): ProblemDetails {
    return {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      detail,
    };
  }

  /** Nest's built-in HttpExceptions carry developer-written messages only. */
  private httpDetail(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((m) => typeof m === 'string').join('; ');
    }
    return exception.message;
  }
}
