#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, 'src');

if (!fs.existsSync(srcDir)) {
  console.error('[test:build] src/ not found. Run from project root.');
  process.exit(1);
}

const serviceFiles = [];
const isDryRun = process.argv.includes('--dry-run');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile()) {
      if (
        entry.name.endsWith('.service.ts') &&
        !entry.name.endsWith('.service.spec.ts')
      ) {
        serviceFiles.push(fullPath);
      }
    }
  }
}

walk(srcDir);

function hasModifier(node, kind) {
  return (node.modifiers || []).some((modifier) => modifier.kind === kind);
}

function getMethodName(nameNode) {
  if (!nameNode) {
    return null;
  }
  if (ts.isIdentifier(nameNode)) {
    return nameNode.text;
  }
  if (ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
    return nameNode.text;
  }
  return null;
}

function extractClassInfo(filePath, content) {
  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const classes = [];
  let serviceClass = null;

  function visit(node) {
    if (ts.isClassDeclaration(node) && node.name) {
      classes.push(node);
      if (!serviceClass && node.name.text.endsWith('Service')) {
        serviceClass = node;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);

  const targetClass = serviceClass || classes[0];
  if (!targetClass || !targetClass.name) {
    return null;
  }

  const className = targetClass.name.text;
  const methods = [];

  for (const member of targetClass.members) {
    if (ts.isConstructorDeclaration(member)) {
      continue;
    }
    if (!ts.isMethodDeclaration(member)) {
      continue;
    }
    if (
      hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
      hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ||
      hasModifier(member, ts.SyntaxKind.StaticKeyword)
    ) {
      continue;
    }
    const name = getMethodName(member.name);
    if (!name) {
      continue;
    }
    methods.push(name);
  }

  return { className, methods };
}

function extractTestTitles(specText) {
  const titles = [];
  const regex =
    /\b(?:it|test|describe)(?:\.(?:only|skip|todo))?\s*\(\s*(['"`])([^'"`]+)\1/g;
  let match;
  while ((match = regex.exec(specText)) !== null) {
    titles.push(match[2]);
  }
  return titles;
}

function findDescribeBlock(specText, filePath, className) {
  const source = ts.createSourceFile(
    filePath,
    specText,
    ts.ScriptTarget.Latest,
    true,
  );
  let found = null;

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === 'describe') {
        const [titleArg, fnArg] = node.arguments;
        if (
          titleArg &&
          ts.isStringLiteral(titleArg) &&
          titleArg.text === className &&
          fnArg &&
          (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg)) &&
          ts.isBlock(fnArg.body)
        ) {
          found = fnArg.body;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

function detectIndent(specText, block) {
  const blockText = specText.slice(block.getStart(), block.getEnd());
  const statementMatch = blockText.match(
    /\n([ \t]+)(?:it|test|describe|beforeEach|afterEach)\b/,
  );
  if (statementMatch) {
    return statementMatch[1];
  }
  const blockStart = block.getStart();
  const lineStart = specText.lastIndexOf('\n', blockStart);
  const line = specText.slice(lineStart + 1, blockStart);
  const baseIndentMatch = line.match(/^\s*/);
  return (baseIndentMatch ? baseIndentMatch[0] : '') + '  ';
}

let created = 0;
let updated = 0;
let skipped = 0;

for (const serviceFile of serviceFiles) {
  const serviceText = fs.readFileSync(serviceFile, 'utf8');
  const classInfo = extractClassInfo(serviceFile, serviceText);
  if (!classInfo || classInfo.methods.length === 0) {
    skipped += 1;
    continue;
  }

  const specFile = serviceFile.replace(/\.service\.ts$/, '.service.spec.ts');
  const specExists = fs.existsSync(specFile);
  const specText = specExists ? fs.readFileSync(specFile, 'utf8') : '';
  const titles = specExists ? extractTestTitles(specText) : [];
  const missing = classInfo.methods.filter(
    (method) => !titles.some((title) => title.includes(method)),
  );

  if (missing.length === 0) {
    skipped += 1;
    continue;
  }

  if (!specExists) {
    const lines = [
      `describe('${classInfo.className}', () => {`,
      ...missing.map((method) => `  it.todo('${method}');`),
      '});',
      '',
    ];
    if (!isDryRun) {
      fs.writeFileSync(specFile, lines.join('\n'), 'utf8');
    }
    created += 1;
    continue;
  }

  const describeBlock = findDescribeBlock(
    specText,
    specFile,
    classInfo.className,
  );
  if (!describeBlock) {
    const lines = [
      specText.trimEnd(),
      '',
      `describe('${classInfo.className}', () => {`,
      ...missing.map((method) => `  it.todo('${method}');`),
      '});',
      '',
    ];
    if (!isDryRun) {
      fs.writeFileSync(specFile, lines.join('\n'), 'utf8');
    }
    updated += 1;
    continue;
  }

  const indent = detectIndent(specText, describeBlock);
  const insertPos = describeBlock.getEnd() - 1;
  const todoLines = missing.map((method) => `${indent}it.todo('${method}');`);
  const insertText = `${specText.slice(0, insertPos)}${
    specText.slice(0, insertPos).endsWith('\n') ? '' : '\n'
  }${todoLines.join('\n')}\n${specText.slice(insertPos)}`;

  if (!isDryRun) {
    fs.writeFileSync(specFile, insertText, 'utf8');
  }
  updated += 1;
}

console.log(
  `[test:build]${isDryRun ? ' dry-run' : ''} created ${created}, updated ${updated}, skipped ${skipped}`,
);
