import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserGroupService } from './user-group.service';
import { UserGroupItemDto, CheckMembershipDto } from './dto/user-group.dto';
import {
  AddUsersToGroupDto,
  RemoveUsersFromGroupDto,
  UpdateMemberRoleDto,
  GroupMemberDto,
  GroupResponseDto,
} from '../group/dto/group.dto';
import { GroupMemberRole } from './enum/group-member-role.enum';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('User Groups')
@ApiBearerAuth('access-token')
@Controller('user-groups')
export class UserGroupController {
  constructor(private readonly userGroupService: UserGroupService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy danh sách groups của user với chi tiết' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [UserGroupItemDto],
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  async getUserGroups(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserGroupItemDto[]> {
    return this.userGroupService.getUserGroupsDetail(userId);
  }

  @Get('group/:groupId')
  @ApiOperation({ summary: 'Lấy danh sách members của group với chi tiết' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupMemberDto],
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  async getGroupMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupMemberDto[]> {
    return this.userGroupService.getGroupMembersDetail(groupId);
  }

  @Get('check-membership')
  @ApiOperation({ summary: 'Kiểm tra user có trong group không' })
  @ApiResponse({
    status: 200,
    description: 'Kiểm tra thành công',
    type: CheckMembershipDto,
  })
  async checkMembership(
    @Query('userId', ParseUUIDPipe) userId: string,
    @Query('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<CheckMembershipDto> {
    return this.userGroupService.checkMembership(userId, groupId);
  }

  @Get('role')
  @ApiOperation({ summary: 'Lấy role của user trong group' })
  @ApiResponse({
    status: 200,
    description: 'Lấy role thành công',
    schema: {
      properties: {
        role: {
          type: 'string',
          enum: Object.values(GroupMemberRole),
          nullable: true,
        },
      },
    },
  })
  async getUserRole(
    @Query('userId', ParseUUIDPipe) userId: string,
    @Query('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<{ role: GroupMemberRole | null }> {
    const role = await this.userGroupService.getUserRole(userId, groupId);
    return { role };
  }

  @Get('my-groups')
  @ApiOperation({ summary: 'Lấy danh sách groups của current user' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupResponseDto],
  })
  async getMyGroups(@User() user: JwtPayload): Promise<GroupResponseDto[]> {
    return this.userGroupService.getMyGroups(user);
  }

  @Get('group/:groupId/members')
  @ApiOperation({ summary: 'Lấy danh sách thành viên của group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupMemberDto],
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  async getMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupMemberDto[]> {
    return this.userGroupService.getGroupMembers(groupId);
  }

  @Post('group/:groupId/members')
  @ApiOperation({ summary: 'Thêm users vào group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Thêm thành viên thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  addUsersToGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AddUsersToGroupDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    return this.userGroupService.addUsersToGroup(groupId, dto, user);
  }

  @Put('group/:groupId/members/:userId/role')
  @ApiOperation({ summary: 'Cập nhật role của user trong group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group hoặc user' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async updateRole(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    return this.userGroupService.updateMemberRole(
      groupId,
      userId,
      dto.role,
      user,
    );
  }

  @Delete('group/:groupId/members')
  @ApiOperation({ summary: 'Xóa users khỏi group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Xóa thành viên thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async removeMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: RemoveUsersFromGroupDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    return this.userGroupService.removeUsersFromGroup(
      groupId,
      dto.userIds,
      user,
    );
  }
}
