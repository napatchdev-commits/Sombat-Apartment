// ==========================================================================
// SUPABASE EDGE FUNCTION - LINE Login OAuth Callback Handler
// Processes authorization code, retrieves LINE profile, and saves link to DB.
//
// Deploy:
//   supabase functions deploy line-login-callback --no-verify-jwt
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   LINE_LOGIN_CHANNEL_ID       - your LINE Login Channel ID
//   LINE_LOGIN_CHANNEL_SECRET   - your LINE Login Channel Secret
// ==========================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_LOGIN_CHANNEL_ID = Deno.env.get("LINE_LOGIN_CHANNEL_ID") || "";
const LINE_LOGIN_CHANNEL_SECRET = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET") || "";

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: { "Location": url },
  });
}

function errorResponse(msg: string, status = 400) {
  return new Response(JSON.stringify({ status: "error", message: msg }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const urlObj = new URL(req.url);
  const action = urlObj.searchParams.get("action");
  
  // Construct external Callback URL handling reverse proxy (Kong) protocol downgrade & path rewrite
  let CALLBACK_URL = Deno.env.get("LINE_REDIRECT_URI");
  if (!CALLBACK_URL) {
    const host = urlObj.hostname;
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const port = urlObj.port ? `:${urlObj.port}` : "";
    
    if (host.includes("supabase.co")) {
      CALLBACK_URL = `https://${host}/functions/v1/line-login-callback`;
    } else {
      CALLBACK_URL = `${protocol}://${host}${port}${urlObj.pathname}`;
    }
  }

  // 1. STEP 1: Redirect user to LINE Login Authorization
  if (action === "loginRedirect") {
    const tenantId = urlObj.searchParams.get("tenantId");
    const roomId = urlObj.searchParams.get("roomId");
    const returnUrl = urlObj.searchParams.get("returnUrl");

    if (!tenantId || !roomId || !returnUrl) {
      return errorResponse("Missing required redirect parameters: tenantId, roomId, returnUrl");
    }

    if (!LINE_LOGIN_CHANNEL_ID) {
      return errorResponse("LINE_LOGIN_CHANNEL_ID environment variable is not configured.");
    }

    // Encode parameters in OAuth 'state' parameter to persist during redirection
    const stateObj = { tenantId, roomId, returnUrl };
    const stateString = btoa(JSON.stringify(stateObj));

    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code` +
      `&client_id=${LINE_LOGIN_CHANNEL_ID}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
      `&state=${encodeURIComponent(stateString)}` +
      `&scope=profile%20openid`;

    return redirect(lineAuthUrl);
  }

  // 2. STEP 2: Handle OAuth Callback from LINE
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const error = urlObj.searchParams.get("error");
  const errorDescription = urlObj.searchParams.get("error_description");

  // Fallback return URL if decoding state fails
  let fallbackReturnUrl = "https://sombat-apartment.vercel.app/tenant.html";
  let decodedState: { tenantId: string; roomId: string; returnUrl: string } | null = null;

  try {
    if (state) {
      decodedState = JSON.parse(atob(state));
      if (decodedState?.returnUrl) {
        fallbackReturnUrl = decodedState.returnUrl;
      }
    }
  } catch (stateErr) {
    console.error("Failed to decode state:", stateErr);
  }

  // Handle errors sent by LINE Login
  if (error) {
    const msg = errorDescription || error;
    return redirect(`${fallbackReturnUrl}?line_linking=error&error_msg=${encodeURIComponent(msg)}`);
  }

  if (!code || !decodedState) {
    return redirect(`${fallbackReturnUrl}?line_linking=error&error_msg=${encodeURIComponent("Missing auth code or state parameters")}`);
  }

  const { tenantId, roomId, returnUrl } = decodedState;

  try {
    if (!LINE_LOGIN_CHANNEL_ID || !LINE_LOGIN_CHANNEL_SECRET) {
      throw new Error("LINE Login secrets are not configured in Supabase environment.");
    }

    // A. Trade authorization code for access token
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: CALLBACK_URL,
        client_id: LINE_LOGIN_CHANNEL_ID,
        client_secret: LINE_LOGIN_CHANNEL_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // B. Fetch LINE User Profile using Access Token
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      throw new Error(`Failed to retrieve LINE profile: ${errText}`);
    }

    const profile = await profileRes.json();
    const lineUserId = profile.userId;
    const displayName = profile.displayName;
    const pictureUrl = profile.pictureUrl;

    if (!lineUserId) {
      throw new Error("Line profile did not return a valid User ID.");
    }

    // C. Verify unique 1-to-1 account constraints before writing to DB
    // Check 1: Is this LINE user ID already linked to a DIFFERENT tenant?
    const checkLineRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tenant_line_accounts?line_user_id=eq.${lineUserId}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (checkLineRes.ok) {
      const rows = await checkLineRes.json();
      if (rows && rows.length > 0 && rows[0].tenant_id !== tenantId) {
        throw new Error("บัญชี LINE นี้ถูกนำไปใช้เชื่อมต่อกับผู้เช่าห้องอื่นอยู่แล้ว");
      }
    }

    // Check 2: Is this tenant ID already linked to a DIFFERENT LINE user ID?
    const checkTenantRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tenant_line_accounts?tenant_id=eq.${tenantId}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (checkTenantRes.ok) {
      const rows = await checkTenantRes.json();
      if (rows && rows.length > 0 && rows[0].line_user_id !== lineUserId) {
        throw new Error("บัญชีผู้เช่านี้ถูกเชื่อมโยงกับ LINE อื่นอยู่แล้ว กรุณายกเลิกการเชื่อมต่ออันเดิมก่อน");
      }
    }

    // D. Save linking details to DB
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/tenant_line_accounts`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        room_id: roomId,
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url: pictureUrl || null,
        linked_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      throw new Error(`Failed to save LINE account details to DB: ${errText}`);
    }

    // Redirect user back to the tenant portal with success flag
    return redirect(`${returnUrl}?line_linking=success`);
  } catch (err: any) {
    console.error("LINE login callback error:", err);
    return redirect(`${returnUrl}?line_linking=error&error_msg=${encodeURIComponent(err.message)}`);
  }
});
