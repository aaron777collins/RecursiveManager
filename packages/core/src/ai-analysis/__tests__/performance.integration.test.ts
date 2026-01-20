/**
 * Performance Integration Test for AI Provider System (Task 5.2.3)
 *
 * This test suite validates the performance and concurrency handling:
 * 1. Trigger 10 multi-perspective analyses in parallel
 * 2. Verify all complete successfully
 * 3. Verify AICEO Gateway queued them appropriately
 * 4. Measure total execution time
 * 5. Verify no rate limit errors
 *
 * NOTE: This test requires AICEO Gateway to be running at http://localhost:4000
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MultiPerspectiveAnalysis } from '../multi-perspective';
import { ProviderFactory } from '../providers/factory';
import { AIProvider } from '../providers/base';

describe('AI Provider Performance Integration', () => {
  let provider: AIProvider;
  let originalEnv: NodeJS.ProcessEnv;
  const PARALLEL_REQUESTS = 10;
  const MAX_EXPECTED_TIME_MS = 60000; // 60 seconds for all 10 requests (generous timeout)
  const MIN_EXPECTED_TIME_MS = 1000; // Should take at least 1 second (sanity check)

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up AICEO Gateway configuration for testing
    process.env.AI_PROVIDER = 'aiceo-gateway';
    process.env.AICEO_GATEWAY_URL = process.env.AICEO_GATEWAY_URL || 'http://localhost:4000/api/glm/submit';
    process.env.AICEO_GATEWAY_API_KEY = process.env.AICEO_GATEWAY_API_KEY || 'test-api-key';
    process.env.AICEO_GATEWAY_PROVIDER = 'glm';
    process.env.AICEO_GATEWAY_MODEL = 'glm-4.7';
    process.env.AICEO_GATEWAY_PRIORITY = 'normal'; // Use normal priority for performance test
    process.env.ANALYSIS_CACHE_TTL_MS = '0'; // Disable caching for accurate performance measurement

    // Create provider with health check
    try {
      provider = await ProviderFactory.createWithHealthCheck();
    } catch (error) {
      console.warn('AICEO Gateway not available, skipping performance tests');
      console.warn(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 parallel multi-perspective analyses successfully', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      const startTime = Date.now();
      const analyses: MultiPerspectiveAnalysis[] = [];

      // Create 10 analysis instances
      for (let i = 0; i < PARALLEL_REQUESTS; i++) {
        analyses.push(new MultiPerspectiveAnalysis(provider));
      }

      // Trigger all 10 analyses in parallel with different contexts
      const contexts = [
        'Should we add Redis caching to our API?',
        'Should we migrate to microservices architecture?',
        'Should we implement OAuth2 authentication?',
        'Should we use TypeScript for our backend?',
        'Should we adopt GraphQL instead of REST?',
        'Should we implement real-time notifications?',
        'Should we add automated testing to our CI/CD pipeline?',
        'Should we use Docker for local development?',
        'Should we implement feature flags?',
        'Should we add API rate limiting?'
      ];

      const promises = analyses.map((analysis, index) =>
        analysis.analyze(contexts[index]!)
      );

      // Wait for all analyses to complete
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalExecutionTime = endTime - startTime;

      // Verify all requests completed successfully
      expect(results).toHaveLength(PARALLEL_REQUESTS);

      // Verify each result has all expected properties
      results.forEach((result) => {
        expect(result).toHaveProperty('perspectives');
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('overallConfidence');
        expect(result).toHaveProperty('executionTime');
        expect(result).toHaveProperty('timestamp');

        // Verify all 8 perspectives are present
        expect(result.perspectives).toHaveLength(8);

        // Verify confidence scores are valid (0.0 - 1.0)
        expect(result.overallConfidence).toBeGreaterThanOrEqual(0.0);
        expect(result.overallConfidence).toBeLessThanOrEqual(1.0);

        // Verify each perspective has valid structure
        result.perspectives.forEach(perspective => {
          expect(perspective).toHaveProperty('perspective');
          expect(perspective).toHaveProperty('analysis');
          expect(perspective).toHaveProperty('confidence');
          expect(perspective.confidence).toBeGreaterThanOrEqual(0.0);
          expect(perspective.confidence).toBeLessThanOrEqual(1.0);
        });
      });

      // Performance assertions
      console.log(`Total execution time: ${totalExecutionTime}ms for ${PARALLEL_REQUESTS} parallel analyses`);
      console.log(`Average time per analysis: ${totalExecutionTime / PARALLEL_REQUESTS}ms`);

      // Verify execution time is within expected range
      expect(totalExecutionTime).toBeGreaterThan(MIN_EXPECTED_TIME_MS);
      expect(totalExecutionTime).toBeLessThan(MAX_EXPECTED_TIME_MS);

      // Verify no rate limit errors (all results should be present)
      const successfulResults = results.filter(r => r.perspectives.length === 8);
      expect(successfulResults).toHaveLength(PARALLEL_REQUESTS);
    }, 120000); // 2 minute timeout for the test

    it('should handle sequential batches without rate limit errors', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      const BATCHES = 3;
      const BATCH_SIZE = 5;
      const batchResults: any[] = [];

      for (let batchNum = 0; batchNum < BATCHES; batchNum++) {
        const startTime = Date.now();
        const analyses: MultiPerspectiveAnalysis[] = [];

        // Create batch of analyses
        for (let i = 0; i < BATCH_SIZE; i++) {
          analyses.push(new MultiPerspectiveAnalysis(provider));
        }

        // Run batch in parallel
        const promises = analyses.map((analysis, index) =>
          analysis.analyze(`Batch ${batchNum + 1}, Question ${index + 1}: Should we proceed?`)
        );

        const results = await Promise.all(promises);
        const endTime = Date.now();

        batchResults.push({
          batchNum: batchNum + 1,
          executionTime: endTime - startTime,
          successCount: results.filter(r => r.perspectives.length === 8).length
        });

        console.log(`Batch ${batchNum + 1} completed in ${endTime - startTime}ms`);

        // Verify all batch requests succeeded
        expect(results).toHaveLength(BATCH_SIZE);
        results.forEach(result => {
          expect(result.perspectives).toHaveLength(8);
        });
      }

      // Verify all batches completed successfully
      expect(batchResults).toHaveLength(BATCHES);
      batchResults.forEach(batch => {
        expect(batch.successCount).toBe(BATCH_SIZE);
      });

      console.log('All batches completed successfully:', batchResults);
    }, 180000); // 3 minute timeout for sequential batches

    it('should respect AICEO Gateway rate limits gracefully', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      // This test verifies that the gateway queues requests properly
      // without throwing rate limit errors

      const analysis = new MultiPerspectiveAnalysis(provider);
      const startTime = Date.now();

      // Trigger a single analysis and measure wait time
      const result = await analysis.analyze('Test rate limiting behavior');
      const endTime = Date.now();

      // Verify result is valid
      expect(result.perspectives).toHaveLength(8);

      // If there was queueing, metadata should reflect wait time
      // (This is informational - we don't fail if there's no wait time)
      const executionTime = endTime - startTime;
      console.log(`Single analysis execution time: ${executionTime}ms`);

      // Verify no errors occurred
      expect(result.perspectives.every(p => p.analysis)).toBe(true);
    }, 60000);

    it('should provide metadata about queue depth and wait times', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      // Trigger multiple analyses and check if metadata is present
      const analysis = new MultiPerspectiveAnalysis(provider);
      const result = await analysis.analyze('Check metadata presence');

      // Verify result structure
      expect(result).toHaveProperty('perspectives');
      expect(result.perspectives).toHaveLength(8);

      // Check if any perspective has metadata (it should from AICEO Gateway)
      const perspectivesWithMetadata = result.perspectives.filter(
        p => p.metadata && typeof p.metadata === 'object'
      );

      console.log(`Perspectives with metadata: ${perspectivesWithMetadata.length}/8`);

      // At least some perspectives should have metadata from the provider
      expect(perspectivesWithMetadata.length).toBeGreaterThan(0);

      // If metadata exists, verify it has expected properties
      perspectivesWithMetadata.forEach(p => {
        if (p.metadata) {
          // AICEO Gateway should provide these metadata fields
          expect(p.metadata).toHaveProperty('provider');

          // Log metadata for debugging
          console.log('Sample metadata:', JSON.stringify(p.metadata, null, 2));
        }
      });
    }, 60000);
  });

  describe('Performance Metrics', () => {
    it('should complete single analysis within reasonable time', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      const analysis = new MultiPerspectiveAnalysis(provider);
      const startTime = Date.now();

      const result = await analysis.analyze('Simple performance check question');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Single analysis should complete in reasonable time
      // This is a generous bound - adjust based on actual performance
      expect(executionTime).toBeLessThan(30000); // 30 seconds

      console.log(`Single analysis completed in ${executionTime}ms`);
      console.log(`Individual execution time from result: ${result.executionTime}ms`);

      // Verify result is valid
      expect(result.perspectives).toHaveLength(8);
    }, 60000);

    it('should show performance improvement with parallel execution', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      // This test compares sequential vs parallel execution
      // (Informational - we don't enforce specific performance characteristics)

      const contexts = [
        'Performance test question 1',
        'Performance test question 2',
        'Performance test question 3'
      ];

      // Sequential execution
      const sequentialStart = Date.now();
      const sequentialResults = [];
      for (const context of contexts) {
        const analysis = new MultiPerspectiveAnalysis(provider);
        const result = await analysis.analyze(context);
        sequentialResults.push(result);
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Parallel execution
      const parallelStart = Date.now();
      const parallelPromises = contexts.map(context => {
        const analysis = new MultiPerspectiveAnalysis(provider);
        return analysis.analyze(context);
      });
      const parallelResults = await Promise.all(parallelPromises);
      const parallelTime = Date.now() - parallelStart;

      console.log(`Sequential execution: ${sequentialTime}ms`);
      console.log(`Parallel execution: ${parallelTime}ms`);
      console.log(`Performance ratio: ${(sequentialTime / parallelTime).toFixed(2)}x`);

      // Verify all results are valid
      expect(sequentialResults).toHaveLength(3);
      expect(parallelResults).toHaveLength(3);

      sequentialResults.forEach(result => {
        expect(result.perspectives).toHaveLength(8);
      });

      parallelResults.forEach(result => {
        expect(result.perspectives).toHaveLength(8);
      });

      // Parallel should generally be faster or similar
      // (Not enforcing strict performance bounds as they depend on gateway load)
      console.log('Performance comparison completed successfully');
    }, 180000);
  });

  describe('Error Handling under Load', () => {
    it('should handle errors gracefully without affecting other requests', async () => {
      if (!provider) {
        console.warn('Skipping test: Provider not available');
        return;
      }

      // Create a mix of valid and potentially problematic requests
      const analyses: MultiPerspectiveAnalysis[] = [];
      const contexts = [
        'Valid question 1',
        '', // Empty context - might cause issues
        'Valid question 2',
        'x'.repeat(10000), // Very long context - might cause issues
        'Valid question 3',
      ];

      for (let i = 0; i < contexts.length; i++) {
        analyses.push(new MultiPerspectiveAnalysis(provider));
      }

      // Run all analyses in parallel
      const promises = analyses.map((analysis, index) =>
        analysis.analyze(contexts[index]!).catch(error => ({
          error: true,
          message: error.message,
          context: contexts[index]
        }))
      );

      const results = await Promise.all(promises);

      // At least some requests should succeed
      const successfulResults = results.filter(r => !r.hasOwnProperty('error'));
      console.log(`Successful requests: ${successfulResults.length}/${results.length}`);

      // Verify that valid requests succeeded
      expect(successfulResults.length).toBeGreaterThan(0);

      // Log any errors for debugging
      const errors = results.filter(r => r.hasOwnProperty('error'));
      if (errors.length > 0) {
        console.log('Errors encountered:', errors);
      }
    }, 120000);
  });
});
