import { slugToTabName } from './slug';
import { parseCSV, extractSheetRows, transformSheetRows } from './parser';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

console.log('========================================');
console.log('TEST SUITE: ROBERT CONTENT API PARSER');
console.log('========================================\n');

// 1. Slug Mapping Tests
console.log('--- 1. Slug to Tab Name Mapping ---');
const slugs: Array<[string, string]> = [
  ['logan', 'Logan'],
  ['stretton', 'Stretton'],
  ['gold-coast', 'Gold Coast'],
  ['springwood', 'Springwood'],
  ['browns-plains', 'Browns Plains'],
  ['upper-mount-gravatt', 'Upper Mount Gravatt'],
];

for (const [input, expected] of slugs) {
  const actual = slugToTabName(input);
  assert(actual === expected, `slugToTabName("${input}") === "${expected}"`);
}

// 2. New Schema Standard Logan CSV (section_id, field, type, value)
console.log('\n--- 2. New Schema Standard Parsing (section_id, field, type, value) ---');
const newSchemaLoganCsv = `"section_id","field","type","value"
"site","suburb","text","Logan"
"site","slug","slug","logan"
"hero","heading","text","CCTV Security Cameras in Logan"
"hero","subheading","text","Professional CCTV Installation"
"hero","description","richtext","Professional CCTV installation for homes and businesses."
"hero","bullet_1","text","Professional installation"
"hero","bullet_2","text","Mobile viewing"
"hero","bullet_3","text","No monthly fees"
"seo","title","seo","CCTV Security Cameras Logan"
"seo","description","seo","Professional CCTV security camera installation in Logan."
`;

const matrix1 = parseCSV(newSchemaLoganCsv);
const sheetRows1 = extractSheetRows(matrix1);
assert(sheetRows1.length === 10, `Extracted 10 sheet rows from new schema`);

const content1 = transformSheetRows(sheetRows1);
const expectedLoganContent = {
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
};

assert(
  JSON.stringify(content1) === JSON.stringify(expectedLoganContent),
  'Parsed Logan content matches exact production contract'
);

// 3. Header-Based Column Order Flexibility (Arbitrary Permutation)
console.log('\n--- 3. Header Column Permutation / Reordering Resilience ---');
const reorderedCsv = `"value","type","field","section_id"
"Logan","text","suburb","site"
"logan","slug","slug","site"
"CCTV Security Cameras in Logan","text","heading","hero"
`;

const matrix2 = parseCSV(reorderedCsv);
const sheetRows2 = extractSheetRows(matrix2);
const content2 = transformSheetRows(sheetRows2);

assert(content2.site?.suburb === 'Logan', 'Mapped suburb from reversed column order');
assert(content2.site?.slug === 'logan', 'Mapped slug from reversed column order');
assert(content2.hero?.heading === 'CCTV Security Cameras in Logan', 'Mapped heading from reversed column order');

// 4. Type Conversions (text, richtext, seo, slug, number, boolean)
console.log('\n--- 4. Type Conversions (number, boolean, text, richtext, seo, slug) ---');
const typeTestCsv = `"section_id","field","type","value"
"stats","cameras_count","number","4"
"stats","rating","number","4.9"
"stats","invalid_number","number","N/A"
"features","has_ai","boolean","true"
"features","has_subscription","boolean","FALSE"
"features","custom_text","text","High Definition"
"features","rich_html","richtext","<p>Bullet <strong>1</strong></p>"
"seo","title","seo","SEO Title"
"site","slug","slug","stretton"
`;

const typeMatrix = parseCSV(typeTestCsv);
const typeRows = extractSheetRows(typeMatrix);
const typeContent = transformSheetRows(typeRows);

assert(typeContent.stats?.cameras_count === 4, 'Number parsed integer correctly (4)');
assert(typeContent.stats?.rating === 4.9, 'Number parsed float correctly (4.9)');
assert(typeContent.stats?.invalid_number === 'N/A', 'Invalid number falls back to string');
assert(typeContent.features?.has_ai === true, 'Boolean parsed "true" -> true');
assert(typeContent.features?.has_subscription === false, 'Boolean parsed "FALSE" -> false');
assert(typeContent.features?.custom_text === 'High Definition', 'Text preserved as string');
assert(typeContent.features?.rich_html === '<p>Bullet <strong>1</strong></p>', 'Richtext preserved');
assert(typeContent.seo?.title === 'SEO Title', 'SEO preserved');
assert(typeContent.site?.slug === 'stretton', 'Slug preserved');

// 5. Blank Rows and Whitespace Handling
console.log('\n--- 5. Blank Rows & Extra Whitespace Handling ---');
const blankRowsCsv = `

"section_id","field","type","value"

"site","suburb","text","Stretton"
,,,
"site","slug","slug","stretton"

`;

const blankMatrix = parseCSV(blankRowsCsv);
const blankRows = extractSheetRows(blankMatrix);
const blankContent = transformSheetRows(blankRows);

assert(blankRows.length === 2, 'Ignored leading, trailing, and intermediate blank rows');
assert(blankContent.site?.suburb === 'Stretton', 'Extracted suburb successfully from spaced rows');
assert(blankContent.site?.slug === 'stretton', 'Preserved slug');

// 6. Validation: Missing Required Headers
console.log('\n--- 6. Validation on Missing Required Headers ---');
const missingHeaderCsv = `"section_id","field","value"
"site","suburb","Logan"
`;
let missingHeaderCaught = false;
try {
  const m = parseCSV(missingHeaderCsv);
  extractSheetRows(m);
} catch (err: any) {
  missingHeaderCaught = true;
  assert(err.message.includes('Missing required CSV header(s): type'), `Caught missing header error: "${err.message}"`);
}
assert(missingHeaderCaught, 'Missing required header correctly threw fatal error');

// 7. Validation: Duplicate Headers
console.log('\n--- 7. Validation on Duplicate Headers ---');
const duplicateHeaderCsv = `"section_id","field","type","value","field"
"site","suburb","text","Logan","duplicate"
`;
let duplicateHeaderCaught = false;
try {
  const m = parseCSV(duplicateHeaderCsv);
  extractSheetRows(m);
} catch (err: any) {
  duplicateHeaderCaught = true;
  assert(err.message.includes('Duplicate header detected in CSV: "field"'), `Caught duplicate header error: "${err.message}"`);
}
assert(duplicateHeaderCaught, 'Duplicate header correctly threw fatal error');

// 8. Multi-line and Quoted CSV Strings (RFC 4180)
console.log('\n--- 8. Multi-line and Quoted String Values (RFC 4180) ---');
const multiLineCsv = `"section_id","field","type","value"
"hero","description","richtext","Line 1
Line 2 with ""quotes"" and , commas"
`;
const mlMatrix = parseCSV(multiLineCsv);
const mlRows = extractSheetRows(mlMatrix);
const mlContent = transformSheetRows(mlRows);

assert(
  mlContent.hero?.description === 'Line 1\nLine 2 with "quotes" and , commas',
  'Multi-line richtext with escaped quotes parsed cleanly'
);

// 9. Malformed and Incomplete Rows (Skipped gracefully)
console.log('\n--- 9. Malformed & Incomplete Rows Handling ---');
const malformedCsv = `"section_id","field","type","value"
"","only_field","text","some value"
"only_section","","text","some value"
"site","suburb","text","Valid Suburb"
`;
const malformedMatrix = parseCSV(malformedCsv);
const malformedRows = extractSheetRows(malformedMatrix);
const malformedContent = transformSheetRows(malformedRows);

assert(malformedRows.length === 1, 'Skipped rows with missing section_id or missing field');
assert(malformedContent.site?.suburb === 'Valid Suburb', 'Extracted only valid row');

// 10. Unknown Slug Handling
console.log('\n--- 10. Unknown / Dynamic Slug Mapping ---');
const unknownSlug = 'some-unheard-of-suburb';
const mappedTab = slugToTabName(unknownSlug);
assert(mappedTab === 'Some Unheard Of Suburb', 'Dynamically title-cases arbitrary suburb slugs');

// 11. Partial Suburb Content & Optional Hero Fields (Stretton 6-Field Dataset)
console.log('\n--- 11. Partial Suburb Content & Optional Hero Fields (Stretton 6-Field Dataset) ---');
const strettonPartialCsv = `"section_id","field","type","value"
"site","suburb","text","Stretton"
"site","slug","slug","stretton"
"hero","heading","text","CCTV & Security Camera Installation in Stretton"
"hero","description","richtext","Professionally installed camera systems for local homes and businesses, with tidy cabling, clear night footage, mobile viewing and practical after-installation support."
"seo","title","seo","CCTV & Security Camera Installation in Stretton | CCTV Stretton"
"seo","description","seo","Professionally installed CCTV & security camera systems for local homes and businesses in Stretton and surrounding Brisbane South suburbs. Licensed QLD installers, tidy cabling, clear night vision, mobile viewing."
`;

const strettonMatrix = parseCSV(strettonPartialCsv);
const strettonRows = extractSheetRows(strettonMatrix);

// 1. Verify exactly 6 rows extracted
assert(strettonRows.length === 6, 'Extracted exactly 6 sheet rows for Stretton partial dataset');

const strettonContent = transformSheetRows(strettonRows);

// 2. Verify site, hero, and seo are grouped correctly and values preserved
assert(strettonContent.site?.suburb === 'Stretton', 'site.suburb matches "Stretton"');
assert(strettonContent.site?.slug === 'stretton', 'site.slug matches "stretton"');
assert(
  strettonContent.hero?.heading === 'CCTV & Security Camera Installation in Stretton',
  'hero.heading matches exact Stretton H1'
);
assert(
  strettonContent.hero?.description ===
    'Professionally installed camera systems for local homes and businesses, with tidy cabling, clear night footage, mobile viewing and practical after-installation support.',
  'hero.description matches exact Stretton lead paragraph'
);
assert(
  strettonContent.seo?.title === 'CCTV & Security Camera Installation in Stretton | CCTV Stretton',
  'seo.title matches exact Stretton page title'
);
assert(
  strettonContent.seo?.description ===
    'Professionally installed CCTV & security camera systems for local homes and businesses in Stretton and surrounding Brisbane South suburbs. Licensed QLD installers, tidy cabling, clear night vision, mobile viewing.',
  'seo.description matches exact Stretton meta description'
);

// 3. Verify missing optional fields are accepted and undefined (not invented)
assert(strettonContent.hero?.subheading === undefined, 'Missing hero.subheading is accepted and undefined');
assert(strettonContent.hero?.bullet_1 === undefined, 'Missing hero.bullet_1 is accepted and undefined');
assert(strettonContent.hero?.bullet_2 === undefined, 'Missing hero.bullet_2 is accepted and undefined');
assert(strettonContent.hero?.bullet_3 === undefined, 'Missing hero.bullet_3 is accepted and undefined');

// 4. Verify no extra/invented keys exist on hero
const heroKeys = Object.keys(strettonContent.hero || {}).sort();
assert(
  JSON.stringify(heroKeys) === JSON.stringify(['description', 'heading']),
  'hero contains only "heading" and "description" without invented keys'
);

console.log('\n========================================');
console.log('ALL UNIT TESTS COMPLETED SUCCESSFULLY!');
console.log('========================================\n');


