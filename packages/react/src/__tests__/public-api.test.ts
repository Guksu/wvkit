import { describe, expect, it } from 'vitest';
import { WebviewHeadlessError } from '../index';

describe('public api — WebviewHeadlessError', () => {
  // TC-8
  it('re-exports WebviewHeadlessError', () => {
    expect(typeof WebviewHeadlessError).toBe('function');
    expect(new WebviewHeadlessError('boom')).toBeInstanceOf(Error);
  });
});
