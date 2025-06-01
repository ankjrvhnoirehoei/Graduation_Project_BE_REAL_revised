import { AbstractRepository } from "@app/common";
import { Story as StoryDocument } from "./schema/story.schema";
import { Injectable, Logger } from "@nestjs/common";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class StoryRepository extends AbstractRepository<StoryDocument> {
  protected readonly logger = new Logger(StoryRepository.name);

  constructor(
    @InjectModel(StoryDocument.name)
    reservationModel: Model<StoryDocument>,
  ) {
    super(reservationModel);
  }
}