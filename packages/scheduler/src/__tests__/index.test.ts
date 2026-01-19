/**
 * Example test for @recursive-manager/scheduler package
 * This test verifies that the Jest configuration is working correctly.
 */

describe('scheduler package', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve({ status: 'ok' });
    expect(result.status).toBe('ok');
  });

  it('should work with TypeScript types', () => {
    interface TestInterface {
      id: number;
      name: string;
    }
    const testObj: TestInterface = { id: 1, name: 'test' };
    expect(testObj).toHaveProperty('id');
    expect(testObj).toHaveProperty('name');
  });
});
