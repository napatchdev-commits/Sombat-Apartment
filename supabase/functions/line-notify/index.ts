// ==========================================================================
// SUPABASE EDGE FUNCTION - LINE Messaging Bridge
// Replaces the old Google Apps Script (Code.gs) LINE push + webhook handlers.
//
// Deploy:
//   supabase functions deploy line-notify --no-verify-jwt
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   LINE_CHANNEL_ACCESS_TOKEN   - your LINE Messaging API channel access token
//                                 (used as a fallback if none is saved in Settings)
//   LINE_CHANNEL_SECRET         - optional, enables verifying that webhook
//                                 requests really came from LINE
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime, no need to set them yourself.
//
// After deploying, point two things at this function:
//   1. In the app's "ตั้งค่า" (Settings) page, the Supabase Project URL is
//      already saved — app.js calls ${supabaseUrl}/functions/v1/line-notify
//      automatically for the "ส่ง LINE Bot" button.
//   2. In the LINE Developers console, set the Messaging API Webhook URL to:
//      https://<your-project-ref>.functions.supabase.co/line-notify
// ==========================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_CHANNEL_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
const CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") || "";

const TENANT_PORTAL_URL = Deno.env.get("TENANT_PORTAL_URL") ||
  "https://sombat-apartment.vercel.app/tenant.html";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function getLatestState() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/apartment_state?id=eq.1`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to read apartment_state: ${res.statusText}`);
  const rows = await res.json();
  return rows && rows.length > 0 ? rows[0].state : {};
}

function getChannelToken(state: Record<string, any>) {
  const settings = state?.settings || {};
  if (settings.lineToken && String(settings.lineToken).trim()) {
    return String(settings.lineToken).trim();
  }
  return DEFAULT_CHANNEL_TOKEN;
}

async function lineBroadcast(channelToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelToken}`,
    },
    body: JSON.stringify({ messages: [{ type: "text", text }] }),
  });
  const text2 = await res.text();
  if (res.status === 200) {
    return { status: "success", message: "⚡ ส่งข้อความ LINE แจ้งเตือนเข้าโทรศัพท์ผู้เช่าเรียบร้อยแล้ว!" };
  }
  let errMsg = text2;
  try {
    const errJson = JSON.parse(text2);
    errMsg = errJson.message || text2;
  } catch {
    // keep raw text
  }
  return { status: "error", message: `LINE API Error (${res.status}): ${errMsg}` };
}

async function lineReply(replyToken: string, text: string, channelToken: string) {
  if (!replyToken || !channelToken) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelToken}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch (err) {
    console.error("Error sending LINE reply:", err);
  }
}

async function handleWebhookEvents(events: any[]) {
  const state = await getLatestState();
  const channelToken = getChannelToken(state);
  const invoices = state.invoices || [];

  for (const event of events) {
    if (event.type !== "message") continue;
    const replyToken = event.replyToken;
    const msgType = event.message?.type;

    if (msgType === "image") {
      await lineReply(
        replyToken,
        `🙏 ขอบคุณสำหรับสลิปการโอนเงินครับ!\n\nระบบได้รับรูปภาพสลิปเรียบร้อยแล้ว เจ้าหน้าที่จะทำการตรวจสอบและอัปเดตสถานะบิลให้อย่างเร่งด่วนครับ\n\n📲 ตรวจสอบสถานะบิลล่าสุดของคุณได้ทันที:\n${TENANT_PORTAL_URL}`,
        channelToken,
      );
      continue;
    }

    if (msgType === "text") {
      const userMsg = (event.message.text || "").trim();
      const cleanMsg = userMsg.toLowerCase().replace(/ห้อง|\s+/g, "");

      const matchedInv = invoices.find((inv: any) => {
        const rName = String(inv.roomName || "").toLowerCase().replace(/ห้อง|\s+/g, "");
        const rId = String(inv.roomId || "").toLowerCase().replace(/ห้อง|\s+/g, "");
        return rName === cleanMsg || rId === cleanMsg || (cleanMsg.length > 0 && rName.includes(cleanMsg));
      });

      if (matchedInv) {
        const isPaid = matchedInv.status === "paid";
        const statusText = isPaid ? "✅ ชำระเงินเรียบร้อยแล้ว" : "🔴 รอชำระเงิน";
        const reply = `🏠 หอพักสมบัติ นนทบุรี (ห้อง ${matchedInv.roomName})\n` +
          `----------------------------------------\n` +
          `👤 ผู้เช่า: ${matchedInv.tenantName || "ผู้เช่า"}\n` +
          `📅 ประจำเดือน: ${matchedInv.monthKey || "ล่าสุด"}\n` +
          `⚡ ค่าไฟ: ฿${Number(matchedInv.elecAmount || 0).toLocaleString()}\n` +
          `💧 ค่าน้ำ: ฿${Number(matchedInv.waterAmount || 0).toLocaleString()}\n` +
          `💰 ยอดบิลสุทธิ: ฿${Number(matchedInv.totalAmount || 0).toLocaleString()}\n` +
          `📌 สถานะ: ${statusText}\n\n` +
          `📲 ตรวจสอบรายละเอียดเต็มและแนบสลิป:\n${TENANT_PORTAL_URL}`;
        await lineReply(replyToken, reply, channelToken);
        continue;
      }

      if (["id", "myid", "groupid", "ไอดี", "เช็คไอดี"].some((k) => cleanMsg.includes(k))) {
        const uId = event.source.userId || "ไม่พบ User ID";
        const gId = event.source.groupId || "ไม่ได้อยู่ในกลุ่ม (แชทเดี่ยว)";
        const reply = `🔑 ข้อมูล LINE ID ของคุณ:\n` +
          `----------------------------------------\n` +
          `👤 User ID: ${uId}\n` +
          `👥 Group ID: ${gId}\n\n` +
          `*(คัดลอก ID ด้านบนไปกรอกในหน้าตั้งค่าของระบบแอดมิน เพื่อเปิดใช้งานการแจ้งเตือนสลิปเงินโอนใหม่ได้ทันที)`;
        await lineReply(replyToken, reply, channelToken);
        continue;
      }

      if (["บิล", "น้ำ", "ไฟ", "ยอด", "เช็ค"].some((k) => cleanMsg.includes(k))) {
        await lineReply(
          replyToken,
          `🏠 หอพักสมบัติ นนทบุรี\n\n📢 ระบบตรวจสอบบิลผ่าน LINE Bot\n\nกรุณาพิมพ์ "เลขห้องพัก" ของคุณ (เช่น S101 หรือ 101) เพื่อตรวจสอบยอดบิลประจำเดือนครับ\n\nหรือกดลิงก์เข้าสู่ระบบผู้เช่าเพื่อชำระเงินและแนบสลิป:\n${TENANT_PORTAL_URL}`,
          channelToken,
        );
        continue;
      }

      await lineReply(
        replyToken,
        `🏠 ยินดีต้อนรับสู่ LINE Official หอพักสมบัติ นนทบุรี\n\n` +
          `🔹 พิมพ์ "เลขห้องพัก" (เช่น S101 หรือ 101) เพื่อเช็คยอดบิล\n` +
          `🔹 พิมพ์ "บิล" เพื่อรับคำแนะนำการใช้งาน\n\n` +
          `📲 เข้าสู่ระบบผู้เช่า (ดูบิล / ชำระเงิน / แนบสลิป):\n${TENANT_PORTAL_URL}`,
        channelToken,
      );
    }
  }

  return json({ status: "success", message: "LINE Event Processed" });
}

async function verifyLineSignature(req: Request, rawBody: string) {
  if (!CHANNEL_SECRET) return true; // no secret configured, skip verification
  const signature = req.headers.get("x-line-signature");
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return expected === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ status: "error", message: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  if (!rawBody) return json({ status: "error", message: "Empty POST body" }, 400);

  let requestData: any;
  try {
    requestData = JSON.parse(rawBody);
  } catch {
    return json({ status: "error", message: "Invalid JSON" }, 400);
  }

  try {
    // 1. Incoming LINE webhook (messages/events from users, sent by LINE's servers)
    if (Array.isArray(requestData.events)) {
      const verified = await verifyLineSignature(req, rawBody);
      if (!verified) return json({ status: "error", message: "Invalid LINE signature" }, 401);
      return await handleWebhookEvents(requestData.events);
    }

    // 2. Admin app.js "ส่ง LINE Bot" button
    if (requestData.action === "linePushNotify") {
      const state = await getLatestState();
      const channelToken = getChannelToken(state);
      if (!channelToken) {
        return json({
          status: "error",
          message: "ยังไม่ได้กรอก LINE Channel Access Token ในระบบ! กรุณาไปที่เมนู 'ตั้งค่า' แล้วกรอก Token ก่อนครับ",
        });
      }
      const result = await lineBroadcast(channelToken, requestData.messageText || "");
      return json(result);
    }

    // 3. Tenant uploaded a slip, notify admin
    if (requestData.action === "notifyAdminNewSlip") {
      const state = await getLatestState();
      const settings = state?.settings || {};
      const roomName = requestData.roomName || "ไม่ทราบห้อง";
      const tenantName = requestData.tenantName || "ผู้เช่า";
      const amount = Number(requestData.amount || 0);
      const paymentMethod = requestData.paymentMethod || "transfer";

      const messageText = paymentMethod === "cash"
        ? `🔔 แจ้งชำระเงินด้วยเงินสด!\n\n` +
          `ห้อง: ${roomName}\n` +
          `ผู้เช่า: ${tenantName}\n` +
          `ยอดเงิน: ฿${amount.toLocaleString()} บาท\n\n` +
          `ผู้เช่าแจ้งชำระเงินด้วย "เงินสด" แอดมินกรุณาตรวจสอบและบันทึกรับเงินสดด้วยครับ 💵`
        : `🔔 แจ้งเตือนสลิปเงินโอนใหม่!\n\n` +
          `ห้อง: ${roomName}\n` +
          `ผู้เช่า: ${tenantName}\n` +
          `ยอดเงิน: ฿${amount.toLocaleString()} บาท\n\n` +
          `ขณะนี้ผู้เช่าได้อัปโหลดหลักฐานสลิปเข้าระบบแล้ว แอดมินกรุณาตรวจสอบความถูกต้องอีกครั้งครับ 🧾`;

      let sentNotify = false;
      let sentBot = false;
      let errorMsg = "";

      // A. Try LINE Notify if token is configured
      const notifyToken = settings.lineNotifyToken || "";
      if (notifyToken && notifyToken.trim()) {
        try {
          const params = new URLSearchParams();
          params.append("message", messageText);

          const notifyRes = await fetch("https://notify-api.line.me/api/notify", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Bearer ${notifyToken.trim()}`,
            },
            body: params,
          });
          if (notifyRes.ok) {
            sentNotify = true;
          } else {
            errorMsg += `LINE Notify error status: ${notifyRes.status} ${await notifyRes.text()}; `;
          }
        } catch (err: any) {
          errorMsg += `LINE Notify exception: ${err.message}; `;
        }
      }

      // B. Try LINE Bot Push if channel token and admin user ID are configured
      const channelToken = getChannelToken(state);
      const adminUserId = settings.lineUserId || "";
      if (channelToken && adminUserId && adminUserId.trim()) {
        try {
          const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${channelToken}`,
            },
            body: JSON.stringify({
              to: adminUserId.trim(),
              messages: [{ type: "text", text: messageText }],
            }),
          });
          if (pushRes.ok) {
            sentBot = true;
          } else {
            errorMsg += `LINE Bot Push error status: ${pushRes.status} ${await pushRes.text()}; `;
          }
        } catch (err: any) {
          errorMsg += `LINE Bot Push exception: ${err.message}; `;
        }
      }

      if (sentNotify || sentBot) {
        return json({
          status: "success",
          message: `แจ้งเตือนไปยังแอดมินสำเร็จ (Notify: ${sentNotify}, Bot: ${sentBot})`,
        });
      } else {
        return json({
          status: "error",
          message: errorMsg || "ยังไม่ได้ตั้งค่า LINE Notify Token หรือ LINE Bot UserId สำหรับแอดมิน",
        });
      }
    }

    return json({ status: "error", message: "Invalid action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ status: "error", message: String(err) }, 500);
  }
});
