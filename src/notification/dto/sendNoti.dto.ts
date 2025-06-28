export class SendNotificationDto {
  receiverIds: string[];
  senderId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}
