export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

// Convert string to RFC 2822 format and encode in web-safe Base64Url
function createEmailRaw({ to, subject, bodyText, bodyHtml }: SendEmailParams): string {
  const boundary = `__boundary_${Date.now()}__`;

  let emailContent = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyText,
    "",
  ];

  if (bodyHtml) {
    emailContent = emailContent.concat([
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      bodyHtml,
      "",
    ]);
  }

  emailContent.push(`--${boundary}--`);

  const rawMessage = emailContent.join("\r\n");

  // UTF-8 safe base64 encoding
  const base64 = btoa(unescape(encodeURIComponent(rawMessage)));
  // Make web-safe (Base64URL)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const sendEmailViaGmail = async (
  accessToken: string,
  params: SendEmailParams
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const raw = createEmailRaw(params);

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gmail API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("sendEmailViaGmail error:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
};
