import { CreatePostDto } from 'src/post/dto/create-post.dto';
import { CreateMediaDto } from '../../media/dto/create-media.dto';

export class CreatePostWithMediaDto {
  post: CreatePostDto;
  media: CreateMediaDto[];
}
