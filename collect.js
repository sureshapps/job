const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'docs', 'data', 'links.json');
const READER_BASE = 'https://r.jina.ai/';

// Source pages to check every run. Each has a `test` regex that decides
// whether a link found on the page is an actual job posting (not nav,
// footer, category, or "similar searches" clutter).
const SOURCES = [
  {
    name: 'Jora',
    url: 'https://my.jora.com/Web-Developer-jobs-in-Kuala-Lumpur',
    test: (link) => /my\.jora\.com\/job\//i.test(link),
  },
  {
    name: 'Hiredly',
    url: 'https://my.hiredly.com/jobs/jobs-malaysia-search?keyword=web%20developer&location=Kuala%20Lumpur',
    test: (link) => /my\.hiredly\.com\/jobs\/[a-z0-9-]+-\d+/i.test(link) || /my\.hiredly\.com\/jobs\/[a-z0-9-]{10,}$/i.test(link),
  },
  {
    name: 'Jobstreet',
    url: 'https://my.jobstreet.com/web-developer-jobs/in-Kuala-Lumpur',
    test: (link) => /my\.jobstreet\.com\/(job|en\/job)\//i.test(link),
  },
];

function loadStore() {
  if (!fs.existsSync(DATA_FILE)) return { links: [], runs: [] };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { links: [], runs: [] };
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

async function scrapeSource(source, apiKey) {
  const res = await fetch(READER_BASE + source.url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-With-Links-Summary': 'true',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jina Reader error for ${source.name} (${res.status}): ${text}`);
  }

  const json = await res.json();
  // data.links is an object like { "Senior Web Developer": "https://...", ... }
  const linksObj = (json.data && json.data.links) || {};
  const rawLinks = Object.values(linksObj);
  return rawLinks.filter((link) => source.test(link));
}

async function runCollection() {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error('JINA_API_KEY is not set (add it as a repo secret)');

  const store = loadStore();
  const existingUrls = new Set(store.links.map((l) => l.url));
  const timestamp = new Date().toISOString();
  const runSummary = { timestamp, sources: {}, newLinksFound: 0, errors: [] };

  for (const source of SOURCES) {
    try {
      const found = await scrapeSource(source, apiKey);
      let newCount = 0;
      for (const url of found) {
        if (!existingUrls.has(url)) {
          existingUrls.add(url);
          store.links.push({ url, source: source.name, firstSeen: timestamp });
          newCount++;
        }
      }
      runSummary.sources[source.name] = { checked: found.length, new: newCount };
      runSummary.newLinksFound += newCount;
    } catch (err) {
      runSummary.errors.push({ source: source.name, message: err.message });
    }
  }

  store.runs.unshift(runSummary);
  store.runs = store.runs.slice(0, 200); // keep last 200 run logs
  store.links.sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
  saveStore(store);

  console.log(JSON.stringify(runSummary, null, 2));
  if (runSummary.errors.length) {
    // Don't fail the whole workflow over one source erroring - just log it
    console.warn(`Completed with ${runSummary.errors.length} source error(s).`);
  }
}

runCollection().catch((err) => {
  console.error('Collection run failed:', err.message);
  process.exit(1);
});
