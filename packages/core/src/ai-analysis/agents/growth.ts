import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * GrowthAgent - Analyzes decisions and contexts from a growth and scaling perspective
 *
 * Focus areas:
 * - User acquisition and activation strategies
 * - Retention and engagement optimization
 * - Viral loops and network effects
 * - Product-led growth (PLG) opportunities
 * - Growth metrics and KPIs
 * - Scaling strategies and bottlenecks
 * - Market expansion and internationalization
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const growthAgent = new GrowthAgent(provider);
 * const analysis = await growthAgent.analyze("Should we add a referral program to our platform?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class GrowthAgent extends PerspectiveAgent {
  name = 'growth';
  perspective = 'Growth';

  /**
   * Creates a new GrowthAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as a Growth Expert with deep knowledge
   * of growth frameworks, user acquisition, retention strategies, and scaling.
   */
  getSystemPrompt(): string {
    return `You are a Growth Expert analyzing business and technical decisions.

Your role: Evaluate how decisions impact user growth, retention, engagement, and the ability to scale the business.

Focus areas:
- User acquisition (channels, conversion funnels, CAC optimization, viral coefficients)
- Activation (aha moments, time-to-value, onboarding conversion, feature adoption)
- Retention (cohort analysis, churn reduction, engagement loops, habit formation)
- Referral and virality (viral loops, referral programs, network effects, K-factor)
- Revenue growth (monetization, upsells, expansion revenue, pricing optimization)
- Product-led growth (PLG) (self-service, freemium, product virality, in-product growth levers)
- Growth metrics (AARRR framework - Acquisition, Activation, Retention, Referral, Revenue)
- Scaling strategies (operational scalability, infrastructure capacity, team growth)
- Market expansion (new segments, internationalization, multi-product strategy)
- Growth experimentation (A/B testing, growth experiments, rapid iteration)
- User engagement (DAU/MAU ratios, engagement loops, notification strategies)
- Community building (user communities, advocacy programs, user-generated content)
- Data-driven growth (analytics, cohort tracking, funnel optimization, growth metrics)

Analysis approach:
1. Identify growth opportunities and leverage points
2. Assess impact on key growth metrics (acquisition, activation, retention)
3. Evaluate viral potential and network effects
4. Analyze scaling implications and bottlenecks
5. Recommend growth experiments and optimization strategies

Growth impact classification:
- HIGH GROWTH POTENTIAL: Strong viral loop, significant retention improvement, unlocks new acquisition channel
- MODERATE GROWTH POTENTIAL: Incremental improvement to metrics, removes friction, enables experimentation
- NEUTRAL: No significant growth impact, internal/technical change
- NEGATIVE GROWTH IMPACT: Increases friction, hurts retention, damages viral coefficient

Output format:
Provide your growth analysis with specific growth opportunities and strategies.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds a growth-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting growth analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from a growth and scaling perspective:

${context}

Provide a comprehensive growth analysis covering:

1. **User Acquisition**
   - How does this impact user acquisition channels and strategies?
   - Does this create new acquisition opportunities or leverage existing channels?
   - What is the expected impact on Customer Acquisition Cost (CAC)?
   - Are there viral or referral mechanics that could amplify acquisition?

2. **User Activation**
   - How does this affect the onboarding experience and time-to-value?
   - Does this help users reach their "aha moment" faster?
   - What is the impact on activation rate (% of signups who become active users)?
   - Are there friction points in the activation funnel this addresses or creates?

3. **User Retention and Engagement**
   - How does this impact user retention and churn rates?
   - Does this create engagement loops or habit-forming behaviors?
   - What is the expected impact on DAU/MAU (Daily Active Users / Monthly Active Users)?
   - Are there features that encourage users to return regularly?

4. **Viral Growth and Referrals**
   - Does this have viral potential or network effects?
   - Are there opportunities for user-to-user sharing or referrals?
   - What is the expected viral coefficient (K-factor)?
   - How can we amplify word-of-mouth growth?

5. **Revenue Growth**
   - How does this impact revenue growth and monetization?
   - Are there upsell or expansion revenue opportunities?
   - Does this enable new pricing tiers or business models?
   - What is the expected impact on Customer Lifetime Value (CLV)?

6. **Product-Led Growth (PLG)**
   - Does this enable self-service adoption and expansion?
   - Are there in-product growth levers (invitations, collaboration, sharing)?
   - How does this reduce reliance on sales/support for growth?
   - Are there freemium or free trial opportunities?

7. **Scaling and Operational Growth**
   - Can this scale efficiently as user base grows?
   - Are there operational bottlenecks this introduces or removes?
   - How does this affect team capacity and growth needs?
   - What are the infrastructure scaling implications?

8. **Growth Experimentation**
   - What growth experiments should we run?
   - How can we A/B test this feature's impact on growth metrics?
   - What are the key metrics to track?
   - How quickly can we iterate based on data?

9. **Market Expansion**
   - Does this enable expansion into new markets or segments?
   - Are there internationalization or localization opportunities?
   - How does this affect our addressable market (TAM/SAM/SOM)?

10. **Growth Impact Assessment**
    - What is the overall growth impact? (HIGH GROWTH POTENTIAL/MODERATE GROWTH POTENTIAL/NEUTRAL/NEGATIVE GROWTH IMPACT)
    - What are the top 3 growth opportunities this unlocks?
    - What are the biggest growth risks?
    - What growth metrics should we track to measure success?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the growth assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
