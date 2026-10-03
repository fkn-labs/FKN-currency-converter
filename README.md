# FKN's Currency Converter

A currency converter built with Express, Axios and EJS.
Rates come from the free ExchangeRate-API open endpoint (no API key needed).

## Run it
    npm install
    node index.js
Then open http://localhost:3000

## How it works
- `GET /?amount=100&from=USD&to=GHS` asks the API for rates and renders the result.
- Responses are cached for 10 minutes.
- Errors (bad input, unknown currency, API down) show a friendly message.

Rates by [ExchangeRate-API](https://www.exchangerate-api.com)
