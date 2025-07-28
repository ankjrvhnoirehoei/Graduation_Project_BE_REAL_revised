import { forwardRef, Module } from '@nestjs/common';
import { CommonServices } from './helpers.service';
import { DatabaseModule, UserSchema } from '@app/common';
import { Post, PostSchema } from 'src/post/post.schema';
import { PostModule } from 'src/post/post.module';
import { UserModule } from 'src/user/user.module';
import { User } from 'src/user/user.schema';

@Module({
  imports: [
    DatabaseModule.forFeature([
      { name: Post.name, schema: PostSchema }, { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => PostModule),
    forwardRef(() => UserModule),
  ],
  providers: [CommonServices],
  exports: [CommonServices],
})
export class CommonUtilsModule {}