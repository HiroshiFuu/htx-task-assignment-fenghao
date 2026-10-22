import { HttpException, HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Generous for every DTO here (a 5-level task tree is about 11 levels of JSON),
 * yet far below what class-transformer's recursion can survive.
 */
export const MAX_JSON_DEPTH = 32;

/** Iterative, and stops as soon as the limit is passed, so the work stays bounded. */
export function exceedsJsonDepth(value: unknown, maxDepth: number): boolean {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];
  while (stack.length > 0) {
    const current = stack.pop() as { value: unknown; depth: number };
    if (typeof current.value !== 'object' || current.value === null) {
      continue;
    }
    if (current.depth > maxDepth) {
      return true;
    }
    for (const child of Object.values(current.value)) {
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }
  return false;
}

/**
 * Express middleware placed after the JSON parser and before any Nest pipe:
 * ValidationPipe's class-transformer step recurses into every value (unknown
 * fields included), so an over-deep body would otherwise overflow the stack (500).
 */
export function rejectDeepJson(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (exceedsJsonDepth(request.body, MAX_JSON_DEPTH)) {
    next(
      new HttpException(
        'Request body is nested too deeply.',
        HttpStatus.BAD_REQUEST,
      ),
    );
    return;
  }
  next();
}
