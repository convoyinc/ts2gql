"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var typescript = require("typescript");
var path = require("path");
var util = require("./util");
var Collector_1 = require("./Collector");
var Emitter_1 = require("./Emitter");
function load(schemaRootPath, rootNodeNames) {
    var e_1, _a;
    schemaRootPath = path.resolve(schemaRootPath);
    var program = typescript.createProgram([schemaRootPath], {});
    var schemaRoot = program.getSourceFile(schemaRootPath);
    var interfaces = {};
    typescript.forEachChild(schemaRoot, function (node) {
        if (!isNodeExported(node))
            return;
        if (node.kind === typescript.SyntaxKind.InterfaceDeclaration) {
            var interfaceNode = node;
            interfaces[interfaceNode.name.text] = interfaceNode;
            var documentation = util.documentationForNode(interfaceNode, schemaRoot.text);
            if (documentation && _.find(documentation.tags, { title: 'graphql', description: 'schema' })) {
                rootNodeNames.push(interfaceNode.name.text);
            }
        }
    });
    rootNodeNames = _.uniq(rootNodeNames);
    var collector = new Collector_1.default(program);
    try {
        for (var rootNodeNames_1 = __values(rootNodeNames), rootNodeNames_1_1 = rootNodeNames_1.next(); !rootNodeNames_1_1.done; rootNodeNames_1_1 = rootNodeNames_1.next()) {
            var name = rootNodeNames_1_1.value;
            var rootInterface = interfaces[name];
            if (!rootInterface) {
                throw new Error("No interface named " + name + " was exported by " + schemaRootPath);
            }
            collector.addRootNode(rootInterface);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (rootNodeNames_1_1 && !rootNodeNames_1_1.done && (_a = rootNodeNames_1.return)) _a.call(rootNodeNames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    _.each(interfaces, function (node, name) {
        var documentation = util.documentationForNode(node);
        if (!documentation)
            return;
        var override = _.find(documentation.tags, function (t) { return t.title === 'graphql' && t.description.startsWith('override'); });
        if (!override)
            return;
        var overrideName = override.description.split(' ')[1] || name;
        collector.mergeOverrides(node, overrideName);
    });
    return collector.types;
}
exports.load = load;
function emit(schemaRootPath, rootNodeNames, stream) {
    if (stream === void 0) { stream = process.stdout; }
    var loadedTypes = load(schemaRootPath, rootNodeNames);
    var emitter = new Emitter_1.default(loadedTypes);
    emitter.emitAll(stream);
}
exports.emit = emit;
function isNodeExported(node) {
    return !!node.modifiers && node.modifiers.some(function (m) { return m.kind === typescript.SyntaxKind.ExportKeyword; });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsMEJBQTRCO0FBQzVCLHVDQUF5QztBQUN6QywyQkFBNkI7QUFHN0IsNkJBQStCO0FBQy9CLHlDQUFvQztBQUNwQyxxQ0FBZ0M7QUFFaEMsY0FBcUIsY0FBcUIsRUFBRSxhQUFzQjs7SUFDaEUsY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDOUMsSUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLGFBQWEsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLENBQUM7SUFFekQsSUFBTSxVQUFVLEdBQWtELEVBQUUsQ0FBQztJQUNyRSxVQUFVLENBQUMsWUFBWSxDQUFDLFVBQWlCLEVBQUUsVUFBQyxJQUFRO1FBQ2xELElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO1lBQUUsT0FBTztRQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsRUFBRTtZQUM1RCxJQUFNLGFBQWEsR0FBb0MsSUFBSSxDQUFDO1lBQzVELFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQztZQUVwRCxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxFQUFFLFVBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqRixJQUFJLGFBQWEsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsRUFBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUMsQ0FBQyxFQUFFO2dCQUMxRixhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDN0M7U0FDRjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsYUFBYSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFdEMsSUFBTSxTQUFTLEdBQUcsSUFBSSxtQkFBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDOztRQUN6QyxLQUFtQixJQUFBLGtCQUFBLFNBQUEsYUFBYSxDQUFBLDRDQUFBLHVFQUFFO1lBQTdCLElBQU0sSUFBSSwwQkFBQTtZQUNiLElBQU0sYUFBYSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyQyxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUFzQixJQUFJLHlCQUFvQixjQUFnQixDQUFDLENBQUM7YUFDakY7WUFDRCxTQUFTLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQ3RDOzs7Ozs7Ozs7SUFFRCxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxVQUFDLElBQUksRUFBRSxJQUFJO1FBQzVCLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxJQUFJLENBQUMsYUFBYTtZQUFFLE9BQU87UUFDM0IsSUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLEtBQUssS0FBSyxTQUFTLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQTdELENBQTZELENBQUMsQ0FBQztRQUNoSCxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU87UUFDdEIsSUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSyxDQUFDO1FBQ2pFLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQy9DLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFDO0FBQ3pCLENBQUM7QUF4Q0Qsb0JBd0NDO0FBRUQsY0FDRSxjQUFxQixFQUNyQixhQUFzQixFQUN0QixNQUE2QztJQUE3Qyx1QkFBQSxFQUFBLFNBQStCLE9BQU8sQ0FBQyxNQUFNO0lBRTdDLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDeEQsSUFBTSxPQUFPLEdBQUcsSUFBSSxpQkFBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3pDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDMUIsQ0FBQztBQVJELG9CQVFDO0FBRUQsd0JBQXdCLElBQW9CO0lBQzFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUE5QyxDQUE4QyxDQUFDLENBQUM7QUFDdEcsQ0FBQyJ9