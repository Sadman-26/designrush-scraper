import { Builder, By } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

function randomDelay(min = 500, max = 1200) {
  return new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

const MAX_ITEMS_PER_KEYWORD = parseInt(process.env.MAX_ITEMS_PER_KEYWORD, 10) || 3;

export async function scrapeAgencies(paramsList) {
  const userAgent = USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)];
  const width = randomInt(1200, 1600);
  const height = randomInt(700, 1000);

  let driver;
  let chromeOptions;

  const createDriver = async () => {
    chromeOptions = new chrome.Options();
    chromeOptions.addArguments(
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-blink-features=AutomationControlled',
      `--user-agent=${userAgent}`,
      `--window-size=${width},${height}`
    );
    const headless = process.env.CHROME_HEADLESS === 'True';
    if (headless) {
      chromeOptions.addArguments('--headless=new');
    } else {
      chromeOptions.addArguments('--start-maximized');
    }
    const newDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    await newDriver.manage().setTimeouts({ pageLoad: 30000, implicit: 10000 });
    return newDriver;
  };

  try {
    driver = await createDriver();
    const results = [];

    for (const params of paramsList) {
      const { business, category, location } = params;
      console.log(`Processing: business='${business}', category='${category}', location='${location}'`);
      try {
        // Check if browser is still responsive, restart if needed
        try {
          await driver.getCurrentUrl();
        } catch (browserError) {
          console.log('Browser session lost, restarting...');
          if (driver) {
            try { await driver.quit(); } catch (e) {}
          }
          driver = await createDriver();
        }
        await driver.get('https://www.designrush.com');
        await randomDelay();
        // 1. Click the main category in the nav (category param)
        const navCategorySelector = '.js-service-category-nav ul li';
        let foundCategory = false;
        const navCategories = await driver.findElements(By.css(navCategorySelector));
        for (const navCat of navCategories) {
          const text = await navCat.getText();
          if (text && text.toLowerCase().includes(category.toLowerCase())) {
            await navCat.click();
            foundCategory = true;
            await randomDelay();
            break;
          }
        }
        if (!foundCategory) {
          console.log(`Category '${category}' not found, skipping...`);
          continue;
        }
        // 2. Click the subcategory (business param) in the revealed section
        const sectionSelector = `.section-item.active ul li a`;
        let foundBusiness = false;
        const businessLinks = await driver.findElements(By.css(sectionSelector));
        for (const link of businessLinks) {
          const text = await link.getText();
          if (text && text.toLowerCase().includes(business.toLowerCase())) {
            await link.click();
            foundBusiness = true;
            await randomDelay();
            break;
          }
        }
        if (!foundBusiness) {
          console.log(`Business '${business}' not found in category '${category}', skipping...`);
          continue;
        }
        // 3. On the new page, enter the location in the filter/search bar and trigger search
        // (Location search removed as per user request)
        // 4. Wait for results and scrape as before
        await randomDelay();
        // Use the new selector for each agency item
        for (let i = 0; i < MAX_ITEMS_PER_KEYWORD; i++) {
          let agencyButtons = await driver.findElements(By.css('button.btn-view-portfolio.js-item-overlay-open'));
          if (!agencyButtons[i]) {
            console.log(`No more agency items at index ${i}`);
            break;
          }
          try {
            // Scroll into view before clicking
            await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', agencyButtons[i]);
            await randomDelay(300, 600);
            await agencyButtons[i].click();
            await randomDelay();
            // Wait for overlay to appear
            // Now click the 'visit full profile' link in the overlay
            let profileLink;
            try {
              profileLink = await driver.findElement(By.css('a.view-profile.js--agency-profile-link'));
              // Open in new tab
              const originalTabs = await driver.getAllWindowHandles();
              await driver.executeScript('window.open(arguments[0].href, "_blank");', profileLink);
              await randomDelay();
              // Switch to new tab
              let newTab = null;
              for (let tries = 0; tries < 10; tries++) {
                const tabs = await driver.getAllWindowHandles();
                if (tabs.length > originalTabs.length) {
                  newTab = tabs.find(t => !originalTabs.includes(t));
                  break;
                }
                await randomDelay(300, 600);
              }
              if (!newTab) {
                console.log(`No new tab detected for profile link at item ${i + 1}`);
                // Try to close overlay and continue
                try {
                  const closeBtn = await driver.findElement(By.css('.overlay-close, .modal-close, .js-overlay-close'));
                  await closeBtn.click();
                  await randomDelay();
                } catch (e) {
                  await driver.actions().sendKeys('\uE00C').perform();
                  await randomDelay();
                }
                continue;
              }
              await driver.switchTo().window(newTab);
              await randomDelay();
              // Scrape data from full profile
              const data = await driver.executeScript(() => {
                const getText = (selector) => {
                  const el = document.querySelector(selector);
                  return el ? el.innerText.trim() : '';
                };
                const getList = (selector) => {
                  const elements = document.querySelectorAll(selector);
                  return Array.from(elements).map(el => el.innerText.trim()).join(', ');
                };
                // Company name logic
                let companyName = getText('.company-title') || getText('h1') || getText('.agency-title') || getText('.profile-title') || '';
                // Employees logic
                let employees = '';
                const overviewItems = document.querySelectorAll('.overview-adds--item');
                overviewItems.forEach(item => {
                  const title = item.querySelector('.overview-adds--title')?.innerText.trim();
                  if (title && title.toLowerCase().includes('number of employees')) {
                    employees = item.querySelector('.overview-adds--text')?.innerText.trim() || '';
                  }
                });
                // Reviews logic
                let reviewRating = '';
                let reviewCount = '';
                const reviewBlock = document.querySelector('.profile-header--reviews');
                if (reviewBlock) {
                  const ratingEl = reviewBlock.querySelector('.review-rating');
                  const countEl = reviewBlock.querySelector('.review-count');
                  reviewRating = ratingEl ? ratingEl.innerText.trim() : '';
                  if (countEl) {
                    const match = countEl.innerText.match(/\((\d+) reviews?\)/);
                    reviewCount = match ? match[1] : '';
                  }
                }
                // Areas of Expertise logic
                let areasOfExpertise = '';
                const expertiseEls = document.querySelectorAll('.aoe__tab-item.js-expertise-tab span');
                if (expertiseEls && expertiseEls.length > 0) {
                  areasOfExpertise = Array.from(expertiseEls).map(el => el.innerText.trim()).join(', ');
                }
                // Reviews section (detailed)
                let reviews = [];
                const reviewItems = document.querySelectorAll('.review-list.js-review-list > .tab-review--list-item');
                for (const item of reviewItems) {
                  const authorName = item.querySelector('.review-author-name')?.innerText.trim() || '';
                  const authorPosition = item.querySelector('.review-author-position')?.innerText.trim() || '';
                  const reviewItemTitle = item.querySelector('.item-title')?.innerText.trim() || '';
                  const reviewType = item.querySelector('.item-type span')?.innerText.trim() || '';
                  const reviewDescription = item.querySelector('.tab-review--item-description.desktop')?.innerText.trim() || '';
                  reviews.push({
                    authorName,
                    authorPosition,
                    reviewItemTitle,
                    reviewType,
                    reviewDescription
                  });
                }
                return {
                  title: companyName,
                  address: getText('.company-address') || getText('.address') || getText('[class*="address"]'),
                  website: (() => {
                    const el = document.querySelector('.profile-header--edit a.site');
                    return el ? el.href : '';
                  })(),
                  employees,
                  services: getList('.services-list li') || getList('.services li') || getList('[class*="service"] li'),
                  industries: getList('.industries-list li') || getList('.industries li') || getList('[class*="industry"] li'),
                  clientTypes: getList('.client-types-list li') || getList('.clients li') || getList('[class*="client"] li'),
                  reviewRating,
                  reviewCount,
                  areasOfExpertise,
                  reviews: JSON.stringify(reviews),
                };
              });
              data.searchName = `${business} | ${category} | ${location}`;
              results.push(data);
              console.log(`Scraped data for: ${data.title}`);
              await randomDelay();
              // Close the tab and switch back
              await driver.close();
              await driver.switchTo().window(originalTabs[0]);
              await randomDelay();
              // Click 'Back to agency listing' to close overlay
              try {
                const backToListingBtn = await driver.findElement(By.css('.item-overlay--close.js-item-overlay-close'));
                await backToListingBtn.click();
                await randomDelay();
              } catch (e) {
                // Fallback: try to close overlay with other close buttons or ESC
                try {
                  const closeBtn = await driver.findElement(By.css('.overlay-close, .modal-close, .js-overlay-close'));
                  await closeBtn.click();
                  await randomDelay();
                } catch (e) {
                  await driver.actions().sendKeys('\uE00C').perform();
                  await randomDelay();
                }
              }
            } catch (e) {
              console.log(`Profile link not found in overlay for item ${i + 1}, skipping...`);
              // Try to close overlay and continue
              try {
                const closeBtn = await driver.findElement(By.css('.overlay-close, .modal-close, .js-overlay-close'));
                await closeBtn.click();
                await randomDelay();
              } catch (e) {
                await driver.actions().sendKeys('\uE00C').perform();
                await randomDelay();
              }
              continue;
            }
          } catch (e) {
            console.log(`Error processing agency ${i + 1} for "${business} | ${category} | ${location}":`, e.message);
            await randomDelay();
            continue;
          }
        }
        await randomDelay(500, 1000); // Wait between searches
      } catch (e) {
        console.log(`Error searching for "${business} | ${category} | ${location}":`, e.message);
        continue;
      }
    }
    return results;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
} 