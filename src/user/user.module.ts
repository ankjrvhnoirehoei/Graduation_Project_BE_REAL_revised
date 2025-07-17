import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from 'src/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { Relation, RelationSchema } from '../relation/relation.schema';
import { RelationModule } from '../relation/relation.module';
import { Post, PostSchema } from 'src/post/post.schema';
import { PostModule } from 'src/post/post.module';
import { Story, StorySchema } from 'src/story/schema/story.schema';
import { StoryModule } from 'src/story/story.module';
import { HttpModule } from '@nestjs/axios'; 

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Relation.name, schema: RelationSchema },
      { name: Post.name, schema: PostSchema },
      { name: Story.name, schema: StorySchema },
    ]),
    forwardRef(() => AuthModule),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    forwardRef(() => RelationModule),
    forwardRef(() => PostModule),
    forwardRef(() => StoryModule),
    HttpModule.register({ timeout: 5000 }), 
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService, MongooseModule],
})
export class UserModule {}
