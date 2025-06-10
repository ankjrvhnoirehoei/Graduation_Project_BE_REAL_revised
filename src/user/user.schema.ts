import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop()
  username: string;

  @Prop()
  email?: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  handleName: string;

  @Prop()
  bio?: string;

  @Prop()
  address?: string;

  @Prop()
  gender?: string;

  @Prop()
  profilePic?: string;

  @Prop()
  dateOfBirth?: string;

  @Prop({ default: false })
  isVip: boolean;

  @Prop()
  refreshToken?: string;

  @Prop({ default: false })
  deletedAt?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);