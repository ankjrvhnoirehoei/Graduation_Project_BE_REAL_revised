import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookmarkPlaylistDocument = BookmarkPlaylist & Document;

@Schema({ timestamps: true })
export class BookmarkPlaylist {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userID: Types.ObjectId;

  @Prop({ required: true })
  playlistName: string;

  @Prop({ default: 'https://res.cloudinary.com/degdvuuhd/image/upload/v1748940509/bv1cukj386izinosx4v5.png' })
  coverImg: string; 

  @Prop({ default: 0 })
  postCount: number;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const BookmarkPlaylistSchema = SchemaFactory.createForClass(BookmarkPlaylist);

// ensure that each user cannot create two playlists with the same name
BookmarkPlaylistSchema.index({ userID: 1, playlistName: 1 }, { unique: true });
