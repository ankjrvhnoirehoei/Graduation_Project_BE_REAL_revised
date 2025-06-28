import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { WeeklyPostsDto } from 'src/post/dto/weekly-posts.dto';
import { LastTwoWeeksDto } from 'src/post/dto/last-two-weeks.dto';
import { TopPostDto } from 'src/post/dto/top-posts.dto';
import { TopFollowerDto } from 'src/user/dto/top-followers.dto';

@Controller('admin')
@UseGuards(JwtRefreshAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Post routes
  @Get('posts/weekly')
  getWeekly(@CurrentUser('sub') userId: string): Promise<WeeklyPostsDto[]> {
    return this.adminService.getWeeklyStats(userId);
  }

  @Get('posts/last-two-weeks')
  getLastTwoWeeks(@CurrentUser('sub') userId: string): Promise<LastTwoWeeksDto[]> {
    return this.adminService.getLastTwoWeeks(userId);
  }

  @Get('posts/top-liked')
  getTopLiked(@CurrentUser('sub') userId: string): Promise<TopPostDto[]> {
    return this.adminService.getTopLiked(userId);
  }

  @Get('posts/stats/content-distribution')
  getContentDistribution(@CurrentUser('sub') userId: string) {
    return this.adminService.getContentDistribution(userId);
  }

  @Get('posts/yearly-stats')
  getYearlyStats(@CurrentUser('sub') userId: string) {
    return this.adminService.getTwoYearStats(userId);
  }

  @Get('posts/last-six-months')
  getLastSixMonths(@CurrentUser('sub') userId: string) {
    return this.adminService.getLastSixMonths(userId);
  }

  @Get('posts/compare-last-6-months')
  compareLastSixMonths(@CurrentUser('sub') userId: string) {
    return this.adminService.compareLastSixMonths(userId);
  }

  @Get('posts/summary-posts')
  getPostsSummary(@CurrentUser('sub') userId: string) {
    return this.adminService.getPostsSummary(userId);
  }

  // User routes

  @Get('users/top-followers')
  getTopFollowers(
    @CurrentUser('sub') userId: string,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<TopFollowerDto[]> {
    return this.adminService.getTopFollowers(userId, limit);
  }

  @Get('users/today-stats')
  getTodayStats(@CurrentUser('sub') userId: string) {
    return this.adminService.getTodayStats(userId);
  }

  @Get('users/stats/new-accounts')
  getDailyNewAccounts(
    @CurrentUser('sub') userId: string,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.adminService.getDailyNewAccounts(userId, month);
  }

  @Get('users/search')
  adminSearch(
    @CurrentUser('sub') userId: string,
    @Query('keyword') keyword: string,
  ) {
    return this.adminService.searchUsers(userId, keyword);
  }

  @Get('users/recommended')
  getRecommended(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getRecommendedUsers(userId, page, limit);
  }  
}