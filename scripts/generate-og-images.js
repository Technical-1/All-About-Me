import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const htmlFiles = [
  { input: 'option-a-geometric-dark.html', output: 'og-home.png' },
  { input: 'projects-terminal.html', output: 'og-projects.png' },
  { input: 'contact-cta.html', output: 'og-contact.png' },
  { input: 'experience.html', output: 'og-experience.png' },
  { input: 'blog.html', output: 'og-blog.png' },
  { input: 'chat.html', output: 'og-chat.png' },
  { input: 'resume.html', output: 'og-resume.png' },
];

async function generateOGImages() {
  const browser = await puppeteer.launch({
    headless: 'new',
  });

  const previewsDir = path.join(__dirname, '../public/og-previews');
  const outputDir = path.join(__dirname, '../public/og');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const file of htmlFiles) {
    const inputPath = path.join(previewsDir, file.input);
    const outputPath = path.join(outputDir, file.output);

    console.log(`Generating ${file.output}...`);

    const page = await browser.newPage();

    // Set viewport to exact OG image dimensions
    await page.setViewport({
      width: OG_WIDTH,
      height: OG_HEIGHT,
      deviceScaleFactor: 2, // 2x for crisp resolution
    });

    // Load the HTML file
    await page.goto(`file://${inputPath}`, {
      waitUntil: 'networkidle0',
    });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Take screenshot of just the og-card element
    const element = await page.$('.og-card');
    if (element) {
      await element.screenshot({
        path: outputPath,
        type: 'png',
      });
    } else {
      // Fallback to full page if no .og-card found
      await page.screenshot({
        path: outputPath,
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: OG_WIDTH,
          height: OG_HEIGHT,
        },
      });
    }

    await page.close();
    console.log(`  ✓ Saved to ${outputPath}`);
  }

  await browser.close();
  console.log('\nAll OG images generated successfully!');
}

generateOGImages().catch(console.error);
