// Test parsing logic
const testCases = [
  'Technical (yes, proceed with 0.7)',
  'Security (reject strongly with 0.95)',
  'A (conditional with 1.0)',
  'Technical (approve with confidence 0.9)',
  'A (reject with 0.7 confidence)',
  'Security (reject with 0.95)',
];

testCases.forEach((perspective) => {
  const responseMatch = perspective.match(/\((.+)\)/);
  const confidenceMatch = perspective.match(/(?:confidence\s+|with\s+)(0?\.\d+|1\.0)/i);

  console.log('\nInput:', perspective);
  console.log('Response:', responseMatch ? responseMatch[1] : 'none');
  console.log('Confidence:', confidenceMatch ? confidenceMatch[1] : 'none');

  if (responseMatch && responseMatch[1]) {
    const response = responseMatch[1];
    console.log('Keywords:');
    console.log('  - approve:', response.toLowerCase().includes('approve'));
    console.log('  - reject:', response.toLowerCase().includes('reject'));
    console.log('  - conditional:', response.toLowerCase().includes('conditional'));
    console.log('  - yes:', response.toLowerCase().includes('yes'));
  }
});
