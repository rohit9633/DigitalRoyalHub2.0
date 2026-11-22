import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'kalavault.db');
export const db = new Database(DB_PATH);

export const AVATAR_MALE_URL = '/src/assets/images/avatar_male_3d_anime_1795279037587.jpg';
export const AVATAR_FEMALE_URL = '/src/assets/images/avatar_female_3d_anime_1795279041191.jpg';

export function normalizeGender(raw: unknown): 'male' | 'female' {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'female' ? 'female' : 'male';
}

export function resolveDefaultAvatar(gender: 'male' | 'female'): string {
  return gender === 'female' ? AVATAR_FEMALE_URL : AVATAR_MALE_URL;
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function sanitizeUrl(raw: unknown, allowRelativeAsset = false): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (allowRelativeAsset && trimmed.startsWith('/src/assets/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      phone TEXT DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'male',
      avatar_url TEXT NOT NULL DEFAULT '',
      company TEXT DEFAULT '',
      billing_address TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      push_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_challenges (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      identifier TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'login',
      pending_name TEXT DEFAULT '',
      pending_gender TEXT NOT NULL DEFAULT 'male',
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      subtitle TEXT DEFAULT '',
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      compare_at_price INTEGER DEFAULT 0,
      commercial_price INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      file_format TEXT NOT NULL DEFAULT 'ZIP · Figma + Code',
      file_size TEXT NOT NULL DEFAULT '48 MB',
      version TEXT NOT NULL DEFAULT '2.4',
      preview_url TEXT DEFAULT '',
      download_notes TEXT DEFAULT '',
      highlights_json TEXT NOT NULL DEFAULT '[]',
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      sales_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      billing_address TEXT DEFAULT '',
      subtotal INTEGER NOT NULL,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'Pending',
      status_note TEXT DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'Razorpay',
      payment_mode TEXT NOT NULL DEFAULT 'sandbox',
      razorpay_order_id TEXT DEFAULT '',
      razorpay_payment_id TEXT DEFAULT '',
      payment_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_title TEXT NOT NULL,
      product_image TEXT NOT NULL,
      file_format TEXT NOT NULL,
      version TEXT NOT NULL,
      license_type TEXT NOT NULL DEFAULT 'Personal',
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      license_key TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      verified_purchase INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      order_id TEXT DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safely migrate existing SQLite databases created before gender & 3D avatar support
  const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const colNames = new Set(userCols.map((c) => c.name));
  if (!colNames.has('gender')) {
    db.exec("ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT 'male'");
  }
  if (!colNames.has('avatar_url')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }
  db.prepare("UPDATE users SET avatar_url = ? WHERE (avatar_url IS NULL OR avatar_url = '') AND gender = 'female'").run(
    AVATAR_FEMALE_URL
  );
  db.prepare("UPDATE users SET avatar_url = ? WHERE (avatar_url IS NULL OR avatar_url = '') AND gender != 'female'").run(
    AVATAR_MALE_URL
  );

  seedDefaultSettings();
  seedDefaultCatalogAndDemoData();
}

export interface SiteSettings {
  brandName: string;
  tagline: string;
  announcementEnabled: boolean;
  announcementText: string;
  heroKicker: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImage: string;
  currencySymbol: string;
  currencyCode: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;
  stat4Value: string;
  stat4Label: string;
  catalogTitle: string;
  catalogSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialTwitter: string;
  socialInstagram: string;
  socialLinkedin: string;
  socialGithub: string;
  socialYoutube: string;
  copyrightText: string;
  termsUpdatedAt: string;
  termsContent: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: 'KalaVault',
  tagline: 'Precision digital instruments, design systems, and engineering kits for modern builders.',
  announcementEnabled: true,
  announcementText: 'Instant digital delivery with commercial licensing and lifetime version updates.',
  heroKicker: 'Curated Digital Editions · 2026 Release',
  heroHeadline: 'Architectural digital products built to ship faster.',
  heroSubheadline:
    'Production-grade UI systems, full-stack starter kits, Notion operating workspaces, and editorial guides crafted for independent founders and product teams.',
  heroPrimaryCta: 'Browse Catalog',
  heroSecondaryCta: 'View Categories',
  heroImage: '/src/assets/images/hero_digital_studio_1795268985581.jpg',
  currencySymbol: '₹',
  currencyCode: 'INR',
  stat1Value: '14,800+',
  stat1Label: 'Verified Creator Downloads',
  stat2Value: '4.9 / 5',
  stat2Label: 'Average Buyer Rating',
  stat3Value: 'Instant',
  stat3Label: 'License Key & File Delivery',
  stat4Value: 'Lifetime',
  stat4Label: 'Free Release Updates',
  catalogTitle: 'Featured Digital Collection',
  catalogSubtitle: 'Every release includes organized source files, documentation, and a verified license certificate.',
  contactEmail: 'hello@kalavault.studio',
  contactPhone: '+91 98204 51290',
  contactAddress: 'Suite 402, Indiranagar 100ft Road, Bengaluru 560038, India',
  socialTwitter: 'https://x.com/kalavault',
  socialInstagram: 'https://instagram.com/kalavault',
  socialLinkedin: 'https://linkedin.com/company/kalavault',
  socialGithub: 'https://github.com/kalavault',
  socialYoutube: 'https://youtube.com/@kalavault',
  copyrightText: '© 2026 KalaVault Digital Studio. All rights reserved.',
  termsUpdatedAt: 'November 2026',
  termsContent: `1. Digital Product Licensing
Every purchase from KalaVault grants you a non-exclusive, worldwide license corresponding to the tier selected at checkout. A Personal License covers individual projects and internal prototyping. A Commercial License covers unlimited client work, commercial SaaS applications, and team usage up to 15 seats.

2. Instant Delivery & Account Access
Upon successful verification through Razorpay, your license keys and downloadable files are unlocked inside your User Dashboard under My Library. You may re-download future minor and major version updates directly from your account at no additional cost.

3. Payments & Razorpay Security
All payments are processed securely via Razorpay using encrypted payment instruments (UPI, Credit/Debit Cards, NetBanking, and Wallets). KalaVault never stores raw card details or UPI PINs on its servers.

4. Refund Policy
Because digital assets, source code, and design files are delivered instantaneously and cannot be revoked after download, refunds are evaluated on a case-by-case basis within 7 days of purchase if a product is demonstrably corrupted or materially inconsistent with its listing description.

5. Prohibited Usage
You may not redistribute, resell, sublicense, or publish raw source files, Figma libraries, or starter repositories as competing templates, marketplaces, or public open-source kits.

6. Support & Contact
For licensing upgrades, GST invoicing, or technical assistance with any release, reach our studio support team using the contact details listed in the footer.`
};

function seedDefaultSettings(): void {
  const existing = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('config') as
    | { value: string }
    | undefined;
  if (!existing) {
    db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(
      'config',
      JSON.stringify(DEFAULT_SETTINGS)
    );
  }
}

export function getSiteSettings(): SiteSettings {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('config') as
    | { value: string }
    | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSiteSettings(partial: Partial<SiteSettings>): SiteSettings {
  const current = getSiteSettings();
  const merged: SiteSettings = {
    ...current,
    ...partial,
    heroImage: partial.heroImage !== undefined ? sanitizeUrl(partial.heroImage, true) || current.heroImage : current.heroImage,
    socialTwitter: partial.socialTwitter !== undefined ? sanitizeUrl(partial.socialTwitter) : current.socialTwitter,
    socialInstagram: partial.socialInstagram !== undefined ? sanitizeUrl(partial.socialInstagram) : current.socialInstagram,
    socialLinkedin: partial.socialLinkedin !== undefined ? sanitizeUrl(partial.socialLinkedin) : current.socialLinkedin,
    socialGithub: partial.socialGithub !== undefined ? sanitizeUrl(partial.socialGithub) : current.socialGithub,
    socialYoutube: partial.socialYoutube !== undefined ? sanitizeUrl(partial.socialYoutube) : current.socialYoutube
  };
  db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('config', JSON.stringify(merged));
  return merged;
}

function seedDefaultCatalogAndDemoData(): void {
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    const categories = [
      ['cat-ui', 'UI Systems', 'ui-systems', 'Modular Figma component libraries and responsive design tokens.', 1],
      ['cat-code', 'Code Starters', 'code-starters', 'Production full-stack React, TypeScript, and SaaS boilerplates.', 2],
      ['cat-notion', 'Workspace OS', 'workspace-os', 'Structured Notion and productivity operating systems for teams.', 3],
      ['cat-books', 'Editorial Guides', 'editorial-guides', 'Deep-dive typography, architecture, and product strategy monographs.', 4],
      ['cat-icons', 'Design Assets', 'design-assets', 'Precision vector icon foundries, grid packs, and brand kits.', 5]
    ];
    for (const c of categories) {
      insertCat.run(...c);
    }
  }

  const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  if (prodCount === 0) {
    const now = new Date().toISOString();
    const insertProd = db.prepare(`
      INSERT INTO products (
        id, title, slug, subtitle, description, price, compare_at_price, commercial_price,
        category_id, image_url, file_format, file_size, version, preview_url, download_notes,
        highlights_json, featured, published, sales_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const products = [
      {
        id: 'prod-strata-ui',
        title: 'Strata Architecture UI System',
        slug: 'strata-architecture-ui-system',
        subtitle: '420+ responsive Figma & Tailwind v4 components with Light/Dark tokens',
        description:
          'Built for serious product teams who refuse bloated themes. Strata pairs Swiss typographic precision with token-driven Figma variables and copy-ready React + Tailwind v4 components covering data tables, navigation shells, checkout drawers, and marketing layouts.',
        price: 2499,
        compare_at_price: 3999,
        commercial_price: 5999,
        category_id: 'cat-ui',
        image_url: '/src/assets/images/product_ui_system_1795268973060.jpg',
        file_format: 'Figma · React + Tailwind ZIP',
        file_size: '84 MB',
        version: '3.2',
        preview_url: 'https://kalavault.studio/previews/strata-ui',
        download_notes: 'Includes Figma .fig master library, React TypeScript component kit, and CSS token spec.',
        highlights: [
          '420+ accessible components with WCAG AA light & dark contrast pairs',
          'Full Figma Variables & auto-layout responsive breakpoints',
          'Zero external runtime dependencies in the Tailwind v4 React kit',
          'Lifetime free access to all v3.x component drops'
        ],
        featured: 1,
        sales_count: 618
      },
      {
        id: 'prod-kinetix-saas',
        title: 'Foundry Full-Stack SaaS Boilerplate',
        slug: 'foundry-fullstack-saas-boilerplate',
        subtitle: 'TypeScript React + Express + Razorpay billing + Role-based Admin kit',
        description:
          'Skip three weeks of repetitive infrastructure setup. Foundry delivers clean authentication, parameterized SQLite/PostgreSQL migrations, Razorpay order verification webhooks, transactional email templates, and a clean multi-role admin console.',
        price: 3999,
        compare_at_price: 5999,
        commercial_price: 8999,
        category_id: 'cat-code',
        image_url: '/src/assets/images/product_code_starter_1795268991031.jpg',
        file_format: 'Git Repo · TypeScript ZIP',
        file_size: '36 MB',
        version: '2.8',
        preview_url: 'https://kalavault.studio/previews/foundry-saas',
        download_notes: 'Complete source repository with setup handbook, API specs, and deployment scripts.',
        highlights: [
          'Pre-wired Razorpay India & international checkout verification',
          'Hardened authentication with role-based access middleware',
          'Real-time SSE event pipeline and audit logging out of the box',
          'Comprehensive 45-page deployment and architecture manual'
        ],
        featured: 1,
        sales_count: 482
      },
      {
        id: 'prod-calm-os',
        title: 'Monolith Studio Workspace OS',
        slug: 'monolith-studio-workspace-os',
        subtitle: 'Complete Notion operating system for agencies, freelancers, and product studios',
        description:
          'Replace fragmented spreadsheets and scattered docs with a calm, relational operating system. Manage client retainers, sprint roadmaps, invoice ledgers, content pipelines, and weekly executive reviews from a single interconnected dashboard.',
        price: 1299,
        compare_at_price: 1999,
        commercial_price: 2999,
        category_id: 'cat-notion',
        image_url: '/src/assets/images/product_notion_os_1795268981946.jpg',
        file_format: 'Notion Template · PDF Guide',
        file_size: '14 MB',
        version: '4.0',
        preview_url: 'https://kalavault.studio/previews/monolith-os',
        download_notes: 'One-click Notion duplicate link, onboarding walkthrough video notes, and automation templates.',
        highlights: [
          '12 interconnected relational databases with automated rollups',
          'Client portal template ready to share with external stakeholders',
          'Quarterly OKR tracker, sprint board, and financial cashflow ledger',
          'Clean monochrome design built for distraction-free daily focus'
        ],
        featured: 1,
        sales_count: 940
      },
      {
        id: 'prod-grid-monograph',
        title: 'Grid Systems & Modern Editorial Type',
        slug: 'grid-systems-modern-editorial-type',
        subtitle: '260-page interactive e-book + Figma layout grids for web & product designers',
        description:
          'A practical visual treatise on proportional grids, optical typography, tabular rhythm, and dual-theme color restraint for digital interfaces. Includes 36 real-world before/after breakdowns and downloadable Figma grid templates.',
        price: 999,
        compare_at_price: 1499,
        commercial_price: 2499,
        category_id: 'cat-books',
        image_url: '/src/assets/images/product_brand_ebook_1795268972411.jpg',
        file_format: 'PDF · EPUB · Figma Grids',
        file_size: '62 MB',
        version: '1.5',
        preview_url: 'https://kalavault.studio/previews/grid-monograph',
        download_notes: 'High-DPI interactive PDF, reflowable EPUB for tablets, and 24 Figma grid templates.',
        highlights: [
          '260 illustrated pages covering Swiss grid math for responsive screens',
          '36 annotated interface critiques comparing cluttered vs refined UI',
          '24 ready-to-use Figma desktop and mobile column templates',
          'Bonus chapter on dark-mode contrast and optical letter-spacing'
        ],
        featured: 1,
        sales_count: 725
      },
      {
        id: 'prod-dieter-icons',
        title: 'Vektor Precision Icon Foundry',
        slug: 'vektor-precision-icon-foundry',
        subtitle: '1,800 geometric SVG & React icons drawn on a strict 24px optical grid',
        description:
          'Every icon is individually hand-balanced across three stroke weights (1.5px, 1.75px, 2px) plus filled variants. Designed for enterprise dashboards, fintech apps, and minimalist consumer products.',
        price: 1499,
        compare_at_price: 2299,
        commercial_price: 3499,
        category_id: 'cat-icons',
        image_url: '/src/assets/images/product_icon_foundry_1795268982392.jpg',
        file_format: 'SVG · Figma · React Package',
        file_size: '28 MB',
        version: '2.1',
        preview_url: 'https://kalavault.studio/previews/vektor-icons',
        download_notes: 'Optimized raw SVGs, tree-shakeable React TypeScript icon package, and Figma component set.',
        highlights: [
          '1,800 unique metaphors across 24 categories including fintech & commerce',
          '3 calibrated stroke weights plus solid fill variants',
          'Tree-shakeable React & Vue components with TypeScript props',
          'Consistent geometric optical balance at 16px, 20px, and 24px'
        ],
        featured: 0,
        sales_count: 530
      },
      {
        id: 'prod-deck-studio',
        title: 'Series A Pitch & Brand Architecture Deck',
        slug: 'series-a-pitch-brand-deck',
        subtitle: '95 architectural slides for Figma, Keynote, and PowerPoint with financial charts',
        description:
          'Present your product vision with institutional clarity. Engineered with crisp data visualization slides, timeline architectures, pricing matrices, and executive narrative frameworks tailored for seed and Series A founders.',
        price: 1799,
        compare_at_price: 2699,
        commercial_price: 3999,
        category_id: 'cat-ui',
        image_url: '/src/assets/images/hero_digital_studio_1795268985581.jpg',
        file_format: 'Figma · Keynote · PPTX',
        file_size: '54 MB',
        version: '2.0',
        preview_url: 'https://kalavault.studio/previews/series-a-deck',
        download_notes: 'Light and dark 16:9 slide masters across Figma, Apple Keynote, and Microsoft PowerPoint.',
        highlights: [
          '95 modular slide layouts with editable tabular financial charts',
          'Both crisp light paper and deep charcoal dark themes included',
          'Founder narrative workbook with investor Q&A appendix templates',
          '100% vector diagrams and free Google Fonts pairing guide'
        ],
        featured: 0,
        sales_count: 390
      }
    ];

    for (const p of products) {
      insertProd.run(
        p.id,
        p.title,
        p.slug,
        p.subtitle,
        p.description,
        p.price,
        p.compare_at_price,
        p.commercial_price,
        p.category_id,
        p.image_url,
        p.file_format,
        p.file_size,
        p.version,
        p.preview_url,
        p.download_notes,
        JSON.stringify(p.highlights),
        p.featured,
        1,
        p.sales_count,
        now
      );
    }
  }

  // Seed verified customer reviews (linked to synthetic non-login reviewer accounts so reviews look authentic)
  const revCount = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as { c: number }).c;
  if (revCount === 0) {
    const now = new Date().toISOString();
    const lockedHash = `locked:${crypto.randomBytes(16).toString('hex')}`;
    const seedUsers = [
      ['usr-seed-1', 'Aarav Mehta', 'aarav.mehta@example.studio', lockedHash, 'customer'],
      ['usr-seed-2', 'Meera Krishnan', 'meera.k@example.studio', lockedHash, 'customer'],
      ['usr-seed-3', 'Rohan Deshmukh', 'rohan.d@example.studio', lockedHash, 'customer']
    ];
    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const u of seedUsers) {
      insertUser.run(...u, now);
    }

    const insertRev = db.prepare(`
      INSERT INTO reviews (id, product_id, user_id, user_name, rating, title, comment, verified_purchase, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const reviews = [
      [
        'rev-1',
        'prod-strata-ui',
        'usr-seed-1',
        'Aarav Mehta',
        5,
        'Cut our dashboard redesign timeline in half',
        'Every component token maps cleanly between Figma and Tailwind v4. Dark mode contrast works right out of the box without tweaking hex values.',
        1,
        '2026-10-14T09:15:00.000Z'
      ],
      [
        'rev-2',
        'prod-strata-ui',
        'usr-seed-2',
        'Meera Krishnan',
        5,
        'Zero clutter, genuinely architectural typography',
        'Our product team switched from a bulky template to Strata and immediately noticed how much calmer our data tables and drawers look.',
        1,
        '2026-10-28T14:40:00.000Z'
      ],
      [
        'rev-3',
        'prod-kinetix-saas',
        'usr-seed-3',
        'Rohan Deshmukh',
        5,
        'Razorpay signature verification saved days',
        'Clean TypeScript architecture with proper server-side order verification and role guards. Deployed our MVP in a single weekend.',
        1,
        '2026-11-02T11:20:00.000Z'
      ],
      [
        'rev-4',
        'prod-calm-os',
        'usr-seed-2',
        'Meera Krishnan',
        4,
        'Best studio Notion setup I have used',
        'The client portal and retainer ledger are super intuitive. Took about 20 minutes to import our active agency clients.',
        1,
        '2026-11-09T17:05:00.000Z'
      ],
      [
        'rev-5',
        'prod-grid-monograph',
        'usr-seed-1',
        'Aarav Mehta',
        5,
        'Required reading for UI engineers',
        'The 36 interface before/after critiques alone justify the price. Practical rules you can apply immediately.',
        1,
        '2026-11-12T08:30:00.000Z'
      ]
    ];
    for (const r of reviews) {
      insertRev.run(...r);
    }
  }
}

export function generateLicenseKey(prefix = 'KV'): string {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${seg()}-${seg()}-${seg()}-${seg()}`;
}
