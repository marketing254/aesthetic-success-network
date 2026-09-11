"use client";

import { useState } from "react";

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/**
 * Consult-conversion calculator. Shows the monthly revenue impact of
 * lifting same-day close rate by a few points, holding lead volume and
 * average ticket constant.
 */
export default function ConversionCalculator() {
  const [consults, setConsults] = useState(40);
  const [closeRate, setCloseRate] = useState(35);
  const [avgTicket, setAvgTicket] = useState(650);
  const [liftPoints, setLiftPoints] = useState(10);

  const currentRevenue = consults * (closeRate / 100) * avgTicket;
  const liftedRevenue = consults * ((closeRate + liftPoints) / 100) * avgTicket;
  const monthlyGain = liftedRevenue - currentRevenue;
  const annualGain = monthlyGain * 12;

  return (
    <div className="calc" style={{ textAlign: "left" }}>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="c-consults">
            Consults per month <output>{consults}</output>
          </label>
          <input
            type="range"
            id="c-consults"
            min={5}
            max={200}
            step={5}
            value={consults}
            onChange={(e) => setConsults(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="c-close">
            Current same-day close rate <output>{closeRate}%</output>
          </label>
          <input
            type="range"
            id="c-close"
            min={5}
            max={90}
            step={1}
            value={closeRate}
            onChange={(e) => setCloseRate(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="c-ticket">
            Average ticket <output>{fmt(avgTicket)}</output>
          </label>
          <input
            type="range"
            id="c-ticket"
            min={100}
            max={5000}
            step={50}
            value={avgTicket}
            onChange={(e) => setAvgTicket(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="c-lift">
            Close-rate lift you want to test <output>+{liftPoints}pts</output>
          </label>
          <input
            type="range"
            id="c-lift"
            min={1}
            max={30}
            step={1}
            value={liftPoints}
            onChange={(e) => setLiftPoints(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="result">
        <div className="lbl">Added revenue from that lift</div>
        <div className="big">{fmt(monthlyGain)}/mo</div>
        <div className="vs">
          {fmt(annualGain)}/yr, moving close rate from {closeRate}% to {closeRate + liftPoints}%
          on the same {consults} consults
        </div>
      </div>
      <div className="disclaimer">
        How this is calculated: consults &times; close rate &times; average ticket, compared at
        your current rate vs. your target rate. Estimates only &mdash; actual results depend on
        case mix, financing options and how consistently your team runs the consult.
      </div>
    </div>
  );
}
