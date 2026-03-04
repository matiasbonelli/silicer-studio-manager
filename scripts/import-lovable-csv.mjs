import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const CSV_DIR = path.join(ROOT, "data", "lovable-csv");
const DEFAULT_ADMIN_EMAIL = "silicerespacio@gmail.com";

const TABLE_TO_PREFIX = {
  schedules: "schedules",
  students: "students",
  inventory: "inventory",
  sales: "sales",
  sale_items: "sale_items",
  enrollments: "enrollments",
  user_roles: "user_roles",
  pricing_config: "pricing_config",
  pricing_products: "pricing_products",
};

const CLEAR_ORDER = [
  "sale_items",
  "sales",
  "enrollments",
  "students",
  "inventory",
  "schedules",
  "pricing_products",
  "pricing_config",
  "user_roles",
];

const LOAD_ORDER = [
  "schedules",
  "students",
  "inventory",
  "sales",
  "sale_items",
  "enrollments",
  "user_roles",
  "pricing_config",
  "pricing_products",
];

function readDotEnvVar(name) {
  if (!fs.existsSync(ENV_PATH)) return null;
  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (key !== name) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

function getEnv(name) {
  return process.env[name] || readDotEnvVar(name);
}

function parseSemicolonCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ";" && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function normalizeValue(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  return trimmed;
}

function getLatestCsv(prefix) {
  const files = fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.startsWith(`${prefix}-export-`) && f.endsWith(".csv"))
    .sort();
  return files[files.length - 1] || null;
}

function loadCsv(prefix) {
  const file = getLatestCsv(prefix);
  if (!file) {
    throw new Error(`No se encontró CSV para: ${prefix}`);
  }

  const fullPath = path.join(CSV_DIR, file);
  const text = fs.readFileSync(fullPath, "utf8");
  const rows = parseSemicolonCsv(text);
  const headers = (rows[0] || []).map((h) => h.replace(/^\ufeff/, "").trim());
  const dataRows = rows.slice(1);

  const data = dataRows.map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = normalizeValue(row[i]);
    }
    return obj;
  });

  return { file, rows: data };
}

async function clearTable(supabase, table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) throw new Error(`Error limpiando ${table}: ${error.message}`);
  console.log(`Limpieza ${table}: ${count ?? 0}`);
}

async function upsertTable(supabase, table, rows, chunkSize = 500) {
  if (rows.length === 0) {
    console.log(`Carga ${table}: 0`);
    return;
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) {
      throw new Error(`Error cargando ${table} (${i}-${i + chunk.length - 1}): ${error.message}`);
    }
  }
  console.log(`Carga ${table}: ${rows.length}`);
}

async function countTable(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Error contando ${table}: ${error.message}`);
  return count ?? 0;
}

async function ensureAdminLinkedData(supabase, adminEmail) {
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (usersError) throw new Error(`No se pudieron listar usuarios: ${usersError.message}`);

  const users = usersData.users || [];
  const userIdSet = new Set(users.map((u) => u.id));
  const adminUser = users.find((u) => (u.email || "").toLowerCase() === adminEmail.toLowerCase());
  if (!adminUser) {
    console.log(`Aviso: no se encontró usuario auth para ${adminEmail}.`);
    return;
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("id,user_id,role");
  if (rolesError) throw new Error(`Error leyendo user_roles: ${rolesError.message}`);

  const orphanRoleIds = (roles || [])
    .filter((r) => !userIdSet.has(r.user_id))
    .map((r) => r.id);
  if (orphanRoleIds.length > 0) {
    const { error } = await supabase.from("user_roles").delete().in("id", orphanRoleIds);
    if (error) throw new Error(`Error limpiando user_roles huérfanos: ${error.message}`);
  }

  const hasAdminRole = (roles || []).some(
    (r) => r.user_id === adminUser.id && r.role === "admin",
  );
  if (!hasAdminRole) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: adminUser.id, role: "admin" });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      throw new Error(`Error restaurando rol admin: ${error.message}`);
    }
  }

  const { data: pricingConfig, error: pcError } = await supabase
    .from("pricing_config")
    .select("id,user_id");
  if (pcError) throw new Error(`Error leyendo pricing_config: ${pcError.message}`);

  if ((pricingConfig || []).length > 1) {
    const keep = pricingConfig[0]?.id;
    const deleteIds = pricingConfig.filter((r) => r.id !== keep).map((r) => r.id);
    if (deleteIds.length > 0) {
      const { error } = await supabase.from("pricing_config").delete().in("id", deleteIds);
      if (error) throw new Error(`Error limpiando pricing_config duplicado: ${error.message}`);
    }
  }

  if ((pricingConfig || []).length > 0) {
    const rowId = pricingConfig[0].id;
    const { error } = await supabase
      .from("pricing_config")
      .update({ user_id: adminUser.id })
      .eq("id", rowId);
    if (error) throw new Error(`Error remapeando pricing_config.user_id: ${error.message}`);
  }

  const { error: ppError } = await supabase
    .from("pricing_products")
    .update({ user_id: adminUser.id })
    .neq("user_id", adminUser.id);
  if (ppError) throw new Error(`Error remapeando pricing_products.user_id: ${ppError.message}`);
}

async function run() {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.");
  }
  if (!fs.existsSync(CSV_DIR)) {
    throw new Error(`No existe la carpeta ${CSV_DIR}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const datasets = {};
  console.log("CSV seleccionados:");
  for (const [table, prefix] of Object.entries(TABLE_TO_PREFIX)) {
    datasets[table] = loadCsv(prefix);
    console.log(`- ${table}: ${datasets[table].file}`);
  }

  for (const table of CLEAR_ORDER) {
    await clearTable(supabase, table);
  }

  for (const table of LOAD_ORDER) {
    await upsertTable(supabase, table, datasets[table].rows);
  }

  await ensureAdminLinkedData(supabase, adminEmail);

  console.log("\nConteo final:");
  for (const table of LOAD_ORDER) {
    const count = await countTable(supabase, table);
    console.log(`${table}: ${count}`);
  }
}

run().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
