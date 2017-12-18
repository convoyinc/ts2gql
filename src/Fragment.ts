import * as typescript from  'typescript';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';

export function generateFragments(rootPath:string) {
  rootPath = path.resolve(rootPath);
  const program = typescript.createProgram([rootPath], {
    jsx: typescript.JsxEmit.React,
  });
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
      mkdirp.sync(path.dirname(gqlPath));

      let contents = '';
      contents += `fragment ${fileName} on ${call.baseName} {\n`;
      contents += emitFields(call.properties);
      contents += '}\n';
      fs.writeFileSync(gqlPath, contents);
      console.log(`Created fragment at ${gqlPath}`); // tslint:disable-line
    });
  });
}

function getFragmentDeclaration(files:ReadonlyArray<typescript.SourceFile>):typescript.FunctionDeclaration|null {
  let fragmentDeclaration:typescript.FunctionDeclaration|null = null;
  // Looks for this file's (src/Fragment.ts's) .d.ts file to see if the fragment function
  // is called
  const thisTypeFile = files.find(f => f.fileName === `${__filename.substr(0, __filename.length - 3)}.d.ts`);
  if (!thisTypeFile) {
    throw new Error(`ts2gqlfragment is not imported in the project`);
  }
  thisTypeFile.forEachChild(child => {
    if (child.kind !== typescript.SyntaxKind.FunctionDeclaration) return;
    const declaration = child as typescript.FunctionDeclaration;
    if (declaration.name!.text === 'fragment') {
      fragmentDeclaration = declaration;
    }
  });
  return fragmentDeclaration;
}

function emitFields(fields:Field[], indent = '  ') {
  let contents = '';
  fields.forEach(field => {
    if (field.subfields.length) {
      contents += `${indent}${field.name} {\n`;
      contents += emitFields(field.subfields, `${indent}  `);
      contents += `${indent}}\n`;
    } else {
      contents += `${indent}${field.name}\n`;
    }
  });
  return contents;
}

interface FragmentCall {
  properties:Field[];
  baseName:string;
  relativePath:string;
}

function collectFragmentCalls(
  node:typescript.Node,
  checker:typescript.TypeChecker,
  fragmentDeclaration:typescript.FunctionDeclaration,
) {

  let calls:FragmentCall[] = [];
  typescript.forEachChild(node, child => {
    const childCalls = collectFragmentCalls(child, checker, fragmentDeclaration);
    if (childCalls) {
      calls = calls.concat(childCalls);
    }
    if (child.kind !== typescript.SyntaxKind.CallExpression) return;
    const call = child as typescript.CallExpression;

    const symbol = checker.getSymbolAtLocation(call.expression);

    if (!symbol) return;

    const type = checker.getTypeOfSymbolAtLocation(symbol, call.expression);

    // Short-circuit if a function call is not to ts2gql's fragment function
    if (!type.symbol || type.symbol.valueDeclaration !== fragmentDeclaration) return;

    if (!call.typeArguments || call.typeArguments.length !== 2) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(graphQLFilePath) should have two type arguments');
    }
    if (call.arguments.length !== 1) {
      throw new Error('ts2gql.fragment<TFragment, TFragmentBase>(graphQLFilePath): Must have one argument');
    }

    const data = call.typeArguments[0];
    if (data.kind !== typescript.SyntaxKind.TypeReference) {
      throw new Error(`ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)):` +
        `TFragment must be a TypeReference`);
    }
    const base = call.typeArguments[1];
    if (base.kind !== typescript.SyntaxKind.TypeReference) {
      throw new Error(`ts2gql.fragment<TFragment, TFragmentBase>(require(relGQLPath)):` +
        `TFragmentBase must be a TypeReference`);
    }
    const gqlToken = call.arguments[0];
    const relativePath = (gqlToken as typescript.StringLiteral).text;

    const propertyType = checker.getTypeFromTypeNode(data);
    const properties = collectProperties(propertyType, checker, data);
    const baseNameRaw = ((base as typescript.TypeReferenceNode).typeName as typescript.Identifier).text;
    const baseName = baseNameRaw.replace(/\W/g, '_');

    calls.push({
      properties,
      baseName,
      relativePath,
    });
    return;
  });
  return calls;
}

interface Field {
  name:string;
  subfields:Field[];
}

function collectProperties(type:typescript.Type, checker:typescript.TypeChecker, typeNode:typescript.TypeNode):Field[] {
  const fields:Field[] = [];

  // For Arrays we want to use the type of the array
  if (type.symbol && type.symbol.name === 'Array') {
    const arrayType = type as typescript.TypeReference;
    type = arrayType.typeArguments![0];
  }

  // For unstructured types (like string, number, etc) we don't need to loop through their properties
  if (!(type.flags & typescript.TypeFlags.StructuredType)) return [];

  // A bit strange, but a boolean is a union of true and false therefore a StructuredType
  if (type.flags & typescript.TypeFlags.Boolean) return [];

  // For Date's we don't need to loop through their properties
  if (type.symbol && type.symbol.name === 'Date') return [];

  const properties = checker.getPropertiesOfType(type);

  properties.forEach(symbol => {
    const propertyType = checker.getTypeOfSymbolAtLocation(symbol, typeNode);
    const subfields = collectProperties(propertyType, checker, typeNode);
    fields.push({ name: symbol.name, subfields });
  });
  return fields;
}

export function fragment<TFragment extends Partial<TFragmentBase>, TFragmentBase>(filepath:string) {
  // Some pointless code to appease error TS6133: 'TFragment' is declared but its value is never read.
  const ignore:TFragment|null = null;
  if (ignore !== null) return;

  return require(filepath);
}
