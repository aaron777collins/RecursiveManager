/**
 * Example test for @recursive-manager/core package
 * This test verifies that the Jest configuration is working correctly.
 */

describe('core package', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should work with TypeScript types', () => {
    const testValue: number = 123;
    expect(typeof testValue).toBe('number');
    expect(testValue).toBe(123);
  });
});
