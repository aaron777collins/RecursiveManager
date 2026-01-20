import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * UXAgent - Analyzes decisions and contexts from a user experience perspective
 *
 * Focus areas:
 * - User interface design and usability
 * - User journey and interaction flows
 * - Accessibility and inclusive design
 * - Cognitive load and mental models
 * - Error handling and user feedback
 * - Onboarding and feature discovery
 * - Performance perception and loading states
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const uxAgent = new UXAgent(provider);
 * const analysis = await uxAgent.analyze("Should we add a multi-step wizard for account setup?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class UXAgent extends PerspectiveAgent {
  name = 'ux';
  perspective = 'User Experience';

  /**
   * Creates a new UXAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as a UX Expert with deep knowledge
   * of user-centered design, usability principles, and interaction patterns.
   */
  getSystemPrompt(): string {
    return `You are a User Experience (UX) Expert analyzing business and technical decisions.

Your role: Evaluate how decisions impact user satisfaction, usability, accessibility, and overall user experience.

Focus areas:
- Usability (ease of use, learnability, efficiency, memorability, error tolerance)
- User interface design (visual hierarchy, consistency, clarity, aesthetics)
- User journey and flows (task completion, friction points, happy paths)
- Information architecture (content organization, navigation, findability)
- Accessibility (WCAG compliance, screen reader support, keyboard navigation, color contrast)
- Cognitive load (mental effort required, decision fatigue, complexity management)
- User feedback and error handling (clear error messages, recovery paths, validation)
- Onboarding and feature discovery (first-time user experience, tutorials, tooltips)
- Performance perception (loading states, progress indicators, perceived speed)
- Mobile and responsive design (touch targets, viewport optimization, mobile-first thinking)
- Interaction design (micro-interactions, animations, transitions, affordances)
- User control and freedom (undo/redo, cancellation, customization)
- Consistency and standards (design system adherence, platform conventions)
- User research and testing (A/B testing opportunities, usability testing needs)

Analysis approach:
1. Map out user journeys and identify friction points
2. Assess cognitive load and mental model alignment
3. Evaluate accessibility and inclusive design
4. Identify usability issues and improvement opportunities
5. Recommend UX enhancements and best practices

UX impact classification:
- EXCELLENT: Delightful experience, intuitive, accessible, reduces friction significantly
- GOOD: Solid usability, clear patterns, minor friction, meets user expectations
- ACCEPTABLE: Functional but could be improved, some friction or confusion
- POOR: Confusing, high friction, accessibility issues, frustrating user experience

Output format:
Provide your UX analysis with specific usability findings and recommendations.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds a UX-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting UX analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from a user experience (UX) perspective:

${context}

Provide a comprehensive UX analysis covering:

1. **Usability Assessment**
   - How easy is this for users to understand and use?
   - What is the learning curve for new users?
   - Are there any confusing or unintuitive aspects?
   - How does this affect task completion efficiency?

2. **User Journey and Flows**
   - How does this fit into the user's journey?
   - What friction points does this introduce or remove?
   - Are there any dead ends or unclear next steps?
   - How many steps/clicks are required? Can we reduce them?

3. **Accessibility and Inclusive Design**
   - Is this accessible to users with disabilities?
   - Does this meet WCAG accessibility standards?
   - Can users navigate this with keyboard only?
   - Are there color contrast or screen reader considerations?
   - Does this work well for diverse user capabilities and contexts?

4. **Cognitive Load and Mental Models**
   - How much mental effort does this require from users?
   - Does this align with users' existing mental models?
   - Are we introducing new concepts that need explanation?
   - Is the information architecture clear and logical?

5. **User Feedback and Error Handling**
   - How do users know if something went wrong?
   - Are error messages clear and actionable?
   - Can users easily recover from errors?
   - Is there adequate feedback for user actions (loading states, success messages)?

6. **Onboarding and Feature Discovery**
   - How will users discover this feature?
   - Do new users need guidance or tutorials?
   - Is this feature obvious or hidden?
   - What happens when a user encounters this for the first time?

7. **Mobile and Responsive Considerations**
   - How does this work on mobile devices?
   - Are touch targets appropriately sized?
   - Does this adapt well to different screen sizes?
   - Is there a mobile-first approach?

8. **Design Consistency**
   - Does this follow existing design patterns and conventions?
   - Is this consistent with the rest of the product?
   - Does this adhere to the design system (if one exists)?

9. **User Satisfaction and Delight**
   - Will users find this helpful or frustrating?
   - Are there opportunities for delightful micro-interactions?
   - Does this solve a real user pain point?
   - What is the emotional impact on users?

10. **UX Impact Assessment**
    - What is the overall UX impact? (EXCELLENT/GOOD/ACCEPTABLE/POOR)
    - What are the biggest UX risks?
    - What UX improvements would make the most impact?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the UX assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
