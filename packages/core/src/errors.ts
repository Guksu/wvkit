export class WebviewHeadlessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebviewHeadlessError';
  }
}
