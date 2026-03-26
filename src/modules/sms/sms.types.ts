export interface SendSmsDto {
  message: string;
  clientIds?: string[];
  groupId?: string;
  sendToAll?: boolean;
  campaignName?: string;
  scheduledAt?: string;
}

export interface SendSingleSmsDto {
  phone: string;
  message: string;
}

export interface CampaignFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface SmsDeliveryResult {
  clientId: string;
  phone: string;
  status: 'SENT' | 'FAILED';
  twilioSid?: string;
  errorCode?: string;
  errorMessage?: string;
}
