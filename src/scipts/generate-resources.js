const fs = require('fs');
const path = require('path');

const name = process.argv[2]; // Tên entity, ví dụ: Teacher
if (!name) {
  console.error('Vui lòng nhập tên entity: node generate-resource.js Teacher');
  process.exit(1);
}

const lcName = name.toLowerCase();
const folder = path.join(__dirname, '..', 'src', lcName);
if (!fs.existsSync(folder)) fs.mkdirSync(folder);

// --- Template Entity ---
const entityTemplate = `import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity()
export class ${name} extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;
}
`;

// --- Template Service ---
const serviceTemplate = `import { Injectable } from '@nestjs/common';
import { ${name} } from './${lcName}.entity';

@Injectable()
export class ${name}Service {
  // TODO: Thêm logic CRUD
}
`;

// --- Template Controller ---
const controllerTemplate = `import { Controller } from '@nestjs/common';
import { ${name}Service } from './${lcName}.service';

@Controller('${lcName}')
export class ${name}Controller {
  constructor(private readonly ${lcName}Service: ${name}Service) {}
}
`;

// --- Template Module ---
const moduleTemplate = `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${name}Service } from './${lcName}.service';
import { ${name}Controller } from './${lcName}.controller';
import { ${name} } from './${lcName}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${name}])],
  controllers: [${name}Controller],
  providers: [${name}Service],
})
export class ${name}Module {}
`;

// --- Tạo file ---
fs.writeFileSync(path.join(folder, `${lcName}.entity.ts`), entityTemplate);
fs.writeFileSync(path.join(folder, `${lcName}.service.ts`), serviceTemplate);
fs.writeFileSync(
  path.join(folder, `${lcName}.controller.ts`),
  controllerTemplate,
);
fs.writeFileSync(path.join(folder, `${lcName}.module.ts`), moduleTemplate);

console.log(`✅ 4 file của resource ${name} đã được tạo.`);

// --- Cập nhật AppModule ---
const appModulePath = path.join(__dirname, '..', 'src', 'app.module.ts');
let appModuleContent = fs.readFileSync(appModulePath, 'utf-8');

// Thêm import nếu chưa có
if (!appModuleContent.includes(`${name}Module`)) {
  const importLine = `import { ${name}Module } from './${lcName}/${lcName}.module';\n`;
  appModuleContent = importLine + appModuleContent;
}

// Chèn module vào imports array
appModuleContent = appModuleContent.replace(
  /imports:\s*\[([^\]]*)\]/,
  (match, p1) => {
    // Nếu module chưa tồn tại trong imports, thêm vào đầu
    if (!p1.includes(`${name}Module`)) {
      return `imports: [${name}Module${p1 ? ', ' + p1 : ''}]`;
    }
    return match;
  },
);

fs.writeFileSync(appModulePath, appModuleContent);

console.log(`✅ ${name}Module đã được thêm vào AppModule.`);
console.log('🎉 Hoàn tất tạo resource theo template và cập nhật AppModule.');
