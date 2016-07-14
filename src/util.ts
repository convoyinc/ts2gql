import * as _ from 'lodash';
import * as doctrine from 'doctrine';
import * as typescript from 'typescript';

export function documentationForNode(node:typescript.Node):doctrine.ParseResult {
  const source = node.getSourceFile().text;
  const commentRanges = typescript.getLeadingCommentRanges(source, node.getFullStart());
  if (!commentRanges) return null;

  const mergedComment = _(commentRanges)
    .map(({pos, end}) => source.substr(pos, end - pos))
    .join('')
    .trim();

  return doctrine.parse(mergedComment, {unwrap: true});
}
