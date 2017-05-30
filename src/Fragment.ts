import * as _ from 'lodash';
import * as typescript from  'typescript';
import * as path from 'path';

// Find files that import { fragment } from '@convoy/ts2gql'
// Log that '* as' is not supported
// Support 'as' in import

export function generateFragments(rootPath:string) {
  rootPath = path.resolve(rootPath);
  const program = typescript.createProgram([rootPath], {});
  const files = program.getSourceFiles();
  const checker = program.getTypeChecker();

  const calls = files.map(file => ({
    filePath: file.fileName,
    calls: collectFromFile(file, checker, rootPath),
  }));

  calls.forEach(file => {
    file.calls.forEach(call => {
      const gqlPath = path.resolve(file.filePath, call.relativePath);
      const fileName = path.basename(gqlPath, path.extname(gqlPath));
      console.log(gqlPath);
      console.log(`fragment ${fileName} on ${call.baseName} {`);
      emitFields(call.properties);
      console.log('}');
    });
  });
}

function emitFields(fields, indent = '  ') {
  fields.forEach(field => {
    if (field.subfields) {
      console.log(`${indent}${field.name} {`);
      emitFields(field.subfields, `${indent}  `);
      console.log(`${indent}}`);
    } else {
      console.log(`${indent}${field.name}`);
    }
  });
}

function collectFromFile(file:typescript.SourceFile, checker:typescript.TypeChecker, rootPath:string) {
  // Find the actual fragment function call imported from ts2gql
  let fragmentIdentifier;
  typescript.forEachChild(file, child => {
    if (child.kind === typescript.SyntaxKind.ImportDeclaration) {
      const declaration = child as typescript.ImportDeclaration;
      // TODO config @convoy/ts2gql
      if ((declaration.moduleSpecifier as typescript.StringLiteral).text === '../src') {
        const bindings = (declaration.importClause as typescript.ImportClause).namedBindings as typescript.NamedImports;
        const elements = bindings.elements as typescript.ImportSpecifier[];
        const importSpecifier = _.find(elements, element => (element.propertyName || element.name).text === 'fragment');
        if (!importSpecifier) return null;
        fragmentIdentifier = importSpecifier.name;
      }
    }
  });
  if (!fragmentIdentifier) return [];
  return collectFragmentCalls(file, checker, fragmentIdentifier.text);
}

function collectFragmentCalls(node:typescript.Node, checker:typescript.TypeChecker, fragmentCallIdentifier:string) {
  let calls = [];
  typescript.forEachChild(node, child => {
    const childCalls = collectFragmentCalls(child, checker, fragmentCallIdentifier);
    if (childCalls) {
      calls = calls.concat(childCalls);
    }
    if (child.kind !== typescript.SyntaxKind.CallExpression) return null;
    const call = child as typescript.CallExpression;

    // TODO Can we get the actual symbol?
    if ((call.expression as typescript.Identifier).text !== fragmentCallIdentifier) return null;
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

function collectProperties(typeNode:typescript.TypeNode, checker:typescript.TypeChecker) {
  const fields = [];
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

export function fragment<TFragment, TFragmentBase>(document:any) {
  return document;
}
