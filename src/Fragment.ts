import * as _ from 'lodash';
import * as typescript from  'typescript';
import * as path from 'path';
import * as fs from 'fs';

// TODO:
// Create directory to file you are writing to
// Convert Namespace.Type to appropriate name of Namespace_Type
// Move require to the fragment call

export function generateFragments(rootPath:string) {
  rootPath = path.resolve(rootPath);
  const program = typescript.createProgram([rootPath], {});
  const files = program.getSourceFiles();
  const checker = program.getTypeChecker();

  // Get the declaration of the fragment function contained in this file
  const fragmentDeclaration = getFragmentDeclaration(files);

  if (!fragmentDeclaration) {
    throw new Error(`ts2gql.fragments is not imported and used anywhere in this program`);
  }

  const calls = files.map(file => ({
    filePath: file.fileName,
    calls: collectFragmentCalls(file, checker, fragmentDeclaration),
  }));

  calls.forEach(file => {
    file.calls.forEach(call => {
      const gqlPath = path.resolve(file.filePath, call.relativePath);
      const fileName = path.basename(gqlPath, path.extname(gqlPath));
      const stream = fs.createWriteStream(gqlPath, { autoClose: false } as any);
      stream.write(`fragment ${fileName} on ${call.baseName} {\n`);
      emitFields(call.properties, stream);
      stream.write('}\n');
      console.log(`Created fragment at ${gqlPath}`);
    });
  });
}

function getFragmentDeclaration(files:typescript.SourceFile[]) {
  let fragmentDeclaration:typescript.FunctionDeclaration|null = null;
  const thisTypeFile = files.find(f => f.fileName === `${__filename.substr(0, __filename.length - 3)}.d.ts`);
  thisTypeFile.forEachChild(child => {
    if (child.kind !== typescript.SyntaxKind.FunctionDeclaration) return;
    const declaration = child as typescript.FunctionDeclaration;
    if (declaration.name.text === 'fragment') {
      fragmentDeclaration = declaration;
    }
  });
  return fragmentDeclaration;
}

function emitFields(fields:Field[], stream:NodeJS.WritableStream, indent = '  ') {
  fields.forEach(field => {
    if (field.subfields) {
      stream.write(`${indent}${field.name} {\n`);
      emitFields(field.subfields, stream, `${indent}  `);
      stream.write(`${indent}}\n`);
    } else {
      stream.write(`${indent}${field.name}\n`);
    }
  });
}

interface FragmentCall {
  properties:Field[];
  baseName:string;
  relativePath:string;
}

function collectFragmentCalls(node:typescript.Node, checker:typescript.TypeChecker, fragmentDeclaration:typescript.FunctionDeclaration) {

  let calls:FragmentCall[] = [];
  typescript.forEachChild(node, child => {
    const childCalls = collectFragmentCalls(child, checker, fragmentDeclaration);
    if (childCalls) {
      calls = calls.concat(childCalls);
    }
    if (child.kind !== typescript.SyntaxKind.CallExpression) return null;
    const call = child as typescript.CallExpression;

    const symbol = checker.getSymbolAtLocation(call.expression);

    if (!symbol) return null;

    const type = checker.getTypeOfSymbolAtLocation(symbol, call.expression);

    if (type.symbol.valueDeclaration !== fragmentDeclaration) return null;

    if (call.typeArguments.length !== 2) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)) should have two type arguments');
    }
    if (call.arguments.length !== 1) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)): Must have one argument');
    }

    const data = call.typeArguments[0];
    if (data.kind !== typescript.SyntaxKind.TypeReference) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)): TFragment must be a TypeReference');
    }
    const base = call.typeArguments[1];
    if (base.kind !== typescript.SyntaxKind.TypeReference) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)): TFragmentBase must be a TypeReference');
    }
    const argument = call.arguments[0];
    if (argument.kind !== typescript.SyntaxKind.CallExpression) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)): First argument must be a require call');
    }
    const requireCall = argument as typescript.CallExpression;
    if (requireCall.arguments.length !== 1) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)): Require call must have 1 argument');
    }
    const gqlToken = requireCall.arguments[0];
    if (gqlToken.kind !== typescript.SyntaxKind.StringLiteral) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)): Require call argument must be a string literal');
    }
    const relativePath = (gqlToken as typescript.StringLiteral).text;

    const properties = collectProperties(data, checker);
    const baseName = ((base as typescript.TypeReferenceNode).typeName as typescript.Identifier).text;

    calls.push({
      properties,
      baseName,
      relativePath,
    });
  });
  return calls;
}

interface Field {
  name:string;
  subfields:Field[];
}

function collectProperties(typeNode:typescript.TypeNode, checker:typescript.TypeChecker) {
  const fields:Field[] = [];
  const type = checker.getTypeFromTypeNode(typeNode);

  // For unstructured types (like string, number, etc) we don't need to loop through their properties
  if (!(type.flags & typescript.TypeFlags.StructuredType)) return null;
  const properties = checker.getPropertiesOfType(type);

  properties.forEach(symbol => {
    let subfields = null;
    if (symbol.valueDeclaration) {
      if (symbol.valueDeclaration.kind === typescript.SyntaxKind.PropertySignature) {
        const propertySignature = symbol.valueDeclaration as typescript.PropertySignature;
        subfields = collectProperties(propertySignature.type, checker);
      }
    }
    fields.push({ name: symbol.name, subfields });
  });
  return fields;
}

export function fragment<TFragment extends Partial<TFragmentBase>, TFragmentBase>(document:any) {
  return document;
}
