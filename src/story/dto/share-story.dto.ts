import { Type } from "class-transformer";
import { 
  IsArray, 
  IsMongoId, 
  IsNotEmpty, 
  IsOptional, 
  ValidateNested 
} from "class-validator";
import { MediaDto } from "../../message/dto/message.dto";

export class ShareStoryDTO {
  @IsNotEmpty({ message: "roomIds can not be empty" })
  @IsArray({ message: "roomIds must be an array" })
  @IsMongoId({ each: true, message: "Each roomId must be valid MongoID" })
  roomIds: string[];

  @IsOptional()
  @Type(() => String)
  message?: string;

  @ValidateNested()
  @Type(() => MediaDto)
  media: MediaDto;
}