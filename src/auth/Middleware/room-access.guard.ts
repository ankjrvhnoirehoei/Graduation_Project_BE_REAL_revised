import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { RoomService } from 'src/room/room.service';

@Injectable()
export class RoomAccessGuard implements CanActivate {
  constructor(private readonly roomService: RoomService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const roomId = req.params.roomId;

    const hasAccess = await this.roomService.isUserInRoom(roomId, user.userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this room');
    }
    return true;
  }
}
