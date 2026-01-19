# Copilot Instructions for Teacher Management API

## Project Overview

NestJS 11 backend API for managing teachers, lectures, courses, and user groups. Uses TypeORM with PostgreSQL, JWT authentication, and Socket.IO for real-time features.

## Architecture

### Module Structure

Each domain follows: `{domain}.module.ts`, `{domain}.controller.ts`, `{domain}.service.ts`, `{domain}.entity.ts`, with DTOs in `dto/` subfolder.

- Complex modules (e.g., `lecture/`) split services into `services/` and controllers into `controller/` subfolders
- All entities extend `BaseEntity` from `src/common/sql/base.entity.ts` (provides `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
- Services can extend `BaseService<T>` for common CRUD operations and transaction support

### Key Directories

- `src/common/` - Shared utilities: guards, decorators, filters, DTOs, constants
- `src/auth/` - JWT authentication with role-based login (`/auth/login/admin`, `/auth/login/teacher`)
- `src/socket/` - WebSocket gateway for real-time features

## Patterns & Conventions

### Authentication & Authorization

- Global `AuthGuard` protects all routes by default. Use `@Public()` decorator for unauthenticated routes
- Role-based access: Apply `@UseGuards(RolesGuard)` + `@Roles(UserType.ADMIN)` on restricted endpoints
- Access current user in controllers via `@User() user: JwtPayload` decorator
- User types: `ADMIN`, `TEACHER` (see `src/common/enum/user-type.enum.ts`)

### DTO Conventions

- Use `class-validator` decorators with Vietnamese error messages: `@IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })`
- All DTOs use `@ApiProperty`/`@ApiPropertyOptional` for Swagger documentation
- Pagination: Extend or use `PaginationRequestDto` from `src/common/dto/pagingation.dto.ts`

### Error Handling

- Use constants from `src/common/constant/error-messages.constant.ts` for error messages (Vietnamese)
- Entity names in `ENTITY_NAMES` constant for dynamic error messages
- Global `AllExceptionsFilter` standardizes error responses with format: `{ statusCode, message, error, timestamp, path, method }`

### Response Format

- `SuccessResponseInterceptor` wraps all responses: `{ success: true, message: 'Thành công', data: ... }`
- No need to manually wrap responses in controllers

### Database Patterns

- TypeORM with PostgreSQL, entities registered in `app.module.ts`
- Column naming: snake_case in DB (`user_name`), camelCase in TypeScript (`userName`)
- Use `@Column({ name: 'column_name', ... })` for explicit mapping
- Transactions: Use `BaseService.runInTransaction()` or `runInTransaction()` utility from `src/common/database/transaction.utils.ts`

### File Uploads

- Files stored in `uploads/` directory, served statically at `/uploads`
- Use `FileEntity` and `FileAccessEntity` for tracking files and permissions
- Upload controller uses Multer interceptors: `@UseInterceptors(FileInterceptor('file'))`

## Commands

```bash
yarn start:dev     # Development with watch mode
yarn build         # Build for production
yarn start:prod    # Run production build
yarn lint          # ESLint with auto-fix
yarn format        # Prettier formatting
yarn test:e2e      # End-to-end tests
yarn deploy        # Run deploy.sh script
```

## API Documentation

Swagger UI available at `/swagger` when running the server.

## Adding New Features

### New Module Checklist

1. Create module folder with entity, service, controller, module files
2. Entity extends `BaseEntity`, register in `app.module.ts` entities array
3. Service extends `BaseService<T>` for standard CRUD
4. Apply `@ApiTags`, `@ApiBearerAuth('access-token')` to controller
5. Create DTOs with validation decorators and Swagger annotations
6. Use `ERROR_MESSAGES` constants for error handling
