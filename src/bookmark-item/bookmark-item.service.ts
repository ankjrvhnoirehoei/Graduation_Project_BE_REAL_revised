import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { BookmarkItem, BookmarkItemDocument } from './bookmark-item.schema';
import {
  BookmarkPlaylist,
  BookmarkPlaylistDocument,
} from 'src/bookmark-playlist/bookmark-playlist.schema';
import { PostService } from 'src/post/post.service';
interface RemovalResult {
  deletedCount: number;
  notFoundCount: number;
  details: Array<{
    postId: string;
    status: 'deleted' | 'not_found';
    playlistId?: string;
  }>;
}

@Injectable()
export class BookmarkItemService {
  constructor(
    @InjectModel(BookmarkItem.name)
    private readonly itemModel: Model<BookmarkItemDocument>,
    @InjectModel(BookmarkPlaylist.name)
    private readonly playlistModel: Model<BookmarkPlaylistDocument>,
    private readonly postService: PostService,
  ) {}

  // returns all non-deleted items in a given playlist
  async findAllByPlaylist(
    playlistId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: any[]; total: number }> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }

    const skip = (page - 1) * limit;
    const playlistObjectId = new Types.ObjectId(playlistId);
    const currentUser = new Types.ObjectId(userId);
    // count total matching bookmark‑items
    const total = await this.itemModel.countDocuments({
      playlistID: playlistObjectId,
      isDeleted: false,
    });

    // aggregate pipeline to join posts/reels
    const pipeline: PipelineStage[] = [
      // 1) match & paginate bookmark‑items
      { $match: { playlistID: playlistObjectId, isDeleted: false } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // 2) join into posts and musics collections
      {
        $lookup: {
          from: 'posts',
          let: { id: '$itemID' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$id'] },
                    { $in: ['$type', ['post', 'reel']] }
                  ]
                }
              }
            }
          ],
          as: 'postDoc'
        }
      },
      { $unwind: { path: '$postDoc', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'musics',
          let: { id: '$itemID' },
          pipeline: [
            { $match: {
                $expr: { $eq: ['$_id', '$$id'] }
              }
            }
          ],
          as: 'musicDoc'
        }
      },
      { $unwind: { path: '$musicDoc', preserveNullAndEmptyArrays: true } },

      // 3) UNIFY FIELDS
      {
        $addFields: {
          // if postDoc exists, pull from it; otherwise pull from musicDoc, or fall back to defaults:
          _id:        { $ifNull: ['$postDoc._id', '$musicDoc._id'] },
          userID:     { $ifNull: ['$postDoc.userID', ''] },
          type:       { $ifNull: ['$postDoc.type', '$itemType'] },
          caption:    { $ifNull: ['$postDoc.caption', ''] },
          isFlagged:  { $ifNull: ['$postDoc.isFlagged', false] },
          nsfw:       { $ifNull: ['$postDoc.nsfw', false] },
          isEnable:   { $ifNull: ['$postDoc.isEnable', false] },
          viewCount:  { $ifNull: ['$postDoc.viewCount', 0] },

          // music-specific fields (will be empty on posts)
          song:      { $ifNull: ['$musicDoc.song', ''] },
          link:      { $ifNull: ['$musicDoc.link', ''] },
          author:    { $ifNull: ['$musicDoc.author', ''] },
          coverImg:  { $ifNull: ['$musicDoc.coverImg', ''] },

          // carry through bookmark timestamps
          createdAtBookmark: '$createdAt',
          updatedAtBookmark: '$updatedAt',
        }
      },

      // 4) existing “relations -> isFollow” logic, but wired against _id and userID
      {
        $lookup: {
          from: 'relations',
          let: { pu: '$userID', cu: currentUser },
          pipeline: [
            { $addFields: {
                pair: {
                  $cond: [
                    { $lt: ['$$cu','$$pu'] },
                    { u1:'$$cu', u2:'$$pu', userOneIsCurrent:true },
                    { u1:'$$pu', u2:'$$cu', userOneIsCurrent:false }
                  ]
                }
              }
            },
            { $match: {
                $expr: {
                  $and: [
                    { $eq:['$userOneID','$pair.u1'] },
                    { $eq:['$userTwoID','$pair.u2'] }
                  ]
                }
              }
            },
            { $project: { _id:0, relation:1,userOneIsCurrent:'$pair.userOneIsCurrent' } }
          ],
          as: 'relationLookup'
        }
      },
      {
        $addFields: {
          isFollow: {
            $let: {
              vars: { rel: { $arrayElemAt: ['$relationLookup',0] } },
              in: {
                $cond:[
                  { $eq:['$$rel', null] }, false,
                  {
                    $switch:{
                      branches:[
                        {
                          case:{ $eq:['$$rel.userOneIsCurrent',true] },
                          then:{
                            $eq:[
                              { $arrayElemAt:[{ $split:['$$rel.relation','_'] },0] },
                              'FOLLOW'
                            ]
                          }
                        },
                        {
                          case:{ $eq:['$$rel.userOneIsCurrent',false] },
                          then:{
                            $eq:[
                              { $arrayElemAt:[{ $split:['$$rel.relation','_'] },1] },
                              'FOLLOW'
                            ]
                          }
                        }
                      ],
                      default:false
                    }
                  }
                ]
              }
            }
          }
        }
      },
      { $project: { relationLookup:0 } },
      {
        $addFields: {
          isFollow: {
            $cond:[
              { $eq:['$userID', currentUser] },
              '$$REMOVE',
              '$isFollow'
            ]
          }
        }
      },

      // 5) media lookup
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        }
      },

      // 6) author lookup
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user'
        }
      },
      // allow music‑type items through
      { 
        $unwind: { 
          path: '$user', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // default-inject an empty user if none was found
      {
        $addFields: {
          user: {
            _id:         { $ifNull: ['$user._id', ''] },
            handleName:  { $ifNull: ['$user.handleName', ''] },
            profilePic:  { $ifNull: ['$user.profilePic', ''] },
          }
        }
      },

      // 7) likes & comments
      { $lookup: { from:'postlikes', localField:'_id', foreignField:'postId', as:'likes' } },
      {
        $lookup: {
          from: 'comments',
          let: { pid: '$_id' },
          pipeline: [
            { $match: {
                $expr: { $and:[
                  { $eq:['$postID','$$pid'] },
                  { $eq:['$isDeleted', false] }
                ]}
              }
            }
          ],
          as: 'comments'
        }
      },
      {
        $addFields: {
          likeCount:    { $size:'$likes' },
          commentCount: { $size:'$comments' }
        }
      },

      // 8) isLike for current user
      {
        $lookup: {
          from: 'postlikes',
          let: { pid:'$_id' },
          pipeline: [
            { $match: {
                $expr: { $and:[
                  { $eq:['$postId','$$pid'] },
                  { $eq:['$userId', currentUser] }
                ]}
              }
            }
          ],
          as: 'userLikeEntry'
        }
      },
      {
        $addFields: {
          isLike: { $gt:[ { $size:'$userLikeEntry' }, 0 ] }
        }
      },

      // 9) final projection: rename fields, pick bookmark timestamps + enriched post shape
      {
        $project: {
          // bookmark fields
          _id: 1,               // the post/reel _id
          playlistID: 1,
          itemID: 1,
          itemType: 1,
          isDeleted: 1,
          createdAt: '$createdAtBookmark',  
          updatedAt: '$updatedAtBookmark', 

          // enriched post shape
          userID: 1,
          type: 1,
          caption: 1,
          isFlagged: 1,
          nsfw: 1,
          isEnable: 1,
          viewCount: 1,

          // music-specific fields 
          song: 1,
          link: 1,
          author: 1,
          coverImg: 1,

          // lookups
          media: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
          commentCount: 1,
          likeCount: 1,
          isLike: 1,
          isFollow: 1,
        }
      }
    ];

    const data = await this.itemModel.aggregate(pipeline).exec();
    return { data, total };
  }
  
  // validate that a playlist belongs to the given user, used to create or delete
  async validatePlaylistOwnership(
    playlistId: string,
    userId: string,
  ): Promise<BookmarkPlaylist> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }

    const playlist = await this.playlistModel.findOne({
      _id: new Types.ObjectId(playlistId),
      userID: new Types.ObjectId(userId),
      isDeleted: false,
    });

    // console.log('_id: ', playlistId, '\nuserID: ', userId);

    if (!playlist) {
      throw new BadRequestException(
        'Playlist not found or does not belong to user.',
      );
    }

    return playlist;
  }

  // create a new bookmark item, ensuring no duplicates (partial filter)
  async create(
    playlistId: string,
    itemId: string,
    userId: string,
  ): Promise<BookmarkItem> {
    // ensure playlist belongs to user
    await this.validatePlaylistOwnership(playlistId, userId);

    if (!Types.ObjectId.isValid(itemId)) {
      throw new BadRequestException('Invalid item ID format.');
    }

    const pid = new Types.ObjectId(playlistId);
    const iid = new Types.ObjectId(itemId);

    // Get the post type using PostService
    const itemType = await this.postService.getPostType(itemId);

    // Check for existing soft-deleted item
    const existing = await this.itemModel.findOne({
      playlistID: pid,
      itemID: iid,
      itemType,
    });

    if (existing) {
      if (!existing.isDeleted) {
        throw new BadRequestException('This item is already bookmarked.');
      }
      // Resurrect the soft-deleted item
      existing.isDeleted = false;
      return existing.save();
    }

    // Create new if no existing item found
    const newItem = new this.itemModel({
      playlistID: pid,
      itemID: iid,
      itemType,
      isDeleted: false,
    });

    return newItem.save();
  }

  /**
   * soft-delete multiple bookmark items from a single playlist
   * returns the number of documents actually modified 
   */
  async removeMultiple(
    playlistId: string,
    postIds: string[],
    userId: string,
  ): Promise<number> {
    // validate playlist ownership
    await this.validatePlaylistOwnership(playlistId, userId);

    // validate each postId
    const objectPostIds: Types.ObjectId[] = [];
    for (const pid of postIds) {
      if (!Types.ObjectId.isValid(pid)) {
        throw new BadRequestException(`Invalid post ID format: ${pid}`);
      }
      objectPostIds.push(new Types.ObjectId(pid));
    }

    // perform a bulk update: set isDeleted = true where:
    // playlistID matches, itemID in provided list, and isDeleted = false
    const result = await this.itemModel.updateMany(
      {
        playlistID: new Types.ObjectId(playlistId),
        itemID: { $in: objectPostIds },
        isDeleted: false,
      },
      { isDeleted: true },
    );

    const modifiedCount =
      (result as any).modifiedCount ?? (result as any).nModified ?? 0;

    return modifiedCount;
  }

  // add or readd a music item to a playlist
  async createMusic(
    playlistId: string,
    musicId: string,
    userId: string,
  ): Promise<BookmarkItem> {
    await this.validatePlaylistOwnership(playlistId, userId);

    if (!Types.ObjectId.isValid(musicId)) {
      throw new BadRequestException('Invalid music ID format.');
    }
    const pid = new Types.ObjectId(playlistId);
    const mid = new Types.ObjectId(musicId);

    // see if there's a soft-deleted one we can resurrect
    const existing = await this.itemModel.findOne({
      playlistID: pid,
      itemID: mid,
      itemType: 'music',
    });

    if (existing) {
      if (!existing.isDeleted) {
        throw new BadRequestException('This music is already bookmarked.');
      }
      existing.isDeleted = false;
      return existing.save();
    }

    // otherwise create fresh
    const bookmark = new this.itemModel({
      playlistID: pid,
      itemID: mid,
      itemType: 'music',
      isDeleted: false,
    });
    return bookmark.save();
  }

  // soft-delete a music item from a playlist
  async removeMusic(
    playlistId: string,
    musicId: string,
    userId: string,
  ): Promise<number> {
    await this.validatePlaylistOwnership(playlistId, userId);

    if (!Types.ObjectId.isValid(musicId)) {
      throw new BadRequestException('Invalid music ID format.');
    }
    const pid = new Types.ObjectId(playlistId);
    const mid = new Types.ObjectId(musicId);

    const result = await this.itemModel.updateOne(
      { playlistID: pid, itemID: mid, itemType: 'music', isDeleted: false },
      { isDeleted: true },
    );

    // modifiedCount is 1 if flipped
    const count = (result as any).modifiedCount ?? 0;
    if (count === 0) {
      throw new BadRequestException('No active bookmark found to remove.');
    }
    return count;
  }  

  // for checking if a post or reel is already in a bookmark playlist of the user
  async exists(
    playlistId: string,
    itemId: string,
  ): Promise<boolean> {
    const pid = new Types.ObjectId(playlistId);
    const iid = new Types.ObjectId(itemId);
    const count = await this.itemModel.countDocuments({
      playlistID: pid,
      itemID: iid,
      isDeleted: false,
    });
    return count > 0;
  }

  /** 
   * Remove a single post from whichever playlist it's in for this user. 
   * Then decrement that playlist's postCount by 1.
   */
  async removeByUserAndPosts(userId: string, postIds: string[]): Promise<RemovalResult> {
    // Find all playlists for this user
    const playlists = await this.playlistModel
      .find({ userID: new Types.ObjectId(userId), isDeleted: false })
      .select('_id')
      .exec();
    const pids = playlists.map(p => p._id);

    if (pids.length === 0) {
      throw new BadRequestException('No active playlists found for this user.');
    }

    // Convert postIds to ObjectIds
    const postObjectIds = postIds.map(id => new Types.ObjectId(id));

    // Find all existing bookmarks that match the criteria
    const existingBookmarks = await this.itemModel.find({
      itemID: { $in: postObjectIds },
      playlistID: { $in: pids },
      isDeleted: false,
    }).exec();

    if (existingBookmarks.length === 0) {
      return {
        deletedCount: 0,
        notFoundCount: postIds.length,
        details: postIds.map(postId => ({
          postId,
          status: 'not_found' as const,
        }))
      };
    }

    // Soft delete all found bookmarks
    const bookmarkIds = existingBookmarks.map(bookmark => bookmark._id);
    await this.itemModel.updateMany(
      { _id: { $in: bookmarkIds } },
      { $set: { isDeleted: true } }
    );

    // Count deletions per playlist to update postCount
    const playlistDeletionCounts = new Map<string, number>();
    existingBookmarks.forEach(bookmark => {
      const playlistIdStr = bookmark.playlistID.toString();
      playlistDeletionCounts.set(
        playlistIdStr, 
        (playlistDeletionCounts.get(playlistIdStr) || 0) + 1
      );
    });

    // Update postCount for affected playlists
    const updatePromises = Array.from(playlistDeletionCounts.entries()).map(
      ([playlistId, count]) => 
        this.playlistModel.updateOne(
          { _id: new Types.ObjectId(playlistId) },
          { $inc: { postCount: -count } }
        )
    );
    await Promise.all(updatePromises);

    // Create result details
    const deletedPostIds = new Set(
      existingBookmarks.map(bookmark => bookmark.itemID.toString())
    );

    const details = postIds.map(postId => {
      const wasDeleted = deletedPostIds.has(postId);
      const bookmark = existingBookmarks.find(b => b.itemID.toString() === postId);
      
      return {
        postId,
        status: wasDeleted ? 'deleted' as const : 'not_found' as const,
        ...(wasDeleted && bookmark && { playlistId: bookmark.playlistID.toString() })
      };
    });

    return {
      deletedCount: existingBookmarks.length,
      notFoundCount: postIds.length - existingBookmarks.length,
      details
    };
  }
}
