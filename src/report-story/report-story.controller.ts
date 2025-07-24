import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ReportStoryService } from './report-story.service';
import { CreateReportStoryDto } from './dto/create-report-story.dto';
import { UpdateReportStoryDto } from './dto/update-report-story.dto';
import { QueryReportStoryDto } from './dto/query-report-story.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('report-story')
@Controller('report-story')
@UseGuards(JwtRefreshAuthGuard)
export class ReportStoryController {
  constructor(private readonly reportStoryService: ReportStoryService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new story report' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) createReportStoryDto: CreateReportStoryDto,
  ) {
    return this.reportStoryService.create(createReportStoryDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports' })
  async findAll(@Query(new ValidationPipe()) queryDto: QueryReportStoryDto) {
    return this.reportStoryService.findAll(queryDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get current user reports' })
  async getMyReports(
    @CurrentUser('sub') userId: string,
    @Param('userId')
    @Query(new ValidationPipe()) queryDto: QueryReportStoryDto,
  ) {
    return this.reportStoryService.getReportsByUser(userId, queryDto);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get report statistics' })
  async getStatistics() {
    return this.reportStoryService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  async findOne(@Param('id') id: string) {
    return this.reportStoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update report' })
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) updateReportStoryDto: UpdateReportStoryDto,
  ) {
    return this.reportStoryService.update(id, updateReportStoryDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete report' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reportStoryService.remove(id, userId, false);
  }
}