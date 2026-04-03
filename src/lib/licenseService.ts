// ── Lemon Squeezy License Service ──────────────────────────────────────────

const PRO_ID = "942032";

function getDeviceId(): string {
  const nav = window.navigator;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join("|");

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export interface ActivateResult {
  success: boolean;
  license?: import("@/lib/types").License;
  error?:   string;
}

export async function activateLicense(key: string): Promise<ActivateResult> {
  try {
    const deviceId     = getDeviceId();
    const instanceName = `HACCPrint-${deviceId}`;

    const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/activate", {
      method: "POST",
      headers: {
        "Accept":       "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        license_key:   key.trim(),
        instance_name: instanceName,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.activated) {
      return {
        success: false,
        error: data.error ?? "Invalid license key.",
      };
    }

    const productId = String(data.meta?.product_id ?? "");
    const plan: import("@/lib/types").SubscriptionPlan =
      productId === PRO_ID ? "premium" : "basic";

    const expiresAt = data.license_key?.expires_at
      ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      license: {
        key,
        plan,
        expiresAt,
        deviceId,
        activatedAt: new Date().toISOString(),
      },
    };
  } catch {
    return {
      success: false,
      error: "Network error. Check your internet connection.",
    };
  }
}

export async function validateLicense(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method: "POST",
      headers: {
        "Accept":       "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        license_key: key.trim(),
      }),
    });

    const data = await res.json();
    return res.ok && data.valid === true;
  } catch {
    return false;
  }
}