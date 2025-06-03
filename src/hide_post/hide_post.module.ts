import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HiddenPost, UserHiddenPostSchema } from './hide_post.schema';
import { UserHiddenPostService } from './hide_post.service';
import { UserHiddenPostController } from './hide_post.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HiddenPost.name, schema: UserHiddenPostSchema },
    ]),
  ],
  controllers: [UserHiddenPostController],
  providers: [UserHiddenPostService],
  exports: [UserHiddenPostService],
})
export class UserHiddenPostModule {}
