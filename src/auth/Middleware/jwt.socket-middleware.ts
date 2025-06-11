import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

export const socketJwtMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];

  if (!token) {
    return next(new Error('Authentication token missing'));
  }

  try {
    const jwtSecret = process.env.JWT_ACCESS_SECRET;
    if (!jwtSecret) {
      return next(new Error('JWT secret is not defined'));
    }
    const decoded = jwt.verify(token, jwtSecret);
    socket.data.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Invalid token'));
  }
};
