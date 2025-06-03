import { IsNotEmpty } from "class-validator";

export class getFollowingStories { 
   @IsNotEmpty()
   page: number = 1;  
}