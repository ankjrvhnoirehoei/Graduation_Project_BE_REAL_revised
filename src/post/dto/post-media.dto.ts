import { CreatePostDto } from 'src/post/dto/post.dto';
import { CreateMediaDto } from '../../media/dto/media.dto';
import { MusicDto } from 'src/music/dto/music.dto';

export class CreatePostWithMediaDto {
  post: CreatePostDto;
  media: CreateMediaDto[];
  music?: MusicDto;
}
