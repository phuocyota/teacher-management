# Module Pattern Template

Tài liệu mô tả pattern chuẩn để tạo các module CRUD trong dự án NestJS này.  
Lấy `question-bank` làm mẫu tham khảo.

---

## 📁 Cấu trúc thư mục

```
src/
└── {module-name}/
    ├── {module-name}.controller.ts
    ├── {module-name}.entity.ts
    ├── {module-name}.module.ts
    ├── {module-name}.service.ts
    └── dto/
        ├── create-{module-name}.dto.ts
        └── {module-name}.dto.ts
```

---

## 1. Entity (`{module-name}.entity.ts`)

```typescript
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';

@Entity('{table_name}')
export class {ModuleName}Entity extends BaseEntity {
  @Column({ name: 'column_name', type: 'varchar', nullable: false })
  fieldName: string;

  // Foreign key - lưu ID
  @Column({ name: 'related_id', type: 'uuid' })
  relatedId: string;

  // Relation với entity khác
  @ManyToOne(() => RelatedEntity, (related) => related.items)
  @JoinColumn({ name: 'related_id' })
  related: RelatedEntity;
}
```

**Quy tắc:**

- Extends `BaseEntity` (có sẵn `id`, `createdAt`, `updatedAt`)
- Column name dùng `snake_case`, field name dùng `camelCase`
- Relation: dùng `@ManyToOne`, `@OneToMany`, `@JoinColumn`

---

## 2. DTOs

### 2.1. Create & Update DTO (`dto/create-{module-name}.dto.ts`)

```typescript
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class Create{ModuleName}Dto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Mô tả field bằng tiếng Việt',
    example: 'Giá trị mẫu',
  })
  fieldName!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID của entity liên quan',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  relatedId!: string;
}

export class Update{ModuleName}Dto extends PartialType(Create{ModuleName}Dto) {}
```

**Quy tắc:**

- Sử dụng `class-validator` decorators: `@IsString()`, `@IsNotEmpty()`, `@IsUUID()`, `@IsOptional()`
- Sử dụng `@ApiProperty` với `description` (tiếng Việt) và `example`
- Field dùng `!` để khẳng định non-null
- `UpdateDto` extends `PartialType(CreateDto)` - tất cả fields trở thành optional

### 2.2. Response DTO (`dto/{module-name}.dto.ts`)

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class {ModuleName}ResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Mô tả field',
    example: 'Giá trị mẫu',
  })
  fieldName!: string;

  @ApiProperty({
    description: 'ID của entity liên quan',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  relatedId?: string;
}

export class {ModuleName}ListResponseDto extends PaginationResponseDto<{ModuleName}ResponseDto> {
  @ApiProperty({
    description: 'Danh sách {module-name}',
    type: [{ModuleName}ResponseDto],
  })
  declare data: {ModuleName}ResponseDto[];
}
```

**Quy tắc:**

- `ResponseDto` extends `BaseDto`
- `ListResponseDto` extends `PaginationResponseDto<ResponseDto>`
- Dùng `declare` cho field `data` để override type

---

## 3. Service (`{module-name}.service.ts`)

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { {ModuleName}Entity } from './{module-name}.entity';
import { Create{ModuleName}Dto, Update{ModuleName}Dto } from './dto/create-{module-name}.dto';
import { RelatedService } from 'src/related/related.service';
import { ERROR_MESSAGES, ENTITY_NAMES } from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { {ModuleName}ResponseDto } from './dto/{module-name}.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class {ModuleName}Service {
  constructor(
    @InjectRepository({ModuleName}Entity)
    private readonly {moduleName}Repo: Repository<{ModuleName}Entity>,
    private readonly relatedService: RelatedService,  // Inject service, không inject repository
  ) {}

  // CREATE
  async create(dto: Create{ModuleName}Dto): Promise<{ModuleName}Entity> {
    // Validate related entity exists
    const related = await this.relatedService.findOne(dto.relatedId);

    const record = this.{moduleName}Repo.create({
      fieldName: dto.fieldName,
      related: related,  // Gán entity object, không gán ID
    });
    return this.{moduleName}Repo.save(record);
  }

  // READ ALL (with pagination & filters)
  async findAll(
    page = 1,
    size = 10,
    filter1?: string,
    filter2?: string,
  ): Promise<PaginationResponseDto<{ModuleName}ResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.{moduleName}Repo
      .createQueryBuilder('alias')
      .leftJoinAndSelect('alias.related', 'related');

    if (filter1) {
      qb.andWhere('alias.column_name = :filter1', { filter1 });
    }

    if (filter2) {
      qb.andWhere('alias.field ILIKE :filter2', { filter2: `%${filter2}%` });
    }

    qb.orderBy('alias.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto({ModuleName}ResponseDto, data),
      page,
      size,
      total,
    };
  }

  // READ ONE
  async findOne(id: string): Promise<{ModuleName}Entity> {
    const record = await this.{moduleName}Repo.findOne({
      where: { id },
      relations: ['related'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.{MODULE_NAME} ?? '{ModuleName}',
          id,
        ),
      );
    }
    return record;
  }

  // UPDATE
  async update(id: string, dto: Update{ModuleName}Dto): Promise<{ModuleName}Entity> {
    const record = await this.findOne(id);

    if (dto.relatedId) {
      const related = await this.relatedService.findOne(dto.relatedId);
      record.related = related;
    }

    if (dto.fieldName !== undefined) {
      record.fieldName = dto.fieldName;
    }

    return this.{moduleName}Repo.save(record);
  }

  // DELETE
  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.{moduleName}Repo.remove(record);
  }
}
```

**Quy tắc:**

- Repository đặt tên: `{moduleName}Repo`
- Inject Service của module liên quan, **KHÔNG inject Repository**
- Sử dụng `ERROR_MESSAGES` và `ENTITY_NAMES` cho thông báo lỗi
- QueryBuilder cho `findAll` với pagination
- Luôn check `!== undefined` khi update optional fields

---

## 4. Controller (`{module-name}.controller.ts`)

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { {ModuleName}Service } from './{module-name}.service';
import { Create{ModuleName}Dto, Update{ModuleName}Dto } from './dto/create-{module-name}.dto';
import { {ModuleName}ResponseDto, {ModuleName}ListResponseDto } from './dto/{module-name}.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('{Module Name}')
@ApiBearerAuth('access-token')
@Controller('{module-name}')
export class {ModuleName}Controller {
  constructor(private readonly {moduleName}Service: {ModuleName}Service) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới {tên entity}' })
  @ApiCreatedResponse({ type: {ModuleName}ResponseDto })
  create(@Body() dto: Create{ModuleName}Dto) {
    return this.{moduleName}Service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách {tên entity}' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'filterId',
    required: false,
    type: String,
    description: 'Lọc theo ID liên quan',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm theo tên',
  })
  @ApiOkResponse({ type: {ModuleName}ListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('filterId') filterId?: string,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<{ModuleName}ResponseDto>> {
    return this.{moduleName}Service.findAll(page, size, filterId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin {tên entity} theo ID' })
  @ApiOkResponse({ type: {ModuleName}ResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.{moduleName}Service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin {tên entity}' })
  @ApiOkResponse({ type: {ModuleName}ResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update{ModuleName}Dto,
  ) {
    return this.{moduleName}Service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa {tên entity}' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.{moduleName}Service.remove(id);
  }
}
```

**Quy tắc:**

- `@ApiTags` - Tên hiển thị trong Swagger (có khoảng trắng)
- `@ApiBearerAuth('access-token')` - Xác thực JWT
- `@ApiOperation({ summary: '...' })` - Mô tả tiếng Việt cho mỗi endpoint
- `@ParseUUIDPipe` cho tất cả param `id`
- Param DTO đặt tên `dto`, không dùng `createDto` hoặc `updateDto`
- **KHÔNG dùng** `@HttpCode`, `@ApiParam`, `@ApiNoContentResponse`

---

## 5. Module (`{module-name}.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { {ModuleName}Service } from './{module-name}.service';
import { {ModuleName}Controller } from './{module-name}.controller';
import { {ModuleName}Entity } from './{module-name}.entity';
import { RelatedModule } from 'src/related/related.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([{ModuleName}Entity]),
    RelatedModule,  // Import MODULE, không import entity
  ],
  providers: [{ModuleName}Service],
  controllers: [{ModuleName}Controller],
  exports: [{ModuleName}Service],
})
export class {ModuleName}Module {}
```

**Quy tắc:**

- Import `TypeOrmModule.forFeature` chỉ với entity của module hiện tại
- Import **Module** của entity liên quan (không import Entity trực tiếp)
- Luôn `exports: [Service]` để module khác có thể sử dụng

---

## 6. Thêm Entity Name (`src/common/constant/error-messages.constant.ts`)

```typescript
export const ENTITY_NAMES = {
  // ... existing
  {MODULE_NAME}: '{Tên tiếng Việt}',
};
```

---

## 📋 Checklist tạo module mới

- [ ] Tạo entity với `@Entity`, extends `BaseEntity`
- [ ] Tạo `dto/create-{module-name}.dto.ts` với `CreateDto` và `UpdateDto`
- [ ] Tạo `dto/{module-name}.dto.ts` với `ResponseDto` và `ListResponseDto`
- [ ] Tạo service với CRUD operations
- [ ] Tạo controller với Swagger decorators
- [ ] Tạo module, import các module liên quan
- [ ] Thêm entity name vào `ENTITY_NAMES`
- [ ] Import module vào `AppModule`

---

## 🔧 Naming Conventions

| Loại                | Pattern                                               | Ví dụ                    |
| ------------------- | ----------------------------------------------------- | ------------------------ |
| Entity class        | `{ModuleName}Entity`                                  | `QuestionBankEntity`     |
| Service class       | `{ModuleName}Service`                                 | `QuestionBankService`    |
| Controller class    | `{ModuleName}Controller`                              | `QuestionBankController` |
| Module class        | `{ModuleName}Module`                                  | `QuestionBankModule`     |
| Repository variable | `{moduleName}Repo`                                    | `questionBankRepo`       |
| DB table name       | `snake_case`                                          | `question_bank`          |
| DB column name      | `snake_case`                                          | `exam_date`              |
| API route           | `kebab-case`                                          | `/question-bank`         |
| DTO files           | `create-{module-name}.dto.ts`, `{module-name}.dto.ts` |                          |
