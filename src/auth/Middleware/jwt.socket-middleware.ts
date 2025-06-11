import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

export const socketJwtMiddleware = async (socket: Socket, next: (err?: any) => void) => {
  try {
    const token = socket.handshake.auth?.token;
    console.log('🔐 Token from client socket:', token);

    if (!token) {
      console.log('❌ Token missing in handshake');
      return next(new Error('Token required'));
    }

    if (!process.env.JWT_ACCESS_SECRET) {
      console.log('❌ JWT secret missing in environment');
      return next(new Error('JWT secret not configured'));
    }
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string);
    console.log('✅ JWT payload:', payload);

    socket.data.user = { _id: payload.sub };
    return next();
  } catch (error) {
    console.log('❌ JWT error:', error.message);
    return next(new Error('Unauthorized'));
  }
};
