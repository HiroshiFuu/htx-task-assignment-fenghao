/**
 * Errors raised by services/rules. They carry an HTTP status and a stable `code`
 * so the problem+json filter can render them without the domain knowing about HTTP.
 */
export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    detail: string,
    readonly extensions: Readonly<Record<string, unknown>> = {},
  ) {
    super(detail);
    this.name = new.target.name;
  }
}

/** A request that is well-formed but violates a business rule → 422. */
export class BusinessRuleViolation extends DomainError {
  constructor(
    code: string,
    detail: string,
    extensions: Readonly<Record<string, unknown>> = {},
  ) {
    super(422, code, 'Business rule violation', detail, extensions);
  }
}

/** The change conflicts with current state and needs explicit client intent → 409. */
export class ConfirmationRequired extends DomainError {
  constructor(
    code: string,
    detail: string,
    extensions: Readonly<Record<string, unknown>> = {},
  ) {
    super(409, code, 'Confirmation required', detail, extensions);
  }
}

export class ResourceNotFound extends DomainError {
  constructor(resource: string, id: string) {
    super(404, 'NOT_FOUND', 'Not Found', `${resource} ${id} was not found.`);
  }
}
