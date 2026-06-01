"use client";

import { useState } from "react";
import { faqs } from "@/content";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq__list">
      {faqs.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className="faq__item" key={item.q} data-open={isOpen}>
            <button
              type="button"
              className="faq__q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {item.q}
              <span className="faq__sign" aria-hidden="true" />
            </button>
            <div className="faq__a">
              <div className="faq__a-inner">
                {item.a && <p>{item.a}</p>}
                {item.items && (
                  <ul>
                    {item.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                )}
                {item.aClose && <p className="faq__close">{item.aClose}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
