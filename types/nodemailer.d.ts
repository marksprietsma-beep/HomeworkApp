declare module "nodemailer" {
  export type Transporter = {
    verify(): Promise<unknown>;
    sendMail(message: Record<string, unknown>): Promise<{ messageId?: string; accepted?: unknown }>;
  };
  const nodemailer: { createTransport(options: Record<string, unknown>): Transporter };
  export default nodemailer;
}
