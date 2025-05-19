import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@app/common';

@Schema({ versionKey: false })
export class UserDocument extends AbstractDocument {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop()
  email?: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  handleName?: string;

  @Prop()
  bio?: string;

  @Prop()
  address?: string;

  @Prop()
  gender: string;

  @Prop()
  profilePic?: string;

  @Prop({ default: false })
  isVip: boolean;

  @Prop()
  refreshToken?: string;

  @Prop({ default: false })
  deletedAt?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(UserDocument);
