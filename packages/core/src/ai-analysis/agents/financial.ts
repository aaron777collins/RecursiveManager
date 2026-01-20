import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * FinancialAgent - Analyzes decisions and contexts from a financial perspective
 *
 * Focus areas:
 * - Cost-benefit analysis and ROI
 * - Resource utilization and optimization
 * - Budget impact and financial constraints
 * - Opportunity costs and trade-offs
 * - Revenue implications and monetization
 * - Total cost of ownership (TCO)
 * - Financial risk assessment
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const financialAgent = new FinancialAgent(provider);
 * const analysis = await financialAgent.analyze("Should we migrate to Kubernetes?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class FinancialAgent extends PerspectiveAgent {
  name = 'financial';
  perspective = 'Financial';

  /**
   * Creates a new FinancialAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as a Financial Analyst with expertise
   * in cost analysis, ROI calculation, and financial decision-making.
   */
  getSystemPrompt(): string {
    return `You are a Financial Analyst analyzing business and technical decisions.

Your role: Evaluate costs, benefits, ROI, and financial implications of proposed changes, features, and architectural decisions.

Focus areas:
- Cost-benefit analysis (quantify costs vs. expected benefits)
- Return on Investment (ROI) calculations
- Total Cost of Ownership (TCO) including maintenance, licensing, and operational costs
- Resource utilization (developer time, infrastructure, third-party services)
- Opportunity costs (what we're NOT doing by choosing this)
- Budget impact (upfront costs, recurring costs, hidden costs)
- Revenue implications (monetization potential, revenue protection)
- Financial risk assessment (cost overruns, dependency costs, vendor lock-in)
- Scalability economics (how costs scale with growth)
- Cost optimization opportunities (ways to reduce expenses)
- Make vs. buy decisions (build internally vs. purchase solutions)
- Team efficiency and productivity impact

Analysis approach:
1. Identify all direct and indirect costs (development, infrastructure, licensing, maintenance)
2. Quantify expected benefits (revenue increase, cost savings, efficiency gains)
3. Calculate ROI and payback period where possible
4. Assess opportunity costs (alternative uses of resources)
5. Evaluate financial risks and contingencies
6. Consider long-term financial sustainability

Financial impact classification:
- HIGH ROI: Strong positive financial impact, clear cost savings or revenue generation
- MODERATE ROI: Positive impact but with caveats, reasonable cost-benefit ratio
- NEUTRAL: Costs roughly equal benefits, strategic value unclear
- NEGATIVE ROI: Costs likely exceed benefits, poor financial justification

Output format:
Provide your financial analysis with specific cost estimates and ROI assessment where possible.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the financial analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds a financial-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting financial analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from a financial perspective:

${context}

Provide a comprehensive financial analysis covering:

1. **Cost Analysis**
   - What are the upfront costs? (development time, infrastructure setup, licensing, etc.)
   - What are the recurring costs? (maintenance, hosting, subscriptions, support, etc.)
   - What are the hidden costs? (technical debt, training, migration costs, etc.)
   - What is the Total Cost of Ownership (TCO) over 1-3 years?

2. **Benefit Analysis**
   - What financial benefits does this provide? (revenue increase, cost savings, efficiency gains)
   - Can we quantify the benefits in monetary terms?
   - What is the expected ROI (Return on Investment)?
   - What is the payback period (how long to recoup costs)?

3. **Resource Utilization**
   - How much developer time will this require?
   - What infrastructure resources are needed?
   - Are we using our resources efficiently?
   - What is the opportunity cost? (what else could we build with these resources?)

4. **Financial Risks**
   - What are the financial risks? (cost overruns, vendor lock-in, deprecation, etc.)
   - What happens if usage grows significantly? (scalability economics)
   - Are there dependencies with uncertain pricing?
   - What contingencies should we plan for?

5. **Recommendation**
   - Does this make financial sense?
   - What is the overall financial impact? (HIGH ROI/MODERATE ROI/NEUTRAL/NEGATIVE ROI)
   - Are there more cost-effective alternatives?
   - What cost optimization strategies should we consider?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the financial assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
