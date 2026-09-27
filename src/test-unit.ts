import { slugToTabName } from '../src/slug';
import { parseCSV, extractSheetRows, transformSheetRows } from '../src/parser';

console.log('--- Testing Slug Mapping ---');
const slugs = [
  ['logan', 'Logan'],
  ['stretton', 'Stretton'],
  ['gold-coast', 'Gold Coast'],
];

for (const [input, expected] of slugs) {
  const actual = slugToTabName(input);
  console.log(`slugToTabName("${input}") => "${actual}" [${actual === expected ? 'PASS' : 'FAIL'}]`);
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

console.log('\n--- Testing CSV Parser & Row Transformation ---');

const sampleLoganCsv = `"section_id","field","value","type"
"site","suburb","Logan","text"
"site","slug","logan","slug"
"hero","heading","CCTV Security Cameras in Logan","text"
"hero","subheading","Professional CCTV Installation","text"
"hero","description","Professional CCTV installation for homes and businesses.","richtext"
"hero","bullet_1","Professional installation","text"
"hero","bullet_2","Mobile viewing","text"
"hero","bullet_3","No monthly fees","text"
"seo","title","CCTV Security Cameras Logan","seo"
"seo","description","Professional CCTV security camera installation in Logan.","seo"
`;

const matrix = parseCSV(sampleLoganCsv);
console.log(`Parsed matrix rows: ${matrix.length}`);

const sheetRows = extractSheetRows(matrix);
console.log(`Extracted sheet rows: ${sheetRows.length}`);

const content = transformSheetRows(sheetRows);
const expectedOutput = {
  status: 'success',
  slug: 'logan',
  content: {
    site: {
      suburb: 'Logan',
      slug: 'logan',
    },
    hero: {
      heading: 'CCTV Security Cameras in Logan',
      subheading: 'Professional CCTV Installation',
      description: 'Professional CCTV installation for homes and businesses.',
      bullet_1: 'Professional installation',
      bullet_2: 'Mobile viewing',
      bullet_3: 'No monthly fees',
    },
    seo: {
      title: 'CCTV Security Cameras Logan',
      description: 'Professional CCTV security camera installation in Logan.',
    },
  },
};

const output = {
  status: 'success',
  slug: 'logan',
  content,
};

console.log('\nResulting JSON:');
console.log(JSON.stringify(output, null, 2));

if (JSON.stringify(output) === JSON.stringify(expectedOutput)) {
  console.log('\n[PASS] Output matches exact specification!');
} else {
  console.error('\n[FAIL] Output does not match specification');
  process.exit(1);
}
