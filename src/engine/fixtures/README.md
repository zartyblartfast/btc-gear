# Golden scenario fixture provenance

Reviewed at: 2026-05-30

Expected values in `goldenScenarios.json` were calculated by an independent Python reference formula in this implementation session, not by importing or calling the TypeScript engine under test. The formulas mirror the public spec: interest on starting debt, max safe debt = min(income LTV ceiling, liquidation LTV after required buffer), draw capped by available safe capacity, and ending-row risk fields calculated from ending debt.

Required MVP engine fixtures covered:

## flat-fixed-draw-all-safe
Flat BTC, fixed draw, all years stay green.

Key expected rows:
- 2026: price=100000, startDebt=0.000000, interest=0.000000, target=10000.000000, actual=10000.000000, skipped=0.000000, endingDebt=10000.000000, LTV=10.000000%, drop=80.000000%, netBTC=0.900000, status=green
- 2027: price=100000, startDebt=10000.000000, interest=0.000000, target=10000.000000, actual=10000.000000, skipped=0.000000, endingDebt=20000.000000, LTV=20.000000%, drop=60.000000%, netBTC=0.800000, status=green
- 2028: price=100000, startDebt=20000.000000, interest=0.000000, target=10000.000000, actual=10000.000000, skipped=0.000000, endingDebt=30000.000000, LTV=30.000000%, drop=40.000000%, netBTC=0.700000, status=green

## bear-fixed-draw-constrained
Bear path, fixed draw becomes constrained by safe capacity.

Key expected rows:
- 2026: price=100000, startDebt=0.000000, interest=0.000000, target=20000.000000, actual=20000.000000, skipped=0.000000, endingDebt=20000.000000, LTV=20.000000%, drop=60.000000%, netBTC=0.800000, status=green
- 2027: price=80000, startDebt=20000.000000, interest=0.000000, target=20000.000000, actual=12000.000000, skipped=8000.000000, endingDebt=32000.000000, LTV=40.000000%, drop=20.000000%, netBTC=0.600000, status=constrained
- 2028: price=70000, startDebt=32000.000000, interest=0.000000, target=20000.000000, actual=0.000000, skipped=20000.000000, endingDebt=32000.000000, LTV=45.714286%, drop=8.571429%, netBTC=0.542857, status=constrained

## bear-recovery-supplemental-resumes
Bear then recovery, Supplemental Guardrail reduces, skips, then resumes without liquidation.

Key expected rows:
- 2026: price=100000, startDebt=20000.000000, interest=0.000000, target=15000.000000, actual=15000.000000, skipped=0.000000, endingDebt=35000.000000, LTV=35.000000%, drop=30.000000%, netBTC=0.650000, status=green
- 2027: price=90000, startDebt=35000.000000, interest=0.000000, target=15000.000000, actual=1000.000000, skipped=14000.000000, endingDebt=36000.000000, LTV=40.000000%, drop=20.000000%, netBTC=0.600000, status=constrained
- 2028: price=80000, startDebt=36000.000000, interest=0.000000, target=15000.000000, actual=0.000000, skipped=15000.000000, endingDebt=36000.000000, LTV=45.000000%, drop=10.000000%, netBTC=0.550000, status=constrained
- 2029: price=150000, startDebt=36000.000000, interest=0.000000, target=15000.000000, actual=15000.000000, skipped=0.000000, endingDebt=51000.000000, LTV=34.000000%, drop=32.000000%, netBTC=0.660000, status=green

## bull-arva-income-rises
Bull path, ARVA recalculation increases income over time.

Key expected rows:
- 2026: price=100000, startDebt=0.000000, interest=0.000000, target=50000.000000, actual=50000.000000, skipped=0.000000, endingDebt=50000.000000, LTV=50.000000%, drop=50.000000%, netBTC=0.500000, status=green
- 2027: price=200000, startDebt=50000.000000, interest=0.000000, target=150000.000000, actual=130000.000000, skipped=20000.000000, endingDebt=180000.000000, LTV=90.000000%, drop=10.000000%, netBTC=0.100000, status=constrained

## crash-arva-guardrails-safety-override
Crash path, ARVA Guardrails safety override beats smoothing.

Key expected rows:
- 2026: price=100000, startDebt=0.000000, interest=0.000000, target=20000.000000, actual=20000.000000, skipped=0.000000, endingDebt=20000.000000, LTV=20.000000%, drop=80.000000%, netBTC=0.800000, status=green
- 2027: price=30000, startDebt=20000.000000, interest=0.000000, target=18000.000000, actual=7000.000000, skipped=11000.000000, endingDebt=27000.000000, LTV=90.000000%, drop=10.000000%, netBTC=0.100000, status=constrained

## Deferred fixture
The required Review/Rebaseline fixture from `docs/web-app/test-strategy.md` depends on Stage 2/Review storage and rebaseline operations, which are not implemented in the Stage 1 engine yet. It should be added when those operations exist so the fixture can test real behavior rather than a placeholder.
