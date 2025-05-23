import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  phoneNumber?: string;

  @Prop({ required: true, unique: true })
  handleName?: string;

  @Prop()
  bio?: string;

  @Prop()
  address?: string;

  @Prop()
  gender?: string;

  @Prop()
  profilePic?: string;

  @Prop({ default: false })
  isVip: boolean;

  @Prop()
  refreshToken?: string;

  @Prop({ default: false })
  deletedAt?: boolean;

  @Prop() resetTokenHash?: string;
  @Prop() newPasswordHash?: string;
  @Prop() resetTokenExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
