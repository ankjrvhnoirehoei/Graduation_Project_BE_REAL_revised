import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookmarkItemDocument = Document<Types.ObjectId, any, BookmarkItem> & BookmarkItem;

@Schema({ timestamps: true })
export class BookmarkItem {
  @Prop({ type: Types.ObjectId, required: true, ref: 'BookmarkPlaylist' })
  playlistID: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  itemID: Types.ObjectId;

  @Prop({ required: true, enum: ['post', 'music', 'reel'] })
  itemType: string; 

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt: TimeRanges;
}

export const BookmarkItemSchema = SchemaFactory.createForClass(BookmarkItem);

BookmarkItemSchema.index(
  { playlistID: 1, itemID: 1, itemType: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
