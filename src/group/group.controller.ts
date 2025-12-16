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
  ApiQuery,
} from '@nestjs/swagger';
import { GroupService } from './group.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddUsersToGroupDto,
  RemoveUsersFromGroupDto,
  GroupResponseDto,
  GroupWithMemberCountDto,
  GroupWithMembersDto,
  GroupMemberDto,
  MaxCodeResponseDto,
} from './dto/group.dto';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('Groups')
@ApiBearerAuth('access-token')
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo group mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo group thành công',
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(
    @Body() dto: CreateGroupDto,
    @User() user: JwtPayload,
  ): Promise<GroupResponseDto> {
    return this.groupService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả groups' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupResponseDto],
  })
  async findAll(): Promise<GroupResponseDto[]> {
    return this.groupService.findAll();
  }

  @Get('with-count')
  @ApiOperation({ summary: 'Lấy danh sách groups với số lượng members' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupWithMemberCountDto],
  })
  async findAllWithMemberCount(): Promise<GroupWithMemberCountDto[]> {
    return this.groupService.findAllWithMemberCount();
  }

  @Get('my-groups')
  @ApiOperation({ summary: 'Lấy danh sách groups của current user' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupResponseDto],
  })
  async getMyGroups(@User() user: JwtPayload): Promise<GroupResponseDto[]> {
    return this.groupService.getMyGroups(user);
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm groups theo tên hoặc mã' })
  @ApiQuery({ name: 'keyword', required: true, description: 'Từ khóa cần tìm' })
  @ApiResponse({
    status: 200,
    description: 'Tìm kiếm thành công',
    type: [GroupResponseDto],
  })
  async search(@Query('keyword') keyword: string): Promise<GroupResponseDto[]> {
    return this.groupService.search(keyword);
  }

  @Get('max-code')
  @ApiOperation({ summary: 'Lấy mã group lớn nhất hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Lấy mã thành công',
    type: MaxCodeResponseDto,
  })
  async getMaxCode(): Promise<MaxCodeResponseDto> {
    const maxCode = await this.groupService.getMaxCode();
    return { maxCode };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết group theo ID' })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin thành công',
    type: GroupWithMembersDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GroupWithMembersDto> {
    return this.groupService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin group' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thành công',
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @User() user: JwtPayload,
  ): Promise<GroupResponseDto> {
    return this.groupService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa group' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.groupService.remove(id, user);
    return { message: 'Đã xóa group thành công' };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Lấy danh sách thành viên của group' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupMemberDto],
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  async getGroupMembers(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GroupMemberDto[]> {
    return this.groupService.getGroupMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Thêm users vào group' })
  @ApiResponse({
    status: 200,
    description: 'Thêm thành viên thành công',
    type: GroupWithMembersDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async addUsersToGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddUsersToGroupDto,
    @User() user: JwtPayload,
  ): Promise<GroupWithMembersDto> {
    return this.groupService.addUsersToGroup(id, dto.userIds, user);
  }

  @Delete(':id/members')
  @ApiOperation({ summary: 'Xóa users khỏi group' })
  @ApiResponse({
    status: 200,
    description: 'Xóa thành viên thành công',
    type: GroupWithMembersDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy group' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async removeUsersFromGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveUsersFromGroupDto,
    @User() user: JwtPayload,
  ): Promise<GroupWithMembersDto> {
    return this.groupService.removeUsersFromGroup(id, dto.userIds, user);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy danh sách groups của một user' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thành công',
    type: [GroupResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  async getUserGroups(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GroupResponseDto[]> {
    return this.groupService.getUserGroups(userId);
  }
}
