import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { WeeklyPostsDto } from 'src/post/dto/weekly-posts.dto';
import { LastTwoWeeksDto } from 'src/post/dto/last-two-weeks.dto';
import { TopPostDto } from 'src/post/dto/top-posts.dto';
import { TopFollowerDto } from 'src/user/dto/top-followers.dto';
import { EditUserDto } from 'src/user/dto/update-user.dto';
import { PostService } from 'src/post/post.service';
import { UserService } from 'src/user/user.service';
type RangeKey = 'default' | '7days' | '30days' | 'year';
@Controller('admin')
@UseGuards(JwtRefreshAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService, 
    private readonly postService: PostService,
    private readonly userService: UserService,) {}

  // Post routes
  @Get('posts/weekly')
  async getWeekly(@CurrentUser('sub') userId: string): Promise<WeeklyPostsDto[]> {
    return this.adminService.getWeeklyStats(userId);
  }

  @Get('posts/last-two-weeks')
  async getLastTwoWeeks(@CurrentUser('sub') userId: string): Promise<LastTwoWeeksDto[]> {
    return this.adminService.getLastTwoWeeks(userId);
  }

  @Get('posts/top-liked')
  async getTopLiked(@CurrentUser('sub') userId: string): Promise<TopPostDto[]> {
    return this.adminService.getTopLiked(userId);
  }

  @Get('posts/stats/content-distribution')
  async getContentDistribution(@CurrentUser('sub') userId: string) {
    return this.adminService.getContentDistribution(userId);
  }

  @Get('posts/yearly-stats')
  async getYearlyStats(@CurrentUser('sub') userId: string) {
    return this.adminService.getTwoYearStats(userId);
  }

  @Get('posts/last-six-months')
  async getLastSixMonths(@CurrentUser('sub') userId: string) {
    return this.adminService.getLastSixMonths(userId);
  }

  @Get('posts/compare-last-6-months')
  async compareLastSixMonths(@CurrentUser('sub') userId: string) {
    return this.adminService.compareLastSixMonths(userId);
  }

  @Get('posts/summary-posts')
  async getPostsSummary(@CurrentUser('sub') userId: string) {
    return this.adminService.getPostsSummary(userId);
  }

  @Get('posts/new')
  async getNewPosts(
    @CurrentUser('sub') userId: string,
    @Query('range', new DefaultValuePipe('default')) range: 'default' | '7days' | '30days' | 'year',
  ) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date, to: Date = now;

    switch (range) {
      case '7days':
        from = new Date(todayStart.getTime() - 6 * 24*60*60*1000);
        break;
      case '30days':
        from = new Date(todayStart.getTime() - 29 * 24*60*60*1000);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        from = todayStart;
    }

    const posts = await this.adminService.getNewPostsByDate(userId, from, to);
    return { success: true, data: posts };
  }

  @Patch('posts/disable/:id')
  async disablePost(
    @CurrentUser('sub') adminId: string,
    @Param('id') postId: string,
  ) {
    await this.adminService.ensureAdmin(adminId);
    const isEnabled = await this.postService.disablePost(postId);
    return { success: true, postId, isEnabled, message: `Post ${postId} is now ${isEnabled ? 'enabled' : 'disabled'}.` };
  }

  // User routes
  @Get('users/top-followers')
  async getTopFollowers(
    @CurrentUser('sub') userId: string,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<TopFollowerDto[]> {
    return this.adminService.getTopFollowers(userId, limit);
  }

  @Get('users/today-stats')
  async getTodayStats(@CurrentUser('sub') userId: string) {
    return this.adminService.getTodayStats(userId);
  }

  @Get('users/stats/new-accounts')
  async getDailyNewAccounts(
    @CurrentUser('sub') userId: string,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.adminService.getDailyNewAccounts(userId, month);
  }

  @Get('users/search')
  async adminSearch(
    @CurrentUser('sub') userId: string,
    @Query('keyword') keyword: string,
  ) {
    return this.adminService.searchUsers(userId, keyword);
  }

  @Get('users/recommended')
  async getRecommended(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getRecommendedUsers(userId, page, limit);
  }  

  @Patch('users/disable/:id')
  async disableUser(
    @CurrentUser('sub') adminId: string,
    @Param('id') userId: string,
  ) {
    await this.adminService.ensureAdmin(adminId);
    const isDeleted = await this.userService.disableUser(userId);
    return { success: true, userId, isDeleted, message: `User ${userId} is now ${isDeleted ? 'deleted' : 'active'}.` };
  }

  @Get('users/new')
  async getNewUsers(
    @CurrentUser('sub') adminId: string,
    @Query('range', new DefaultValuePipe('default')) range: RangeKey,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    await this.adminService.ensureAdmin(adminId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date, to = now;

    switch (range) {
      case '7days':
        from = new Date(todayStart.getTime() - 6 * 86_400_000);
        break;
      case '30days':
        from = new Date(todayStart.getTime() - 29 * 86_400_000);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        from = todayStart;
    }

    const result = await this.userService.getNewUsersByDate(from, to, page, limit);
    return { success: true, data: result };
  }

  // General routes
  @Post('setting')
  async adminAccountEdit(
    @CurrentUser('sub') userId: string,
    @Body() dto: EditUserDto
  ) {
    return this.adminService.editAccount(userId, dto);
  }

  @Get('stats')
  async getStats(
    @CurrentUser('sub') userId: string,
    @Query('range', new DefaultValuePipe('default')) range: RangeKey,
  ) {
    const data = await this.adminService.getDashboardStats(userId, range);
    return { success: true, data };
  }

  @Get('engagement')
  async getEngagementActivity(
    @CurrentUser('sub') adminId: string,
    @Query('range', new DefaultValuePipe('7days'))
    range: '7days' | '30days' | 'year',
  ) {
    const result = await this.adminService.getEngagementActivity(adminId, range);
    return { success: true, ...result };
  }

  @Get('content')
  async getContentActivity(
    @CurrentUser('sub') adminId: string,
    @Query('range', new DefaultValuePipe('7days'))
    range: '7days' | '30days' | 'year',
  ) {
    const result = await this.adminService.getContentActivity(adminId, range);
    return { success: true, ...result };
  }

  @Get('cumulative')
  async getCumulativeNewUsers(
    @CurrentUser('sub') adminId: string,
    @Query('range', new DefaultValuePipe('7days'))
    range: '7days' | '30days' | 'year',
  ) {
    const result = await this.adminService.getCumulativeNewUsers(adminId, range);
    return { success: true, ...result };
  }
}