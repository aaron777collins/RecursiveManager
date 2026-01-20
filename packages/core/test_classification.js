// Test classification logic
const perspectives = [
  'Technical (yes, proceed with 0.7)',
  'Business (yes, approve with 0.8)',
  'UX (yes, recommend with 0.75)',
  'Operations (yes, proceed with 0.7)',
  'Security (reject strongly with 0.95)',
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
    response.includes('approve') ||
    response.includes('recommend') ||
    response.includes('proceed') ||
    response.includes('yes')
  ) {
    recommendation = 'approve';
  } else if (
    response.includes('reject') ||
    response.includes('deny') ||
    response.includes("don't") ||
    response.includes('no') ||
    response.includes('against')
  ) {
    recommendation = 'reject';
  } else if (
    response.includes('conditional') ||
    response.includes('with conditions') ||
    response.includes('if') ||
    response.includes('provided that')
  ) {
    recommendation = 'conditional';
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

// Check for strong rejection
const strongRejection = analyzedResults.find(
  (r) => r.recommendation === 'reject' && r.confidence > 0.8
);

console.log('\nStrong rejection found:', !!strongRejection);
if (strongRejection) {
  console.log('  Perspective:', strongRejection.perspective);
  console.log('  Confidence:', strongRejection.confidence);
  console.log('  Should recommend: reject');
} else {
  // Check majority
  const approvals = analyzedResults.filter((r) => r.recommendation === 'approve');
  const rejections = analyzedResults.filter((r) => r.recommendation === 'reject');
  const totalResponses = analyzedResults.length;
  const majorityThreshold = totalResponses / 2;

  console.log('  Approvals:', approvals.length);
  console.log('  Rejections:', rejections.length);
  console.log('  Majority threshold:', majorityThreshold);
  console.log('  Should recommend:', approvals.length > majorityThreshold ? 'approve' : 'other');
}
