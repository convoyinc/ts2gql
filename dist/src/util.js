"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var doctrine = require("doctrine");
var typescript = require("typescript");
function documentationForNode(node, source) {
    source = source || node.getSourceFile().text;
    var commentRanges = typescript.getLeadingCommentRanges(source, node.getFullStart());
    if (!commentRanges)
        return undefined;
    // We only care about the closest comment to the node.
    var lastRange = _.last(commentRanges);
    if (!lastRange)
        return undefined;
    var comment = source.substr(lastRange.pos, lastRange.end - lastRange.pos).trim();
    return doctrine.parse(comment, { unwrap: true });
}
exports.documentationForNode = documentationForNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLG1DQUFxQztBQUNyQyx1Q0FBeUM7QUFFekMsOEJBQXFDLElBQW9CLEVBQUUsTUFBYztJQUN2RSxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDN0MsSUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUMsYUFBYTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQ3JDLHNEQUFzRDtJQUN0RCxJQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3hDLElBQUksQ0FBQyxTQUFTO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDakMsSUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRW5GLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBVkQsb0RBVUMifQ==