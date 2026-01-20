import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * EmotionalAgent - Analyzes decisions and contexts from an emotional and team dynamics perspective
 *
 * Focus areas:
 * - Team morale and job satisfaction
 * - Developer experience and cognitive burden
 * - Stakeholder sentiment and relationships
 * - Psychological safety and communication
 * - Work-life balance and burnout risks
 * - Team culture and collaboration dynamics
 * - Change management and resistance
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const emotionalAgent = new EmotionalAgent(provider);
 * const analysis = await emotionalAgent.analyze("Should we migrate to a new tech stack?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class EmotionalAgent extends PerspectiveAgent {
  name = 'emotional';
  perspective = 'Emotional Intelligence';

  /**
   * Creates a new EmotionalAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as an Emotional Intelligence Expert with deep knowledge
   * of team dynamics, psychological safety, developer experience, and organizational health.
   */
  getSystemPrompt(): string {
    return `You are an Emotional Intelligence Expert analyzing business and technical decisions.

Your role: Evaluate how decisions impact team morale, developer experience, stakeholder relationships, and organizational health.

Focus areas:
- Team morale and motivation (job satisfaction, sense of purpose, enthusiasm, energy levels)
- Developer experience (DX) (cognitive load, tool quality, workflow efficiency, frustration points)
- Psychological safety (ability to speak up, experiment, make mistakes, ask for help)
- Communication quality (clarity, transparency, listening, feedback loops, alignment)
- Stakeholder relationships (trust, expectations, collaboration, conflict resolution)
- Work-life balance (sustainable pace, burnout prevention, flexibility, time pressure)
- Team culture (values, collaboration, respect, inclusivity, celebration of wins)
- Change management (resistance to change, adaptation fatigue, learning curves, transition support)
- Autonomy and empowerment (decision-making authority, ownership, creative freedom)
- Recognition and appreciation (acknowledgment of contributions, visible impact)
- Collaboration dynamics (cross-team coordination, knowledge sharing, mentorship)
- Stress and anxiety factors (uncertainty, complexity, deadlines, technical debt burden)
- Sense of progress (visible achievements, momentum, shipping velocity)
- Job security and stability (confidence in role, career growth, skill development)

Analysis approach:
1. Assess emotional and psychological impact on team members
2. Evaluate stakeholder sentiment and relationship dynamics
3. Identify morale risks and opportunities for positive impact
4. Consider developer experience and cognitive burden
5. Recommend strategies for emotional wellbeing and team health

Emotional impact classification:
- POSITIVE: Boosts morale, improves DX, builds trust, energizes team, reduces stress
- NEUTRAL: No significant emotional impact, business-as-usual change
- MIXED: Both positive and negative impacts, requires careful management
- NEGATIVE: Damages morale, increases stress, creates friction, burns out team, erodes trust

Output format:
Provide your emotional intelligence analysis with specific findings about team impact and wellbeing.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds an emotional intelligence-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting emotional intelligence analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from an emotional intelligence and team dynamics perspective:

${context}

Provide a comprehensive emotional intelligence analysis covering:

1. **Team Morale and Motivation**
   - How will this affect team morale and job satisfaction?
   - Will this energize or demotivate the team?
   - Does this give the team a sense of purpose and meaningful work?
   - How might different team members react emotionally?

2. **Developer Experience (DX)**
   - How does this impact daily development workflows?
   - Will this increase or decrease cognitive load for developers?
   - Are we making developers' lives easier or harder?
   - What frustrations might this introduce or remove?
   - Does this improve or degrade the quality of tools and processes?

3. **Psychological Safety**
   - Does this create an environment where team members feel safe to experiment?
   - Can people speak up about concerns without fear?
   - How does this affect the ability to make mistakes and learn?
   - Are we fostering or hindering healthy risk-taking?

4. **Communication and Transparency**
   - How does this affect team communication quality?
   - Is this decision being communicated clearly with context and rationale?
   - Are stakeholders aligned and informed?
   - Are there potential misunderstandings or information gaps?

5. **Stakeholder Relationships**
   - How will this affect relationships with stakeholders (customers, partners, leadership)?
   - Does this build or erode trust?
   - Are expectations being set and managed appropriately?
   - How might stakeholders emotionally respond to this?

6. **Work-Life Balance and Burnout**
   - Does this contribute to or prevent team burnout?
   - How does this affect work-life balance and sustainable pace?
   - Are we asking for unreasonable effort or time commitment?
   - What stress levels does this introduce?

7. **Change Management and Adaptation**
   - How much change fatigue is the team experiencing?
   - Will this change be welcomed or resisted?
   - What support is needed to help the team adapt?
   - Are we introducing change at a sustainable pace?

8. **Autonomy and Empowerment**
   - Does this give the team more autonomy and decision-making power?
   - Are team members empowered to own their work?
   - How does this affect creative freedom and ownership?

9. **Recognition and Sense of Progress**
   - Will this create visible wins and momentum for the team?
   - Are contributions being recognized and appreciated?
   - Does this help the team see the impact of their work?
   - Is this building toward something exciting and meaningful?

10. **Team Culture and Collaboration**
    - How does this affect team culture and values?
    - Does this improve or hinder cross-team collaboration?
    - Are we fostering healthy competition or unhealthy conflict?
    - How does this impact inclusivity and respect?

11. **Stress, Anxiety, and Mental Health**
    - What anxiety or stress might this create?
    - Are we introducing uncertainty or instability?
    - How does this affect mental health and wellbeing?
    - Are there hidden emotional costs we should consider?

12. **Emotional Impact Assessment**
    - What is the overall emotional impact? (POSITIVE/NEUTRAL/MIXED/NEGATIVE)
    - What are the biggest emotional risks?
    - How can we maximize positive emotional impact and minimize negative impact?
    - What support or communication would help the team process this?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the emotional assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
