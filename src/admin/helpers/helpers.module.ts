import { forwardRef, Module } from '@nestjs/common';
import { CommonServices } from './helpers.service';
import { DatabaseModule } from '@app/common';
import { Post, PostSchema } from 'src/post/post.schema';
import { PostModule } from 'src/post/post.module';

@Module({
  imports: [
    DatabaseModule.forFeature([
      { name: Post.name, schema: PostSchema },
    ]),
    forwardRef(() => PostModule),
  ],
  providers: [CommonServices],
  exports: [CommonServices],
})
export class CommonUtilsModule {}