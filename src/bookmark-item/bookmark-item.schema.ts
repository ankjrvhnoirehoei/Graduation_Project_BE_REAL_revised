import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookmarkItemDocument = BookmarkItem & Document;

@Schema({ timestamps: true })
export class BookmarkItem {
  @Prop({ type: Types.ObjectId, required: true, ref: 'BookmarkPlaylist' })
  playlistID: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  itemID: Types.ObjectId; // points to either a Post, Music or Reel

  @Prop({ required: true, enum: ['post', 'music', 'reel'] })
  itemType: string; 

  @Prop({ default: false })
  isDeleted: boolean;
}

export const BookmarkItemSchema = SchemaFactory.createForClass(BookmarkItem);

// prevent a given post from being added more than once while not deleted:
BookmarkItemSchema.index(
  { playlistID: 1, itemID: 1, itemType: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
