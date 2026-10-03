import express from "express";
import axios from "axios";

const app = express();
const port = 3000;

// ExchangeRate-API's free "open" endpoint: no API key needed.
// Example: https://open.er-api.com/v6/latest/USD
const API_URL = "https://open.er-api.com/v6/latest";

// Nice names for the currencies people use most. Others still work, they just show the code.
const NAMES = {
  GHS: "Ghanaian Cedi", USD: "US Dollar", EUR: "Euro", GBP: "British Pound",
  NGN: "Nigerian Naira", CNY: "Chinese Yuan", CAD: "Canadian Dollar",
  JPY: "Japanese Yen", INR: "Indian Rupee", ZAR: "South African Rand",
  XOF: "West African CFA Franc", AUD: "Australian Dollar", CHF: "Swiss Franc",
  AED: "UAE Dirham", KES: "Kenyan Shilling",
};
const POPULAR = Object.keys(NAMES);

// Rates only change about once a day, so we keep each response for 10 minutes.
// This makes the page faster and avoids hammering the API.
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

app.use(express.static("public"));

// Fetch rates for a base currency (with caching). Throws if something goes wrong.
async function getRates(base) {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.savedAt < CACHE_MS) return hit.data;

  const response = await axios.get(`${API_URL}/${base}`, { timeout: 8000 });

  // This API can answer "200 OK" but still report an error inside the JSON.
  if (response.data.result !== "success") {
    const err = new Error(response.data["error-type"] || "unknown");
    err.apiError = true;
    throw err;
  }
  cache.set(base, { savedAt: Date.now(), data: response.data });
  return response.data;
}

// Turn a number into text like 1,234.56
const fmt = (n, digits = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

// Rates can be tiny (0.08) or big (12.3), so show more decimals for small numbers.
const fmtRate = (n) => fmt(n, n < 1 ? 5 : 4).replace(/\.?0+$/, "") ;

// Main page: GET /?amount=100&from=USD&to=GHS
app.get("/", async (req, res) => {
  const from = String(req.query.from || "USD").toUpperCase();
  const to = String(req.query.to || "GHS").toUpperCase();
  const amount = Number(req.query.amount ?? 100); // default so the page opens with a result

  // Values the template always needs, even when something fails.
  const view = { from, to, amountInput: req.query.amount ?? "100", codes: POPULAR, names: NAMES, result: null, error: null };

  // 1. Check what the user typed. Currency codes must be exactly 3 letters (like GHS),
  // because "from" is placed inside the API URL and we never want odd text there.
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    view.error = "Currency codes must be 3 letters, like USD or GHS.";
    return res.render("index.ejs", view);
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
    view.error = "Enter a valid amount, like 250 or 99.50.";
    return res.render("index.ejs", view);
  }

  // 2. Ask the API and build the result.
  try {
    const data = await getRates(from);
    const rates = data.rates;

    if (!(to in rates)) {
      view.error = `We don't have rates for "${to}". Pick a currency from the list.`;
      return res.render("index.ejs", view);
    }

    // Full list of codes for the dropdowns: popular first, the rest A to Z.
    const others = Object.keys(rates).filter((c) => !POPULAR.includes(c)).sort();
    view.codes = [...POPULAR.filter((c) => c in rates), ...others];

    view.result = {
      amount: fmt(amount),
      converted: fmt(amount * rates[to]),
      rate: fmtRate(rates[to]),
      inverse: fmtRate(1 / rates[to]),
      updated: new Date(data.time_last_update_utc).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      }),
      // The same amount in a few other popular currencies (no extra API call needed).
      others: POPULAR.filter((c) => c !== from && c in rates).slice(0, 6).map((c) => ({
        code: c, value: fmt(amount * rates[c]),
      })),
    };
  } catch (err) {
    console.error("Rates request failed:", err.message);

    if (err.apiError && err.message === "unsupported-code") {
      view.error = `"${from}" isn't a supported currency code.`;
    } else if (err.response) {
      view.error = "The exchange-rate service had a problem. Try again in a minute.";
    } else if (err.request) {
      view.error = "Couldn't reach the exchange-rate service. Check your internet connection.";
    } else {
      view.error = "Something went wrong while converting. Please try again.";
    }
  }

  res.render("index.ejs", view);
});

app.listen(port, () => {
  console.log(`Cedi Converter running at http://localhost:${port}`);
});
