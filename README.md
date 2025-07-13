# DesignRush Agency Scraper

This Node.js project scrapes agency/company data from [designrush.com/agency](https://www.designrush.com/agency) using Selenium and reads/writes data to Google Sheets.

## Features
- Reads agency search parameters from a Google Sheet (`input` worksheet):
  - Column A: Business (subcategory, e.g., "Software Developers")
  - Column B: Category (main category, e.g., "Software Development")
- Scrapes title, address, website, number of employees, services, industries, client types, review rating, review count, and areas of expertise for each agency
- Writes agency-level results to the `output` worksheet in the same Google Sheet
- Scrapes all reviews for each agency (author name, author position, review item title, review type, review description)
- Writes all reviews to a separate `reviews` worksheet, with each review in its own row and columns for all review fields
- Humanlike browser behavior to avoid bot detection

## Setup

### 1. Clone the repository
```
git clone <repo-url>
cd designrush-scraper
```

### 2. Install dependencies
```
npm install
```

### 3. Google Cloud Setup
- Create a Google Cloud project and enable the Google Sheets and Drive APIs
- Create a service account and download the credentials JSON file
- Share your target Google Sheet with the service account email

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/credentials.json
GOOGLE_SHEET_NAME=your_google_sheet_name
```

### 5. Prepare Your Google Sheet
- Worksheet named `input` with search parameters:
  - Column A: Business (e.g., "Software Developers")
  - Column B: Category (e.g., "Software Development")
  - (No location column needed)
- Worksheet named `output` (agency-level results will be appended here)
- Worksheet named `reviews` (all reviews for all agencies will be appended here)

## Usage
```
npm start
```

## Output
- Results are written to the `output` worksheet in your Google Sheet, with columns:
  - Search Name, Title, Address, Website, Employees, Services, Industries, Client Types, Review Rating, Review Count, Areas of Expertise
- All reviews are written to the `reviews` worksheet, with columns:
  - Search Name, Agency Title, Author Name, Author Position, Review Item Title, Review Type, Review Description

## Notes
- The scraper uses random delays and humanlike navigation to mimic real users.
- If multiple sheets have the same name, the first found will be used.
- Make sure your service account has access to the sheet.
- The location filter is no longer used; only business and category are required.

---

**For any issues or feature requests, please open an issue or contact the maintainer.** 