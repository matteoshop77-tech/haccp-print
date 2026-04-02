// ── Lemon Squeezy License Service ──────────────────────────────────────────

const LS_API_KEY  = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiI0Y2M5ZmFlMmMwZjE4YzM1YjYxN2NiZTNkMmJlZmQ2NzJhNzNhZDRkOWUyZTgwYmZjYjlkYmQ5ZGNjMzYyNDVkZmY1MWNmNmE0YWQ4YzE5MSIsImlhdCI6MTc3NTE1Mjk1MS4wOTM4MjEsIm5iZiI6MTc3NTE1Mjk1MS4wOTM4MjMsImV4cCI6MTc5MDg5OTIwMC4wNDE5MzgsInN1YiI6IjY4MjQ5ODMiLCJzY29wZXMiOltdfQ.IFVv-SPDpBYI2tQGbW3S4oRi942f68w_VrUeF-t8VwWtepms-JIpTKZTDl1t4mwvf2i-bme0QQApi6AbHJKaGtw_eoP2pvPsQ9S-NHN_GhOZoHhflasFLvIxPsHu18gO_MWKwUW4RuPWt1Oxi1mMqvqT_bVTn82qhflleD2f3IwF9dj5OPYd849yma3diKIVxgfJ8jcliwBbn36V1hDSjzo4b0xWiG-XiLJ5oBCMfyPOHV2fBy4BdAlUreudgimj62Uv3krz8td0s2U_GG8zXsaYkmYjpoIHcPBuV_ibz4sSNgJKB8kgQ6mqDwwVlkWiV6PNq2K5BTppHPsvnyFdZg_Z9h9DxBYsyqqv-HUazCQz4sgEA9ciALiZ_QLzo4FFGHlNJ6e4-hGBAaZbDz7eIaQ7O327oAHYdXjlrNFDSIBlNig8fp0dFN6JIC0L-0EYl3aUdaSAiBw8CGpWYrlthFWR3ySfkdTRlOP1L3bh3JKre3q_E-HA52nZ61hlcrpBsY8vbEwONuaH-ut-hH5WZQSlvp7BT0JVJOyw_NJUw1ltVFgYu1K1XWbbywEEaJ_Sz1GKCwnH5uQP66hDEUlvHfcyKuiQyzphl5c33cCMzjXbr2ZKkH-tQVdVJ9OL2J8wtYfvIx-OZ4viwVkxI2rsRYisnVqSlO-OGbHz6jpeL-o";
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