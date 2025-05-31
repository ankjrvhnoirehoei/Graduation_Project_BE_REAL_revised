import { AbstractRepository } from "@app/common";
import { Logger } from "@nestjs/common";
import { Model } from "mongoose";
import { Story as StoryDocument } from "./schema/story.schema";
import { InjectModel } from "@nestjs/mongoose";

export class StoryRepository extends AbstractRepository<StoryDocument>  {
  protected logger: Logger;
  constructor(
    @InjectModel(StoryDocument.name)
    model: Model<StoryDocument>,
  ) {
    super(model);
  }
}