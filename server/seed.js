import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDb, saveDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCSV(text) {
  // Single-pass CSV parser that correctly handles quoted fields with embedded
  // newlines, commas, and escaped quotes (doubled "")
  const records = [];
  let field = '';
  let fields = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        fields.push(field);
        field = '';
        i++;
      } else if (ch === '\r' || ch === '\n') {
        fields.push(field);
        field = '';
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++;
        if (fields.some(f => f.length > 0)) {
          records.push(fields);
        }
        fields = [];
      } else {
        field += ch;
        i++;
      }
    }
  }
  // Last record
  fields.push(field);
  if (fields.some(f => f.length > 0)) {
    records.push(fields);
  }

  if (records.length < 2) return [];

  const header = records[0];
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = records[r][j] || '';
    }
    rows.push(obj);
  }
  return rows;
}

// 2024 and 2025 entries to append
const extra = [
  // 2024 Grand Final
  { year: 2024, to_country: 'Switzerland', performer: 'Nemo', song: 'The Code', place_final: 1, points_final: 591, youtube_url: 'https://youtube.com/watch?v=CO_qJf-nW0k' },
  { year: 2024, to_country: 'Croatia', performer: 'Baby Lasagna', song: 'Rim Tim Tagi Dim', place_final: 2, points_final: 547, youtube_url: 'https://youtube.com/watch?v=YIBjarAiAVc' },
  { year: 2024, to_country: 'Ukraine', performer: 'alyona alyona & Jerry Heil', song: 'Teresa & Maria', place_final: 3, points_final: 453, youtube_url: 'https://youtube.com/watch?v=d4N82wPpdg8' },
  { year: 2024, to_country: 'France', performer: 'Slimane', song: 'Mon amour', place_final: 4, points_final: 445, youtube_url: 'https://youtube.com/watch?v=-XyLecY2JyE' },
  { year: 2024, to_country: 'Israel', performer: 'Eden Golan', song: 'Hurricane', place_final: 5, points_final: 375, youtube_url: 'https://youtube.com/watch?v=K60BWlEhtAA' },
  { year: 2024, to_country: 'Ireland', performer: 'Bambie Thug', song: 'Doomsday Blue', place_final: 6, points_final: 278, youtube_url: 'https://youtube.com/watch?v=UMq8ofCstMQ' },
  { year: 2024, to_country: 'Italy', performer: 'Angelina Mango', song: 'La noia', place_final: 7, points_final: 268, youtube_url: 'https://youtube.com/watch?v=zp1FXHjkjpQ' },
  { year: 2024, to_country: 'Armenia', performer: 'Ladaniva', song: 'Jako', place_final: 8, points_final: 183, youtube_url: 'https://youtube.com/watch?v=hAYXDoZzAyE' },
  { year: 2024, to_country: 'Sweden', performer: 'Marcus & Martinus', song: 'Unforgettable', place_final: 9, points_final: 174, youtube_url: 'https://youtube.com/watch?v=DcZpzObYzxs' },
  { year: 2024, to_country: 'Norway', performer: 'Gåte', song: 'Ulveham', place_final: 10, points_final: 148, youtube_url: 'https://youtube.com/watch?v=YBbL8ORqNVU' },
  { year: 2024, to_country: 'Greece', performer: 'Marina Satti', song: 'Zari', place_final: 11, points_final: 126, youtube_url: 'https://youtube.com/watch?v=ENb4LCeq9Lc' },
  { year: 2024, to_country: 'Germany', performer: 'Isaak', song: 'Always on the Run', place_final: 12, points_final: 117, youtube_url: 'https://youtube.com/watch?v=kVOHTxFOhak' },
  { year: 2024, to_country: 'Luxembourg', performer: 'Tali', song: 'Fighter', place_final: 13, points_final: 103, youtube_url: 'https://youtube.com/watch?v=TCWH3Nq5y9A' },
  { year: 2024, to_country: 'Lithuania', performer: 'Silvester Belt', song: 'Luktelk', place_final: 14, points_final: 90, youtube_url: 'https://youtube.com/watch?v=N8YuQzJLR_k' },
  { year: 2024, to_country: 'Serbia', performer: 'Teya Dora', song: 'Ramonda', place_final: 15, points_final: 84, youtube_url: 'https://youtube.com/watch?v=4hUg64uIY_4' },
  { year: 2024, to_country: 'Latvia', performer: 'Dons', song: 'Hollow', place_final: 16, points_final: 64, youtube_url: 'https://youtube.com/watch?v=kgIwQkMwURY' },
  { year: 2024, to_country: 'Georgia', performer: 'Nutsa Buzaladze', song: 'Firefighter', place_final: 17, points_final: 52, youtube_url: 'https://youtube.com/watch?v=He4PGhm7jOw' },
  { year: 2024, to_country: 'Austria', performer: 'Kaleen', song: 'We Will Rave', place_final: 18, points_final: 24, youtube_url: 'https://youtube.com/watch?v=VZ6SlZnk_EI' },
  { year: 2024, to_country: 'United Kingdom', performer: 'Olly Alexander', song: 'Dizzy', place_final: 18, points_final: 46, youtube_url: 'https://youtube.com/watch?v=q0_FdJqyQW0' },
  { year: 2024, to_country: 'Finland', performer: 'Windows95man', song: 'No Rules!', place_final: 19, points_final: 38, youtube_url: 'https://youtube.com/watch?v=7nidDtyS0Wo' },
  { year: 2024, to_country: 'Estonia', performer: '5MIINUST & Puuluup', song: '(nendest) narkootikumidest ei tea me midagi', place_final: 20, points_final: 37, youtube_url: 'https://youtube.com/watch?v=RSMMU2wX0Bk' },
  { year: 2024, to_country: 'Portugal', performer: 'iolanda', song: 'Grito', place_final: 21, points_final: 37, youtube_url: 'https://youtube.com/watch?v=OZn4-H6JvKU' },
  { year: 2024, to_country: 'Spain', performer: 'Nebulossa', song: 'Zorra', place_final: 22, points_final: 30, youtube_url: 'https://youtube.com/watch?v=FOMoQoHG5aU' },
  { year: 2024, to_country: 'Slovenia', performer: 'Raiven', song: 'Veronika', place_final: 23, points_final: 27, youtube_url: 'https://youtube.com/watch?v=l86DxpRnz5M' },
  { year: 2024, to_country: 'Australia', performer: 'Electric Fields', song: 'One Milkali (One Blood)', place_final: 24, points_final: 24, youtube_url: 'https://youtube.com/watch?v=Wzpp6996QdI' },
  { year: 2024, to_country: 'Netherlands', performer: 'Joost Klein', song: 'Europapa', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=IiHFnmI8pxg' },
  // 2024 Semi-final only (eliminated)
  { year: 2024, to_country: 'Cyprus', performer: 'Silia Kapsis', song: 'Liar', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=c4wMioZXbMk' },
  { year: 2024, to_country: 'Czech Republic', performer: 'Aiko', song: 'Pedestal', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=RiItbHRF1BY' },
  { year: 2024, to_country: 'Iceland', performer: 'Hera Björk', song: 'Scared of Heights', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=VChBgcycVl8' },
  { year: 2024, to_country: 'Moldova', performer: 'Natalia Barbu', song: 'In the Middle', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=evIoGkZXj2s' },
  { year: 2024, to_country: 'Albania', performer: 'Besa', song: 'Titan', place_final: null, points_final: null },
  { year: 2024, to_country: 'Denmark', performer: 'Saba', song: 'Sand', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=4f_phiGot7w' },
  { year: 2024, to_country: 'Azerbaijan', performer: 'FAHREE feat. Ilkin Dovlatov', song: 'Özünlə Apar', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=QhN9r8TH2Hw' },
  { year: 2024, to_country: 'Belgium', performer: 'Mustii', song: 'Before the Party\'s Over', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=hNIemQwCaM4' },
  { year: 2024, to_country: 'Malta', performer: 'Sarah Bonnici', song: 'Loop', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=uG-JHeia13c' },
  { year: 2024, to_country: 'Poland', performer: 'Luna', song: 'The Tower', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=ESKG8Uo1YaU' },
  { year: 2024, to_country: 'San Marino', performer: 'Megara', song: '11:11', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=IqyJvkGmAjo' },
  // 2025 entries
  { year: 2025, to_country: 'Albania', performer: 'Shkodra Elektronike', song: 'Zjerm', place_final: null, points_final: null },
  { year: 2025, to_country: 'Armenia', performer: 'Parg', song: 'Survivor', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=qHkZWLld-pw' },
  { year: 2025, to_country: 'Australia', performer: 'Go-Jo', song: 'Milkshake Man', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=EJ0RdIU_G8g' },
  { year: 2025, to_country: 'Austria', performer: 'JJ', song: 'Wasted Love', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=onOex2WXjbA' },
  { year: 2025, to_country: 'Azerbaijan', performer: 'Mamagama', song: 'Run With U', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=wk1CUjaRKyo' },
  { year: 2025, to_country: 'Belgium', performer: 'Red Sebastian', song: 'Strobe Lights', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=fl4LaADiLBY' },
  { year: 2025, to_country: 'Croatia', performer: 'Marko Bošnjak', song: 'Poison Cake', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=jzK4D_gfRjQ' },
  { year: 2025, to_country: 'Cyprus', performer: 'Theo Evan', song: 'Shh', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=egPAiAuC57k' },
  { year: 2025, to_country: 'Czech Republic', performer: 'Adonxs', song: 'Kiss Kiss Goodbye', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=hdxna1DC7yo' },
  { year: 2025, to_country: 'Denmark', performer: 'Sissal', song: 'Hallucination', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=B3BdsYDnS8M' },
  { year: 2025, to_country: 'Estonia', performer: 'Tommy Cash', song: 'Espresso Macchiato', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=9b9Z5HSCXOI' },
  { year: 2025, to_country: 'Finland', performer: 'Erika Vikman', song: 'Ich komme', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=V3vbVd1ynnk' },
  { year: 2025, to_country: 'France', performer: 'Louane', song: 'Maman', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=jhqJY0ll1Wo' },
  { year: 2025, to_country: 'Georgia', performer: 'Mariam Shengelia', song: 'Freedom', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=jphJoo-CNtU' },
  { year: 2025, to_country: 'Germany', performer: 'Abor & Tynna', song: 'Baller', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=3rrWZ6cldsA' },
  { year: 2025, to_country: 'Greece', performer: 'Klavdia', song: 'Asteromáta', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=1qbWRl6h6to' },
  { year: 2025, to_country: 'Iceland', performer: 'Væb', song: 'Róa', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=c73Lx1QUZZA' },
  { year: 2025, to_country: 'Ireland', performer: 'Emmy', song: 'Laika Party', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=3MB628Kanzo' },
  { year: 2025, to_country: 'Israel', performer: 'Yuval Raphael', song: 'New Day Will Rise', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=_7zHp51j2WM' },
  { year: 2025, to_country: 'Italy', performer: 'Lucio Corsi', song: 'Volevo essere un duro', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=Vlu5XXDwHos' },
  { year: 2025, to_country: 'Latvia', performer: 'Tautumeitas', song: 'Bur man laimi', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=nkvcMe3NiQ0' },
  { year: 2025, to_country: 'Lithuania', performer: 'Katarsis', song: 'Tavo akys', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=3F6bwWGhm_s' },
  { year: 2025, to_country: 'Luxembourg', performer: 'Laura Thorn', song: 'La poupée monte le son', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=GT7ZZBCscUg' },
  { year: 2025, to_country: 'Malta', performer: 'Miriana Conte', song: 'Serving', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=povnGP6k0sI' },
  { year: 2025, to_country: 'Montenegro', performer: 'Nina Žižić', song: 'Dobrodošli', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=QxpOxioeZJw' },
  { year: 2025, to_country: 'Netherlands', performer: 'Claude', song: "C'est La Vie", place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=LiTQVJwxvfE' },
  { year: 2025, to_country: 'Norway', performer: 'Kyle Alessandro', song: 'Lighter', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=gQOGxx6Fk9k' },
  { year: 2025, to_country: 'Poland', performer: 'Justyna Steczkowska', song: 'Gaja', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=eg5RtEX1zJ0' },
  { year: 2025, to_country: 'Portugal', performer: 'Napa', song: 'Deslocado', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=waInyqBwSo0' },
  { year: 2025, to_country: 'San Marino', performer: 'Gabry Ponte', song: "Tutta l'Italia", place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=hq6XIRKmA2A' },
  { year: 2025, to_country: 'Serbia', performer: 'Princ', song: 'Mila', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=WlCoZ0UOXoY' },
  { year: 2025, to_country: 'Slovenia', performer: 'Klemen', song: 'How Much Time Do We Have Left', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=Jbs9WlvIkg0' },
  { year: 2025, to_country: 'Spain', performer: 'Melody', song: 'Esa diva', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=IEKSa9FVLqA' },
  { year: 2025, to_country: 'Sweden', performer: 'KAJ', song: 'Bara bada bastu', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=WSh7U3m9KgA' },
  { year: 2025, to_country: 'Switzerland', performer: 'Zoë Më', song: 'Voyage', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=5TMc6HzimQo' },
  { year: 2025, to_country: 'Ukraine', performer: 'Ziferblat', song: 'Bird of Pray', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=-DG0l8sSNJM' },
  { year: 2025, to_country: 'United Kingdom', performer: 'Remember Monday', song: 'What The Hell Just Happened?', place_final: null, points_final: null, youtube_url: 'https://youtube.com/watch?v=Ur5qRh0BaHk' },
];

async function seed() {
  const db = await getDb();

  db.run('DROP TABLE IF EXISTS votes');
  db.run('DROP TABLE IF EXISTS submissions');
  db.run('DROP TABLE IF EXISTS songs');
  db.run('DROP TABLE IF EXISTS settings');

  db.run(`
    CREATE TABLE songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      country TEXT NOT NULL,
      artist TEXT NOT NULL,
      song TEXT NOT NULL,
      place_final INTEGER,
      points_final INTEGER,
      youtube_url TEXT,
      UNIQUE(year, country, song)
    )
  `);

  db.run(`
    CREATE TABLE submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id),
      username TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(song_id)
    )
  `);

  db.run(`
    CREATE TABLE votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      points INTEGER NOT NULL,
      voted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(username, submission_id)
    )
  `);

  db.run(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // voting_state: closed | open | revealed
  db.run("INSERT INTO settings (key, value) VALUES ('voting_state', 'closed')");
  // watching_state: closed | open
  db.run("INSERT INTO settings (key, value) VALUES ('watching_state', 'closed')");
  // admin_password for simple admin auth
  db.run("INSERT INTO settings (key, value) VALUES ('admin_password', 'eurovision2026')");

  db.run('CREATE INDEX IF NOT EXISTS idx_songs_year ON songs(year)');
  db.run('CREATE INDEX IF NOT EXISTS idx_songs_country ON songs(country)');
  db.run('CREATE INDEX IF NOT EXISTS idx_submissions_username ON submissions(username)');

  // Parse CSV
  const csvText = readFileSync(join(__dirname, 'contestants.csv'), 'utf-8');
  const rows = parseCSV(csvText);

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO songs (year, country, artist, song, place_final, points_final, youtube_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  let count = 0;
  for (const r of rows) {
    const yr = parseInt(r.year);
    if (isNaN(yr)) continue;
    stmt.run([
      yr,
      r.to_country || '',
      r.performer || '',
      r.song || '',
      r.place_final ? parseInt(r.place_final) : null,
      r.points_final ? parseInt(r.points_final) : null,
      r.youtube_url || null,
    ]);
    count++;
  }
  stmt.free();

  // Add 2024 + 2025
  const stmt2 = db.prepare(
    'INSERT OR IGNORE INTO songs (year, country, artist, song, place_final, points_final, youtube_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const e of extra) {
    stmt2.run([
      e.year,
      e.to_country,
      e.performer,
      e.song,
      e.place_final || null,
      e.points_final || null,
      e.youtube_url || null,
    ]);
    count++;
  }
  stmt2.free();

  saveDb(db);
  db.close();

  console.log(`Seeded ${count} songs into the database.`);
}

seed().catch(console.error);
