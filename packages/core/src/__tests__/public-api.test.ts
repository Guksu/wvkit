import { describe, expect, it } from 'vitest';
import { WebviewHeadlessError, createPullToRefresh } from '../index';

describe('public api — WebviewHeadlessError', () => {
  // TC-5
  it('exports WebviewHeadlessError as a value', () => {
    expect(typeof WebviewHeadlessError).toBe('function');
  });

  // TC-6
  it('instance carries name and message', () => {
    const err = new WebviewHeadlessError('boom');
    expect(err).toBeInstanceOf(WebviewHeadlessError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('WebviewHeadlessError');
    expect(err.message).toBe('boom');
  });

  // TC-7
  it('factory throw is catchable via instanceof', () => {
    const el = document.createElement('div');
    expect(() =>
      createPullToRefresh(el, { onRefresh: () => {}, threshold: 0 }),
    ).toThrowError(WebviewHeadlessError);
  });
});
