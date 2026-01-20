import { PerspectiveAgent } from './base.js';
import { AIProvider } from '../providers/base.js';

/**
 * SecurityAgent - Analyzes decisions and contexts from a security perspective
 *
 * Focus areas:
 * - Authentication and authorization vulnerabilities
 * - Data protection and privacy concerns
 * - OWASP Top 10 security risks
 * - Regulatory compliance (GDPR, HIPAA, SOC2, etc.)
 * - Security best practices and hardening
 * - Cryptography and secure communications
 * - Access control and privilege escalation risks
 *
 * @example
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const securityAgent = new SecurityAgent(provider);
 * const analysis = await securityAgent.analyze("Should we add Redis caching to our API?");
 * console.log(analysis.analysis);
 * console.log(`Confidence: ${analysis.confidence}`);
 * ```
 */
export class SecurityAgent extends PerspectiveAgent {
  name = 'security';
  perspective = 'Security';

  /**
   * Creates a new SecurityAgent instance
   * @param provider - The AI provider to use for analysis
   */
  constructor(provider: AIProvider) {
    super(provider);
  }

  /**
   * Returns the system prompt that defines the agent's role and expertise
   *
   * This prompt establishes the agent as a Security Expert with deep knowledge
   * of security vulnerabilities, attack vectors, and defensive strategies.
   */
  getSystemPrompt(): string {
    return `You are a Security Expert analyzing business and technical decisions.

Your role: Identify security risks, vulnerabilities, and compliance issues in proposed changes, features, and architectural decisions.

Focus areas:
- Authentication and authorization (OAuth, JWT, session management, RBAC, ACLs)
- Data protection (encryption at rest and in transit, PII handling, data retention)
- OWASP Top 10 vulnerabilities (injection, XSS, CSRF, broken authentication, etc.)
- Regulatory compliance (GDPR, HIPAA, SOC2, PCI-DSS, etc.)
- API security (rate limiting, input validation, API keys, secrets management)
- Infrastructure security (network segmentation, firewall rules, container security)
- Access control (principle of least privilege, privilege escalation risks)
- Cryptography (secure algorithms, key management, certificate validation)
- Security monitoring and incident response capabilities
- Supply chain security (dependency vulnerabilities, third-party integrations)

Analysis approach:
1. Identify immediate security risks and attack vectors
2. Assess potential impact and likelihood of exploitation
3. Evaluate compliance implications
4. Consider defense-in-depth strategies
5. Recommend specific security controls and mitigations

Risk severity classification:
- CRITICAL: Immediate exploitable vulnerabilities, data breach risks, compliance violations
- HIGH: Significant security weaknesses, elevated attack surface, privilege escalation
- MEDIUM: Security concerns requiring attention, defense-in-depth gaps
- LOW: Minor security improvements, hardening opportunities

Output format:
Provide your security analysis with specific findings and recommendations.
Then end with "Confidence: X.X" (0.0-1.0) indicating your confidence in the analysis.
Optionally include a "Reasoning:" section explaining your confidence level.`;
  }

  /**
   * Builds a security-focused analysis prompt from the given context
   *
   * @param context - The decision, feature, or scenario to analyze
   * @returns A formatted prompt requesting security analysis
   */
  buildPrompt(context: string): string {
    return `Analyze the following from a security perspective:

${context}

Provide a comprehensive security analysis covering:

1. **Security Risks and Vulnerabilities**
   - What specific security risks does this introduce?
   - Are there any OWASP Top 10 vulnerabilities present?
   - What attack vectors could be exploited?
   - How might this increase the attack surface?

2. **Compliance Concerns**
   - Does this affect regulatory compliance (GDPR, HIPAA, SOC2, etc.)?
   - Are there data privacy implications?
   - What audit trail or logging requirements apply?

3. **Security Recommendations**
   - What security controls should be implemented?
   - How can we apply defense-in-depth principles?
   - What security testing is required (penetration testing, security reviews, etc.)?
   - Are there security-focused code review requirements?

4. **Risk Severity Assessment**
   - What is the overall risk severity? (CRITICAL/HIGH/MEDIUM/LOW)
   - What is the potential impact if exploited?
   - How likely is exploitation?

End your analysis with:
- "Confidence: X.X" (0.0-1.0) based on how certain you are about the security assessment
- Optionally include "Reasoning:" to explain your confidence level`;
  }
}
