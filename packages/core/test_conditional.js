// Test conditional logic
const perspectives = [
  'Technical (conditional, provided that tests pass)',
  'Security (conditional, if security audit is complete)',
];

// Parse perspectives
const perspectiveResults = perspectives.map((perspective) => {
  const responseMatch = perspective.match(/\((.+)\)/);
  const confidenceMatch = perspective.match(/(?:confidence\s+|with\s+)(0?\.\d+|1\.0)/i);

  let response;
  let confidence = 0.7;
  let perspectiveName = perspective;

  if (responseMatch && responseMatch[1]) {
    response = responseMatch[1];
    const namePart = perspective.split('(')[0];
    perspectiveName = namePart ? namePart.trim() : perspective;

    if (confidenceMatch && confidenceMatch[1]) {
      confidence = parseFloat(confidenceMatch[1]);
    }
  } else {
    response = `Analysis from ${perspective} perspective: [Sub-agent integration pending]`;
    perspectiveName = perspective;
  }

  return {
    perspective: perspectiveName,
    response,
    confidence,
  };
});

console.log('Parsed perspectives:');
perspectiveResults.forEach((r) => {
  console.log(`  ${r.perspective}: "${r.response}" (confidence: ${r.confidence})`);
});

// Classify
const analyzedResults = perspectiveResults.map((result) => {
  const response = result.response.toLowerCase();

  let recommendation = 'neutral';

  if (
    response.includes('conditional') ||
    response.includes('with conditions') ||
    response.includes('if') ||
    response.includes('provided that')
  ) {
    recommendation = 'conditional';
  } else if (
    response.includes('reject') ||
    response.includes('deny') ||
    response.includes("don't") ||
    response.includes('no') ||
    response.includes('against')
  ) {
    recommendation = 'reject';
  } else if (
    response.includes('approve') ||
    response.includes('recommend') ||
    response.includes('proceed') ||
    response.includes('yes')
  ) {
    recommendation = 'approve';
  }

  return {
    ...result,
    recommendation,
  };
});

console.log('\nClassified perspectives:');
analyzedResults.forEach((r) => {
  console.log(`  ${r.perspective}: ${r.recommendation} (confidence: ${r.confidence})`);
});

const conditionals = analyzedResults.filter((r) => r.recommendation === 'conditional');

console.log('\nConditionals found:', conditionals.length);

if (conditionals.length > 0) {
  const warnings = [];
  warnings.push(`Conditional approval requires careful consideration of constraints`);

  console.log('Warnings:', warnings);
  console.log('Contains "conditional"?', warnings.some(w => w.includes('conditional')));
  console.log('Contains "Conditional"?', warnings.some(w => w.includes('Conditional')));
}
