// dto/get-notifications.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { NotificationType } from '../schema/notificate.schema';

export class GetNotificationsDto {
  @ApiProperty({ 
    required: false, 
    description: 'Filter by notification type' 
  })
  @IsOptional()
  type?: NotificationType;

  @ApiProperty({ 
    required: false, 
    description: 'Filter by read status' 
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_read?: boolean;

  @ApiProperty({ 
    required: false, 
    default: 1,
    minimum: 1,
    description: 'Page number' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ 
    required: false, 
    default: 20,
    minimum: 1,
    maximum: 50,
    description: 'Number of items per page' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class MarkAsReadDto {
  @ApiProperty({ 
    required: false,
    type: [String],
    description: 'Array of notification IDs to mark as read. If not provided, all notifications will be marked as read' 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  notification_ids?: string[];
}

export class TriggerUserDto {
  @ApiProperty({ description: 'User ID' })
  _id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Handle name' })
  handleName: string;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  profilePic?: string;
}

export class PostDto {
  @ApiProperty({ description: 'Post ID' })
  _id: string;

  @ApiProperty({ description: 'Post caption', required: false })
  caption?: string;

  @ApiProperty({ description: 'Post type' })
  type: string;
}

export class CommentDto {
  @ApiProperty({ description: 'Comment ID' })
  _id: string;

  @ApiProperty({ description: 'Comment content' })
  content: string;
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  _id: string;

  @ApiProperty({ description: 'Receiver user ID' })
  user_id: string;

  @ApiProperty({ description: 'Trigger user ID' })
  trigger_user_id: string;

  @ApiProperty({ description: 'Notification content' })
  content: string;

  @ApiProperty({ description: 'Notification type' })
  type: NotificationType;

  @ApiProperty({ description: 'Read status' })
  is_read: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Update timestamp' })
  updated_at: Date;

  @ApiProperty({ type: TriggerUserDto, description: 'Trigger user details', required: false })
  trigger_user?: TriggerUserDto;

  @ApiProperty({ type: PostDto, description: 'Related post details', required: false })
  post?: PostDto;

  @ApiProperty({ type: CommentDto, description: 'Related comment details', required: false })
  comment?: CommentDto;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto], description: 'List of notifications' })
  notifications: NotificationResponseDto[];

  @ApiProperty({ description: 'Total number of notifications' })
  totalCount: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Current page number' })
  currentPage: number;
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'Receiver user ID' })
  @IsString()
  user_id: string;

  @ApiProperty({ description: 'Trigger user ID' })
  @IsString()
  trigger_user_id: string;

  @ApiProperty({ description: 'Notification content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Notification type' })
  type: NotificationType;

  @ApiProperty({ description: 'Related post ID', required: false })
  @IsOptional()
  @IsString()
  post_id?: string;

  @ApiProperty({ description: 'Related comment ID', required: false })
  @IsOptional()
  @IsString()
  comment_id?: string;

  @ApiProperty({ description: 'Related message ID', required: false })
  @IsOptional()
  @IsString()
  message_id?: string;
}