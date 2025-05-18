import { CreatePostDto } from 'src/post/dto/post.dto';
import { CreateMediaDto } from '../../media/dto/media.dto';

export class CreatePostWithMediaDto {
  post: CreatePostDto;
  media: CreateMediaDto[];
}
