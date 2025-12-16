# Transaction Implementation - Developer Usage Guide

## Overview for Developers

This guide explains how to use the transaction implementations already in place and how to add transactions to new multi-step operations.

## Current Transaction Implementations

### 1. Upload Lecture with Permissions

**Endpoint**: `POST /upload/lecture`

**What happens**:

```
Request received
  ↓
[TRANSACTION STARTS]
  ├─ Create file record
  ├─ Create lecture record
  └─ Grant permissions to teachers
[TRANSACTION COMMITS/ROLLS BACK]
  ↓
Response sent
```

**Usage**:

```bash
curl -X POST http://localhost:3000/upload/lecture \
  -F "file=@lecture.pdf" \
  -F "lectureTitle=Advanced TypeScript" \
  -F "teacherIds=teacher1,teacher2,teacher3" \
  -H "Authorization: Bearer <token>"
```

**Behavior**:

- ✅ Success: All 3 steps complete, response includes fileId, lectureId, teachersGranted
- ❌ Failure: All rolled back, clean error response, no orphaned records

---

### 2. Add Users to Group

**Endpoint**: `POST /group/:groupId/users`

**What happens**:

```
Request received
  ↓
[TRANSACTION STARTS]
  ├─ Load group with users
  ├─ Validate all users exist
  └─ Update group.users array
[TRANSACTION COMMITS/ROLLS BACK]
  ↓
Response sent
```

**Usage**:

```bash
curl -X POST http://localhost:3000/group/group-123/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "userIds": ["user1", "user2", "user3", "user4", "user5"]
  }'
```

**Behavior**:

- ✅ Success: All 5 users added atomically
- ❌ Failure: No users added (even if 4 of 5 were valid)

---

### 3. Remove Users from Group

**Endpoint**: `DELETE /group/:groupId/users`

**What happens**:

```
Request received
  ↓
[TRANSACTION STARTS]
  ├─ Load group with users
  ├─ Verify permissions
  └─ Remove users from array
[TRANSACTION COMMITS/ROLLS BACK]
  ↓
Response sent
```

**Usage**:

```bash
curl -X DELETE http://localhost:3000/group/group-123/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "userIds": ["user1", "user2"]
  }'
```

**Behavior**:

- ✅ Success: Both users removed atomically
- ❌ Failure: No users removed

---

### 4. Grant Permissions to Multiple Teachers

**Endpoint**: `POST /lecture/:lectureId/permissions/bulk`

**What happens**:

```
Request received
  ↓
[TRANSACTION STARTS]
  ├─ Validate lecture exists
  ├─ Validate all teachers exist
  └─ Loop: Create/update permission for each teacher
[TRANSACTION COMMITS/ROLLS BACK]
  ↓
Response sent
```

**Usage**:

```bash
curl -X POST http://localhost:3000/lecture/lecture-123/permissions/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "teacherIds": ["teacher1", "teacher2", "...", "teacher100"],
    "permissionType": "VIEW",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

**Behavior**:

- ✅ Success: All 100 teachers get permissions atomically
- ❌ Failure at teacher #50: No permissions granted to any teacher

---

### 5. Approve Device Request

**Endpoint**: `POST /device/:requestId/approve`

**What happens**:

```
Request received
  ↓
[TRANSACTION STARTS]
  ├─ Load device request
  ├─ Update status to APPROVED
  └─ Create approved device record
[TRANSACTION COMMITS/ROLLS BACK]
  ↓
Response sent
```

**Usage**:

```bash
curl -X POST http://localhost:3000/device/request-123/approve \
  -H "Authorization: Bearer <admin-token>"
```

**Behavior**:

- ✅ Success: Status updated and device record created together
- ❌ Failure: Neither status nor device created

---

## Testing Transactions

### 1. Test Partial Failure Scenario

```typescript
// Test: Upload lecture fails at permission creation
describe('UploadService.uploadLectureFile', () => {
  it('should rollback file and lecture if permission creation fails', async () => {
    const invalidTeacherId = 'non-existent-teacher';

    await expect(
      service.uploadLectureFile(file, title, desc, [invalidTeacherId], user),
    ).rejects.toThrow('Một số giáo viên không tồn tại');

    // Verify file was NOT created
    const fileCount = await fileRepo.count();
    expect(fileCount).toBe(0);

    // Verify lecture was NOT created
    const lectureCount = await lectureRepo.count();
    expect(lectureCount).toBe(0);
  });
});
```

### 2. Test Concurrent Operations

```typescript
// Test: Two concurrent requests to add users to same group
it('should handle concurrent user additions without conflicts', async () => {
  const group = await createGroup();
  const users1 = ['user1', 'user2'];
  const users2 = ['user3', 'user4'];

  // Fire both requests concurrently
  const [result1, result2] = await Promise.all([
    service.addUsersToGroup(group.id, users1, user),
    service.addUsersToGroup(group.id, users2, user),
  ]);

  // Both should succeed without conflicts
  expect(result1.members.length).toBeGreaterThan(0);
  expect(result2.members.length).toBeGreaterThan(0);

  // Verify final count
  const finalGroup = await service.findOne(group.id);
  expect(finalGroup.members.length).toBe(4); // All 4 users added
});
```

### 3. Test Rollback on Error

```typescript
// Test: Database error during transaction
it('should rollback on database error', async () => {
  const spy = jest.spyOn(permissionRepo, 'save');
  spy.mockRejectedValueOnce(new Error('Database connection lost'));

  await expect(service.grantPermissionsToMultiple(dto, user)).rejects.toThrow(
    'Database connection lost',
  );

  // Verify no permissions were created
  const permissions = await permissionRepo.find();
  expect(permissions.length).toBe(0);
});
```

---

## Adding Transactions to New Services

### Pattern Template

When you need to add a transaction to a new service:

```typescript
import { Connection } from 'typeorm';

@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyEntity)
    private readonly myRepo: Repository<MyEntity>,
    private readonly connection: Connection,
  ) {}

  async myMultiStepOperation(
    data: InputDto,
    user: JwtPayload,
  ): Promise<OutputDto> {
    // Validate inputs first (before transaction)
    if (!data.required) {
      throw new BadRequestException('Missing required field');
    }

    // ✅ Wrap multi-step operations in transaction
    return this.myRepo.manager.connection.transaction(async (manager) => {
      // Step 1
      const entity1 = await manager.findOne(Entity1, {
        where: { id: data.entity1Id },
      });

      if (!entity1) {
        throw new NotFoundException('Entity1 not found');
      }

      // Step 2
      const entity2 = this.myRepo.create({
        ...data,
        createdBy: user.userId,
      });
      const savedEntity2 = await manager.save(entity2);

      // Step 3
      const entity3 = this.otherRepo.create({
        relationId: savedEntity2.id,
        ...otherData,
      });
      await manager.save(entity3);

      // Return result
      return this.mapToDto(savedEntity2);
    });
  }
}
```

### Key Points

1. **Validation First**: Do error checking BEFORE the transaction
2. **Use manager**: Inside transaction, use `manager.save()`, `manager.findOne()`, etc.
3. **Single return**: Return from within transaction block
4. **Error propagation**: Don't catch errors; let them propagate for automatic rollback
5. **No manual rollback**: The framework handles rollback on any error

---

## Monitoring Transactions

### Check Transaction Logs

```sql
-- See current active transactions
SELECT
  pid,
  usename,
  current_timestamp - pg_stat_activity.query_start AS elapsed,
  query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY elapsed DESC;
```

### Check Long-Running Queries

```sql
-- Find slow transactions
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- > 1 second
ORDER BY mean_exec_time DESC;
```

---

## Troubleshooting

### Issue: "Transaction timeout"

**Cause**: Operation taking too long
**Solution**:

- Optimize queries
- Reduce batch size
- Check for N+1 queries

### Issue: "Could not obtain lock"

**Cause**: Lock conflict with another transaction
**Solution**:

- Check if another request is modifying same resources
- Implement retry logic with exponential backoff

### Issue: "Deadlock detected"

**Cause**: Two transactions waiting for each other's locks
**Solution**:

- Review transaction ordering
- Implement timeout and retry
- Check database logs for deadlock info

### Issue: "Partial data created"

**Cause**: You're not using transactions!
**Solution**:

- Wrap multi-step operations in `transaction()` block
- Use `manager` for all operations within transaction

---

## Performance Tips

1. **Keep transactions short**: Minimize lock duration
2. **Validate early**: Throw errors before transaction starts
3. **Batch operations**: Process multiple items in single transaction
4. **Monitor locks**: Watch database lock metrics
5. **Connection pooling**: Ensure adequate connection pool size

---

## Best Practices Checklist

When implementing multi-step operations:

- [ ] All database operations use same connection/manager
- [ ] Validation errors thrown before transaction
- [ ] Business logic errors trigger automatic rollback
- [ ] Return from within transaction block
- [ ] No manual rollback code
- [ ] Error handling in HTTP layer, not transaction
- [ ] Concurrent access properly isolated
- [ ] Data consistency guaranteed
- [ ] Tests verify rollback scenarios
- [ ] Documentation updated

---

## Quick Reference

### Transaction Success Path

```
Validation ✅ → Transaction Start ✅ → Operation 1 ✅
→ Operation 2 ✅ → Operation N ✅ → Commit ✅ → Return ✅
```

### Transaction Failure Path

```
Validation ✅ → Transaction Start ✅ → Operation 1 ✅
→ Operation 2 ✅ → Operation 3 ❌ → Auto-Rollback ✅ → Throw Error ✅
```

---

## Support & Resources

- **Issue**: Check [TRANSACTION_IMPLEMENTATION.md](./TRANSACTION_IMPLEMENTATION.md)
- **Before/After**: See [TRANSACTION_BEFORE_AFTER.md](./TRANSACTION_BEFORE_AFTER.md)
- **Quick Ref**: Read [TRANSACTION_QUICK_REFERENCE.md](./TRANSACTION_QUICK_REFERENCE.md)
- **Checklist**: Review [TRANSACTION_CHECKLIST.md](./TRANSACTION_CHECKLIST.md)

---

**Last Updated**: 2024
**Status**: Production Ready ✅
