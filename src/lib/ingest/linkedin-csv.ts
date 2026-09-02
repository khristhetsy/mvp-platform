// LinkedIn Connections.csv parser. LinkedIn prepends a few "Notes:" preamble lines
// before the real header row, so we skip everything until the header that starts with
// "First Name". Columns: First Name, Last Name, URL, Email Address, Company, Position,
// Connected On. Pure/deterministic — no network, no AI (AI never touches identifiers).

export type LinkedInRow = {
  firstName: string;
  lastName: string;
  name: string;
  profileUrl: string;
  email: string;      // "" when LinkedIn withheld it (most rows)
  domain: string;     // derived from email local@domain, else ""
  company: string;
  title: string;
  connectedOn: string;
};

// A row's triage bucket BEFORE any verification. We never claim "verified" here —
// that requires the SMTP/MX verify service, which this preview does not run.
export type LinkedInDisposition = "has_email" | "no_email";

export type LinkedInParseResult = {
  rows: LinkedInRow[];
  total: number;
  withEmail: number;
  withoutEmail: number;
  error?: string;
};

// Split one CSV record into fields, honoring double-quoted fields (which may contain
// commas and escaped "" quotes). Operates on a single logical record string.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Break raw file text into logical CSV records, keeping quoted newlines together.
function toRecords(text: string): string[] {
  const records: string[] = [];
  let cur = "";
  let inQuotes = false;
  const norm = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if (ch === "\n" && !inQuotes) {
      records.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length) records.push(cur);
  return records;
}

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase().trim() : "";
}

export function parseLinkedInCsv(text: string): LinkedInParseResult {
  const records = toRecords(text);
  // Find the header record — the first one starting with "First Name".
  const headerIdx = records.findIndex((r) => /^"?First Name"?\s*,/i.test(r.trim()));
  if (headerIdx === -1) {
    return { rows: [], total: 0, withEmail: 0, withoutEmail: 0, error: "This doesn't look like a LinkedIn Connections.csv — no \"First Name\" header row was found. Export Connections from LinkedIn → Settings → Data privacy → Get a copy of your data." };
  }

  const header = splitCsvLine(records[headerIdx]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iFirst = col("first name");
  const iLast = col("last name");
  const iUrl = col("url");
  const iEmail = col("email address");
  const iCompany = col("company");
  const iPos = col("position");
  const iConn = col("connected on");

  const rows: LinkedInRow[] = [];
  for (let r = headerIdx + 1; r < records.length; r++) {
    const raw = records[r];
    if (!raw.trim()) continue;
    const f = splitCsvLine(raw);
    const at = (i: number) => (i >= 0 && i < f.length ? f[i].trim() : "");
    const firstName = at(iFirst);
    const lastName = at(iLast);
    if (!firstName && !lastName && !at(iCompany)) continue; // junk/empty line
    const email = at(iEmail).toLowerCase();
    rows.push({
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(" ") || "Unknown",
      profileUrl: at(iUrl),
      email,
      domain: domainOf(email),
      company: at(iCompany),
      title: at(iPos),
      connectedOn: at(iConn),
    });
  }

  const withEmail = rows.filter((x) => x.email).length;
  return { rows, total: rows.length, withEmail, withoutEmail: rows.length - withEmail };
}
