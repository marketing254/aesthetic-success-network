"use client";

import { useState } from "react";

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Injectable margin calculator. Cost per unit vs. price per unit, with a
 * units-per-treatment multiplier, so an owner can see per-treatment profit
 * and margin % without pulling out a spreadsheet.
 */
export default function MarginCalculator() {
  const [costPerUnit, setCostPerUnit] = useState(10);
  const [pricePerUnit, setPricePerUnit] = useState(16);
  const [unitsPerTreatment, setUnitsPerTreatment] = useState(40);

  const revenue = pricePerUnit * unitsPerTreatment;
  const cost = costPerUnit * unitsPerTreatment;
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <div className="calc" style={{ textAlign: "left" }}>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="m-cost">
            Your cost per unit <output>{fmt(costPerUnit)}</output>
          </label>
          <input
            type="range"
            id="m-cost"
            min={2}
            max={40}
            step={0.5}
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="m-price">
            Your price per unit <output>{fmt(pricePerUnit)}</output>
          </label>
          <input
            type="range"
            id="m-price"
            min={4}
            max={60}
            step={0.5}
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="m-units">
            Units per treatment <output>{unitsPerTreatment}</output>
          </label>
          <input
            type="range"
            id="m-units"
            min={5}
            max={100}
            step={1}
            value={unitsPerTreatment}
            onChange={(e) => setUnitsPerTreatment(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="result">
        <div className="lbl">Profit per treatment &middot; margin</div>
        <div className="big">
          {fmt(profit)} <span style={{ fontSize: "0.5em", fontWeight: 600 }}>&middot; {margin.toFixed(1)}%</span>
        </div>
        <div className="vs">
          {fmt(revenue)} revenue &minus; {fmt(cost)} product cost, at {unitsPerTreatment} units
        </div>
      </div>
      <div className="disclaimer">
        How this is calculated: (price per unit &minus; cost per unit) &times; units per
        treatment. Cost per unit should include waste and the injection kit, not just the vial
        price. Estimates only &mdash; actual margin depends on your real invoice cost and any
        promotional pricing.
      </div>
    </div>
  );
}
