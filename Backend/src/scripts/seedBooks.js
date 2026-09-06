import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Number of books per genre to fetch (default: 150, or from CLI: node seedBooks.js 200)
const PER_GENRE_LIMIT = parseInt(process.argv[2], 10) || 150;

const GENRES = [
  { query: 'subject:(thriller)',           genre: 'Thriller' },
  { query: 'subject:(classics)',          genre: 'Classic Literature' },
  { query: 'subject:(science fiction)',   genre: 'Science Fiction' },
  { query: 'subject:(mystery)',           genre: 'Mystery' },
  { query: 'subject:(fantasy)',           genre: 'Fantasy' },
  { query: 'subject:(romance)',           genre: 'Romance' },
  { query: 'subject:(history)',           genre: 'History' },
  { query: 'subject:(biography)',         genre: 'Biography' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanAuthor(creator) {
  if (!creator) return 'Unknown Author';
  const raw = Array.isArray(creator) ? creator[0] : String(creator);
  const stripped = raw.replace(/,?\s*(?:d\.\s*)?\b\d{4}(?:-\d{0,4})?/, '').trim();
  const parts = stripped.split(',').map((s) => s.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[1]} ${parts[0]}`.slice(0, 100);
  }
  return stripped.slice(0, 100) || 'Unknown Author';
}

function cleanPublisher(pub) {
  if (!pub) return null;
  const raw = Array.isArray(pub) ? pub[0] : String(pub);
  const clean = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw.trim();
  return clean.replace(/[[\]]/g, '').trim().slice(0, 255) || null;
}

function cleanIsbn(isbnList) {
  if (!isbnList) return null;
  const list = Array.isArray(isbnList) ? isbnList : [isbnList];
  // 1. Prefer 13-digit standard ISBNs (starting with 978 or 979)
  const isbn13 = list
    .map((s) => String(s).replace(/[^0-9X]/gi, ''))
    .find((s) => s.length === 13 && s.startsWith('97'));
  if (isbn13) return isbn13;

  // 2. Next prefer standard 10-digit ISBNs
  const isbn10 = list
    .map((s) => String(s).replace(/[^0-9X]/gi, ''))
    .find((s) => s.length === 10);
  if (isbn10) return isbn10;

  // 3. Any reasonable length
  const any = list
    .map((s) => String(s).replace(/[^0-9X]/gi, ''))
    .find((s) => s.length >= 9 && s.length <= 20);
  return any || null;
}

async function getOrCreatePublisher(client, rawName) {
  const name = String(rawName).trim().slice(0, 255);
  const { rows } = await client.query(
    `SELECT "publisherID" FROM publisher WHERE LOWER("publisherName") = LOWER($1) LIMIT 1`,
    [name]
  );
  if (rows[0]) return rows[0].publisherID;
  const ins = await client.query(
    `INSERT INTO publisher ("publisherName") VALUES ($1) RETURNING "publisherID"`,
    [name]
  );
  return ins.rows[0].publisherID;
}

async function getOrCreateAuthor(client, rawName) {
  const name = String(rawName).trim().slice(0, 100);
  const { rows } = await client.query(
    `SELECT "authorID" FROM author WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (rows[0]) return rows[0].authorID;
  const ins = await client.query(
    `INSERT INTO author (name) VALUES ($1) RETURNING "authorID"`,
    [name]
  );
  return ins.rows[0].authorID;
}

async function seedGenre({ query, genre }) {
  console.log(`\n📚 Fetching up to ${PER_GENRE_LIMIT} popular books for "${genre}"...`);

  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}` +
    `+AND+mediatype:(texts)+AND+isbn:[*+TO+*]` +
    `&fl[]=title,creator,isbn,year,publisher` +
    `&sort[]=downloads+desc` +
    `&rows=${PER_GENRE_LIMIT}&output=json`;

  let docs = [];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (res.ok) {
      const data = await res.json();
      docs = data.response?.docs ?? [];
    }
  } catch (err) {
    console.error(`   ❌ Failed to query archive: ${err.message}`);
    return;
  }

  console.log(`   → ${docs.length} books received from catalog`);

  let inserted = 0;
  let skipped = 0;

  for (const doc of docs) {
    const isbn = cleanIsbn(doc.isbn);
    const title = doc.title ? String(doc.title).trim() : null;

    if (!title || !isbn) {
      skipped++;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check for existing ISBN
      const existing = await client.query(
        `SELECT "bookID" FROM book WHERE "ISBN" = $1`,
        [isbn]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        skipped++;
        continue;
      }

      // Publisher
      let publisherID = null;
      const pubName = cleanPublisher(doc.publisher);
      if (pubName) {
        publisherID = await getOrCreatePublisher(client, pubName);
      }

      // Random price between $8.00 and $28.00
      const price = Number((Math.random() * 20 + 8).toFixed(2));
      const pubYear = doc.year && Number.isInteger(Number(doc.year)) ? parseInt(doc.year, 10) : null;

      const bookRes = await client.query(
        `INSERT INTO book
           (title, genre, "ISBN", "publicationYear", price, "totalCopies", "availableCopies", "publisherID", language)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'English')
         RETURNING "bookID"`,
        [
          title.slice(0, 255),
          genre,
          isbn,
          pubYear,
          price,
          3,
          3,
          publisherID,
        ]
      );
      const bookID = bookRes.rows[0].bookID;

      // Author
      const authorName = cleanAuthor(doc.creator);
      const authorID = await getOrCreateAuthor(client, authorName);
      await client.query(
        `INSERT INTO book_author ("bookID", "authorID") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [bookID, authorID]
      );

      await client.query('COMMIT');
      inserted++;
    } catch (err) {
      await client.query('ROLLBACK');
      skipped++;
    } finally {
      client.release();
    }
  }

  console.log(`   ✓ Inserted: ${inserted}  |  Skipped/Duplicate: ${skipped}`);
}

async function main() {
  console.log('🌱 Starting Mass Book Seeder...');
  console.log(`Target: ~${PER_GENRE_LIMIT * GENRES.length} books across ${GENRES.length} genres`);

  for (const genreConfig of GENRES) {
    await seedGenre(genreConfig);
    await sleep(500);
  }

  const { rows } = await pool.query('SELECT COUNT(*) FROM book');
  console.log(`\n🎉 Seeding complete! Total books now in database: ${rows[0].count}`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seeder failed:', err);
  process.exit(1);
});
