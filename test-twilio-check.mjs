import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

console.log("=== اختبار اتصال Twilio ===");
console.log("Account SID:", accountSid ? `${accountSid.substring(0, 10)}...` : "غير موجود");
console.log("Auth Token:", authToken ? "✓ موجود" : "✗ غير موجود");
console.log("Phone Number:", fromNumber || "غير موجود");

if (!accountSid || !authToken || !fromNumber) {
  console.log("\n❌ بيانات Twilio غير مكتملة");
  process.exit(1);
}

const client = Twilio(accountSid, authToken);

try {
  const account = await client.api.accounts(accountSid).fetch();
  console.log("\n✅ اتصال ناجح!");
  console.log("اسم الحساب:", account.friendlyName);
  console.log("حالة الحساب:", account.status);
  console.log("نوع الحساب:", account.type);
} catch (error) {
  console.log("\n❌ فشل الاتصال:", error.message);
}
