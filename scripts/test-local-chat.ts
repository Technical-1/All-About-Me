/**
 * Puppeteer test script for AI chat (both local WebLLM and cloud modes)
 *
 * Tests the browser-based AI chat functionality.
 * - Local mode requires WebGPU support (Chrome 113+)
 * - Cloud mode works in any browser
 *
 * Supports streaming responses in both modes.
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

type ChatMode = 'local' | 'cloud';

interface TestResult {
  query: string;
  category: string;
  mode: ChatMode;
  passed: boolean;
  keywordsFound: string[];
  keywordsMissing: string[];
  response: string;
  duration: number;
  streaming: boolean;
}

async function checkWebGPUSupported(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      const device = await adapter.requestDevice();
      return device !== null;
    } catch {
      return false;
    }
  });
}

async function getCurrentMode(page: Page): Promise<ChatMode | null> {
  // Check for mode toggle
  const modeToggle = await page.$('button[role="switch"]');
  if (modeToggle) {
    const isCloudMode = await page.evaluate((btn) => {
      return btn.getAttribute('aria-checked') === 'true';
    }, modeToggle);
    return isCloudMode ? 'cloud' : 'local';
  }

  // Check for cloud-only header (no toggle)
  const cloudOnlyHeader = await page.evaluate(() => {
    const headers = document.querySelectorAll('.px-4.py-2.border-b');
    for (const h of headers) {
      if (h.textContent?.includes('Cloud Mode')) return true;
    }
    return false;
  });

  if (cloudOnlyHeader) return 'cloud';
  return null;
}

async function switchToMode(page: Page, targetMode: ChatMode): Promise<boolean> {
  const currentMode = await getCurrentMode(page);
  if (currentMode === null) {
    console.log('  Could not determine current mode');
    return false;
  }
  if (currentMode === targetMode) {
    return true;
  }

  const modeToggle = await page.$('button[role="switch"]');
  if (!modeToggle) {
    console.log(`  Cannot switch to ${targetMode} mode - no toggle available (WebGPU not supported)`);
    return targetMode === 'cloud'; // Can only use cloud mode
  }

  await modeToggle.click();
  await new Promise(r => setTimeout(r, 500));

  const newMode = await getCurrentMode(page);
  return newMode === targetMode;
}

async function initializeLocalChat(page: Page): Promise<boolean> {
  // Check for "Start Chat" button (local mode initial state)
  const startButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent?.includes('Start Chat')) || null;
  });
  const startButtonElement = startButton.asElement();
  if (startButtonElement) {
    console.log('  Clicking "Start Chat" to initialize WebLLM...');
    await startButtonElement.click();

    // Wait for model to load (this can take a while on first load)
    console.log('  Waiting for WebLLM model to load (this may take several minutes on first run)...');

    try {
      // Wait for the loading to complete - look for the chat input to appear
      await page.waitForSelector('input[placeholder*="Ask about Jacob"]', { timeout: 300000 }); // 5 min timeout
      console.log('  WebLLM model loaded successfully!');
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
        console.error(`  WebGPU Error: ${errorText}`);
        return false;
      }
      throw e;
    }
  }

  // Already initialized - check if chat input exists
  const chatInput = await page.$('input[placeholder*="Ask about Jacob"]');
  return chatInput !== null;
}

async function waitForStreamingComplete(page: Page, countBefore: number): Promise<void> {
  // Wait for streaming to complete
  // Strategy: wait for new message to appear, then wait for cursor to disappear
  await page.waitForFunction(
    (prevCount: number) => {
      // Check for streaming content (has cursor)
      const streamingCursor = document.querySelector('.chat-bubble-ai .animate-pulse');
      if (streamingCursor) {
        // Still streaming - wait
        return false;
      }

      // Check if we have a new message
      const messages = document.querySelectorAll('.chat-bubble-ai');
      if (messages.length > prevCount) {
        const lastMsg = messages[messages.length - 1];
        const text = lastMsg.textContent?.trim() || '';
        // Make sure it has content
        return text.length > 10;
      }
      return false;
    },
    { timeout: 180000 }, // 3 min timeout
    countBefore
  );
}

async function sendMessage(page: Page, message: string): Promise<{ response: string; streaming: boolean }> {
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

  // Check if streaming is happening
  let detectedStreaming = false;
  const streamingCheck = await page.$('.chat-bubble-ai .animate-pulse');
  if (streamingCheck) {
    detectedStreaming = true;
  }

  // Wait for streaming/response to complete
  await waitForStreamingComplete(page, countBefore);

  // Wait a bit for the response to fully render
  await new Promise(r => setTimeout(r, 500));

  // Get the last assistant message
  const messages = await page.$$('.chat-bubble-ai');
  if (messages.length === 0) throw new Error('No assistant response found');

  const lastMessage = messages[messages.length - 1];
  const response = await page.evaluate(el => el.textContent || '', lastMessage);

  return { response, streaming: detectedStreaming };
}

async function runTest(
  page: Page,
  query: string,
  keywords: string[],
  mode: ChatMode
): Promise<{ passed: boolean; found: string[]; missing: string[]; response: string; streaming: boolean }> {
  const { response, streaming } = await sendMessage(page, query);
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
    response,
    streaming
  };
}

async function runTestsForMode(
  page: Page,
  mode: ChatMode,
  webGPUSupported: boolean
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  if (mode === 'local' && !webGPUSupported) {
    console.log(`\n⏭️  Skipping local mode tests - WebGPU not supported`);
    return results;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${mode.toUpperCase()} MODE tests...`);
  console.log('='.repeat(60) + '\n');

  // Navigate to chat page fresh for each mode
  await page.goto(CHAT_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000)); // Wait for React hydration

  // Switch to the target mode
  const switched = await switchToMode(page, mode);
  if (!switched) {
    console.log(`  Failed to switch to ${mode} mode`);
    return results;
  }

  // For local mode, initialize the engine
  if (mode === 'local') {
    const initialized = await initializeLocalChat(page);
    if (!initialized) {
      console.log(`  Failed to initialize local WebLLM engine`);
      return results;
    }
  } else {
    // For cloud mode, wait for initial greeting
    await page.waitForSelector('.chat-bubble-ai', { timeout: 5000 });
  }

  // Run each test
  for (const test of TEST_QUERIES) {
    console.log(`Testing [${mode}]: "${test.query}"`);
    const startTime = Date.now();

    try {
      const result = await runTest(page, test.query, test.keywords, mode);
      const duration = Date.now() - startTime;

      results.push({
        query: test.query,
        category: test.category,
        mode,
        passed: result.passed,
        keywordsFound: result.found,
        keywordsMissing: result.missing,
        response: result.response,
        duration,
        streaming: result.streaming
      });

      const streamIcon = result.streaming ? '📡' : '📦';
      if (result.passed) {
        console.log(`  ✅ PASSED ${streamIcon} (${(duration / 1000).toFixed(1)}s) - Found: ${result.found.join(', ')}`);
      } else {
        console.log(`  ❌ FAILED ${streamIcon} (${(duration / 1000).toFixed(1)}s) - Missing: ${result.missing.join(', ')}`);
      }

      // Small delay between queries
      await new Promise(r => setTimeout(r, 1000));

    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({
        query: test.query,
        category: test.category,
        mode,
        passed: false,
        keywordsFound: [],
        keywordsMissing: test.keywords,
        response: `Error: ${error}`,
        duration,
        streaming: false
      });
      console.log(`  ❌ ERROR (${(duration / 1000).toFixed(1)}s) - ${error}`);
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const testCloudOnly = args.includes('--cloud-only');
  const testLocalOnly = args.includes('--local-only');

  console.log('='.repeat(60));
  console.log('AI CHAT TEST SUITE');
  console.log('='.repeat(60));
  console.log('');
  console.log('Legend: 📡 = Streaming response | 📦 = Non-streaming response');
  console.log('');

  if (testCloudOnly) {
    console.log('Mode: Cloud only (--cloud-only)');
  } else if (testLocalOnly) {
    console.log('Mode: Local only (--local-only)');
  } else {
    console.log('Mode: Both cloud and local');
  }
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
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to chat page to check WebGPU support
    console.log('Navigating to chat page...');
    await page.goto(CHAT_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    const webGPUSupported = await checkWebGPUSupported(page);
    console.log(`WebGPU supported: ${webGPUSupported ? 'Yes ✅' : 'No ❌'}`);

    const allResults: TestResult[] = [];

    // Run cloud mode tests first (always available)
    if (!testLocalOnly) {
      const cloudResults = await runTestsForMode(page, 'cloud', webGPUSupported);
      allResults.push(...cloudResults);
    }

    // Run local mode tests if WebGPU is available
    if (!testCloudOnly) {
      const localResults = await runTestsForMode(page, 'local', webGPUSupported);
      allResults.push(...localResults);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    // Summary by mode
    for (const mode of ['cloud', 'local'] as ChatMode[]) {
      const modeResults = allResults.filter(r => r.mode === mode);
      if (modeResults.length === 0) continue;

      const passed = modeResults.filter(r => r.passed).length;
      const failed = modeResults.filter(r => !r.passed).length;
      const total = modeResults.length;
      const passRate = Math.round((passed / total) * 100);
      const streamingCount = modeResults.filter(r => r.streaming).length;

      console.log(`\n${mode.toUpperCase()} MODE:`);
      console.log(`  Passed: ${passed}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Total: ${total}`);
      console.log(`  Pass Rate: ${passRate}%`);
      console.log(`  Streaming responses: ${streamingCount}/${total}`);
    }

    // Overall
    const totalPassed = allResults.filter(r => r.passed).length;
    const totalFailed = allResults.filter(r => !r.passed).length;
    const totalTests = allResults.length;
    const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    console.log(`\nOVERALL:`);
    console.log(`  Passed: ${totalPassed}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Total: ${totalTests}`);
    console.log(`  Pass Rate: ${overallPassRate}%`);

    // Write results to file
    const resultsMarkdown = generateResultsMarkdown(allResults, webGPUSupported);
    const fs = await import('fs/promises');
    await fs.writeFile('docs/chat-test-results.md', resultsMarkdown);
    console.log('\nResults written to: docs/chat-test-results.md');

  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateResultsMarkdown(results: TestResult[], webGPUSupported: boolean): string {
  const timestamp = new Date().toLocaleString();

  let md = `# AI Chat Test Results

Generated: ${timestamp}

## Environment

- **WebGPU Support:** ${webGPUSupported ? 'Yes ✅' : 'No ❌'}

## Summary

`;

  // Summary by mode
  for (const mode of ['cloud', 'local'] as ChatMode[]) {
    const modeResults = results.filter(r => r.mode === mode);
    if (modeResults.length === 0) continue;

    const passed = modeResults.filter(r => r.passed).length;
    const total = modeResults.length;
    const passRate = Math.round((passed / total) * 100);
    const streamingCount = modeResults.filter(r => r.streaming).length;

    md += `### ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode

- **Passed:** ${passed}/${total} (${passRate}%)
- **Streaming:** ${streamingCount}/${total} responses used streaming

`;
  }

  md += `---

## Test Results

`;

  // Results tables by mode
  for (const mode of ['cloud', 'local'] as ChatMode[]) {
    const modeResults = results.filter(r => r.mode === mode);
    if (modeResults.length === 0) continue;

    md += `### ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode

| Query | Result | Duration | Streaming | Keywords Found |
|-------|--------|----------|-----------|----------------|
`;

    for (const result of modeResults) {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      const duration = `${(result.duration / 1000).toFixed(1)}s`;
      const streaming = result.streaming ? '📡 Yes' : '📦 No';
      const keywords = result.keywordsFound.length > 0
        ? result.keywordsFound.join(', ')
        : `Missing: ${result.keywordsMissing.join(', ')}`;
      md += `| ${result.query} | ${status} | ${duration} | ${streaming} | ${keywords} |\n`;
    }
    md += '\n';
  }

  md += `## Response Details

`;

  for (const result of results) {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const streaming = result.streaming ? '📡 Streaming' : '📦 Non-streaming';
    md += `### ${status}: [${result.mode}] ${result.query}

**Category:** ${result.category}
**Duration:** ${(result.duration / 1000).toFixed(1)}s
**Response Type:** ${streaming}

<details><summary>Response</summary>

${result.response.substring(0, 500)}${result.response.length > 500 ? '...' : ''}

</details>

`;
  }

  return md;
}

main().catch(console.error);
