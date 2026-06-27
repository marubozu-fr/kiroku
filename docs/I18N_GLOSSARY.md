# I18N Glossary — Terms Kept in English

Trading-specific terms that remain in English across all supported languages.
These are industry-standard terms used universally by traders worldwide.

When building translations for any language, these terms must appear in their
English form. Do not translate, transliterate, or adapt them.

## Performance Metrics

| Term | Abbreviation | Context |
|------|-------------|---------|
| P&L | — | Profit & Loss — the core financial result |
| Win Rate | — | Percentage of winning trades |
| Profit Factor | — | Ratio of gross profit to gross loss |
| Expectancy | — | Average expected gain per trade in R |
| Sharpe Ratio | — | Risk-adjusted return metric |
| Drawdown | DD | Peak-to-trough equity decline |
| Max Drawdown | MDD | Largest historical drawdown |
| R | — | Unit of risk (1R = amount risked on a trade) |
| Risk/Reward | R:R | Ratio of potential loss to potential gain |
| Losing Streak | — | Consecutive losing trades |
| Winning Streak | — | Consecutive winning trades |

## Trade Mechanics

| Term | Abbreviation | Context |
|------|-------------|---------|
| Stop Loss | SL | Price level to exit at a loss |
| Take Profit | TP | Price level to exit at a profit |
| Breakeven | BE | Exit at no profit, no loss |
| Long | — | Buying direction (expecting price to rise) |
| Short | — | Selling direction (expecting price to fall) |
| Lot | — | Unit of trade size |
| Spread | — | Difference between bid and ask price |
| Slippage | — | Difference between expected and actual fill price |
| Swap | — | Overnight holding cost/credit |
| Leverage | — | Borrowed capital multiplier |

## Trade Classification

| Term | Abbreviation | Context |
|------|-------------|---------|
| Swing | — | Multi-day trading style |
| Scalping | — | Very short-term trading style |
| Day Trading | — | Intraday trading style |
| Timeframe | TF | Chart time period (M15, H1, D1, etc.) |
| Setup | — | Predefined trade entry pattern/criteria |
| Trade | — | A single position from entry to exit |
| Tags | — | User-defined labels attached to trades |

## Charts & Dashboard

| Term | Abbreviation | Context |
|------|-------------|---------|
| Equity Curve | — | Cumulative P&L over time chart |
| YTD | — | Year To Date |

## Usage in Code

In translation files, use these terms as-is:

```json
{
  "journal": {
    "table": {
      "header": {
        "pnl": "P&L",
        "win_rate": "Win Rate",
        "stop_loss": "Stop Loss"
      }
    }
  }
}
```

These values are identical in `en.json`, `fr.json`, `es.json`, `it.json`, `de.json`, and `pt.json`.

## Adding Terms

Before translating a new trading term, check this glossary. If the term is here,
keep it in English. If you believe a term should be added, update this file first.
