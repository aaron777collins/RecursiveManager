import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * ArchitectureAgent - Analyzes decisions and contexts from an architecture perspective
 *
 * Focus areas:
 * - Scalability and performance implications
 * - Maintainability and code quality
 * - Design patterns and architectural patterns
 * - Technical debt assessment
 * - System complexity and coupling
 * - Infrastructure and deployment considerations
 * - Long-term sustainability
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const architectureAgent = new ArchitectureAgent(provider);
 * const analysis = await architectureAgent.analyze("Should we migrate to microservices architecture?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class ArchitectureAgent extends PerspectiveAgent {
  name = 'architecture';
  perspective = 'Architecture';

  /**
   * Creates a new ArchitectureAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as an Architecture Expert with deep knowledge
   * of software design patterns, scalability, and long-term system sustainability.
   */
  getSystemPrompt(): string {
    return `You are an Architecture Expert analyzing technical decisions and system design.

Your role: Evaluate architectural implications, scalability, maintainability, and technical sustainability of proposed changes and decisions.

Focus areas:
- Scalability (horizontal and vertical scaling, load balancing, distributed systems)
- Performance (latency, throughput, resource utilization, bottlenecks)
- Maintainability (code organization, modularity, separation of concerns, readability)
- Design patterns (creational, structural, behavioral patterns - when to apply them)
- Architectural patterns (microservices, monolith, event-driven, CQRS, layered architecture)
- Technical debt (identifying debt, refactoring strategies, migration planning)
- System complexity (coupling, cohesion, dependency management)
- Code quality (SOLID principles, DRY, KISS, YAGNI)
- Infrastructure considerations (deployment, monitoring, disaster recovery)
- API design (RESTful, GraphQL, versioning, backwards compatibility)
- Data architecture (database design, caching strategies, data consistency)
- Testing strategies (unit, integration, e2e testing architecture)

Analysis approach:
1. Evaluate current and future scalability requirements
2. Assess impact on system maintainability and complexity
3. Identify architectural patterns that fit the use case
4. Consider long-term technical debt implications
5. Recommend specific architectural improvements

Complexity assessment:
- HIGH: Significantly increases system complexity, tight coupling, difficult to maintain
- MEDIUM: Moderate complexity increase, some coupling, manageable maintenance
- LOW: Minimal complexity, loose coupling, easy to maintain, follows best practices

Output format:
Provide your architectural analysis with specific findings and recommendations.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds an architecture-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting architectural analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from an architecture perspective:

${context}

Provide a comprehensive architectural analysis covering:

1. **Scalability and Performance**
   - How does this affect system scalability (horizontal and vertical)?
   - What are the performance implications (latency, throughput, resource usage)?
   - Are there potential bottlenecks or single points of failure?
   - How will this handle increased load or traffic?

2. **Maintainability and Code Quality**
   - How does this impact long-term maintainability?
   - Does this follow SOLID principles and best practices?
   - What is the impact on code complexity and coupling?
   - How easy will it be to modify or extend in the future?

3. **Architectural Patterns and Design**
   - What architectural or design patterns are applicable?
   - Does this fit well with the existing architecture?
   - Are there better architectural approaches?
   - How does this affect system modularity and separation of concerns?

4. **Technical Debt Assessment**
   - Does this introduce or reduce technical debt?
   - What refactoring or migration challenges exist?
   - Are there backwards compatibility concerns?
   - What is the long-term sustainability of this approach?

5. **Infrastructure and Deployment**
   - What are the deployment and operational implications?
   - How does this affect monitoring and observability?
   - Are there disaster recovery or fault tolerance considerations?
   - What infrastructure changes are needed?

6. **Complexity Assessment**
   - What is the overall complexity level? (HIGH/MEDIUM/LOW)
   - How does this affect system coupling and cohesion?
   - Is this the simplest solution that meets requirements?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the architectural assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
