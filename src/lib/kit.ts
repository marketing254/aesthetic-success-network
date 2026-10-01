/**
 * Kit (formerly ConvertKit) form subscription helper.
 *
 * Sends signups to Kit's V3 API, server-side and API-key authenticated.
 *
 * Configuration (all optional; the helper is a no-op until they exist):
 *   - KIT_API_KEY         the account API key
 *   - KIT_FORM_WAITLIST   numeric form id for member waitlist signups
 *   - KIT_FORM_VENDOR     numeric form id for partner applications
 *
 * Find form ids in Kit dashboard → Forms → click form → the URL has the
 * number.
 *
 * Field keys MUST match the custom-field keys configured on the Kit form
 * (snake_case). Unknown keys are silently dropped by Kit.
 *
 * Usage is fire-and-forget from the API routes — never block the user's
 * response on Kit's availability.
 */

export type KitForm = "waitlist" | "vendor";

const FORM_ENV: Record<KitForm, string> = {
  waitlist: "KIT_FORM_WAITLIST",
  vendor: "KIT_FORM_VENDOR",
};

function formIdFor(form: KitForm): string | null {
  const v = process.env[FORM_ENV[form]]?.trim();
  return v ? v : null;
}

export type KitSubscribeInput = {
  email: string;
  firstName?: string;
  // Custom fields. Keys must match the snake_case field keys configured on
  // the Kit form. Unknown keys are dropped server-side by Kit.
  fields?: Record<string, string | null | undefined>;
};

export type KitSubscribeResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export async function subscribeToKit(
  form: KitForm,
  input: KitSubscribeInput,
): Promise<KitSubscribeResult> {
  const formId = formIdFor(form);
  const apiKey = process.env.KIT_API_KEY?.trim();

  if (!apiKey || !formId) {
    console.info(
      `[kit] not configured (${!apiKey ? "KIT_API_KEY" : FORM_ENV[form]} unset); skipping ${form} subscribe.`,
    );
    return { ok: false, error: "kit not configured" };
  }

  // Kit V3 API — server-side, API-key authenticated. Bypasses the public
  // form's "Form Guard" anti-spam quarantine that the public POST endpoint
  // applies to non-browser submissions.
  const url = `https://api.convertkit.com/v3/forms/${encodeURIComponent(formId)}/subscribe`;

  // Clean the fields object before sending so Kit doesn't get explicit
  // nulls (they sometimes get stored as the string "null").
  const cleanedFields: Record<string, string> = {};
  if (input.fields) {
    for (const [k, v] of Object.entries(input.fields)) {
      if (v !== undefined && v !== null && v !== "") {
        cleanedFields[k] = String(v);
      }
    }
  }

  const payload: Record<string, unknown> = {
    api_key: apiKey,
    email: input.email,
  };
  if (input.firstName) payload.first_name = input.firstName;
  if (Object.keys(cleanedFields).length > 0) payload.fields = cleanedFields;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[kit] ${form} (${formId}) ${res.status}:`, text.slice(0, 300));
    }
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error(`[kit] ${form} (${formId}) threw:`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Kit unreachable",
    };
  }
}

function firstNameFrom(fullName: string | undefined | null): string | undefined {
  if (!fullName) return undefined;
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

/**
 * Forward a waitlist signup to Kit. Fire-and-forget — caller doesn't await.
 *
 * Kit form fields (per dashboard):
 *   email_address, phone, practice_name, number_of_locations,
 *   biggest_challenge, source, page_url
 */
export function forwardWaitlistToKit(payload: {
  email: string;
  fullName?: string;
  practiceName?: string | null;
  phone?: string | null;
  numberOfLocations?: string | null;
  biggestChallenge?: string | null;
  source?: string | null;
  pageUrl?: string | null;
}): void {
  void subscribeToKit("waitlist", {
    email: payload.email,
    firstName: firstNameFrom(payload.fullName),
    fields: {
      phone: payload.phone ?? null,
      practice_name: payload.practiceName ?? null,
      number_of_locations: payload.numberOfLocations ?? null,
      biggest_challenge: payload.biggestChallenge ?? null,
      source: payload.source ?? null,
      page_url: payload.pageUrl ?? null,
    },
  });
}

/**
 * Forward a partner (vendor) application to Kit. Fire-and-forget — caller doesn't await.
 *
 * Kit form fields (per dashboard):
 *   email_address, phone, firm_name, vendor_category, website,
 *   source, page_url
 */
export function forwardVendorToKit(payload: {
  contactEmail: string;
  contactName?: string;
  companyName?: string | null;
  category?: string | null;
  website?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  pageUrl?: string | null;
}): void {
  void subscribeToKit("vendor", {
    email: payload.contactEmail,
    firstName: firstNameFrom(payload.contactName),
    fields: {
      phone: payload.contactPhone ?? null,
      firm_name: payload.companyName ?? null,
      vendor_category: payload.category ?? null,
      website: payload.website ?? null,
      source: payload.source ?? null,
      page_url: payload.pageUrl ?? null,
    },
  });
}
