/**
 * Example test for @recursive-manager/cli package
 * This test verifies that the Jest configuration is working correctly.
 */

describe('cli package', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  it('should work with TypeScript types', () => {
    const testArray: number[] = [1, 2, 3];
    expect(Array.isArray(testArray)).toBe(true);
    expect(testArray).toHaveLength(3);
  });
});
