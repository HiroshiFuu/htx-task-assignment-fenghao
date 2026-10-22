import { HttpException } from '@nestjs/common';
import type { ErrorRequestHandler } from 'express';

/** body-parser client errors carry a 4xx `status`, a `type` and `expose: true`. */
interface BodyParserError {
  status: number;
  type: string;
  expose: true;
}

function isBodyParserClientError(error: unknown): error is BodyParserError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as Partial<BodyParserError>;
  return (
    candidate.expose === true &&
    typeof candidate.type === 'string' &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500
  );
}

const DETAIL_BY_TYPE: Readonly<Record<string, string>> = {
  'entity.too.large': 'Request body is too large.',
  'encoding.unsupported': 'Unsupported content encoding.',
  'charset.unsupported': 'Unsupported charset.',
};

/**
 * Express error middleware placed right after the JSON parser. Nest would otherwise
 * turn parser errors into exceptions carrying the raw parser message (e.g. JSON
 * syntax details) or into 500s, so they are replaced with curated text here.
 */
export const translateBodyParserErrors: ErrorRequestHandler = (
  error: unknown,
  _request,
  _response,
  next,
) => {
  if (!isBodyParserClientError(error)) {
    next(error);
    return;
  }
  const detail =
    DETAIL_BY_TYPE[error.type] ?? 'Request body could not be parsed.';
  next(new HttpException(detail, error.status));
};
