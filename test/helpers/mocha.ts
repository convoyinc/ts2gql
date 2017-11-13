/**
 * Calls `callback` once Mocha has loaded its environment.
 *
 * See https://github.com/mochajs/mocha/issues/764
 */
export function withMocha(callback: () => void): void {
  if ('beforeEach' in global) {
    callback();
    return;
  }

  setImmediate(() => {
    withMocha(callback);
  });
}
