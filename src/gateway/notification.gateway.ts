import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/user.schema'; 
import { Server, Socket } from 'socket.io';
import { admin } from 'src/firebase';

@WebSocketGateway({
  namespace: '/notification',
  cors: {
    origin: '*',
    method: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
})

export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  //lưu userId - socketId
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  //khởi taoh gateway
  afterInit(server: Server) {
    console.log('✅ WebSocket server initialized');
  }

  //kết nối socket
  handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId) {
      const existingSockets = this.onlineUsers.get(userId) || new Set<string>();
      existingSockets.add(client.id);
      this.onlineUsers.set(userId, existingSockets);
      console.log(`🔌 User ${userId} connected with socket ${client.id}`);
    }
  }

  //client ngắt kết nối
  handleDisconnect(@ConnectedSocket() client: Socket) {
    for (const [userId, socketSet] of this.onlineUsers.entries()) {
      if (socketSet.has(client.id)) {
        socketSet.delete(client.id);
        if (socketSet.size === 0) {
          this.onlineUsers.delete(userId);
        } else {
          this.onlineUsers.set(userId, socketSet);
        }
        console.log(`❌ Socket ${client.id} of user ${userId} disconnected`);
        break;
      }
    }
  }

  //gửi thông báo đến người dùng cụ thể
  async sendNotification(receiverId: string, eventName: string, payload: any) {
    const socketSet = this.onlineUsers.get(receiverId);
    if (socketSet && socketSet.size > 0) {
      for (const socketId of socketSet) {
        this.server.to(socketId).emit(eventName, payload);
      }
      console.log(`📨 Sent "${eventName}" via socket to ${receiverId}`);
    } else {
      console.log(`⚠️ User ${receiverId} offline. Gửi FCM...`);

      const user = await this.userModel.findById(receiverId);
      if (user?.fcmToken) {
        await this.sendFCM(user.fcmToken, payload.caption || 'Bạn có thông báo mới');
      } else {
        console.log(`🚫 No FCM token for user ${receiverId}`);
      }
    }
  }

  private async sendFCM(token: string, body: string) {
    const message = {
      notification: {
        title: 'Thông báo mới',
        body,
      },
      token,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('✅ FCM sent:', response);
    } catch (err) {
      console.error('❌ Gửi FCM lỗi:', err.message);
    }
  }
}
