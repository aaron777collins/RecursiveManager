/**
 * Example test for @recursivemanager/common package
 * This test verifies that the Jest configuration is working correctly.
 */

describe('common package', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should work with TypeScript types', () => {
    const testValue: string = 'test';
    expect(typeof testValue).toBe('string');
    expect(testValue).toHaveLength(4);
  });
});
