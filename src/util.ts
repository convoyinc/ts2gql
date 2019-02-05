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

export function hasDocTag(node:types.TranspiledNode, prefix:string):boolean {
  return !!getDocTag(node, prefix);
}

export function getDocTag(node:types.TranspiledNode, prefix:string):string|null {
  if (!node.documentation) return null;
  for (const tag of node.documentation.tags) {
    if (tag.title !== 'graphql') continue;
    if (tag.description.startsWith(prefix)) return tag.description;
  }
  return null;
}

export function isOutputType(node:types.TypeNode):node is types.OutputTypeNode {
  if (isWrappingType(node)) {
    return isOutputType(node.wrapped);
  }
  return node.kind === types.GQLNodeKind.ENUM_TYPE || node.kind === types.GQLNodeKind.UNION_TYPE ||
  node.kind === types.GQLNodeKind.INTERFACE_TYPE || node.kind === types.GQLNodeKind.OBJECT_TYPE || isScalar(node);
}

export function isInputType(node:types.TypeNode):node is types.InputTypeNode {
  if (isWrappingType(node)) {
    return isInputType(node.wrapped);
  }
  return node.kind === types.GQLNodeKind.ENUM_TYPE || node.kind === types.GQLNodeKind.INPUT_OBJECT_TYPE
   || isScalar(node);
}

export function isScalar(node:types.TypeNode):node is types.ScalarTypeNode {
  return node.kind === types.GQLNodeKind.CUSTOM_SCALAR_TYPE || isBuiltInScalar(node);
}

export function isBuiltInScalar(node:types.TypeNode):node is types.BuiltInScalarTypeNode {
  return node.kind === types.GQLNodeKind.STRING_TYPE || node.kind === types.GQLNodeKind.INT_TYPE
  || node.kind === types.GQLNodeKind.FLOAT_TYPE || node.kind === types.GQLNodeKind.BOOLEAN_TYPE;
}

export function isWrappingType(node:types.TypeNode):node is types.WrappingTypeNode {
  return node.kind === types.GQLNodeKind.LIST_TYPE;
}
