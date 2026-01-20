import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * SimplicityAgent - Analyzes decisions and contexts from a simplicity perspective
 *
 * Focus areas:
 * - Reducing complexity and cognitive load
 * - YAGNI (You Aren't Gonna Need It) principle
 * - Avoiding over-engineering and premature optimization
 * - Keeping solutions minimal and focused
 * - Eliminating unnecessary abstractions
 * - Favoring straightforward implementations
 * - Reducing dependencies and moving parts
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const simplicityAgent = new SimplicityAgent(provider);
 * const analysis = await simplicityAgent.analyze("Should we add a caching layer with Redis?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class SimplicityAgent extends PerspectiveAgent {
  name = 'simplicity';
  perspective = 'Simplicity';

  /**
   * Creates a new SimplicityAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as a Simplicity Advocate who challenges
   * complexity and champions straightforward, minimal solutions.
   */
  getSystemPrompt(): string {
    return `You are a Simplicity Advocate analyzing technical and business decisions.

Your role: Challenge complexity, identify over-engineering, and promote the simplest solution that meets actual requirements (not hypothetical future requirements).

Focus areas:
- YAGNI principle (You Aren't Gonna Need It) - avoid building for hypothetical futures
- KISS principle (Keep It Simple, Stupid) - favor straightforward solutions
- Avoiding premature optimization and abstraction
- Reducing cognitive load and mental overhead
- Eliminating unnecessary dependencies and moving parts
- Questioning whether features are truly needed
- Identifying simpler alternatives to complex proposals
- Avoiding "gold plating" and feature creep
- Favoring boring, proven technology over shiny new tools
- Reducing the number of concepts developers need to understand
- Minimizing configuration and setup complexity
- Avoiding unnecessary layers of indirection

Analysis approach:
1. Question the necessity of the proposed change - do we actually need it?
2. Identify simpler alternatives that meet the actual (not hypothetical) requirements
3. Evaluate the complexity-to-value ratio
4. Consider whether we're solving a real problem or an imagined one
5. Recommend the minimal viable solution

Complexity evaluation:
- OVER-ENGINEERED: Far more complex than needed, solving problems that don't exist
- COMPLEX: More complicated than necessary, simpler alternatives available
- BALANCED: Appropriate complexity for the problem being solved
- SIMPLE: Minimal, focused solution that solves the actual problem elegantly

Output format:
Provide your simplicity analysis with specific findings and recommendations for simplification.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds a simplicity-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting simplicity analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from a simplicity perspective:

${context}

Provide a comprehensive simplicity analysis covering:

1. **Necessity Assessment**
   - Is this actually needed, or are we solving a hypothetical problem?
   - What problem does this solve, and is that problem real or imagined?
   - Can we achieve the same goal without this change?
   - Are we building for current needs or speculative future needs?

2. **Simpler Alternatives**
   - What simpler approaches could achieve the same outcome?
   - Can we solve this with existing tools/patterns instead of adding new ones?
   - What's the minimal viable solution that solves the actual problem?
   - Can we defer this decision until we have more information?

3. **Complexity Analysis**
   - How much complexity does this add to the system?
   - How many new concepts must developers learn?
   - How many new dependencies or moving parts does this introduce?
   - What is the cognitive load increase for the team?
   - Are we adding unnecessary layers of abstraction?

4. **YAGNI and Over-Engineering Assessment**
   - Are we building features we don't currently need?
   - Are we optimizing prematurely?
   - Are we abstracting before we understand the real patterns?
   - Are we choosing a complex tool when a simple one would suffice?

5. **Simplification Recommendations**
   - How can we simplify this proposal?
   - What can we remove or avoid adding?
   - What's the most boring, straightforward solution?
   - How can we reduce the number of moving parts?

6. **Complexity Rating**
   - What is the overall complexity evaluation? (OVER-ENGINEERED/COMPLEX/BALANCED/SIMPLE)
   - Is the complexity justified by the actual value delivered?
   - What's the simplicity vs. functionality trade-off?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the simplicity assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
