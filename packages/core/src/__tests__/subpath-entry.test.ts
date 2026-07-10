import { describe, expect, it } from 'vitest';
import * as barrel from '../index';
import { createScrollContainer } from '../scroll-container';

/**
 * B-02 — three 분리 subpath 경계 테스트.
 * 배럴(`.`)은 three 무참조(값은 non-three 만), ScrollContainer 값은
 * `@guksu/wvkit-core/scroll-container` subpath 엔트리로만 노출된다.
 */
describe('subpath entry — scroll-container', () => {
  // TC-B02-1
  it('TC-B02-1: subpath entry exports createScrollContainer as a function', () => {
    expect(typeof createScrollContainer).toBe('function');
  });

  // TC-B02-2
  it('TC-B02-2: barrel has no createScrollContainer value but keeps non-three values', () => {
    expect('createScrollContainer' in barrel).toBe(false);
    expect(typeof (barrel as Record<string, unknown>).createStableInput).toBe('function');
  });
});
