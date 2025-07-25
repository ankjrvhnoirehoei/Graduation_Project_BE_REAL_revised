import { Body, Controller, DefaultValuePipe, Get, NotFoundException, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { WeeklyPostsDto } from 'src/post/dto/weekly-posts.dto';
import { LastTwoWeeksDto } from 'src/post/dto/last-two-weeks.dto';
import { TopFollowerDto } from 'src/user/dto/top-followers.dto';
import { EditUserDto } from 'src/user/dto/update-user.dto';
import { PostService } from 'src/post/post.service';
import { UserService } from 'src/user/user.service';
import { ReportUserService } from 'src/report-user/report-user.service';
import { ReportContentService } from 'src/report-content/report-content.service';
type RangeKey = 'default' | '7days' | '30days' | 'year';
type ReportMode = 'user' | 'content';
@Controller('admin')
@UseGuards(JwtRefreshAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService, 
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly reportUserService: ReportUserService,
    private readonly reportContentService: ReportContentService,
  ) {}

  private getReportService(mode: ReportMode) {
    return mode === 'user' ? this.reportUserService : this.reportContentService;
  }

  private async populateReportData(reports: any[], mode: ReportMode) {
    return Promise.all(
      reports.map(async (report) => {
        const [reporter, target] = await Promise.all([
          this.userService.findById(report.reporterId.toString()),
          mode === 'user' 
            ? this.userService.findById(report.targetId.toString())
            : this.postService.getPostById(report.targetId.toString(), '682ac4f9f7612a80f6146b88')
        ]);
        
        return {
          ...report,
          reporter,
          target,
        };
      })
    );
  }

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
  async getTopLiked(@CurrentUser('sub') userId: string) {
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
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy: 'createdAt' | 'likeCount' | 'commentCount' | 'viewCount',
    @Query('sortOrder', new DefaultValuePipe('desc')) sortOrder: 'asc' | 'desc',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
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
    const result = await this.adminService.getNewPostsByDatePaginated(
      userId, 
      from, 
      to, 
      sortBy, 
      sortOrder, 
      page, 
      limit
    );
    return { success: true, data: result }; 
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

  @Get('reported')
  async getRepeatedOffenders(
    @CurrentUser('sub') adminId: string,
    @Query('range', new DefaultValuePipe('7days'))
    range: '7days' | '30days' | 'year',
  ) {
    const result = await this.reportUserService.getReportedUsersActivity(adminId, range);
    return { success: true, ...result };
  }

  // Get report reasons activity
  @Get('reports/:mode/reasons')
  async getReportReason(
    @CurrentUser('sub') adminId: string,
    @Param('mode') reportMode: ReportMode,
    @Query('range', new DefaultValuePipe('7days'))
    range: '7days' | '30days' | 'year',
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const result = await reportService.getReportReasonsActivity(adminId, range);
    
    return { success: true, ...result };
  }

  // Reports routes
  @Get('reports/:mode/all')
  async getAllReports(
    @CurrentUser('sub') adminId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Param('mode') reportMode: ReportMode,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const reports = await reportService.getAllReports({ page, limit });
    const reportsWithUsers = await this.populateReportData(reports.data, reportMode);
    
    return {
      ...reports,
      data: reportsWithUsers,
    };
  }

  // Get unread reports
  @Get('reports/:mode/unread')
  async getUnreadReports(
    @CurrentUser('sub') adminId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Param('mode') reportMode: ReportMode,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const reports = await reportService.getUnreadReports({ page, limit });
    const reportsWithUsers = await this.populateReportData(reports.data, reportMode);
    
    return {
      ...reports,
      data: reportsWithUsers,
    };
  }

  // Get unresolved reports
  @Get('reports/:mode/unresolved')
  async getUnresolvedReports(
    @CurrentUser('sub') adminId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Param('mode') reportMode: ReportMode,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const reports = await reportService.getUnresolvedReports({ page, limit });
    const reportsWithUsers = await this.populateReportData(reports.data, reportMode);
    
    return {
      ...reports,
      data: reportsWithUsers,
    };
  }

  // Mark all reports as read
  @Patch('reports/:mode/mark-all-read')
  async markAllReportsAsRead(
    @CurrentUser('sub') adminId: string,
    @Param('mode') reportMode: ReportMode,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const result = await reportService.markAllReportsAsRead();
    
    return {
      message: 'Đã đánh dấu tất cả báo cáo là đã đọc',
      modifiedCount: result.modifiedCount,
    };
  }

  // Get reports by target (user or content)
  @Get('reports/:mode/target/:targetId')
  async getReportsByTarget(
    @CurrentUser('sub') adminId: string,
    @Param('mode') reportMode: ReportMode,
    @Param('targetId') targetId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const reports = await reportService.getReportsByTargetId(targetId, { page, limit });
    
    // Get target details based on mode
    const target = reportMode === 'user' 
      ? await this.userService.findById(targetId)
      : await this.postService.getPostById(targetId, '682ac4f9f7612a80f6146b88');
    
    // Populate reporter details for each report
    const reportsWithReporters = await Promise.all(
      reports.data.map(async (report) => {
        const reporter = await this.userService.findById(report.reporterId.toString());
        
        return {
          ...report,
          reporter,
        };
      })
    );
    
    return {
      target,
      reports: {
        ...reports,
        data: reportsWithReporters,
      },
    };
  }

  // Dismiss a report (mark as resolved and dismissed)
  @Patch('reports/:mode/dismiss/:id')
  async dismissReport(
    @CurrentUser('sub') adminId: string,
    @Param('mode') reportMode: ReportMode,
    @Param('id') reportId: string,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const report = await reportService.dismissReport(reportId);
    
    return {
      message: 'Báo cáo đã được bỏ qua',
      report,
    };
  }

  // Resolve a report (mark as resolved only)
  @Patch('reports/:mode/resolve/:id')
  async resolveReport(
    @CurrentUser('sub') adminId: string,
    @Param('mode') reportMode: ReportMode,
    @Param('id') reportId: string,
  ) {
    await this.adminService.ensureAdmin(adminId);
    
    if (!['user', 'content'].includes(reportMode)) {
      throw new NotFoundException('Invalid report mode. Must be "user" or "content"');
    }

    const reportService = this.getReportService(reportMode);
    const report = await reportService.resolveReport(reportId);
    
    return {
      message: 'Báo cáo đã được giải quyết',
      report,
    };
  }
}