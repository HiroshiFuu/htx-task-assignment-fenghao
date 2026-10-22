import { BadRequestException, ValidationError } from '@nestjs/common';
import { FieldError } from './problem-details';

export class ValidationProblemException extends BadRequestException {
  constructor(readonly errors: FieldError[]) {
    super('Request validation failed.');
  }
}

/** Flattens class-validator's nested error tree into dotted field paths. */
export function toFieldErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): ValidationProblemException {
  return new ValidationProblemException(toFieldErrors(errors));
}
