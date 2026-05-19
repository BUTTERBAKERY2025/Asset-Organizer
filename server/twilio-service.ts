import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const whatsappSandboxNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

let client: twilio.Twilio | null = null;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

export interface WhatsAppMessage {
  to: string;
  message: string;
}

export interface SMSMessage {
  to: string;
  message: string;
}

export interface MeetingInvitation {
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  meetingLink?: string;
  agenda?: string;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '966' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('966') && cleaned.length === 9) {
    cleaned = '966' + cleaned;
  }
  return '+' + cleaned;
}

function formatMeetingInvitation(invitation: MeetingInvitation, recipientName: string): string {
  let message = `السلام عليكم ورحمة الله وبركاته

${recipientName} المحترم/ة

نتشرف بدعوتكم لحضور:
*${invitation.meetingTitle}*

📅 التاريخ: ${invitation.meetingDate}
⏰ الوقت: ${invitation.meetingTime}
📍 المكان: ${invitation.location}`;

  if (invitation.meetingLink) {
    if (invitation.meetingLink.includes('/rsvp/')) {
      message += `\n\n✅ لتأكيد حضورك، يرجى الضغط على الرابط التالي:\n${invitation.meetingLink}`;
    } else {
      message += `\n🔗 رابط الاجتماع: ${invitation.meetingLink}`;
    }
  }

  if (invitation.agenda) {
    message += `\n\n📋 جدول الأعمال:\n${invitation.agenda}`;
  }

  message += `\n\nشركة الزبد الأفضل التجارية
سجل تجاري: 7026155296`;

  return message;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!client || !twilioPhone) {
    console.log('Twilio not configured, skipping WhatsApp message');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const formattedPhone = formatPhoneNumber(to);
    const fromNumber = whatsappSandboxNumber;
    const result = await client.messages.create({
      body: message,
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${formattedPhone}`,
    });

    // Redact phone numbers in logs — keep only last 4 digits for debugging.
    // Never log fromNumber (sandbox/sender) or the Twilio auth response payload.
    console.log(`WhatsApp message sent to ***${formattedPhone.slice(-4)}: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (error: any) {
    // Sanitize error.message: Twilio errors sometimes echo phone numbers and
    // (rarely) credential fragments. Strip anything that looks like a phone.
    const safe = String(error?.message || "")
      .replace(/\+?\d{7,}/g, "***")
      .replace(/AC[0-9a-fA-F]{32}/g, "AC***")
      .replace(/SK[0-9a-fA-F]{32}/g, "SK***");
    console.error('Error sending WhatsApp message:', safe);
    return { success: false, error: error.message };
  }
}

export async function sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!client || !twilioPhone) {
    console.log('Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const formattedPhone = formatPhoneNumber(to);
    const result = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone,
    });

    console.log(`SMS sent to ***${formattedPhone.slice(-4)}: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (error: any) {
    const safe = String(error?.message || "")
      .replace(/\+?\d{7,}/g, "***")
      .replace(/AC[0-9a-fA-F]{32}/g, "AC***")
      .replace(/SK[0-9a-fA-F]{32}/g, "SK***");
    console.error('Error sending SMS:', safe);
    return { success: false, error: error.message };
  }
}

export async function sendMeetingInvitations(
  shareholders: Array<{ fullName: string; phone?: string; email?: string }>,
  invitation: MeetingInvitation,
  options: { sendWhatsApp: boolean; sendSMS: boolean }
): Promise<{ sent: number; failed: number; results: Array<{ name: string; channel: string; success: boolean; error?: string }> }> {
  const results: Array<{ name: string; channel: string; success: boolean; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const shareholder of shareholders) {
    if (!shareholder.phone) continue;

    const message = formatMeetingInvitation(invitation, shareholder.fullName);

    if (options.sendWhatsApp) {
      const result = await sendWhatsAppMessage(shareholder.phone, message);
      results.push({
        name: shareholder.fullName,
        channel: 'whatsapp',
        success: result.success,
        error: result.error,
      });
      if (result.success) sent++;
      else failed++;
    }

    if (options.sendSMS) {
      const smsMessage = `دعوة لحضور ${invitation.meetingTitle} - ${invitation.meetingDate} ${invitation.meetingTime}${invitation.meetingLink ? ` - ${invitation.meetingLink}` : ''}`;
      const result = await sendSMS(shareholder.phone, smsMessage);
      results.push({
        name: shareholder.fullName,
        channel: 'sms',
        success: result.success,
        error: result.error,
      });
      if (result.success) sent++;
      else failed++;
    }
  }

  return { sent, failed, results };
}

export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && twilioPhone);
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatPhoneNumber(phone).replace('+', '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

export function generateWhatsAppLinks(
  shareholders: Array<{ fullName: string; phone?: string }>,
  invitation: MeetingInvitation
): Array<{ name: string; phone: string; whatsappLink: string }> {
  return shareholders
    .filter(s => s.phone)
    .map(s => {
      const message = formatMeetingInvitation(invitation, s.fullName);
      return {
        name: s.fullName,
        phone: s.phone!,
        whatsappLink: generateWhatsAppLink(s.phone!, message),
      };
    });
}
