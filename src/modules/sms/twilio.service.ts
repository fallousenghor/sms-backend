import twilio from 'twilio';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface TwilioSendResult {
  sid: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

export class TwilioService {
  private readonly client: twilio.Twilio;
  private readonly fromNumber: string;
  private readonly mockMode: boolean;

  constructor() {
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    this.fromNumber = config.twilio.phoneNumber;
    // Mode mock si le numéro commence par +000 ou si c'est un numéro de test
    this.mockMode = 
      this.fromNumber.startsWith('+000') || 
      this.fromNumber === '+1234567890' ||
      process.env.TWILIO_MOCK_MODE === 'true';
  }

  async sendSms(to: string, body: string): Promise<TwilioSendResult> {
    // Mode mock : simule l'envoi sans appeler Twilio
    if (this.mockMode) {
      logger.info(`[MOCK] SMS sent to ${to}: ${body.substring(0, 50)}...`);
      return {
        sid: `SM${uuidv4()}`,
        status: 'sent',
      };
    }

    try {
      const message = await this.client.messages.create({
        body,
        from: this.fromNumber,
        to,
      });

      logger.debug(`SMS sent to ${to}: SID=${message.sid} status=${message.status}`);

      return {
        sid: message.sid,
        status: message.status,
      };
    } catch (err: unknown) {
      const twilioErr = err as { code?: string; message?: string };
      logger.error(`Failed to send SMS to ${to}:`, twilioErr);

      return {
        sid: '',
        status: 'failed',
        errorCode: String(twilioErr.code || 'UNKNOWN'),
        errorMessage: twilioErr.message || 'Unknown Twilio error',
      };
    }
  }

  async getMessageStatus(sid: string): Promise<string> {
    const message = await this.client.messages(sid).fetch();
    return message.status;
  }

  async validatePhoneNumber(phone: string): Promise<boolean> {
    try {
      const lookup = await this.client.lookups.v1.phoneNumbers(phone).fetch();
      return !!lookup.phoneNumber;
    } catch {
      return false;
    }
  }
}
