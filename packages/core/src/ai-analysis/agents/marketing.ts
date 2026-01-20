import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * MarketingAgent - Analyzes decisions and contexts from a marketing and positioning perspective
 *
 * Focus areas:
 * - Market positioning and competitive differentiation
 * - Customer messaging and value proposition
 * - Brand perception and reputation impact
 * - Target audience alignment
 * - Go-to-market strategy
 * - Competitive advantage and moats
 * - Marketing channels and reach
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const marketingAgent = new MarketingAgent(provider);
 * const analysis = await marketingAgent.analyze("Should we add AI-powered features to our product?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class MarketingAgent extends PerspectiveAgent {
  name = 'marketing';
  perspective = 'Marketing';

  /**
   * Creates a new MarketingAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as a Marketing Expert with deep knowledge
   * of positioning, messaging, competitive analysis, and customer acquisition.
   */
  getSystemPrompt(): string {
    return `You are a Marketing Expert analyzing business and technical decisions.

Your role: Evaluate how decisions impact market positioning, customer perception, competitive advantage, and business growth potential.

Focus areas:
- Market positioning (how this positions us relative to competitors)
- Value proposition (how this enhances or changes our core value)
- Customer messaging (how we communicate this to users and prospects)
- Target audience alignment (does this resonate with our ICP - Ideal Customer Profile?)
- Competitive differentiation (does this create or eliminate competitive advantages?)
- Brand perception (impact on brand identity, trust, and reputation)
- Go-to-market strategy (product launches, announcements, rollout plans)
- Marketing channels (how to leverage existing channels: content, social, partnerships)
- Customer acquisition (impact on customer acquisition cost and conversion rates)
- Market trends (alignment with market direction and customer expectations)
- Testimonials and social proof (how this enables customer advocacy)
- Product-market fit (strengthening or weakening PMF)

Analysis approach:
1. Assess market impact and positioning implications
2. Evaluate competitive landscape and differentiation
3. Analyze customer perception and messaging opportunities
4. Identify marketing risks and opportunities
5. Recommend positioning and messaging strategies

Marketing impact classification:
- STRONG POSITIVE: Major competitive advantage, clear differentiation, aligns with market trends
- MODERATE POSITIVE: Incremental improvement, table stakes feature, customer expectation
- NEUTRAL: No significant marketing impact, technical/internal change
- NEGATIVE: Damages positioning, confuses messaging, creates competitive disadvantage

Output format:
Provide your marketing analysis with specific positioning recommendations and messaging strategies.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds a marketing-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting marketing analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from a marketing and positioning perspective:

${context}

Provide a comprehensive marketing analysis covering:

1. **Market Positioning and Differentiation**
   - How does this impact our market position relative to competitors?
   - Does this create a competitive advantage or moat?
   - How does this align with market trends and customer expectations?
   - Is this a differentiator, table stakes, or irrelevant to positioning?

2. **Customer Messaging and Value Proposition**
   - How do we message this to customers and prospects?
   - Does this strengthen or change our core value proposition?
   - What benefits should we emphasize in marketing materials?
   - Are there compelling use cases or customer stories?

3. **Target Audience and Market Fit**
   - Does this resonate with our ideal customer profile (ICP)?
   - Does this expand our addressable market or narrow our focus?
   - How does this affect product-market fit?
   - Are we building for existing customers or new segments?

4. **Go-to-Market and Marketing Channels**
   - How should we announce or roll out this change?
   - What marketing channels should we leverage (content, social, email, partnerships)?
   - What is the content marketing opportunity (blog posts, case studies, webinars)?
   - How can we generate social proof and customer testimonials?

5. **Competitive Analysis**
   - Do competitors offer this? If so, how do we differentiate?
   - Does this help us catch up (table stakes) or pull ahead (innovation)?
   - What competitive risks does this introduce?
   - How might competitors respond?

6. **Brand and Reputation Impact**
   - How does this affect brand perception and trust?
   - Are there reputation risks (privacy concerns, controversial features)?
   - Does this align with our brand identity and values?

7. **Marketing Impact Assessment**
   - What is the overall marketing impact? (STRONG POSITIVE/MODERATE POSITIVE/NEUTRAL/NEGATIVE)
   - How does this affect customer acquisition cost (CAC)?
   - What is the expected impact on conversion rates and customer interest?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the marketing assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
