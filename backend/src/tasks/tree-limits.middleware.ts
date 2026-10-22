import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ValidationProblemException } from '../common/problem-details/validation-problem.exception';
import { checkTreeLimits } from './tree-limits';

/**
 * Runs on the parsed JSON before ValidationPipe, whose class-transformer step is
 * recursive: rejecting oversized trees here keeps that recursion bounded.
 */
@Injectable()
export class TreeLimitsMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const violation = checkTreeLimits(request.body);
    if (violation) {
      throw new ValidationProblemException([
        { field: violation.field, messages: [violation.message] },
      ]);
    }
    next();
  }
}
