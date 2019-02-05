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

export function isPrimitive(node:types.Node):boolean {
  const unwrapped = unwrapNotNull(node);
  return unwrapped.type === types.NodeType.STRING || unwrapped.type === types.NodeType.NUMBER
  || unwrapped.type === types.NodeType.BOOLEAN || unwrapped.type === types.NodeType.ANY;
}

export function unwrapNotNull(node:types.Node):types.Node {
  let unwrapped = node;
  while (unwrapped.type === types.NodeType.NOT_NULL) {
    unwrapped = unwrapped.node;
  }
  return unwrapped;
}

export function wrapNotNull(node:types.Node):types.NotNullNode {
  if (node.type === types.NodeType.NOT_NULL) {
    return node;
  }
  return {
    type: types.NodeType.NOT_NULL,
    node,
  };
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
