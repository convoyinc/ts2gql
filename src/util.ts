import * as _ from 'lodash';
import * as doctrine from 'doctrine';
import * as typescript from 'typescript';

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
