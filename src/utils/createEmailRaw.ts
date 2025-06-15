export const createEmailRaw = ({ to, cc, bcc, fromDisplayName, from, subject, htmlBody }: {
  to: Array<string>;
  cc: Array<string>;
  bcc: Array<string>;
  fromDisplayName: string;
  from: string;
  subject: string;
  htmlBody: string;
}): string => {
  const boundary = 'gmail_boundary_12345'

  const toHeader = to.join(', ')
  const ccHeader = cc.length > 0 ? `Cc: ${cc.join(', ')}` : ''
  const bccHeader = bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : ''

  const data = [
    `From: "${fromDisplayName}" <${from}>`,
    `To: ${toHeader}`,
    ...(ccHeader ? [ccHeader] : []),
    ...(bccHeader ? [bccHeader] : []),
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody.replace(/<[^>]*>?/gm, '')).toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    '',
    `--${boundary}--`,
  ].join('\n')
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}