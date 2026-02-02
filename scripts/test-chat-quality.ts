/**
 * Comprehensive AI Chat Quality Test Script
 *
 * Tests BOTH local WebLLM and cloud modes, showing FULL responses
 * and checking for quality issues like:
 * - Unnatural documentation references
 * - Quoting internal labels (FACT:, etc.)
 * - Overly verbose or robotic responses
 *
 * Usage:
 *   npx tsx scripts/test-chat-quality.ts [--local-only] [--cloud-only]
 */

import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:4321';
const CHAT_URL = `${BASE_URL}/chat`;

// Test queries - simpler set for quality testing
const TEST_QUERIES = [
  { query: "What is Jacob's favorite color?", expected: "purple", category: "Personal" },
  { query: "Where does Jacob work?", expected: "Deloitte", category: "Work" },
  { query: "What degree does Jacob have?", expected: ["Computer Engineering", "Florida"], category: "Education" },
  { query: "Does Jacob know Python?", expected: "Python", category: "Skills" },
  { query: "Tell me about the AHSR project", expected: ["robot", "hospital"], category: "Projects" },
];

// Patterns that indicate poor quality responses
const QUALITY_ISSUES = [
  { pattern: /as stated in the/i, issue: "References 'as stated in'" },
  { pattern: /according to the (documentation|facts|information)/i, issue: "References documentation explicitly" },
  { pattern: /FACT:/i, issue: "Quotes internal 'FACT:' label" },
  { pattern: /background information/i, issue: "References 'background information'" },
  { pattern: /retrieved documentation/i, issue: "References 'retrieved documentation'" },
  { pattern: /\(relevance: (HIGH|MEDIUM|LOW)\)/i, issue: "Quotes relevance scores" },
  { pattern: /I don't have personal preferences/i, issue: "Claims to be AI without preferences (irrelevant to question)" },
  { pattern: /as an ai/i, issue: "Unnecessarily references being an AI" },
];

type ChatMode = 'local' | 'cloud';

interface QualityResult {
  query: string;
  category: string;
  mode: ChatMode;
  response: string;
  hasExpectedContent: boolean;
  qualityIssues: string[];
  duration: number;
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
  const modeToggle = await page.$('button[role="switch"]');
  if (modeToggle) {
    const isCloudMode = await page.evaluate((btn) => {
      return btn.getAttribute('aria-checked') === 'true';
    }, modeToggle);
    return isCloudMode ? 'cloud' : 'local';
  }

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
  if (currentMode === null) return false;
  if (currentMode === targetMode) return true;

  const modeToggle = await page.$('button[role="switch"]');
  if (!modeToggle) return targetMode === 'cloud';

  await modeToggle.click();
  await new Promise(r => setTimeout(r, 500));
  return (await getCurrentMode(page)) === targetMode;
}

async function initializeLocalChat(page: Page): Promise<boolean> {
  const startButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent?.includes('Start Chat')) || null;
  });
  const startButtonElement = startButton.asElement();

  if (startButtonElement) {
    console.log('  Initializing WebLLM (this may take a few minutes on first run)...');
    await startButtonElement.click();

    try {
      await page.waitForSelector('input[placeholder*="Ask about Jacob"]', { timeout: 300000 });
      console.log('  WebLLM ready!\n');
      return true;
    } catch {
      return false;
    }
  }

  return (await page.$('input[placeholder*="Ask about Jacob"]')) !== null;
}

async function waitForResponse(page: Page, countBefore: number): Promise<void> {
  await page.waitForFunction(
    (prevCount: number) => {
      const streamingCursor = document.querySelector('.chat-bubble-ai .animate-pulse');
      if (streamingCursor) return false;

      const messages = document.querySelectorAll('.chat-bubble-ai');
      if (messages.length > prevCount) {
        const lastMsg = messages[messages.length - 1];
        return (lastMsg.textContent?.trim().length || 0) > 10;
      }
      return false;
    },
    { timeout: 180000 },
    countBefore
  );
}

async function sendMessage(page: Page, message: string): Promise<string> {
  const input = await page.$('input[type="text"]');
  if (!input) throw new Error('Chat input not found');

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(message, { delay: 10 });

  const sendButton = await page.$('button[type="submit"]');
  if (!sendButton) throw new Error('Send button not found');

  const messagesBefore = await page.$$('.chat-bubble-ai');
  await sendButton.click();
  await new Promise(r => setTimeout(r, 300));
  await waitForResponse(page, messagesBefore.length);
  await new Promise(r => setTimeout(r, 500));

  const messages = await page.$$('.chat-bubble-ai');
  const lastMessage = messages[messages.length - 1];
  return await page.evaluate(el => el.textContent || '', lastMessage);
}

function checkQuality(response: string): string[] {
  const issues: string[] = [];
  for (const { pattern, issue } of QUALITY_ISSUES) {
    if (pattern.test(response)) {
      issues.push(issue);
    }
  }
  return issues;
}

function hasExpectedContent(response: string, expected: string | string[]): boolean {
  const responseLower = response.toLowerCase();
  const keywords = Array.isArray(expected) ? expected : [expected];
  return keywords.some(k => responseLower.includes(k.toLowerCase()));
}

async function runQualityTests(
  page: Page,
  mode: ChatMode,
  webGPUSupported: boolean
): Promise<QualityResult[]> {
  const results: QualityResult[] = [];

  if (mode === 'local' && !webGPUSupported) {
    console.log('\n⏭️  Skipping local mode - WebGPU not supported\n');
    return results;
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  ${mode.toUpperCase()} MODE - Quality Testing`);
  console.log('═'.repeat(70) + '\n');

  await page.goto(CHAT_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  if (!(await switchToMode(page, mode))) {
    console.log(`  Failed to switch to ${mode} mode\n`);
    return results;
  }

  if (mode === 'local') {
    if (!(await initializeLocalChat(page))) {
      console.log('  Failed to initialize local chat\n');
      return results;
    }
  } else {
    await page.waitForSelector('.chat-bubble-ai', { timeout: 5000 });
  }

  for (const test of TEST_QUERIES) {
    console.log(`─────────────────────────────────────────────────────────────────────`);
    console.log(`Query: "${test.query}"`);
    console.log(`Category: ${test.category}`);
    console.log(`─────────────────────────────────────────────────────────────────────`);

    const startTime = Date.now();

    try {
      const response = await sendMessage(page, test.query);
      const duration = Date.now() - startTime;
      const qualityIssues = checkQuality(response);
      const hasContent = hasExpectedContent(response, test.expected);

      results.push({
        query: test.query,
        category: test.category,
        mode,
        response,
        hasExpectedContent: hasContent,
        qualityIssues,
        duration,
      });

      // Print full response
      console.log(`\nFULL RESPONSE (${(duration / 1000).toFixed(1)}s):`);
      console.log('┌' + '─'.repeat(68) + '┐');
      // Word wrap the response for readability
      const wrapped = response.replace(/(.{1,66})\s/g, '$1\n│ ');
      console.log('│ ' + wrapped);
      console.log('└' + '─'.repeat(68) + '┘');

      // Print analysis
      console.log('\nANALYSIS:');
      console.log(`  Content Check: ${hasContent ? '✅ Contains expected keywords' : '❌ Missing expected content'}`);
      console.log(`  Expected: ${Array.isArray(test.expected) ? test.expected.join(' or ') : test.expected}`);

      if (qualityIssues.length > 0) {
        console.log(`  Quality Issues: ❌ Found ${qualityIssues.length} issue(s)`);
        for (const issue of qualityIssues) {
          console.log(`    - ${issue}`);
        }
      } else {
        console.log(`  Quality Issues: ✅ None - response is natural`);
      }
      console.log('');

      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.log(`  ❌ ERROR: ${error}\n`);
      results.push({
        query: test.query,
        category: test.category,
        mode,
        response: `Error: ${error}`,
        hasExpectedContent: false,
        qualityIssues: ['Test error'],
        duration: Date.now() - startTime,
      });
    }
  }

  return results;
}

function printSummary(results: QualityResult[]) {
  console.log('\n' + '═'.repeat(70));
  console.log('  QUALITY TEST SUMMARY');
  console.log('═'.repeat(70));

  for (const mode of ['cloud', 'local'] as ChatMode[]) {
    const modeResults = results.filter(r => r.mode === mode);
    if (modeResults.length === 0) continue;

    const withContent = modeResults.filter(r => r.hasExpectedContent).length;
    const withIssues = modeResults.filter(r => r.qualityIssues.length > 0).length;
    const perfect = modeResults.filter(r => r.hasExpectedContent && r.qualityIssues.length === 0).length;

    console.log(`\n${mode.toUpperCase()} MODE:`);
    console.log(`  Tests run: ${modeResults.length}`);
    console.log(`  Correct content: ${withContent}/${modeResults.length}`);
    console.log(`  Quality issues found: ${withIssues}/${modeResults.length}`);
    console.log(`  Perfect responses: ${perfect}/${modeResults.length}`);

    // List all unique quality issues
    const allIssues = new Set<string>();
    for (const r of modeResults) {
      for (const issue of r.qualityIssues) {
        allIssues.add(issue);
      }
    }
    if (allIssues.size > 0) {
      console.log('\n  Quality issues found in this mode:');
      for (const issue of allIssues) {
        console.log(`    - ${issue}`);
      }
    }
  }

  // Overall
  const totalPerfect = results.filter(r => r.hasExpectedContent && r.qualityIssues.length === 0).length;
  console.log(`\nOVERALL PERFECT RESPONSES: ${totalPerfect}/${results.length}`);

  if (totalPerfect === results.length) {
    console.log('\n🎉 All responses are accurate AND natural!');
  } else {
    console.log('\n⚠️  Some responses need improvement.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testCloudOnly = args.includes('--cloud-only');
  const testLocalOnly = args.includes('--local-only');

  console.log('═'.repeat(70));
  console.log('  AI CHAT QUALITY TEST SUITE');
  console.log('═'.repeat(70));
  console.log('\nThis test shows FULL responses and checks for quality issues.\n');

  let browser: Browser | null = null;

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
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

    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('404')) {
        console.log(`  [Browser Error]: ${msg.text()}`);
      }
    });

    console.log('Navigating to chat page...');
    await page.goto(CHAT_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    const webGPUSupported = await checkWebGPUSupported(page);
    console.log(`WebGPU supported: ${webGPUSupported ? 'Yes ✅' : 'No ❌'}`);

    const allResults: QualityResult[] = [];

    if (!testLocalOnly) {
      const cloudResults = await runQualityTests(page, 'cloud', webGPUSupported);
      allResults.push(...cloudResults);
    }

    if (!testCloudOnly) {
      const localResults = await runQualityTests(page, 'local', webGPUSupported);
      allResults.push(...localResults);
    }

    printSummary(allResults);

    // Write detailed results to file
    const fs = await import('fs/promises');
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      webGPUSupported,
      results: allResults.map(r => ({
        ...r,
        responseLength: r.response.length,
      })),
    };
    await fs.writeFile(
      'docs/chat-quality-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\nDetailed results written to: docs/chat-quality-report.json');

  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch(console.error);
