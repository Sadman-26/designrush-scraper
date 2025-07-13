import { readInputSheet, writeOutputSheet } from './google-sheets.js';
import { scrapeAgencies } from './scraper.js';

async function main() {
  console.log('Reading input names from Google Sheet...');
  const names = await readInputSheet();
  if (!names.length) {
    console.log('No input names found in the input worksheet.');
    console.log('Please add search keywords to the input worksheet and run the scraper again.');
    return;
  }
  console.log(`Found ${names.length} search keywords. Starting scraping...`);
  const results = await scrapeAgencies(names);
  if (!results.length) {
    console.log('No results scraped. This might be due to:');
    console.log('- No search results found for the keywords');
    console.log('- Website structure changes');
    console.log('- Network connectivity issues');
    return;
  }
  // Prepare rows for output
  const headers = ['Search Name', 'Title', 'Address', 'Website', 'Employees', 'Services', 'Industries', 'Client Types', 'Review Rating', 'Review Count', 'Areas of Expertise'];
  const rows = [headers, ...results.map(r => [
    r.searchName,
    r.title,
    r.address,
    r.website,
    r.employees,
    r.services,
    r.industries,
    r.clientTypes,
    r.reviewRating,
    r.reviewCount,
    r.areasOfExpertise
  ])];
  console.log(`Writing ${results.length} results to Google Sheet...`);
  await writeOutputSheet(rows);

  // Prepare and write reviews to a separate worksheet
  const reviewHeaders = ['Search Name', 'Agency Title', 'Author Name', 'Author Position', 'Review Item Title', 'Review Type', 'Review Description'];
  const reviewRows = [reviewHeaders];
  for (const r of results) {
    let reviews = [];
    try {
      reviews = JSON.parse(r.reviews || '[]');
    } catch (e) {}
    for (const review of reviews) {
      reviewRows.push([
        r.searchName,
        r.title,
        review.authorName,
        review.authorPosition,
        review.reviewItemTitle,
        review.reviewType,
        review.reviewDescription
      ]);
    }
  }
  // Write to 'reviews' worksheet
  await writeOutputSheet(reviewRows, 'reviews');
  console.log('Reviews written to separate worksheet!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 