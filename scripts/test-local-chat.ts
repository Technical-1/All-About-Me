/**
 * Puppeteer test script for local WebLLM chat
 *
 * Tests the browser-based AI chat that runs locally using WebGPU.
 * Requires a browser with WebGPU support (Chrome 113+).
 */

import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:4321';
const CHAT_URL = `${BASE_URL}/chat`;

// Test queries organized by category
const TEST_QUERIES = [
  // Personal Info
  { query: "Where does Jacob work?", keywords: ["Deloitte"], category: "Personal" },
  { query: "What degree does Jacob have?", keywords: ["Computer Engineering", "Florida"], category: "Personal" },
  { query: "What is Jacob's email?", keywords: ["jacobkanfer", "gmail"], category: "Personal" },

  // Skills
  { query: "Does Jacob know Python?", keywords: ["Python"], category: "Skills" },
  { query: "What frameworks does Jacob use?", keywords: ["React"], category: "Skills" },

  // Experience
  { query: "Tell me about the AHSR project", keywords: ["robot", "hospital"], category: "Experience" },
  { query: "What was Jacob's internship?", keywords: ["World Wide Technology", "Data Science"], category: "Experience" },

  // Projects
  { query: "What projects has Jacob built?", keywords: ["BTC", "Git"], category: "Projects" },

  // Blog
  { query: "Has Jacob written any blog posts?", keywords: ["blog", "WebLLM"], category: "Blog" },
];

interface TestResult {
  query: string;
  category: string;
  passed: boolean;
  keywordsFound: string[];
  keywordsMissing: string[];
  response: string;
  duration: number;
}

async function initializeLocalChat(page: Page): Promise<boolean> {
  console.log('Navigating to chat page...');
  await page.goto(CHAT_URL, { waitUntil: 'networkidle2' });

  // Wait for React to hydrate
  await new Promise(r => setTimeout(r, 1000));

  // Check if we're in cloud mode and need to switch to local
  const modeToggle = await page.$('button[role="switch"]');
  if (modeToggle) {
    const isCloudMode = await page.evaluate((btn) => {
      return btn.getAttribute('aria-checked') === 'true';
    }, modeToggle);

    if (isCloudMode) {
      console.log('Switching to local mode...');
      await modeToggle.click();
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Check for "Start Chat" button (local mode initial state)
  const startButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent?.includes('Start Chat')) || null;
  });
  const startButtonElement = startButton.asElement();
  if (startButtonElement) {
    console.log('Clicking "Start Chat" to initialize WebLLM...');
    await startButtonElement.click();

    // Wait for model to load (this can take a while on first load)
    console.log('Waiting for WebLLM model to load (this may take several minutes on first run)...');

    try {
      // Wait for the loading to complete - look for the chat input to appear
      await page.waitForSelector('input[placeholder*="Ask about Jacob"]', { timeout: 300000 }); // 5 min timeout
      console.log('WebLLM model loaded successfully!');
      return true;
    } catch (e) {
      // Check if there's an error state
      const errorElement = await page.evaluateHandle(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.find(h => h.textContent?.includes('WebGPU')) || null;
      });
      const errorH3 = errorElement.asElement();
      if (errorH3) {
        const errorText = await page.evaluate(el => el.textContent, errorH3);
        console.error(`WebGPU Error: ${errorText}`);
        return false;
      }
      throw e;
    }
  }

  // Already initialized - check if chat input exists
  const chatInput = await page.$('input[placeholder*="Ask about Jacob"]');
  return chatInput !== null;
}

async function sendMessage(page: Page, message: string): Promise<string> {
  // Find and fill the input
  const input = await page.$('input[type="text"]');
  if (!input) throw new Error('Chat input not found');

  // Clear and type the message
  await input.click({ clickCount: 3 }); // Select all
  await page.keyboard.press('Backspace');
  await input.type(message, { delay: 10 });

  // Click send button
  const sendButton = await page.$('button[type="submit"]');
  if (!sendButton) throw new Error('Send button not found');

  // Count current messages before sending
  const messagesBefore = await page.$$('.chat-bubble-ai');
  const countBefore = messagesBefore.length;

  await sendButton.click();

  // Wait for user message to appear first
  await new Promise(r => setTimeout(r, 300));

  // Wait for a new assistant message to appear (different from previous count)
  await page.waitForFunction(
    (prevCount: number) => {
      const messages = document.querySelectorAll('.chat-bubble-ai');
      // Also check the last message has actual content (not empty or just loading dots)
      if (messages.length > prevCount) {
        const lastMsg = messages[messages.length - 1];
        const text = lastMsg.textContent?.trim() || '';
        // Make sure it's not just loading dots
        const hasContent = text.length > 10 && !text.includes('●');
        return hasContent;
      }
      return false;
    },
    { timeout: 180000 }, // 3 min timeout for WebLLM response
    countBefore
  );

  // Wait a bit for the response to fully render
  await new Promise(r => setTimeout(r, 500));

  // Get the last assistant message
  const messages = await page.$$('.chat-bubble-ai');
  if (messages.length === 0) throw new Error('No assistant response found');

  const lastMessage = messages[messages.length - 1];
  const response = await page.evaluate(el => el.textContent || '', lastMessage);

  return response;
}

async function runTest(page: Page, query: string, keywords: string[]): Promise<{ passed: boolean; found: string[]; missing: string[]; response: string }> {
  const response = await sendMessage(page, query);
  const responseLower = response.toLowerCase();

  const found: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    if (responseLower.includes(keyword.toLowerCase())) {
      found.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return {
    passed: found.length > 0,
    found,
    missing,
    response
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('LOCAL WEBLLM CHAT TEST SUITE');
  console.log('='.repeat(60));
  console.log('');

  let browser: Browser | null = null;

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // WebGPU often requires headed mode
      args: [
        '--enable-unsafe-webgpu',
        '--enable-features=Vulkan',
        '--use-vulkan',
        '--disable-vulkan-surface',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--ignore-gpu-blocklist',
      ],
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Initialize local chat
    const initialized = await initializeLocalChat(page);

    if (!initialized) {
      console.error('\n❌ Failed to initialize local chat. WebGPU may not be available.');
      console.log('\nTroubleshooting:');
      console.log('- Ensure you are using Chrome 113+ or Edge 113+');
      console.log('- Check that WebGPU is enabled: chrome://flags/#enable-unsafe-webgpu');
      console.log('- Verify GPU drivers are up to date');
      console.log('- Check chrome://gpu for WebGPU status');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('Running tests...');
    console.log('='.repeat(60) + '\n');

    const results: TestResult[] = [];

    for (const test of TEST_QUERIES) {
      console.log(`Testing: "${test.query}"`);
      const startTime = Date.now();

      try {
        const result = await runTest(page, test.query, test.keywords);
        const duration = Date.now() - startTime;

        results.push({
          query: test.query,
          category: test.category,
          passed: result.passed,
          keywordsFound: result.found,
          keywordsMissing: result.missing,
          response: result.response,
          duration
        });

        if (result.passed) {
          console.log(`  ✅ PASSED (${(duration / 1000).toFixed(1)}s) - Found: ${result.found.join(', ')}`);
        } else {
          console.log(`  ❌ FAILED (${(duration / 1000).toFixed(1)}s) - Missing: ${result.missing.join(', ')}`);
        }

        // Small delay between queries
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          query: test.query,
          category: test.category,
          passed: false,
          keywordsFound: [],
          keywordsMissing: test.keywords,
          response: `Error: ${error}`,
          duration
        });
        console.log(`  ❌ ERROR (${(duration / 1000).toFixed(1)}s) - ${error}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const passRate = Math.round((passed / total) * 100);

    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${total}`);
    console.log(`Pass Rate: ${passRate}%`);

    // Write results to file
    const resultsMarkdown = generateResultsMarkdown(results, passed, failed, total, passRate);
    const fs = await import('fs/promises');
    await fs.writeFile('docs/local-chat-test-results.md', resultsMarkdown);
    console.log('\nResults written to: docs/local-chat-test-results.md');

  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateResultsMarkdown(
  results: TestResult[],
  passed: number,
  failed: number,
  total: number,
  passRate: number
): string {
  const timestamp = new Date().toLocaleString();

  let md = `# Local WebLLM Chat Test Results

Generated: ${timestamp}

## Summary

- **Passed:** ${passed}
- **Failed:** ${failed}
- **Total:** ${total}
- **Pass Rate:** ${passRate}%

---

## Test Results

`;

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    md += `### ${category}\n\n`;
    md += `| Query | Result | Duration | Keywords Found |\n`;
    md += `|-------|--------|----------|----------------|\n`;

    for (const result of categoryResults) {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      const duration = `${(result.duration / 1000).toFixed(1)}s`;
      const keywords = result.keywordsFound.length > 0
        ? result.keywordsFound.join(', ')
        : `Missing: ${result.keywordsMissing.join(', ')}`;
      md += `| ${result.query} | ${status} | ${duration} | ${keywords} |\n`;
    }
    md += '\n';
  }

  md += `## Response Details\n\n`;

  for (const result of results) {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    md += `### ${status}: ${result.query}\n`;
    md += `**Category:** ${result.category}\n`;
    md += `**Duration:** ${(result.duration / 1000).toFixed(1)}s\n\n`;
    md += `<details><summary>Response</summary>\n\n`;
    md += `${result.response.substring(0, 500)}${result.response.length > 500 ? '...' : ''}\n\n`;
    md += `</details>\n\n`;
  }

  return md;
}

main().catch(console.error);
