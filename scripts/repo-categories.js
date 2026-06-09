// Single source of truth for repo → domain shelf assignment.
//
// Doc-derived and explicit: each repo was classified by reading its
// .portfolio/ docs (architecture/stack/qa) or, for thin repos, its description
// and languages. Imported by fetch_private_repos.js (nightly sync, durable
// across regeneration) and apply-categories.js (one-off stamp of existing JSON).
//
// A repo missing from this map falls to 'other'. The "Academic Coursework" and
// "Work in Progress" shelves are NOT pure categories:
//   - 'academic' is assigned explicitly here (5 coursework repos).
//   - "Work in Progress" is derived at render time (repos with no preview image);
//     it is not a value in this map. See src/lib/projectSections.ts.

export const REPO_CATEGORIES = {
  // AI & ML
  'ai-talent-platform': 'ai-ml',
  'Claude-Tax-Toolkit': 'ai-ml',
  'ebay_ai_dashboard': 'ai-ml',
  'Kid-Talk-Translator': 'ai-ml',
  'MultiAgent': 'ai-ml',
  'Orbit': 'ai-ml',
  'Resume-Local-LLM': 'ai-ml',
  'SecondBrain': 'ai-ml',
  'serverless-document-pipeline': 'ai-ml',

  // Crypto & Fintech
  'BitcoinTreasuries-Proxy': 'crypto-fintech',
  'BTC-Explorer': 'crypto-fintech',
  'coinbasis-py': 'crypto-fintech',
  'coinbasis-rs': 'crypto-fintech',
  'coinlytics-py': 'crypto-fintech',
  'Crypto-Price-Tracker': 'crypto-fintech',
  'Crypto-Price-Tracker-V2': 'crypto-fintech',
  'Crypto-Proxy-coingecko': 'crypto-fintech',
  'cryptolytics-rs': 'crypto-fintech',
  'ETH-Explorer': 'crypto-fintech',
  'Finance-POS': 'crypto-fintech',

  // Developer Tools & Infrastructure
  'cli-toolkit': 'dev-tools',
  'email-archive-parser': 'dev-tools',
  'FBI-API': 'dev-tools',
  'Git-Archiver': 'dev-tools',
  'Git-Archiver-Web': 'dev-tools',
  'Git-Archiver-Worker': 'dev-tools',
  'Git-Cloudflare-Proxy': 'dev-tools',
  'homebrew-tap': 'dev-tools',
  'Local-Hoster': 'dev-tools',
  'PLC_Project': 'dev-tools',
  'Project-Hub': 'dev-tools',
  'Puppeteer-Packages': 'dev-tools',
  'Puppeteer-Template': 'dev-tools',
  'PY27': 'dev-tools',
  'pythonforge': 'dev-tools',
  'Remote-Preview': 'dev-tools',
  'RepoLens': 'dev-tools',
  'Rust-Dashboard': 'dev-tools',
  'Technical-1': 'dev-tools',

  // Automation & Scraping
  'DailySMS': 'automation',
  'EbayViews': 'automation',
  'EbayViews-Desktop': 'automation',
  'Glassdoor': 'automation',
  'GoogleFormsAutoFiller': 'automation',
  'GSA-Auctions': 'automation',
  'iPhone-Mirroring-AIO': 'automation',
  'iPhone-Mirroring-Auto-Scripts': 'automation',
  'Kanfer-D-Toolkit': 'automation',
  'Kendra-who': 'automation',
  'redfin-scraper': 'automation',
  'WebCrawler': 'automation',
  'Redis-Upstasher': 'automation',
  'Shopify-ATC': 'automation',
  'Supernatural-Speed-Typer': 'automation',
  'UCF_DecisionChecker': 'automation',

  // iOS & Mobile
  'Emailer': 'mobile',
  'GmailMe': 'mobile',
  'ONESHOT': 'mobile',
  'PixScan': 'mobile',
  'ReactNative-Expo-Firebase-Boilerplate-v2': 'mobile',
  'SmoothQueue': 'mobile',
  'SnapDragon': 'mobile',

  // Creative & Generative
  'Ascii-React-Native': 'creative',
  'Differential-Growth': 'creative',
  'Flux': 'creative',
  'Image-To-Ascii-Flask': 'creative',
  'Image-To-Ascii-Vite': 'creative',
  'img2ascii': 'creative',
  'NeoMatrix-FrameCreator': 'creative',
  'Pluribus-Text-Gen': 'creative',
  'Signature-Studio': 'creative',
  'Video-To-Ascii': 'creative',

  // Games & Puzzles
  'Blackjack-Trainer': 'games',
  'ClubGG': 'games',
  'PokerManager': 'games',
  'Simple-Backgammon': 'games',
  'Supernatural-Speed-Racer': 'games',
  'Themed-Crossword-Gen': 'games',

  // Security & Privacy
  'EmailAnalyzer': 'security',
  'QuickPass': 'security',
  'QuickPass-v2': 'security',
  'RepoGuard': 'security',
  'SecuritySite': 'security',

  // Client & Commercial Sites
  'Carmen': 'client-sites',
  'CSNY': 'client-sites',
  'E350-Transportation': 'client-sites',
  'emissary-risk-ops': 'client-sites',
  'FISH-THEME': 'client-sites',
  'RealEstate': 'client-sites',
  'restauranthub': 'client-sites',
  'SmoothQueue-Website': 'client-sites',
  'Terra-Moda-Rewrite': 'client-sites',

  // Web Apps & Utilities
  'All-About-Me': 'web-utilities',
  'Easy-Time-Blocking': 'web-utilities',
  'eSim-Panel': 'web-utilities',
  'GimmeThat': 'web-utilities',
  'Hackathon': 'web-utilities',
  'Limitimer-Pro': 'web-utilities',
  'MasterCode': 'web-utilities',
  'MyVoteProject-V1': 'web-utilities',
  'Personal-Budget-Tool': 'web-utilities',
  'Private-Collab-Whiteboard': 'web-utilities',
  'PropertyProbeV2': 'web-utilities',
  'ServiceHub': 'web-utilities',
  'shopify-atc-gui': 'web-utilities',
  'Snorlax-Tracker': 'web-utilities',
  'Snowball': 'web-utilities',
  'Valentines': 'web-utilities',
  'Venmo-POS': 'web-utilities',

  // Academic Coursework (explicit — incl. featured AHSR senior design)
  'AHSR-senior-design-archive': 'academic',
  'APComputerScienceA2019-2020': 'academic',
  'CAP4770-Final_Project': 'academic',
  'Cplories-and-More': 'academic',
  'EEL4599-Final-Project': 'academic',

  // Other (no clear domain; renders under Work in Progress if it lacks an image)
  'Rainwater': 'other',
  'Work-Files': 'other',
};

export function categoryFor(name) {
  return REPO_CATEGORIES[name] || 'other';
}
