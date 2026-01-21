/**
 * Example test for @recursivemanager/adapters package
 * This test verifies that the Jest configuration is working correctly.
 */

describe('adapters package', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(['item1', 'item2']);
    expect(result).toHaveLength(2);
  });

  it('should work with TypeScript types', () => {
    type TestType = 'type1' | 'type2' | 'type3';
    const testValue: TestType = 'type1';
    expect(['type1', 'type2', 'type3']).toContain(testValue);
  });
});
