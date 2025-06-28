import { Module, forwardRef } from '@nestjs/common';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { DatabaseModule, UserSchema } from '@app/common';
import { UserModule } from 'src/user/user.module';
import { PostModule } from 'src/post/post.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Post, PostSchema } from 'src/post/post.schema';
import { Story, StorySchema } from 'src/story/schema/story.schema';
import { RelationModule } from 'src/relation/relation.module';
import { Relation, RelationSchema } from 'src/relation/relation.schema';
import { User } from 'src/user/user.schema';

@Module({
  imports: [
    DatabaseModule.forFeature([{ name: Post.name, schema: PostSchema }, { name: Story.name, schema: StorySchema }, { name: Relation.name, schema: RelationSchema }, { name: User.name, schema: UserSchema }, ]),
    forwardRef(() => UserModule),
    forwardRef(() => PostModule),
    forwardRef(() => RelationModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

