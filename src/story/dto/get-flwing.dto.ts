import { IsNotEmpty } from "class-validator";

export class getFollowingStories { 
   @IsNotEmpty()
   flwingIds: string[];  
}