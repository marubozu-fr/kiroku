import random
import statistics
from datetime import datetime, timezone
from typing import Any, Optional

from app.errors import ValidationError
from app.repositories import trade_repository

EPS = 1e-9

_MONTH_LABELS = (
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)


def _now() -> datetime:
  """Current UTC time. Isolated so date-dependent logic is easy to reason about."""
  return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Streak helper (mirrors analytics_service._streaks — replicated to avoid
# importing private names across modules)
# ---------------------------------------------------------------------------

def _streaks(pool: list[dict[str, Any]]) -> tuple[int, int]:
  """Longest winning and losing streaks over the pool, ordered by trade_date then id."""
  ordered = sorted(pool, key=lambda t: ((t.get("trade_date") or ""), t["id"]))
  win_streak = loss_streak = cur_win = cur_loss = 0
  for t in ordered:
    perf = t["performance_r"]
    if perf > EPS:
      cur_win += 1
      cur_loss = 0
    elif perf < -EPS:
      cur_loss += 1
      cur_win = 0
    else:
      cur_win = cur_loss = 0
    win_streak = max(win_streak, cur_win)
    loss_streak = max(loss_streak, cur_loss)
  return win_streak, loss_streak


# ---------------------------------------------------------------------------
# Pure engine functions (all accept explicit args so they are unit-testable)
# ---------------------------------------------------------------------------

def compute_stats(pool: list[dict[str, Any]]) -> dict[str, Any]:
  """Descriptive statistics over the trade pool.

  pool must contain only scored trades (performance_r is not None).
  Requires len(pool) >= 2 (guaranteed by the >= 10 guard upstream).
  """
  r_values = [t["performance_r"] for t in pool]
  n = len(r_values)
  mean = sum(r_values) / n
  std = statistics.stdev(r_values)

  if std == 0.0:
    skewness = 0.0
    kurtosis = 0.0
  else:
    skewness = round((1 / n) * sum(((x - mean) / std) ** 3 for x in r_values), 2)
    kurtosis = round((1 / n) * sum(((x - mean) / std) ** 4 for x in r_values), 2)

  wins = [r for r in r_values if r > EPS]
  win_streak, loss_streak = _streaks(pool)

  return {
    "expectancy": round(mean, 2),
    "win_rate": round(len(wins) / n * 100, 2),
    "std_deviation": round(std, 2),
    "skewness": skewness,
    "kurtosis": kurtosis,
    "total_trades": n,
    "best_trade": round(max(r_values), 2),
    "worst_trade": round(min(r_values), 2),
    "max_winning_streak": win_streak,
    "max_losing_streak": loss_streak,
  }


def compute_actual_months(
  pool: list[dict[str, Any]],
  current_year: int,
  current_month: int,
) -> tuple[list[dict[str, Any]], float]:
  """Build zero-filled actual month buckets for Jan..current_month of current_year.

  Returns (actual_months list, actual_ytd_r).
  """
  # Bucket by month for trades in the current year.
  monthly_r: dict[int, float] = {}
  monthly_count: dict[int, int] = {}
  for t in pool:
    trade_year = int(t["trade_date"][:4])
    if trade_year != current_year:
      continue
    m = int(t["trade_date"][5:7])
    monthly_r[m] = monthly_r.get(m, 0.0) + t["performance_r"]
    monthly_count[m] = monthly_count.get(m, 0) + 1

  result: list[dict[str, Any]] = []
  cumulative = 0.0
  for m in range(1, current_month + 1):
    month_r = monthly_r.get(m, 0.0)
    cumulative = round(cumulative + month_r, 2)
    result.append({
      "month": m,
      "label": _MONTH_LABELS[m - 1],
      "cumulative_r": cumulative,
      "month_r": round(month_r, 2),
      "trades_count": monthly_count.get(m, 0),
    })

  return result, cumulative


def compute_estimated_trades(
  pool: list[dict[str, Any]],
) -> dict[int, int]:
  """Per-calendar-month estimated trade frequency, derived from the pool.

  For each month m in 1..12:
    count_m  = number of pool trades falling in month m (across all years).
    freq[m]  = round(count_m / len(distinct_years))  if count_m > 0
             = fallback                               if count_m == 0

  fallback = max(round(total_pool_trades / len(distinct_years) / 12), 1)

  This means months with zero historical trades default to the overall
  monthly average rather than zero, avoiding simulations with empty months.
  """
  distinct_years = sorted({int(t["trade_date"][:4]) for t in pool})
  n_years = len(distinct_years) if distinct_years else 1
  total = len(pool)
  fallback = max(round(total / n_years / 12), 1)

  month_counts: dict[int, int] = {}
  for t in pool:
    m = int(t["trade_date"][5:7])
    month_counts[m] = month_counts.get(m, 0) + 1

  freq: dict[int, int] = {}
  for m in range(1, 13):
    count_m = month_counts.get(m, 0)
    if count_m > 0:
      freq[m] = max(round(count_m / n_years), 1)
    else:
      freq[m] = fallback
  return freq


def _percentile(sorted_values: list[float], p: float) -> float:
  """Linear-interpolation percentile.  p is in 0..100.  sorted_values must be sorted."""
  n = len(sorted_values)
  if n == 0:
    return 0.0
  if n == 1:
    return sorted_values[0]
  rank = p / 100 * (n - 1)
  lo = int(rank)
  hi = lo + 1
  if hi >= n:
    return sorted_values[-1]
  frac = rank - lo
  return sorted_values[lo] + frac * (sorted_values[hi] - sorted_values[lo])


def run_simulation(
  r_values: list[float],
  estimated_trades: dict[int, int],
  current_month: int,
  actual_ytd_r: float,
  simulations: int,
  seed: Optional[int] = None,
) -> tuple[list[dict[str, Any]], float, float, list[float]]:
  """Run the Monte Carlo simulation.

  Returns (projected_months, ruin_probability, max_drawdown_median, finals),
  where `finals` is each simulation's year-end cumulative R. Goal probability
  is derived from these same finals (see `goal_probability`) so the percentile
  bands, risk, and goal all describe the same simulated futures.

  projected_months covers current_month+1 .. 12.
  If current_month == 12, finals == [actual_ytd_r] * simulations (no future
  months → final == actual_ytd_r for every sim) and projected_months is [].
  """
  if seed is not None:
    random.seed(seed)

  projected_months_range = list(range(current_month + 1, 13))

  # per-month lists of cumulative R at end of that month (across sims)
  month_cumulative: dict[int, list[float]] = {m: [] for m in projected_months_range}
  finals: list[float] = []
  sim_max_drawdowns: list[float] = []

  for _ in range(simulations):
    cumulative = actual_ytd_r
    peak = cumulative
    max_dd = 0.0

    for m in projected_months_range:
      n = estimated_trades[m]
      monthly_r = sum(random.choices(r_values, k=n))
      cumulative += monthly_r
      if cumulative > peak:
        peak = cumulative
      drawdown = peak - cumulative
      if drawdown > max_dd:
        max_dd = drawdown
      month_cumulative[m].append(cumulative)

    finals.append(cumulative)
    # Report drawdown as a negative number.
    sim_max_drawdowns.append(-max_dd)

  # If no projected months exist, finals == [actual_ytd_r] * simulations.
  if not projected_months_range:
    finals = [actual_ytd_r] * simulations
    sim_max_drawdowns = [0.0] * simulations

  ruin_prob = round(sum(1 for f in finals if f < 0) / simulations, 2)
  sim_max_drawdowns.sort()
  max_dd_median = round(_percentile(sim_max_drawdowns, 50), 2)

  projected: list[dict[str, Any]] = []
  for m in projected_months_range:
    vals = sorted(month_cumulative[m])
    projected.append({
      "month": m,
      "label": _MONTH_LABELS[m - 1],
      "p10": round(_percentile(vals, 10), 2),
      "p25": round(_percentile(vals, 25), 2),
      "p50": round(_percentile(vals, 50), 2),
      "p75": round(_percentile(vals, 75), 2),
      "p90": round(_percentile(vals, 90), 2),
      "estimated_trades": estimated_trades[m],
    })

  return projected, ruin_prob, max_dd_median, finals


def goal_probability(finals: list[float], goal_r: float) -> float:
  """Return the share of simulations whose year-end cumulative R >= goal_r.

  `finals` is the per-simulation year-end R list returned by `run_simulation`,
  so the goal probability stays consistent with the percentile bands and risk.
  """
  if not finals:
    return 0.0
  return round(sum(1 for f in finals if f >= goal_r) / len(finals), 2)


# ---------------------------------------------------------------------------
# Top-level async entry point (called by the router)
# ---------------------------------------------------------------------------

def _parse_strs(raw: Optional[str]) -> list[str]:
  """Parse a comma-separated string into a list of trimmed, non-empty values."""
  if not raw:
    return []
  return [part.strip() for part in raw.split(",") if part.strip()]


async def get_projections(
  start_date: Optional[str],
  assets_raw: Optional[str],
  goal_r: Optional[float],
  simulations: int,
) -> dict[str, Any]:
  """Assemble the full projections payload."""
  now = _now()
  current_year = now.year
  current_month = now.month

  asset_names = _parse_strs(assets_raw)

  # Load trades (start_date applied at the DB level). Projections always use
  # live trades only — demo/test trades would distort the simulations.
  trades = await trade_repository.list_with_asset(
    start_date=start_date, account_type="live"
  )

  # Build pool: non-missed, scored, asset-filtered.
  pool = [
    t for t in trades
    if not t.get("missed_opportunity") and t.get("performance_r") is not None
  ]
  if asset_names:
    pool = [t for t in pool if (t.get("asset_name") or "") in asset_names]

  if len(pool) < 10:
    raise ValidationError(
      "Insufficient data: at least 10 trades are required for meaningful projections"
    )

  stats = compute_stats(pool)

  actual_months_list, actual_ytd_r = compute_actual_months(pool, current_year, current_month)
  estimated_trades = compute_estimated_trades(pool)

  r_values = [t["performance_r"] for t in pool]

  projected_months, ruin_prob, max_dd_median, finals = run_simulation(
    r_values=r_values,
    estimated_trades=estimated_trades,
    current_month=current_month,
    actual_ytd_r=actual_ytd_r,
    simulations=simulations,
  )

  goal_result: Optional[dict[str, Any]] = None
  if goal_r is not None:
    goal_result = {
      "target_r": goal_r,
      "probability": goal_probability(finals, goal_r),
    }

  return {
    "actual_months": actual_months_list,
    "projected_months": projected_months,
    "stats": stats,
    "goal": goal_result,
    "risk": {
      "ruin_probability": ruin_prob,
      "max_drawdown_median": max_dd_median,
    },
    "filters_applied": {
      "start_date": start_date,
      "assets": asset_names,
    },
  }
