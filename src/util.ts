import * as _ from 'lodash';
import * as doctrine from 'doctrine';
import * as typescript from 'typescript';
import * as types from './types';

export function documentationForNode(node:typescript.Node, source?:string):doctrine.ParseResult|undefined {
  source = source || node.getSourceFile().text;
  const commentRanges = typescript.getLeadingCommentRanges(source, node.getFullStart());
  if (!commentRanges) return undefined;
  // We only care about the closest comment to the node.
  const lastRange = _.last(commentRanges);
  if (!lastRange) return undefined;
  const comment = source.substr(lastRange.pos, lastRange.end - lastRange.pos).trim();

  return doctrine.parse(comment, {unwrap: true});
}

export function hasDocTag(node:types.TranspiledNode, regex:RegExp):boolean {
  return !!extractTagDescription(node.documentation, regex);
}

export function extractTagDescription(doc:doctrine.ParseResult|undefined, regex:RegExp):string|null {
  if (!doc) return null;
  const found = doc.tags.find((tag) => {
    return tag.title === 'graphql' && regex.test(tag.description);
  });
  return found ? found.description : null;
}

export function isReferenceType(node:types.TypeNode):node is types.ReferenceTypeNode {
  return node.kind === types.GQLTypeKind.OBJECT_TYPE || node.kind === types.GQLTypeKind.INTERFACE_TYPE ||
  node.kind === types.GQLTypeKind.ENUM_TYPE || node.kind === types.GQLTypeKind.INPUT_OBJECT_TYPE ||
  node.kind === types.GQLTypeKind.UNION_TYPE || node.kind === types.GQLTypeKind.CUSTOM_SCALAR_TYPE;
}

export function isNullableDefinition(node:types.TypeDefinitionNode):node is types.UnionTypeDefinitionNode |
types.ScalarTypeDefinitionNode  | types.DefinitionAliasNode {
  return node.kind === types.GQLDefinitionKind.UNION_DEFINITION
  || node.kind === types.GQLDefinitionKind.SCALAR_DEFINITION || node.kind === types.GQLDefinitionKind.DEFINITION_ALIAS;
}

export function isOutputType(node:types.TypeNode):node is types.OutputTypeNode {
  if (isWrappingType(node)) {
    return isOutputType(node.wrapped);
  }
  return node.kind === types.GQLTypeKind.ENUM_TYPE || node.kind === types.GQLTypeKind.UNION_TYPE ||
  node.kind === types.GQLTypeKind.INTERFACE_TYPE || node.kind === types.GQLTypeKind.OBJECT_TYPE || isScalar(node);
}

export function isInputType(node:types.TypeNode):node is types.InputTypeNode {
  if (isWrappingType(node)) {
    return isInputType(node.wrapped);
  }
  return node.kind === types.GQLTypeKind.ENUM_TYPE || node.kind === types.GQLTypeKind.INPUT_OBJECT_TYPE
   || isScalar(node);
}

export function isScalar(node:types.TypeNode):node is types.ScalarTypeNode {
  return node.kind === types.GQLTypeKind.CUSTOM_SCALAR_TYPE || isBuiltInScalar(node);
}

export function isBuiltInScalar(node:types.TypeNode):node is types.BuiltInScalarTypeNode {
  return node.kind === types.GQLTypeKind.STRING_TYPE || node.kind === types.GQLTypeKind.INT_TYPE
  || node.kind === types.GQLTypeKind.FLOAT_TYPE || node.kind === types.GQLTypeKind.BOOLEAN_TYPE
  || node.kind === types.GQLTypeKind.ID_TYPE;
}

export function isWrappingType(node:types.TypeNode):node is types.WrappingTypeNode {
  return node.kind === types.GQLTypeKind.LIST_TYPE;
}
