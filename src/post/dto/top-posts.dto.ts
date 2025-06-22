export class TopPostDto {
  id: string;
  thumbnail: string[]; 
  caption?: string;
  author: string;      
  likes: number;
  comments: number;
  shares: number;
}
