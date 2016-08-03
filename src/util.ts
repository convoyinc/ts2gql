import * as _ from 'lodash';
import * as doctrine from 'doctrine';
import * as typescript from 'typescript';

export function documentationForNode(node:typescript.Node):doctrine.ParseResult {
  const source = node.getSourceFile().text;
  const commentRanges = typescript.getLeadingCommentRanges(source, node.getFullStart());
  // We only care about the closest comment to the node.
  const lastRange = _.last(commentRanges);
  if (!lastRange) return null;
  const comment = source.substr(lastRange.pos, lastRange.end - lastRange.pos).trim();

  return doctrine.parse(comment, {unwrap: true});
}
