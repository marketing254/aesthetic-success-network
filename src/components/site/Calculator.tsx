"use client";

import { useState } from "react";

const HOTLINE_VALUE = 150; // conservative per-question consult value; shown as estimate
const COST = 588;

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/**
 * "Do the math" ROI calculator. Defaults render server-side as $4,812 and
 * 9.2x (matching the disclaimer + the static site's no-JS fallback).
 * math = spend x 12 x discount% + questions x $150, minus $588.
 */
export default function Calculator() {
  const [spend, setSpend] = useState(5000);
  const [disc, setDisc] = useState(8);
  const [q, setQ] = useState(4);

  const savings = spend * 12 * (disc / 100) + q * HOTLINE_VALUE;
  const net = savings - COST;
  const mult = Math.round((savings / COST) * 10) / 10;

  return (
    <div className="calc" style={{ textAlign: "left" }}>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="r-spend">
            Monthly spend with vendors a partner could replace <output id="o-spend">{fmt(spend)}</output>
          </label>
          <input
            type="range"
            id="r-spend"
            min={500}
            max={25000}
            step={500}
            value={spend}
            onChange={(e) => setSpend(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="r-disc">
            Member discount you&rsquo;d realistically use <output id="o-disc">{disc}%</output>
          </label>
          <input
            type="range"
            id="r-disc"
            min={2}
            max={20}
            step={1}
            value={disc}
            onChange={(e) => setDisc(Number(e.target.value))}
          />
        </div>
        <div className="ctl">
          <label htmlFor="r-q">
            Hotline questions you&rsquo;d actually ask per year <output id="o-q">{q}</output>
          </label>
          <input
            type="range"
            id="r-q"
            min={0}
            max={12}
            step={1}
            value={q}
            onChange={(e) => setQ(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="result">
        <div className="lbl">Your estimated first-year net benefit</div>
        <div className="big" id="o-net">
          {net < 0 ? "-" : ""}
          {fmt(Math.abs(net))}
        </div>
        <div className="vs">
          vs <b>$588/yr</b> founding membership ($49 &times; 12), that&rsquo;s{" "}
          <span id="o-mult">{mult.toLocaleString("en-US")}&times;</span> your cost
        </div>
      </div>
      <div className="disclaimer">
        How this is calculated: your monthly vendor spend &times; 12 &times; your chosen discount,
        plus $150 of estimated consulting value per Hotline question (our assumption, not a
        promise), minus the $588 annual founding fee. These are estimates only; actual savings
        depend on the deals partners commit to and how much you use the network. Results can be
        negative, and no results are guaranteed.
      </div>
    </div>
  );
}
