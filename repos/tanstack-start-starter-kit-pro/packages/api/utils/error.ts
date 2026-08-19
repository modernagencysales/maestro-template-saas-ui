export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
